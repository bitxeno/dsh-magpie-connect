import test from 'node:test'
import assert from 'node:assert/strict'
import {
  contentHasImage,
  requestImageTarget,
  toPiContext,
  toPiContextWithImages,
  type HarnessGenerateOptions,
  type HarnessMessage,
} from '../src/adapter/messages.ts'

function options(overrides: Partial<HarnessGenerateOptions> = {}): HarnessGenerateOptions {
  return { provider: 'dsh-magpie-connect', model: 'magpie-model', messages: [], ...overrides }
}

function imageMessage(): HarnessMessage {
  return {
    role: 'user',
    content: [
      { type: 'text', text: 'what is this?' },
      {
        type: 'image',
        attachment: { attachmentId: 'abc123', mediaType: 'image/png', bytes: 100, width: 800, height: 600, name: 'shot.png' },
      },
    ],
  }
}

const fakeAttachments = {
  async readImageRequest(ref: { attachmentId: string; mediaType: string; width: number; height: number }) {
    return { data: new Uint8Array([1, 2, 3]), mediaType: ref.mediaType, bytes: 3, width: ref.width, height: ref.height }
  },
}

test('system messages and options.system feed the system prompt', () => {
  const context = toPiContext(
    options({
      system: 'be helpful',
      messages: [{ role: 'system', content: [{ type: 'text', text: 'be helpful' }] }],
    }),
  )
  assert.equal(context.systemPrompt, 'be helpful')
  assert.equal(context.messages.length, 1)
  assert.deepEqual(context.messages[0], { role: 'user', content: 'be helpful', timestamp: 0 })
})

test('tool results become toolResult messages with the name from the prior toolCall', () => {
  const messages: HarnessMessage[] = [
    { role: 'user', content: [{ type: 'text', text: 'run it' }] },
    { role: 'assistant', content: [{ type: 'tool-call', id: 'call_1', name: 'shell', arguments: '{"cmd":"ls"}' }] },
    { role: 'user', content: [{ type: 'tool-result', toolCallId: 'call_1', content: [{ type: 'text', text: 'file.txt' }], isError: false }] },
  ]
  const context = toPiContext(options({ messages }))
  assert.equal(context.messages.length, 3)
  const toolResult = context.messages[2]
  assert.equal(toolResult?.role, 'toolResult')
  assert.deepEqual((toolResult as { content: unknown }).content, [{ type: 'text', text: 'file.txt' }])
})

test('assistant history replays text, thinking and tool calls with parsed arguments', () => {
  const messages: HarnessMessage[] = [
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'thinking out loud' },
        { type: 'reasoning', text: 'internal scratch' },
        { type: 'tool-call', id: 't1', name: 'calc', arguments: '{"a":1}' },
      ],
      source: { kind: 'model', provider: 'dsh-magpie-connect', model: 'm' },
    },
  ]
  const context = toPiContext(options({ messages }))
  const assistant = context.messages[0]
  assert.equal(assistant?.role, 'assistant')
  assert.deepEqual((assistant as { content: unknown }).content, [
    { type: 'text', text: 'thinking out loud' },
    { type: 'thinking', thinking: 'internal scratch' },
    { type: 'toolCall', id: 't1', name: 'calc', arguments: { a: 1 } },
  ])
})

test('assistant images cannot be replayed', () => {
  assert.throws(
    () =>
      toPiContext(
        options({
          messages: [{ role: 'assistant', content: [{ type: 'image' as never, attachment: {} as never } as never] }],
        }),
      ),
    /image/,
  )
})

test('text-only conversion refuses image blocks without resolved bytes', () => {
  assert.throws(() => toPiContext(options({ messages: [imageMessage()] })), /attachment service/)
})

test('contentHasImage detects retained images and ignores offloaded ones', () => {
  assert.equal(contentHasImage([imageMessage()]), true)
  assert.equal(contentHasImage([{ role: 'user', content: [{ type: 'text', text: 'hi' }] }]), false)
  assert.equal(
    contentHasImage([
      { role: 'user', content: [{ type: 'image', attachment: { attachmentId: 'x', mediaType: 'image/png', bytes: 1, width: 1, height: 1 }, offloaded: true }] },
    ]),
    false,
  )
})

test('requestImageTarget fits large images into the pixel budget', () => {
  assert.deepEqual(requestImageTarget({ attachmentId: 'a', mediaType: 'image/png', bytes: 1, width: 800, height: 600 }), {
    width: 800,
    height: 600,
    maxBytes: 1048576,
  })
  const scaled = requestImageTarget({ attachmentId: 'a', mediaType: 'image/png', bytes: 1, width: 8000, height: 6000 })
  assert.ok(scaled.width * scaled.height <= 2048 * 2048)
  assert.ok(scaled.width < 8000)
})

test('image-aware conversion emits handle text plus image bytes', async () => {
  const context = await toPiContextWithImages(options({ messages: [imageMessage()] }), fakeAttachments)
  assert.equal(context.messages.length, 1)
  const user = context.messages[0] as { role: string; content: unknown }
  assert.equal(user.role, 'user')
  const blocks = user.content as Array<{ type: string; text?: string; data?: string; mimeType?: string }>
  assert.equal(blocks[0]?.type, 'text')
  assert.equal(blocks[0]?.text, 'what is this?')
  assert.equal(blocks[1]?.type, 'text')
  assert.match(blocks[1]?.text ?? '', /shot\.png/)
  assert.equal(blocks[2]?.type, 'image')
  assert.equal(blocks[2]?.mimeType, 'image/png')
  assert.ok((blocks[2]?.data?.length ?? 0) > 0)
})

test('offloaded images degrade to placeholder text', async () => {
  const context = await toPiContextWithImages(
    options({
      messages: [
        { role: 'user', content: [{ type: 'image', attachment: { attachmentId: 'x', mediaType: 'image/png', bytes: 1, width: 10, height: 10 }, offloaded: true }] },
      ],
    }),
    fakeAttachments,
  )
  const user = context.messages[0] as { content: unknown }
  assert.deepEqual(user.content, '[image omitted (offloaded); attachment x]')
})

test('tools pass through and empty tool lists are omitted', () => {
  const withTools = toPiContext(options({ tools: [{ name: 'shell', description: 'run', parameters: { type: 'object' } }] }))
  assert.deepEqual(withTools.tools, [{ name: 'shell', description: 'run', parameters: { type: 'object' } }])
  const withoutTools = toPiContext(options())
  assert.equal(withoutTools.tools, undefined)
})

test('developer messages are skipped (tool updates ride options.tools)', async () => {
  const context = toPiContext(
    options({
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        { role: 'developer', content: [{ type: 'tool-addition', toolName: 'x' }] },
      ],
    }),
  )
  assert.equal(context.messages.length, 1)
})

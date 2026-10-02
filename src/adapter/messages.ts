/**
 * Harness GenerateOptions -> pi-ai Context conversion, with image support.
 *
 * Text-only requests convert synchronously (`toPiContext`); requests carrying
 * durable image blocks resolve bytes through the harness attachment service
 * (`toPiContextWithImages`, async). pi-ai then encodes images as OpenAI
 * `image_url` (completions) or `input_image` (responses) parts.
 */

import { modelApiForEntry } from './catalog.ts'

export interface ImageAttachmentRef {
  attachmentId: string
  mediaType: string
  bytes: number
  width: number
  height: number
  name?: string
}

export interface FileAttachmentRef {
  attachmentId: string
  name: string
  bytes: number
}

export interface HarnessTool {
  name: string
  description: string
  parameters: unknown
}

export type HarnessBlock =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; id: string; name: string; arguments: string }
  | { type: 'image'; attachment: ImageAttachmentRef; offloaded?: true; [key: string]: unknown }
  | { type: 'file'; attachment: FileAttachmentRef; [key: string]: unknown }
  | { type: 'tool-result'; toolCallId: string; content: HarnessBlock[]; isError?: boolean; [key: string]: unknown }
  | { type: string; [key: string]: unknown }

export interface HarnessMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'developer'
  content: HarnessBlock[]
  source?: { kind: string; provider?: string; model?: string; callId?: string; [key: string]: unknown }
  toolCallId?: string
  isError?: boolean
  [key: string]: unknown
}

export interface HarnessGenerateOptions {
  provider: string
  model: string
  messages: HarnessMessage[]
  system?: string
  tools?: HarnessTool[]
  maxTokens?: number
  temperature?: number
  reasoningEffort?: string
  signal?: AbortSignal
  [key: string]: unknown
}

/** pi-ai message vocabulary (subset we emit). */
export type PiMessage =
  | { role: 'user'; content: string | PiContentBlock[]; timestamp: number }
  | {
      role: 'assistant'
      content: PiAssistantBlock[]
      api: 'openai-completions' | 'openai-responses'
      provider: string
      model: string
      usage: PiUsage
      stopReason: 'stop' | 'toolUse'
      timestamp: number
    }
  | { role: 'toolResult'; toolCallId: string; toolName: string; content: PiContentBlock[]; isError: boolean; timestamp: number }

export type PiAssistantBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'toolCall'; id: string; name: string; arguments: Record<string, unknown> }

export type PiContentBlock = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }

export interface PiUsage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number }
}

export interface PiTool {
  name: string
  description: string
  parameters: unknown
}

export interface PiContext {
  systemPrompt?: string
  messages: PiMessage[]
  tools?: PiTool[]
}

/** Attachment service surface we consume (structural subset of dsh-attachment). */
export interface AttachmentStore {
  readImageRequest(
    ref: ImageAttachmentRef,
    target: { width: number; height: number; maxBytes: number },
    signal?: AbortSignal,
  ): Promise<{ data: Uint8Array; mediaType: string; bytes: number; width: number; height: number }>
}

export interface RequestImageVersion {
  data: Uint8Array
  mediaType: string
  bytes: number
  width: number
  height: number
}

const REQUEST_MAX_PIXELS = 2048 * 2048
const REQUEST_MAX_BYTES = 1024 * 1024

export function zeroUsage(): PiUsage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}

function parseArguments(raw: string): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.length === 0) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { value: parsed }
  } catch {
    return { raw }
  }
}

/** True when any message carries a retained (non-offloaded) image block. */
export function contentHasImage(messages: readonly HarnessMessage[]): boolean {
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'image' && (block as { offloaded?: unknown }).offloaded !== true) return true
    }
  }
  return false
}

/** Request target for one attachment: fit within the pixel budget, cap bytes. */
export function requestImageTarget(ref: ImageAttachmentRef): { width: number; height: number; maxBytes: number } {
  const pixels = ref.width * ref.height
  if (!(pixels > REQUEST_MAX_PIXELS) || !(ref.width > 0 && ref.height > 0)) {
    return { width: ref.width, height: ref.height, maxBytes: REQUEST_MAX_BYTES }
  }
  const scale = Math.sqrt(REQUEST_MAX_PIXELS / pixels)
  return { width: Math.max(1, Math.floor(ref.width * scale)), height: Math.max(1, Math.floor(ref.height * scale)), maxBytes: REQUEST_MAX_BYTES }
}

function imageHandleText(ref: ImageAttachmentRef, version: RequestImageVersion): string {
  const name = ref.name ?? `attachment ${String(ref.attachmentId).slice(0, 12)}`
  return `Image ${name}; request preview ${version.width}x${version.height}px.`
}

function offloadedImageText(ref: ImageAttachmentRef): string {
  const name = ref.name ?? `attachment ${String(ref.attachmentId).slice(0, 12)}`
  return `[image omitted (offloaded); ${name}]`
}

function toBase64(data: Uint8Array): string {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('base64')
}

/**
 * Resolve every retained image to request bytes. Offloaded occurrences need
 * no bytes (placeholder text only) and are skipped here.
 */
export async function prepareRequestImages(
  messages: readonly HarnessMessage[],
  attachments: AttachmentStore,
  signal?: AbortSignal,
): Promise<Map<string, RequestImageVersion>> {
  const refs = new Map<string, ImageAttachmentRef>()
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type !== 'image') continue
      const image = block as Extract<HarnessBlock, { type: 'image' }>
      if (image.offloaded === true) continue
      if (!refs.has(image.attachment.attachmentId)) refs.set(image.attachment.attachmentId, image.attachment)
    }
  }
  const versions = new Map<string, RequestImageVersion>()
  await Promise.all(
    [...refs.values()].map(async (ref) => {
      const prepared = await attachments.readImageRequest(ref, requestImageTarget(ref), signal)
      versions.set(ref.attachmentId, {
        data: prepared.data,
        mediaType: prepared.mediaType,
        bytes: prepared.bytes,
        width: prepared.width,
        height: prepared.height,
      })
    }),
  )
  return versions
}

/** User/tool-result content with images resolved to handle text + bytes. */
export function userContentWithImages(
  blocks: HarnessBlock[],
  requestImages: Map<string, RequestImageVersion>,
): string | PiContentBlock[] {
  const content: PiContentBlock[] = []
  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        if ((block as { text: string }).text.length > 0) content.push({ type: 'text', text: (block as { text: string }).text })
        break
      case 'image': {
        const image = block as Extract<HarnessBlock, { type: 'image' }>
        if (image.offloaded === true) {
          content.push({ type: 'text', text: offloadedImageText(image.attachment) })
          break
        }
        const version = requestImages.get(image.attachment.attachmentId)
        if (!version) {
          content.push({ type: 'text', text: offloadedImageText(image.attachment) })
          break
        }
        content.push({ type: 'text', text: imageHandleText(image.attachment, version) })
        content.push({ type: 'image', data: toBase64(version.data), mimeType: version.mediaType })
        break
      }
      case 'file': {
        const file = block as Extract<HarnessBlock, { type: 'file' }>
        content.push({ type: 'text', text: `[file: ${file.attachment.name} (${file.attachment.bytes} bytes)]` })
        break
      }
      case 'tool-result':
        content.push({ type: 'text', text: toolResultText((block as { content: HarnessBlock[] }).content) || '(no output)' })
        break
      default:
        break
    }
  }
  if (content.every((block) => block.type === 'text')) return content.map((block) => (block as { text: string }).text).join('')
  return content
}

function toPiAssistant(
  message: HarnessMessage,
  providerId: string,
  api: 'openai-completions' | 'openai-responses' = 'openai-completions',
): Extract<PiMessage, { role: 'assistant' }> {
  const content: PiAssistantBlock[] = []
  for (const block of message.content) {
    switch (block.type) {
      case 'text':
        content.push({ type: 'text', text: (block as { text: string }).text })
        break
      case 'reasoning':
        content.push({ type: 'thinking', thinking: (block as { text: string }).text })
        break
      case 'tool-call': {
        const call = block as { id: string; name: string; arguments: string }
        content.push({ type: 'toolCall', id: call.id, name: call.name, arguments: parseArguments(call.arguments) })
        break
      }
      case 'image':
        throw new Error('dsh-magpie-connect: assistant image output cannot be replayed to the model')
      default:
        break
    }
  }
  const source = message.source
  return {
    role: 'assistant',
    content,
    api,
    provider: source?.kind === 'model' && typeof source.provider === 'string' ? source.provider : providerId,
    model: source?.kind === 'model' && typeof source.model === 'string' ? source.model : providerId,
    usage: zeroUsage(),
    stopReason: content.some((block) => block.type === 'toolCall') ? 'toolUse' : 'stop',
    timestamp: 0,
  }
}

function flattenText(message: HarnessMessage): string {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { text: string }).text)
    .join('')
}

function toolResultText(blocks: HarnessBlock[]): string {
  return blocks
    .map((block) => (block.type === 'text' ? (block as { text: string }).text : block.type === 'tool-result' ? toolResultText((block as { content: HarnessBlock[] }).content) : ''))
    .join('')
}

function toolsOf(options: HarnessGenerateOptions): PiTool[] | undefined {
  const tools = options.tools?.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters }))
  return tools && tools.length > 0 ? tools : undefined
}

function assistantApiFor(options: HarnessGenerateOptions, entryEndpoints: readonly string[]): 'openai-completions' | 'openai-responses' {
  void options
  return modelApiForEntry(entryEndpoints)
}

/**
 * Text-only conversion (no image bytes needed). Images without resolved
 * bytes cannot be sent — callers must route image-bearing requests through
 * `toPiContextWithImages` instead.
 */
export function toPiContext(options: HarnessGenerateOptions, entryEndpoints: readonly string[] = []): PiContext {
  const providerId = options.provider
  const assistantApi = assistantApiFor(options, entryEndpoints)
  const toolNames = new Map<string, string>()
  const messages: PiMessage[] = []
  for (const message of options.messages) {
    if (message.role === 'system') {
      const text = flattenText(message)
      if (text.length > 0) messages.push({ role: 'user', content: text, timestamp: 0 })
      continue
    }
    if (message.role === 'assistant') {
      const assistant = toPiAssistant(message, providerId, assistantApi)
      for (const block of assistant.content) {
        if (block.type === 'toolCall') toolNames.set(block.id, block.name)
      }
      messages.push(assistant)
      continue
    }
    if (message.role === 'developer') continue
    if (message.role === 'tool') {
      const text = flattenText(message)
      messages.push({
        role: 'toolResult',
        toolCallId: message.toolCallId ?? '',
        toolName: message.toolCallId ? (toolNames.get(message.toolCallId) ?? 'unknown') : 'unknown',
        content: [{ type: 'text', text: text || '(no output)' }],
        isError: message.isError ?? false,
        timestamp: 0,
      })
      continue
    }
    for (const block of message.content) {
      if (block.type === 'image') {
        throw new Error('dsh-magpie-connect: image input requires the attachment service (use toPiContextWithImages)')
      }
      if (block.type === 'file') {
        // Files are projected to handle text by the harness; keep a stable
        // placeholder when one arrives unprojected.
        continue
      }
    }
    const text = flattenText(message)
    const fileText = message.content
      .filter((block) => block.type === 'file')
      .map((block) => `[file: ${(block as Extract<HarnessBlock, { type: 'file' }>).attachment.name}]`)
      .join('\n')
    const combined = [text, fileText].filter((part) => part.length > 0).join('\n')
    const results = message.content.filter((block) => block.type === 'tool-result') as Array<
      Extract<HarnessBlock, { type: 'tool-result' }>
    >
    if (combined.length > 0 || results.length === 0) {
      messages.push({ role: 'user', content: combined, timestamp: 0 })
    }
    for (const result of results) {
      messages.push({
        role: 'toolResult',
        toolCallId: result.toolCallId,
        toolName: toolNames.get(result.toolCallId) ?? 'unknown',
        content: [{ type: 'text', text: toolResultText(result.content) || '(no output)' }],
        isError: result.isError ?? false,
        timestamp: 0,
      })
    }
  }
  const context: PiContext = { messages }
  if (typeof options.system === 'string' && options.system.length > 0) context.systemPrompt = options.system
  const tools = toolsOf(options)
  if (tools) context.tools = tools
  return context
}

/**
 * Image-aware conversion: retained images resolve to request bytes via the
 * attachment service; offloaded images become placeholder text.
 */
export async function toPiContextWithImages(
  options: HarnessGenerateOptions,
  attachments: AttachmentStore,
  entryEndpoints: readonly string[] = [],
): Promise<PiContext> {
  const providerId = options.provider
  const assistantApi = assistantApiFor(options, entryEndpoints)
  const requestImages = await prepareRequestImages(options.messages, attachments, options.signal)
  const toolNames = new Map<string, string>()
  const messages: PiMessage[] = []
  for (const message of options.messages) {
    if (message.role === 'system') {
      const text = flattenText(message)
      if (text.length > 0) messages.push({ role: 'user', content: text, timestamp: 0 })
      continue
    }
    if (message.role === 'assistant') {
      const assistant = toPiAssistant(message, providerId, assistantApi)
      for (const block of assistant.content) {
        if (block.type === 'toolCall') toolNames.set(block.id, block.name)
      }
      messages.push(assistant)
      continue
    }
    if (message.role === 'developer') continue
    if (message.role === 'tool') {
      messages.push({
        role: 'toolResult',
        toolCallId: message.toolCallId ?? '',
        toolName: message.toolCallId ? (toolNames.get(message.toolCallId) ?? 'unknown') : 'unknown',
        content: userContentToBlocks(message.content, requestImages),
        isError: message.isError ?? false,
        timestamp: 0,
      })
      continue
    }
    const content = userContentWithImages(message.content, requestImages)
    const results = message.content.filter((block) => block.type === 'tool-result') as Array<
      Extract<HarnessBlock, { type: 'tool-result' }>
    >
    // userContentWithImages already folds nested tool-results to text; emit
    // first-class toolResult messages for pi-ai tool continuity.
    if (typeof content === 'string' ? content.length > 0 || results.length === 0 : true) {
      messages.push({ role: 'user', content, timestamp: 0 })
    } else if (typeof content === 'string' && content.length === 0 && results.length === 0) {
      messages.push({ role: 'user', content, timestamp: 0 })
    }
    for (const result of results) {
      messages.push({
        role: 'toolResult',
        toolCallId: result.toolCallId,
        toolName: toolNames.get(result.toolCallId) ?? 'unknown',
        content: userContentToBlocks(result.content, requestImages),
        isError: result.isError ?? false,
        timestamp: 0,
      })
    }
  }
  const context: PiContext = { messages }
  if (typeof options.system === 'string' && options.system.length > 0) context.systemPrompt = options.system
  const tools = toolsOf(options)
  if (tools) context.tools = tools
  return context
}

function userContentToBlocks(blocks: HarnessBlock[], requestImages: Map<string, RequestImageVersion>): PiContentBlock[] {
  const converted = userContentWithImages(blocks, requestImages)
  if (typeof converted === 'string') return [{ type: 'text', text: converted || '(no output)' }]
  return converted.length > 0 ? converted : [{ type: 'text', text: '(no output)' }]
}

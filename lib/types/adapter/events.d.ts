/**
 * pi-ai AssistantMessageEvent -> harness StreamChunks.
 * The chunk stream must end with `usage` then `finish`.
 */
export type HarnessChunk = {
    type: 'block-start';
    index: number;
    blockType: 'text' | 'reasoning' | 'tool-call';
} | {
    type: 'text-delta';
    index: number;
    text: string;
} | {
    type: 'block-end';
    index: number;
    block: {
        type: 'text';
        text: string;
    } | {
        type: 'reasoning';
        text: string;
    } | {
        type: 'tool-call';
        id: string;
        name: string;
        arguments: string;
    };
} | {
    type: 'reasoning-delta';
    index: number;
    text: string;
} | {
    type: 'tool-call-delta';
    index: number;
    id: string;
    name?: string;
    argumentsDelta: string;
} | {
    type: 'usage';
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens?: number;
        cacheWriteTokens?: number;
    };
} | {
    type: 'finish';
    reason: FinishReason;
    replayState?: unknown;
};
export type FinishReason = {
    kind: 'stop';
} | {
    kind: 'max-tokens';
} | {
    kind: 'tool-calls';
} | {
    kind: 'aborted';
    failure: {
        message: string;
        code: string;
    };
} | {
    kind: 'error';
    failure: {
        message: string;
        code: string;
    };
};
/** pi-ai AssistantMessageEvent vocabulary (subset we consume). */
export type PiEvent = {
    type: 'start';
    partial: PiAssistantPartial;
} | {
    type: 'text_start';
    contentIndex: number;
    partial: PiAssistantPartial;
} | {
    type: 'text_delta';
    contentIndex: number;
    delta: string;
    partial: PiAssistantPartial;
} | {
    type: 'text_end';
    contentIndex: number;
    content: string;
    partial: PiAssistantPartial;
} | {
    type: 'thinking_start';
    contentIndex: number;
    partial: PiAssistantPartial;
} | {
    type: 'thinking_delta';
    contentIndex: number;
    delta: string;
    partial: PiAssistantPartial;
} | {
    type: 'thinking_end';
    contentIndex: number;
    content: string;
    partial: PiAssistantPartial;
} | {
    type: 'toolcall_start';
    contentIndex: number;
    partial: PiAssistantPartial;
} | {
    type: 'toolcall_delta';
    contentIndex: number;
    delta: string;
    partial: PiAssistantPartial;
} | {
    type: 'toolcall_end';
    contentIndex: number;
    toolCall: {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    };
    partial: PiAssistantPartial;
} | {
    type: 'done';
    message: PiDoneMessage;
} | {
    type: 'error';
    error: PiDoneMessage;
};
export interface PiAssistantPartial {
    content: Array<{
        type: string;
        id?: string;
        name?: string;
        [key: string]: unknown;
    }>;
    [key: string]: unknown;
}
/** pi-ai AssistantMessage content block (done/error messages carry these). */
export type PiAssistantBlock = {
    type: string;
    [key: string]: unknown;
};
export interface PiDoneMessage {
    api: string;
    provider: string;
    model: string;
    responseModel?: string;
    responseId?: string;
    content: PiAssistantBlock[];
    usage: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        totalTokens: number;
    };
    stopReason: 'stop' | 'length' | 'toolUse' | 'error' | 'aborted';
    errorMessage?: string;
    [key: string]: unknown;
}
/**
 * Translate one pi-ai event stream into harness chunks. pi-ai never throws
 * mid-stream: failures arrive as `error` events and become error/aborted
 * finish chunks.
 */
export declare function toStreamChunks(events: AsyncIterable<PiEvent>, contextWindow: number): AsyncGenerator<HarnessChunk>;

/**
 * Harness GenerateOptions -> pi-ai Context conversion, with image support.
 *
 * Text-only requests convert synchronously (`toPiContext`); requests carrying
 * durable image blocks resolve bytes through the harness attachment service
 * (`toPiContextWithImages`, async). pi-ai then encodes images as OpenAI
 * `image_url` (completions) or `input_image` (responses) parts.
 */
export interface ImageAttachmentRef {
    attachmentId: string;
    mediaType: string;
    bytes: number;
    width: number;
    height: number;
    name?: string;
}
export interface FileAttachmentRef {
    attachmentId: string;
    name: string;
    bytes: number;
}
export interface HarnessTool {
    name: string;
    description: string;
    parameters: unknown;
}
export type HarnessBlock = {
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
} | {
    type: 'image';
    attachment: ImageAttachmentRef;
    offloaded?: true;
    [key: string]: unknown;
} | {
    type: 'file';
    attachment: FileAttachmentRef;
    [key: string]: unknown;
} | {
    type: 'tool-result';
    toolCallId: string;
    content: HarnessBlock[];
    isError?: boolean;
    [key: string]: unknown;
} | {
    type: string;
    [key: string]: unknown;
};
export interface HarnessMessage {
    role: 'system' | 'user' | 'assistant' | 'tool' | 'developer';
    content: HarnessBlock[];
    source?: {
        kind: string;
        provider?: string;
        model?: string;
        callId?: string;
        [key: string]: unknown;
    };
    toolCallId?: string;
    isError?: boolean;
    [key: string]: unknown;
}
export interface HarnessGenerateOptions {
    provider: string;
    model: string;
    messages: HarnessMessage[];
    system?: string;
    tools?: HarnessTool[];
    maxTokens?: number;
    temperature?: number;
    reasoningEffort?: string;
    signal?: AbortSignal;
    [key: string]: unknown;
}
/** pi-ai message vocabulary (subset we emit). */
export type PiMessage = {
    role: 'user';
    content: string | PiContentBlock[];
    timestamp: number;
} | {
    role: 'assistant';
    content: PiAssistantBlock[];
    api: 'openai-completions' | 'openai-responses';
    provider: string;
    model: string;
    usage: PiUsage;
    stopReason: 'stop' | 'toolUse';
    timestamp: number;
} | {
    role: 'toolResult';
    toolCallId: string;
    toolName: string;
    content: PiContentBlock[];
    isError: boolean;
    timestamp: number;
};
export type PiAssistantBlock = {
    type: 'text';
    text: string;
} | {
    type: 'thinking';
    thinking: string;
} | {
    type: 'toolCall';
    id: string;
    name: string;
    arguments: Record<string, unknown>;
};
export type PiContentBlock = {
    type: 'text';
    text: string;
} | {
    type: 'image';
    data: string;
    mimeType: string;
};
export interface PiUsage {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
    };
}
export interface PiTool {
    name: string;
    description: string;
    parameters: unknown;
}
export interface PiContext {
    systemPrompt?: string;
    messages: PiMessage[];
    tools?: PiTool[];
}
/** Attachment service surface we consume (structural subset of dsh-attachment). */
export interface AttachmentStore {
    readImageRequest(ref: ImageAttachmentRef, target: {
        width: number;
        height: number;
        maxBytes: number;
    }, signal?: AbortSignal): Promise<{
        data: Uint8Array;
        mediaType: string;
        bytes: number;
        width: number;
        height: number;
    }>;
}
export interface RequestImageVersion {
    data: Uint8Array;
    mediaType: string;
    bytes: number;
    width: number;
    height: number;
}
export declare function zeroUsage(): PiUsage;
/** True when any message carries a retained (non-offloaded) image block. */
export declare function contentHasImage(messages: readonly HarnessMessage[]): boolean;
/** Request target for one attachment: fit within the pixel budget, cap bytes. */
export declare function requestImageTarget(ref: ImageAttachmentRef): {
    width: number;
    height: number;
    maxBytes: number;
};
/**
 * Resolve every retained image to request bytes. Offloaded occurrences need
 * no bytes (placeholder text only) and are skipped here.
 */
export declare function prepareRequestImages(messages: readonly HarnessMessage[], attachments: AttachmentStore, signal?: AbortSignal): Promise<Map<string, RequestImageVersion>>;
/** User/tool-result content with images resolved to handle text + bytes. */
export declare function userContentWithImages(blocks: HarnessBlock[], requestImages: Map<string, RequestImageVersion>): string | PiContentBlock[];
/**
 * Text-only conversion (no image bytes needed). Images without resolved
 * bytes cannot be sent — callers must route image-bearing requests through
 * `toPiContextWithImages` instead.
 */
export declare function toPiContext(options: HarnessGenerateOptions, entryEndpoints?: readonly string[]): PiContext;
/**
 * Image-aware conversion: retained images resolve to request bytes via the
 * attachment service; offloaded images become placeholder text.
 */
export declare function toPiContextWithImages(options: HarnessGenerateOptions, attachments: AttachmentStore, entryEndpoints?: readonly string[]): Promise<PiContext>;

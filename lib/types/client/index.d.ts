import { NS } from './i18n.ts';
interface Slots {
    inject(name: string, fn: () => unknown): unknown;
    register(entry: {
        name: string;
        id: string;
        order: number;
        locale?: string;
        label?: () => string;
    }, component: unknown): unknown;
}
interface ClientLocale {
    register(ns: string, dicts: {
        zh: Record<string, string>;
        en: Record<string, string>;
    }): unknown;
    register(ns: string, lang: string, dict: Record<string, string>): () => void;
    subscribe(listener: () => void): () => void;
    getSnapshot(): {
        active?: string;
        revision?: number;
    };
}
export interface ClientContext {
    locale: ClientLocale;
    slots: Slots;
    effect(fn: () => () => void, label?: string): unknown;
}
export declare function apply(ctx: ClientContext): void;
export declare const inject: string[];
export { NS };

import { NS } from './i18n.ts';
export declare const PLUGIN_VERSION: string;
export interface ModelRow {
    id: string;
    displayName: string;
    contextWindow?: number;
    maxTokens?: number;
    image: boolean;
    responsesOnly: boolean;
    reasoning: boolean;
    efforts: string[];
    hidden: boolean;
}
export declare function MagpieSettings(): unknown;
export { NS };

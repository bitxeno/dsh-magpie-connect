/** Owner props the session-scoped slot supplies; `sessionId` names this composer's session. */
export interface MagpieTraceButtonProps {
    /** The session this composer belongs to; absent on shells that project none. */
    readonly sessionId?: string;
}
/**
 * The composer control: the icon button and its compressed routing popover.
 * The session id rides every refresh so the popover's top section shows
 * **this session's** latest route (`/v1/magpie/route`), not just the
 * gateway-wide ledger.
 */
export declare function MagpieTraceButton(props?: MagpieTraceButtonProps): unknown;
export { NS } from './i18n.ts';

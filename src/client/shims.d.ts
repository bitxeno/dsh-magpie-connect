/** Ambient declarations for browser-loader externals (resolved at runtime by the DSH module loader). */

declare module 'react' {
  export function useState<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void]
  export function useEffect(fn: () => void | (() => void), deps?: unknown[]): void
  export function useMemo<T>(fn: () => T, deps: unknown[]): T
  export function useRef<T>(initial: T): { current: T }
  export function useSyncExternalStore<T>(subscribe: (l: () => void) => () => void, snapshot: () => T, server?: () => T): T
  export type ChangeEvent<T = unknown> = { currentTarget: T & { value: string; checked: boolean }; target: T & { value: string; checked: boolean } }
  export type FocusEvent<T = unknown> = { currentTarget: T & { select(): void } }
  export type ReactNode = unknown
  export type FC<P = Record<string, unknown>> = (props: P) => unknown
  const React: { Fragment: unknown }
  export default React
}

declare module 'react/jsx-runtime' {
  export function jsx(type: unknown, props: unknown, key?: unknown): unknown
  export function jsxs(type: unknown, props: unknown, key?: unknown): unknown
  export function Fragment(props: unknown): unknown
}

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  export const Button: (props: Record<string, unknown>) => unknown
  export const Input: (props: Record<string, unknown>) => unknown
  export const Modal: (props: Record<string, unknown>) => unknown
  export const StateDot: (props: Record<string, unknown>) => unknown
}

declare const __PLUGIN_VERSION__: string

declare namespace JSX {
  interface IntrinsicElements {
    [tag: string]: unknown
  }
}

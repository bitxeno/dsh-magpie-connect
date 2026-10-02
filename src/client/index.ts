import { NS, EN, ZH, setLocaleRuntime, text, type LocaleRuntime } from './i18n.ts'
import { MagpieSettings } from './page.tsx'

interface Slots {
  inject(name: string, fn: () => unknown): unknown
  register(entry: { name: string; id: string; order: number; locale?: string; label?: () => string }, component: unknown): unknown
}

interface ClientLocale {
  register(ns: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): unknown
  register(ns: string, lang: string, dict: Record<string, string>): () => void
  subscribe(listener: () => void): () => void
  getSnapshot(): { active?: string; revision?: number }
}

export interface ClientContext {
  locale: ClientLocale
  slots: Slots
  effect(fn: () => () => void, label?: string): unknown
}

function registerDictionaries(ctx: ClientContext): void {
  try {
    ctx.locale.register(NS, { zh: ZH, en: EN })
    return
  } catch {
    // Older hosts only accept per-language registration.
  }
  try {
    ctx.locale.register(NS, 'zh', ZH)
    ctx.locale.register(NS, 'en', EN)
  } catch {
    // Locale is best-effort; the page falls back to English.
  }
}

export function apply(ctx: ClientContext): void {
  setLocaleRuntime(ctx.locale as unknown as LocaleRuntime)
  try {
    ctx.effect(
      () => {
        registerDictionaries(ctx)
        return () => {
          setLocaleRuntime(undefined)
        }
      },
      'dsh-magpie-connect: locale dictionaries',
    )
  } catch {
    registerDictionaries(ctx)
  }
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: 'dsh-magpie-connect',
        order: 12,
        locale: NS,
        label: () => text('nav'),
      },
      MagpieSettings,
    ),
  )
}

export const inject = ['slots', 'locale']

export { NS }

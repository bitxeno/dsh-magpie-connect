import { NS, EN, ZH, setLocaleRuntime, text, type LocaleRuntime } from './i18n.ts'
import { installSettingsNavIcon } from './nav-icon.ts'
import { MagpieSectionIcon } from './section-icon.tsx'
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
  // Native nav glyph for shells that declare `settings.section.icon` (its entry
  // id must equal the section id above). Older shells never declare this slot,
  // so the injection no-ops there and the legacy DOM claim below keeps their
  // gear-swap working; the two are mutually exclusive at render time.
  ctx.slots.inject('settings.section.icon', () =>
    ctx.slots.register(
      {
        name: 'settings.section.icon',
        id: 'dsh-magpie-connect',
        order: 12,
        locale: NS,
        label: () => text('nav'),
      },
      MagpieSectionIcon,
    ),
  )
  // `settings.section` projects only id/order/label on older shells and the
  // nav glyph there is a hardcoded map by id, so this plugin's row would draw
  // the fallback gear. Claim it and swap in the mark; see nav-icon.ts for why
  // and when to delete. On newer shells the slot icon above wins and this
  // fallback stands down (its CSS is gated on the slot glyph being absent).
  installSettingsNavIcon(ctx, () => text('nav'))
}

export const inject = ['slots', 'locale']

export { NS }

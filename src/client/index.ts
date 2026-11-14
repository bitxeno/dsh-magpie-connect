import { NS, EN, ZH, setLocaleRuntime, text, type LocaleRuntime } from './i18n.ts'
import { installSettingsNavIcon } from './nav-icon.ts'
import { MagpieSectionIcon } from './section-icon.tsx'
import { MagpieSettings } from './page.tsx'
import { MagpieTraceButton } from './trace-button.tsx'

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

/** The `/api/magpie-settings` reply, narrowed to what the composer needs. */
interface SettingsPeek {
  showComposerIcon?: boolean
  hasWebKey?: boolean
}

/**
 * Read the composer toggle and Web Key presence once at mount. The icon opens
 * the full routing-group view, which needs the Web Key; hiding it when no Web
 * Key is stored avoids a button that cannot show its intended content.
 */
async function readComposerVisible(): Promise<boolean> {
  try {
    const response = await fetch('/api/magpie-settings', { cache: 'no-store' })
    const payload = (await response.json()) as { ok?: boolean; value?: SettingsPeek }
    if (response.ok && payload?.ok === true && payload.value !== undefined && payload.value !== null) {
      return payload.value.showComposerIcon !== false && payload.value.hasWebKey === true
    }
  } catch {
    // fall through to the conservative default
  }
  return false
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
  // The composer control: a Magpie-mark button in the input box's right tool
  // row (the seat before the send button). Hovering it — tapping it on touch
  // — opens the compressed routing popover; the data comes from the host's
  // `/api/magpie-trace` route, so the browser never sees the gateway key.
  // Older shells without the slot ignore the injection harmlessly.
  //
  // The settings-page toggle gates it: the stored `showComposerIcon` is read
  // once per client mount (the settings page says a flip applies the next
  // time the page opens), and a failed read keeps the icon — the pre-toggle
  // behavior — instead of hiding a working feature behind a bad page load.
  ctx.effect(() => {
    let dispose: unknown
    let cancelled = false
    void readComposerVisible().then((show) => {
      if (cancelled) return
      if (!show) return
      dispose = ctx.slots.inject('conversation.input.right', () =>
        ctx.slots.register(
          {
            name: 'conversation.input.right',
            id: 'magpie-trace',
            order: 100,
            locale: NS,
            label: () => text('trace.open'),
          },
          MagpieTraceButton,
        ),
      )
    })
    return () => {
      cancelled = true
      if (typeof dispose === 'function') dispose()
    }
  }, 'dsh-magpie-connect: composer trace slot')
}

export const inject = ['slots', 'locale']

export { NS }

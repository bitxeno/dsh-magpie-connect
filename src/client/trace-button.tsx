/**
 * The routing popover for the composer: a Magpie-mark button mounted into the
 * input box's right tool row (`conversation.input.right`, the seat before the
 * send button). Hovering it (desktop) — or tapping it (mobile) — opens a
 * compressed view of the gateway's routing: this session's latest route, or
 * — with no session — the newest route in the whole trace. The host serves
 * the data (`/api/magpie-trace`); the browser never talks to the gateway
 * itself.
 *
 * Open semantics follow the plugin contract: desktop hover opens and closing
 * the button+popover region closes (a short delay so the pointer can travel);
 * touch devices get no hover — tap toggles, a tap outside closes. The box is
 * fitted to the visual viewport by `trace-placement.ts`, so a phone screen
 * never truncates it. A failure renders as one localized hint row instead of
 * a silent close.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type {
  ActiveRequestRow,
  SessionRouteView,
  SessionTraceView,
  TraceCandidate,
  TraceRoutingSection,
  TraceView,
} from '../trace-contract.ts'
import { text } from './i18n.ts'
import { TraceBirdIcon, TraceDotIcon, TraceFanIcon, TraceGenericIcon, TraceHollowDotIcon, TraceLinkIcon } from './trace-icons.tsx'
import { adoptTraceStyles } from './trace-styles.ts'
import {
  durationParts,
  maskUser,
  resetParts,
  type RequestTone,
} from './trace-format.ts'
import {
  computePopupPlacement,
  clipBoxFor,
  prefersCoarsePointer,
  readViewport,
  type PopupPlacement,
} from './trace-placement.ts'

/** How long one refresh cycle waits while the popover is open (desktop). */
const DESKTOP_REFRESH_MS = 5_000

/** How long one refresh cycle waits while the popover is open (mobile). */
const TOUCH_REFRESH_MS = 4_000

/** The hover-open delay: long enough to not flicker on a passing pointer. */
const HOVER_OPEN_DELAY_MS = 120

/** The hover-close delay: long enough for the pointer to reach the popover. */
const HOVER_CLOSE_DELAY_MS = 180

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  margin: '0 2px',
  padding: '0',
  border: 'none',
  borderRadius: '8px',
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary, #c9d2e0)',
  cursor: 'pointer',
  flex: 'none',
} as const

const popoverStyle = {
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  right: '0',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--dsw-specific-tip, #1e2533)',
  border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.35))',
  borderRadius: '12px',
  boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
  overflow: 'hidden',
  zIndex: 1000,
} as const

/** The popover's inline placement, overriding the default desktop anchoring. */
function placementStyle(placement: PopupPlacement): CSSProperties {
  return {
    left: `${placement.offsetLeft}px`,
    right: 'auto',
    width: `${placement.width}px`,
    maxHeight: `${placement.maxHeight}px`,
    ...(placement.offsetTop === undefined ? {} : { top: `${placement.offsetTop}px`, bottom: 'auto' }),
    ...(placement.offsetBottom === undefined ? {} : { bottom: `${placement.offsetBottom}px`, top: 'auto' }),
  }
}

const headStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 12px 8px',
  borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.2))',
  flex: 'none',
} as const

const liveDotStyle = {
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  background: 'var(--dsw-alias-state-success-primary, #4ade80)',
  flex: 'none',
} as const

const headTitleStyle = {
  margin: 0,
  fontSize: '13px',
  lineHeight: '18px',
  fontWeight: 600,
  color: 'var(--dsw-alias-label-primary, #e6ebf2)',
} as const

const headLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
  color: 'inherit',
  textDecoration: 'none',
  cursor: 'pointer',
} as const

const headUpdatedStyle = {
  marginLeft: 'auto',
  fontSize: '11px',
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-tertiary, #8a94a6)',
  whiteSpace: 'nowrap',
} as const

const sectionLabelStyle = {
  padding: '8px 12px 4px',
  fontSize: '11px',
  lineHeight: '16px',
  fontWeight: 600,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: 'var(--dsw-alias-label-tertiary, #8a94a6)',
  flex: 'none',
} as const

const listStyle = {
  overflowY: 'auto',
  // Wheel/touch scroll chaining must stop at the popover — scrolling past
  // the ends must not scroll the conversation behind it.
  overscrollBehavior: 'contain',
  // A column flex child defaults to min-height:auto, which would let the
  // list grow past the popover's clamped height instead of scrolling inside.
  minHeight: '0',
  padding: '0 6px 8px',
} as const

const requestRowStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
  padding: '6px 8px',
  borderRadius: '8px',
  minWidth: 0,
} as const

const dotWrapStyle = {
  flex: 'none',
  display: 'inline-flex',
  paddingTop: '5px',
} as const

const rowTextStyle = {
  flex: '1 1 auto',
  minWidth: '0',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
} as const

const rowMainStyle = {
  fontSize: '12px',
  lineHeight: '17px',
  color: 'var(--dsw-alias-label-primary, #e6ebf2)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

const rowSubStyle = {
  fontSize: '11px',
  lineHeight: '15px',
  color: 'var(--dsw-alias-label-tertiary, #8a94a6)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

const rowRightStyle = {
  flex: 'none',
  marginLeft: 'auto',
  fontSize: '11px',
  lineHeight: '15px',
  color: 'var(--dsw-alias-label-tertiary, #8a94a6)',
  whiteSpace: 'nowrap',
  textAlign: 'right',
} as const

const accountPlanStyle = {
  flex: 'none',
  fontSize: '11px',
  lineHeight: '17px',
  padding: '0 6px',
  borderRadius: '9999px',
  border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
  color: 'var(--dsw-alias-label-secondary, #c9d2e0)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'clip',
  maxWidth: '10ch',
} as const

const barFill = 'var(--dsw-alias-brand-primary, #4cc9f0)' as const
const barFillCritical = 'var(--dsw-alias-state-danger-primary, #f87171)' as const

const statusStyle = {
  padding: '12px',
  fontSize: '12px',
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-tertiary, #8a94a6)',
  flex: 'none',
} as const

const fullTraceSectionsStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
} as const

/** A routing group is a short standalone box, with its model rows indented below it. */
const traceGroupStyle = {
  position: 'relative',
  margin: '2px 0 8px',
  padding: '0',
} as const

const groupHeadStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minHeight: '22px',
  padding: '5px 10px',
  border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.35))',
  borderRadius: '10px',
  background: 'var(--dsw-alias-bg-layer-1, rgba(128,128,128,0.05))',
  minWidth: 0,
} as const

const groupNameStyle = {
  minWidth: 0,
  flex: '0 1 auto',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '13px',
  lineHeight: '18px',
  fontWeight: 600,
  color: 'var(--dsw-alias-label-primary, #e6ebf2)',
} as const

const groupRefStyle = {
  flex: '0 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '11px',
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-tertiary, #8a94a6)',
} as const

const routingPillStyle = {
  flex: 'none',
  marginLeft: 'auto',
  padding: '1px 7px',
  border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
  borderRadius: '9999px',
  fontSize: '11px',
  lineHeight: '16px',
  color: 'var(--dsw-alias-label-secondary, #c9d2e0)',
} as const

const candidateListStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '7px',
  marginLeft: '18px',
  paddingTop: '7px',
  paddingLeft: '8px',
} as const

const directListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '7px',
  minWidth: 0,
} as const

const candidateWrapStyle = {
  position: 'relative',
  minWidth: 0,
} as const

const candidateCardStyle = {
  position: 'relative',
  padding: '7px 8px 8px',
  borderRadius: '10px',
  background: 'var(--dsw-alias-bg-layer-1, rgba(128,128,128,0.04))',
  minWidth: 0,
} as const

const candidateHeadStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
} as const

const providerLogoWrapStyle = {
  flex: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  height: '16px',
  color: 'var(--dsw-alias-label-secondary, #c9d2e0)',
} as const

const providerLogoStyle = {
  width: '16px',
  height: '16px',
  objectFit: 'contain',
  borderRadius: '4px',
} as const

const candidateNameStyle = {
  minWidth: 0,
  flex: '0 1 auto',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '12px',
  lineHeight: '17px',
  color: 'var(--dsw-alias-label-primary, #e6ebf2)',
} as const

const candidateDetailStyle = {
  marginTop: '3px',
  fontSize: '11px',
  lineHeight: '16px',
  color: 'var(--dsw-alias-label-tertiary, #8a94a6)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

const candidateGaugeStyle = {
  marginTop: '6px',
  height: '3px',
  borderRadius: '2px',
  background: 'var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.2))',
  overflow: 'hidden',
} as const

/** The dot color for one request tone. */
const TONE_COLOR: Record<RequestTone, string> = {
  ok: 'var(--dsw-alias-state-success-primary, #4ade80)',
  failed: 'var(--dsw-alias-state-danger-primary, #f87171)',
  canceled: 'var(--dsw-alias-label-dimmed, #6b7280)',
}

/** Whether the host reports one of the recoverable fetch failures. */
function isFailedView(view: TraceView | undefined): boolean {
  return view !== undefined && view.status !== 'ok'
}

/**
 * One duration as locale text, or '' when absent.
 * @param parts - value and unit from the compressors.
 * @param kind - which template to use.
 */
function formatDuration(parts: { n: number; unit: 'ms' | 's' | 'm' | 'h' | 'd' } | undefined, kind: 'took' | 'reset'): string {
  if (parts === undefined) return ''
  if (kind === 'took') return text(`trace.took.${parts.unit}`, { n: parts.n })
  return text(`trace.reset.${parts.unit}`, { n: parts.n })
}

/** Owner props the session-scoped slot supplies; `sessionId` names this composer's session. */
export interface MagpieTraceButtonProps {
  /** The session this composer belongs to; absent on shells that project none. */
  readonly sessionId?: string
}

/**
 * One in-flight request row: a pulsing dot + agent · model over the phase
 * word, with the running duration on the right. The popover's own session's
 * request is pinned first by the host and shows a highlighted dot.
 */
function ActiveRow(props: { key?: string; row: ActiveRequestRow }): unknown {
  const { row } = props
  const phaseWord = row.phase === undefined
    ? ''
    : (text(`trace.phase.${row.phase}`) !== `trace.phase.${row.phase}` ? text(`trace.phase.${row.phase}`) : row.phase)
  const model = row.model ?? ''
  const took = formatDuration(durationParts(row.ms), 'took')
  return (
    <div style={requestRowStyle}>
      <span style={{ ...dotWrapStyle, color: row.own === true ? 'var(--dsw-alias-brand-primary, #4cc9f0)' : 'var(--dsw-alias-state-warning-primary, var(--dsw-alias-label-tertiary, #facc15))' }}>
        {TraceDotIcon()}
      </span>
      <span style={rowTextStyle}>
        <span style={rowMainStyle}>
          {row.agent ?? ''}
          {model !== '' ? <span style={{ color: 'var(--dsw-alias-label-secondary, #c9d2e0)' }}>{` · ${model}`}</span> : null}
          {row.own === true ? <span style={{ color: 'var(--dsw-alias-brand-primary, #4cc9f0)' }}>{` · ${text('trace.thisSession')}`}</span> : null}
        </span>
        {phaseWord !== '' ? <span style={rowSubStyle}>{phaseWord}</span> : null}
      </span>
      <span style={rowRightStyle}>{took !== '' ? took : null}</span>
    </div>
  )
}

/**
 * The session's latest route, as one row: dot + asked → served over the tries
 * summary, with the total duration on the right. Mirrors the ledger row but
 * scoped to the composer's own conversation.
 */
function SessionRouteRow(props: { route: SessionRouteView }): unknown {
  const { route } = props
  const tries = route.tries ?? []
  const last = tries.at(-1)
  const tone: RequestTone = route.status !== undefined && (route.status < 200 || route.status >= 400)
    ? 'failed'
    : (route.error !== undefined && route.done !== true ? 'failed' : 'ok')
  const asked = route.asked ?? ''
  const served = route.served ?? ''
  const model = asked !== '' && served !== '' && asked !== served ? `${asked} → ${served}` : (asked !== '' ? asked : served)
  const took = formatDuration(durationParts(route.ms), 'took')
  const errorWord = route.error !== undefined ? (localizedErrorText(route.error) ?? '') : ''
  const sub = tries.length > 1
    ? `${text('trace.tryCount', { n: tries.length })}${errorWord !== '' ? ` · ${errorWord}` : ''}`
    : errorWord
  return (
    <div style={requestRowStyle}>
      <span style={{ ...dotWrapStyle, color: TONE_COLOR[tone] }}>{TraceDotIcon()}</span>
      <span style={rowTextStyle}>
        <span style={rowMainStyle}>
          {model !== '' ? model : text('trace.sessionNone')}
          {route.group !== undefined && route.group !== asked ? (
            <span style={{ color: 'var(--dsw-alias-label-tertiary, #8a94a6)' }}>{` · ${route.group}`}</span>
          ) : null}
        </span>
        {sub !== '' ? <span style={rowSubStyle}>{sub}</span> : null}
      </span>
      <span style={rowRightStyle}>
        {took !== '' ? took : null}
        {last?.status !== undefined ? <span style={{ marginLeft: took !== '' ? 6 : 0 }}>{String(last.status)}</span> : null}
      </span>
    </div>
  )
}

interface TraceWirePath {
  readonly d: string
  readonly active: boolean
  readonly live: boolean
}

interface TraceWireState {
  readonly width: number
  readonly height: number
  readonly paths: readonly TraceWirePath[]
}

/** Localize a Magpie routing mode, defaulting to Smart for `""`. */
function routingLabel(routing: string | undefined): string {
  const key = `trace.routing.${routing || 'smart'}`
  return text(key) !== key ? text(key) : (routing || text('trace.routing.smart'))
}

/**
 * Screenshot-style routing groups: one card per nested group
 * (`Hy4 · auto/hy4free · Smart`, `GPT-6 Luna · auto/gpt-6-luna · Smart`),
 * each with the candidate accounts Magpie weighed or skipped and their
 * Rest reasons/recovery times.
 */
function FullTraceSection(props: { key?: string; trace: SessionTraceView }): unknown {
  const { trace } = props
  const group = trace.group
  const sections: readonly TraceRoutingSection[] = trace.sections ?? [{
    name: group?.name ?? trace.model,
    ref: group?.ref ?? trace.model,
    ...(group?.routing !== undefined ? { routing: group.routing } : {}),
    candidates: [...trace.order, ...trace.left].slice(0, 8),
  }]
  return (
    <div style={fullTraceSectionsStyle}>
      {sections.map((section, index) => (
        <RoutingGroupCard key={`${section.ref}:${index}`} section={section} />
      ))}
    </div>
  )
}

/** One nested routing-group card. */
function RoutingGroupCard(props: { key?: string; section: TraceRoutingSection }): unknown {
  const { section } = props
  const showHeader = section.hideHeader !== true
  const activeIndex = section.candidates.findIndex((candidate) => candidate.outcome === 'answered' || candidate.outcome === 'processing')
  const groupRef = useRef<HTMLDivElement | null>(null)
  const [wires, setWires] = useState<TraceWireState>({ width: 0, height: 0, paths: [] })

  // Measure candidate rows and draw Magpie's cubic S wires from the group
  // header centre to each card centre. A pixel-sized viewBox means no path
  // scaling, so rounded corners/dash phase stay aligned with the cards.
  useLayoutEffect(() => {
    const container = groupRef.current
    if (container === null || !showHeader) {
      setWires({ width: 0, height: 0, paths: [] })
      return
    }
    const measure = (): void => {
      const rect = container.getBoundingClientRect()
      const rows = Array.from(container.querySelectorAll('[data-magpie-candidate]')) as HTMLElement[]
      const x0 = 10
      const x3 = 26
      const mx = (x0 + x3) / 2
      const y0 = 16
      const paths = rows.map((row, index) => {
        const card = row.getBoundingClientRect()
        const y3 = card.top - rect.top + card.height / 2
        return {
          d: `M${x0} ${y0} C${mx} ${y0} ${mx} ${y3} ${x3} ${y3}`,
          active: index === activeIndex,
          live: section.candidates[index]?.outcome === 'processing',
        }
      })
      setWires({ width: rect.width, height: rect.height, paths })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [showHeader, activeIndex, section.candidates])

  return (
    <div ref={groupRef} style={traceGroupStyle}>
      {showHeader && wires.width > 0 ? (
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${wires.width} ${wires.height}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
        >
          {wires.paths.map((wire, index) => (
            <path
              key={index}
              d={wire.d}
              className={`dsh-magpie-connect-trace-wire${wire.active ? ' is-active' : ''}${wire.live ? ' is-live' : ''}`}
            />
          ))}
        </svg>
      ) : null}
      {showHeader ? (
        <div style={groupHeadStyle}>
          <span style={{ ...dotWrapStyle, paddingTop: 0, color: 'var(--dsw-alias-label-secondary, #c9d2e0)' }}>{TraceFanIcon()}</span>
          <span style={groupNameStyle}>{section.name}</span>
          {section.ref !== section.name ? <span style={groupRefStyle}>{section.ref}</span> : null}
          <span style={routingPillStyle}>{routingLabel(section.routing)}</span>
        </div>
      ) : null}
      <div style={showHeader ? candidateListStyle : directListStyle}>
        {section.candidates.length === 0 ? <div style={statusStyle}>{text('trace.noRequests')}</div> : null}
        {section.candidates.map((candidate, index) => (
          <div key={`${candidate.id}:${candidate.model ?? ''}:${candidate.fixed ?? ''}:${index}`} data-magpie-candidate="" style={candidateWrapStyle}>
            <CandidateCard candidate={candidate} active={index === activeIndex} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Map a vendor's own English error sentence onto a localized reason. */
function localizedErrorText(error: string | undefined): string | undefined {
  if (error === undefined || error === '') return undefined
  if (/sign.?in.+expired|could not authenticate|re-?sign/i.test(error)) return text('trace.reason.signin')
  if (/frequency limit|rate.?limit|too many requests|429/i.test(error)) return text('trace.reason.rateLimit')
  if (/quota|allowance|usage exceeds|out of .*allowance/i.test(error)) return text('trace.reason.quota')
  if (/credit/i.test(error)) return text('trace.reason.credit')
  return text('trace.reason.other')
}

/** Map a Magpie fail code (`quota`, `rate`, `auth`, …) onto a localized word. */
function localizedFailText(fail: string | undefined): string {
  if (fail === undefined || fail === '') return text('trace.reason.other')
  const key = `trace.reason.${fail}`
  return text(key) !== key ? text(key) : text('trace.reason.other')
}

/** A localized Rest/try/skip reason, kept to one line for the compact card. */
function candidateReason(candidate: TraceCandidate): string {
  const rest = candidate.rest
  const localized = (key: string, fallback: string): string => (text(key) !== key ? text(key) : fallback)
  if (rest !== undefined) {
    if (rest.rate === true || /rate/i.test(rest.why ?? '') || rest.by === 'retry-after' || rest.by === 'resets') return localized('trace.reason.rateLimit', 'rate limited')
    if (rest.by === 'window' || /quota/i.test(rest.why ?? '')) return localized('trace.reason.window', 'allowance used up')
    if (rest.by === 'credit' || /credit/i.test(rest.why ?? '')) return localized('trace.reason.credit', 'out of credits')
    if (rest.by === 'verify') return localized('trace.reason.verify', 'verification needed')
    if (rest.by === 'restricted') return localized('trace.reason.restricted', 'account restricted')
    if (rest.by === 'backoff') return localized('trace.reason.backoff', 'backoff')
    if (rest.by === 'cooldown') return localized('trace.reason.cooldown', 'cooldown')
    if (rest.by === 'quota') return localized('trace.reason.quota', 'quota used up')
    return localizedErrorText(rest.error) ?? localized('trace.reason.other', 'unavailable')
  }
  if (candidate.window !== undefined) return text('trace.reason.windowSize', { n: Math.round(candidate.window / 1000) })
  if (candidate.skipReason !== undefined && candidate.skipReason !== '') {
    const reason = candidate.skipReason.toLowerCase()
    if (reason.includes('held') || candidate.held === true) return localized('trace.reason.held', 'held by key/group')
    if (reason.includes('credit') || candidate.noCredits === true) return localized('trace.reason.noCredits', 'no credits policy')
    if (reason.includes('unlisted') || candidate.unlisted === true) return localized('trace.reason.unlisted', 'model not listed')
    if (reason.includes('barred') || candidate.barred === true) return localized('trace.reason.barred', 'model barred')
    if (reason.includes('window') || candidate.window !== undefined) return localized('trace.reason.windowTooSmall', 'context window too small')
    if (candidate.noURL !== undefined) return localized('trace.reason.noURL', 'no API URL')
    if (candidate.unread !== undefined) return localized('trace.reason.unread', 'usage unavailable')
    return text('trace.reason.other')
  }
  if (candidate.error !== undefined && candidate.error !== '') return localizedErrorText(candidate.error) ?? localized('trace.reason.other', 'unavailable')
  if (/auth|sign.?in/i.test(candidate.fail ?? '')) return localized('trace.reason.signin', 'sign-in expired')
  if (candidate.fail !== undefined && candidate.fail !== '') return localizedFailText(candidate.fail)
  return localized('trace.reason.other', 'unavailable')
}

/** The one-line detail under a candidate: reason/recovery or usage/reset. */
function candidateDetail(candidate: TraceCandidate): string {
  const rest = candidate.rest
  if (rest !== undefined) {
    const back = rest.until !== undefined ? resetParts(rest.until) : undefined
    const countdown = back !== undefined ? text('trace.restUntil', { d: formatDuration(back, 'reset') }) : ''
    return [candidateReason(candidate), countdown].filter(Boolean).join(' · ')
  }
  if (candidate.outcome === 'skipped' || candidate.outcome === 'failed') {
    const reason = candidateReason(candidate)
    const renew = candidate.renews?.[0] !== undefined ? resetParts(candidate.renews[0]) : undefined
    const resetText = renew !== undefined ? text('trace.quotaReset', { d: formatDuration(renew, 'reset') }) : ''
    return [reason, resetText].filter(Boolean).join(' · ')
  }
  const amount = candidate.amount !== undefined && Number.isFinite(candidate.amount) ? Math.round(candidate.amount * 100) / 100 : undefined
  const limit = candidate.limit !== undefined && Number.isFinite(candidate.limit) ? Math.round(candidate.limit * 100) / 100 : undefined
  const unit = candidate.unit !== undefined && candidate.unit !== ''
    ? (text(`trace.unit.${candidate.unit}`) !== `trace.unit.${candidate.unit}` ? text(`trace.unit.${candidate.unit}`) : candidate.unit)
    : ''
  const amountText = amount !== undefined && limit !== undefined
    ? text('trace.candidate.amount', { amount, limit, unit }).trim()
    : (candidate.usedPct !== undefined ? text('trace.candidate.used', { n: candidate.usedPct }) : '')
  const renew = candidate.renews?.[0] !== undefined ? resetParts(candidate.renews[0]) : undefined
  const resetText = renew !== undefined ? text('trace.quotaReset', { d: formatDuration(renew, 'reset') }) : ''
  return [amountText, resetText].filter(Boolean).join(' · ')
}

/** Map an outcome onto its dot color and right-side state word. */
function candidateState(candidate: TraceCandidate): { color: string; word: string } {
  switch (candidate.outcome) {
    case 'answered': return { color: TONE_COLOR.ok, word: text('trace.candidate.answered') }
    case 'processing': return { color: 'var(--dsw-alias-brand-primary, #4cc9f0)', word: text('trace.candidate.processing') }
    case 'failed': return { color: TONE_COLOR.failed, word: candidate.status !== undefined ? String(candidate.status) : candidateReason(candidate) }
    case 'resting': return { color: TONE_COLOR.failed, word: text('trace.candidate.resting') }
    case 'skipped': return { color: TONE_COLOR.canceled, word: text('trace.candidate.skipped') }
    default: return { color: TONE_COLOR.canceled, word: text('trace.candidate.available') }
  }
}

/** Only built-in Magpie icon names are proxied; URLs/file icons fall back to generic. */
function supplierIconName(candidate: TraceCandidate): string | undefined {
  const raw = candidate.icon ?? candidate.preset
  if (raw === undefined || raw === '' || raw === 'generic') return undefined
  if (raw.includes('/') || raw.includes(':') || raw.includes('..')) return undefined
  return /^[A-Za-z0-9._~-]+$/.test(raw) ? raw : undefined
}

/** A Magpie Web provider logo, proxied by the Host so no browser cookie/key is needed. */
function ProviderLogo(props: { name?: string }): unknown {
  if (props.name === undefined) return <span style={providerLogoWrapStyle}>{TraceGenericIcon()}</span>
  return (
    <span style={providerLogoWrapStyle}>
      <img
        src={`/api/magpie-icon?name=${encodeURIComponent(props.name)}`}
        alt=""
        loading="lazy"
        draggable={false}
        style={providerLogoStyle}
        onError={(event: { currentTarget: { style: { visibility: string } } }) => { event.currentTarget.style.visibility = 'hidden' }}
      />
    </span>
  )
}

/** One candidate card, with Rest reason/recovery and its usage gauge. */
function CandidateCard(props: { key?: string; candidate: TraceCandidate; active?: boolean }): unknown {
  const { candidate, active } = props
  const state = candidateState(candidate)
  const detail = candidateDetail(candidate)
  const critical = (candidate.usedPct ?? 0) >= 90 || candidate.outcome === 'resting' || candidate.outcome === 'failed'
  const processing = candidate.outcome === 'processing'
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [outline, setOutline] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    if (!processing) {
      setOutline({ width: 0, height: 0 })
      return
    }
    const card = cardRef.current
    if (card === null) return
    const measure = (): void => {
      const rect = card.getBoundingClientRect()
      setOutline({ width: rect.width, height: rect.height })
    }
    measure()
    // The popover's width is clamped by its parent after these child layout
    // effects run, and a reopen can render from cached data before that clamp.
    // Follow every card resize (width clamp, image/font layout, viewport move),
    // or the cached first measurement leaves the outline too short.
    const observer = new ResizeObserver(measure)
    observer.observe(card)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [processing, detail])
  const border = processing
    ? 'none'
    : active === true || candidate.outcome === 'answered'
      ? '1px solid var(--dsw-alias-brand-primary, #4cc9f0)'
      : (candidate.outcome === 'resting' || candidate.outcome === 'failed' || candidate.outcome === 'skipped')
        ? '1px dashed var(--dsw-alias-state-danger-primary, rgba(248,113,113,0.55))'
        : '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))'
  const dotColor = active === true ? 'var(--dsw-alias-brand-primary, #4cc9f0)' : state.color
  const filledDot = active === true || candidate.outcome === 'answered' || candidate.outcome === 'processing' || candidate.outcome === 'failed'
  const who = maskUser(candidate.who ?? candidate.name ?? candidate.provider)
  const modelLabel = candidate.model !== undefined
    ? `${candidate.model}${candidate.fixed !== undefined ? `:${candidate.fixed}` : ''}`
    : undefined
  const logoName = supplierIconName(candidate)
  const detailColor = candidate.outcome === 'resting' || candidate.outcome === 'failed' || candidate.outcome === 'skipped'
    ? 'var(--dsw-alias-state-danger-primary, #f87171)'
    : 'var(--dsw-alias-label-tertiary, #8a94a6)'
  return (
    <div ref={cardRef} style={{ ...candidateCardStyle, border, ...(active === true && !processing ? { boxShadow: '0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary, #4cc9f0) 20%, transparent)' } : {}) }} title={candidate.error ?? candidate.rest?.error}>
      {processing && outline.width > 0 ? (
        <svg className="dsh-magpie-connect-trace-busy-outline" viewBox={`0 0 ${outline.width} ${outline.height}`} aria-hidden="true">
          <rect x={1} y={1} width={Math.max(0, outline.width - 2)} height={Math.max(0, outline.height - 2)} rx={9} ry={9} />
        </svg>
      ) : null}
      <div style={candidateHeadStyle}>
        <span style={{ ...dotWrapStyle, paddingTop: 0, color: dotColor }}>{filledDot ? TraceDotIcon() : TraceHollowDotIcon()}</span>
        <ProviderLogo name={logoName} />
        <span style={candidateNameStyle}>{who ?? candidate.provider}</span>
        {candidate.plan !== undefined ? <span style={accountPlanStyle}>{candidate.plan}</span> : null}
        {modelLabel !== undefined ? <span style={groupRefStyle}>{modelLabel}</span> : null}
        <span style={rowRightStyle}>{state.word}</span>
      </div>
      {detail !== '' ? <div style={{ ...candidateDetailStyle, color: detailColor }}>{detail}</div> : null}
      {candidate.usedPct !== undefined ? (
        <div style={candidateGaugeStyle} aria-hidden="true">
          <span style={{ display: 'block', width: `${Math.min(100, Math.max(0, candidate.usedPct))}%`, height: '100%', borderRadius: '2px', background: critical ? barFillCritical : barFill }} />
        </div>
      ) : null}
    </div>
  )
}

/**
 * The composer control: the icon button and its compressed routing popover.
 * The session id rides every refresh so the popover's top section shows
 * **this session's** latest route (`/v1/magpie/route`), not just the
 * gateway-wide ledger.
 */
export function MagpieTraceButton(props: MagpieTraceButtonProps = {}): unknown {
  const sessionId = typeof props.sessionId === 'string' ? props.sessionId : undefined
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<TraceView | undefined>(undefined)
  const [coarse] = useState(prefersCoarsePointer)
  const [placement, setPlacement] = useState<PopupPlacement | null>(null)
  /** Hover feedback on the button itself (same look as dsh-git-plus's toolbtn). */
  const [hover, setHover] = useState(false)
  adoptTraceStyles()
  const boxRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<AbortController | undefined>(undefined)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const clearTimers = (): void => {
    if (openTimerRef.current !== undefined) clearTimeout(openTimerRef.current)
    if (closeTimerRef.current !== undefined) clearTimeout(closeTimerRef.current)
    openTimerRef.current = undefined
    closeTimerRef.current = undefined
  }

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const url = sessionId !== undefined
        ? `/api/magpie-trace?session=${encodeURIComponent(sessionId)}`
        : '/api/magpie-trace'
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
      const payload = (await response.json()) as { ok?: boolean; value?: TraceView; error?: string }
      if (controller.signal.aborted) return
      if (response.ok && payload?.ok === true && payload.value !== undefined && payload.value !== null) {
        setView(payload.value)
        return
      }
      setView({ status: 'unknown', message: typeof payload?.error === 'string' ? payload.error : undefined, fetchedAt: new Date().toISOString() })
    } catch (error) {
      if (controller.signal.aborted) return
      setView({ status: 'network', message: error instanceof Error ? error.message : String(error), fetchedAt: new Date().toISOString() })
    }
  }, [sessionId])

  // Fit the popover to the visible viewport, and keep it fitted while the
  // viewport moves (rotation, the on-screen keyboard, browser chrome).
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null)
      return
    }
    const measure = () => {
      const box = boxRef.current
      if (box === null) return
      setPlacement(computePopupPlacement(box.getBoundingClientRect(), clipBoxFor(box, readViewport())))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    const visual = window.visualViewport
    visual?.addEventListener('resize', measure)
    visual?.addEventListener('scroll', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      visual?.removeEventListener('resize', measure)
      visual?.removeEventListener('scroll', measure)
    }
  }, [open])

  // Load on open, then keep it live while open. Closed, nothing runs.
  useEffect(() => {
    if (!open) return
    void load()
    const interval = setInterval(() => void load(), coarse ? TOUCH_REFRESH_MS : DESKTOP_REFRESH_MS)
    return () => {
      clearInterval(interval)
      controllerRef.current?.abort()
      controllerRef.current = undefined
    }
  }, [open, coarse, load])

  // Close on outside pointer-down (touch: the required outside-tap close).
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (boxRef.current === null) return
      if (!boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Escape closes.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Unmount: stop timers and any in-flight fetch.
  useEffect(() => () => {
    clearTimers()
    controllerRef.current?.abort()
  }, [])

  const toggle = (): void => {
    clearTimers()
    setOpen((value) => !value)
  }

  // Desktop hover: open after the delay, close only once the pointer has
  // left both the button and the popover (they share the wrapper box).
  const onEnter = (): void => {
    if (coarse) return
    if (closeTimerRef.current !== undefined) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
      return
    }
    if (openTimerRef.current !== undefined || open) return
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = undefined
      setOpen(true)
    }, HOVER_OPEN_DELAY_MS)
  }
  const onLeave = (): void => {
    if (coarse) return
    if (openTimerRef.current !== undefined) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = undefined
      return
    }
    if (!open) return
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = undefined
      setOpen(false)
    }, HOVER_CLOSE_DELAY_MS)
  }

  const failed = isFailedView(view)
  const hint = failed
    ? text(
        view?.status === 'unconfigured' ? 'trace.unconfigured'
        : view?.status === 'unauthorized' ? 'trace.unauthorized'
        : view?.status === 'forbidden' ? 'trace.forbidden'
        : view?.status === 'network' ? 'trace.network'
        : 'trace.unknown',
      )
    : ''

  return (
    <div
      ref={boxRef}
      style={{ position: 'relative', display: 'inline-flex', flex: 'none' }}
      onMouseEnter={() => {
        setHover(true)
        onEnter()
      }}
      onMouseLeave={() => {
        setHover(false)
        onLeave()
      }}
    >
      <button
        type="button"
        onClick={toggle}
        title={text('trace.open')}
        aria-label={text('trace.open')}
        aria-expanded={open}
        style={{
          ...buttonStyle,
          // Same hover treatment as dsh-git-plus's composer toolbtn: the
          // shell's interactive hover background and the primary label color.
          ...(hover && !coarse
            ? {
                background: 'var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.2))',
                color: 'var(--dsw-alias-label-primary, #e8edf5)',
              }
            : {}),
          ...(open ? { color: 'var(--dsw-alias-label-primary-bluish, #4cc9f0)' } : {}),
        }}
      >
        {TraceBirdIcon()}
      </button>
      {open && (
        <div
          data-magpie-trace-popup
          data-side={placement?.side ?? 'above'}
          style={placement === null ? popoverStyle : { ...popoverStyle, ...placementStyle(placement) }}
        >
          <div style={headStyle}>
            <a
              href={view?.routingUrl ?? '/?view=routing'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={text('trace.title')}
              title={text('trace.title')}
              style={headLinkStyle}
            >
              <span style={liveDotStyle} aria-hidden="true" />
              <span style={headTitleStyle}>{text('trace.title')}</span>
              <span style={{ display: 'inline-flex', color: 'var(--dsw-alias-label-secondary, #c9d2e0)' }}>{TraceLinkIcon()}</span>
            </a>
            <span style={headUpdatedStyle}>
              {text('trace.fetchedAt', { time: new Date(view?.fetchedAt ?? Date.now()).toLocaleTimeString() })}
            </span>
          </div>
          {failed ? (
            <div style={statusStyle}>
              {hint}
              <button
                type="button"
                onClick={() => void load()}
                style={{
                  display: 'block',
                  margin: '8px 0 0',
                  padding: '4px 10px',
                  fontSize: '12px',
                  lineHeight: '18px',
                  border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: 'var(--dsw-alias-label-secondary, #c9d2e0)',
                  cursor: 'pointer',
                }}
              >
                {text('trace.retry')}
              </button>
            </div>
          ) : (
            <>
              <div style={listStyle}>
                {view?.sessionTrace !== undefined ? (
                  <FullTraceSection key="full-trace" trace={view.sessionTrace} />
                ) : (
                  <>
                    {view?.webTraceError !== undefined ? (
                      <div style={statusStyle} title={view?.webTraceMessage}>
                        {text(
                          view.webTraceError === 'missing-key' ? 'trace.webTraceMissing'
                            : view.webTraceError === 'unauthorized' ? 'trace.webTraceUnauthorized'
                              : view.webTraceError === 'forbidden' ? 'trace.webTraceUnavailable'
                                : 'trace.webTraceUnavailable',
                        )}
                      </div>
                    ) : null}
                    {sessionId !== undefined && view?.sessionRoute !== undefined ? (
                      <>
                        <div style={sectionLabelStyle}>{text('trace.thisSession')}</div>
                        <SessionRouteRow route={view.sessionRoute} />
                      </>
                    ) : null}
                    {(view?.active?.length ?? 0) > 0 ? (
                      <>
                        <div style={sectionLabelStyle}>{text('trace.active')}</div>
                        {(view?.active ?? []).map((row, index) => <ActiveRow key={`${row.agent ?? ''}:${row.model ?? ''}:${index}`} row={row} />)}
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export { NS } from './i18n.ts'

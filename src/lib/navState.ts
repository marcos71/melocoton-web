/** What a screen hands to the next one through the router state (docs/pantallas_alumnos.md, 1.1 and 4.5). */

export type NoticeKind = 'success' | 'info' | 'warning' | 'error'

export type NoticeData = {
  kind: NoticeKind
  text: string
  items?: string[]
  /** A closing sentence after the list, before the link. */
  footer?: string
  link?: { to: string; label: string }
}

export type StudentNavState = {
  /** The list URL (with its filters) the profile's back link returns to. */
  from?: string
  notice?: NoticeData
}

function isNotice(value: unknown): value is NoticeData {
  const notice = value as NoticeData | null
  return (
    typeof notice === 'object' &&
    notice !== null &&
    typeof notice.text === 'string' &&
    ['success', 'info', 'warning', 'error'].includes(notice.kind)
  )
}

export function noticeFromState(state: unknown): NoticeData | null {
  const notice = (state as StudentNavState | null)?.notice
  return isNotice(notice) ? notice : null
}

/** The list URL kept in the state; only paths of the given tab are accepted (the students tab by default). */
export function listFromState(state: unknown, tab = '/students'): string | null {
  const from = (state as StudentNavState | null)?.from
  return typeof from === 'string' && new RegExp(`^${tab}(\\?|$)`).test(from) ? from : null
}

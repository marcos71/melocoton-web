import type { PieceStatus } from '../api/pieceTypes'
import { formatDate } from './format'
import { workshopNow } from './workshopTime'

/** The four states in the order of a piece's life; the PWA knows only the order and the names (RN-04 is the API's). */
export const PIECE_STATUSES: readonly PieceStatus[] = [
  'IN_PROGRESS',
  'BISQUE_FIRED',
  'GLAZED',
  'FINISHED',
]

const LABELS: Record<PieceStatus, string> = {
  IN_PROGRESS: 'En proceso',
  BISQUE_FIRED: 'Bizcochada',
  GLAZED: 'Esmaltada',
  FINISHED: 'Terminada',
}

const PLURALS: Record<PieceStatus, string> = {
  IN_PROGRESS: 'En proceso',
  BISQUE_FIRED: 'Bizcochadas',
  GLAZED: 'Esmaltadas',
  FINISHED: 'Terminadas',
}

/** What each state says about the road ahead, on the student's detail (DI-86). */
export const PIECE_STATUS_HINT: Record<PieceStatus, string> = {
  IN_PROGRESS: 'Falta bizcochar, esmaltar y hornear de nuevo.',
  BISQUE_FIRED: 'Falta esmaltar y hornear de nuevo.',
  GLAZED: 'Falta el último horneado.',
  FINISHED: 'Ya pasó por todos los horneados.',
}

export const PIECE_STEP_COUNT = PIECE_STATUSES.length

/** "En proceso", "Bizcochada", "Esmaltada" or "Terminada". */
export function pieceStatusLabel(status: PieceStatus): string {
  return LABELS[status]
}

/** "En proceso", "Bizcochadas"…: the status naming a group of pieces. */
export function pieceStatusPlural(status: PieceStatus): string {
  return PLURALS[status]
}

/** 1 to 4: the place of the status in the piece's life, for "Paso n de 4". */
export function pieceStep(status: PieceStatus): number {
  return PIECE_STATUSES.indexOf(status) + 1
}

/** "29 de oct de 2026": an instant on the workshop's calendar. */
export function pieceDate(instant: string): string {
  return formatDate(workshopNow(new Date(instant)).date)
}

export type HistoryEntryLike = {
  eventType: 'CREATED' | 'ADVANCED' | 'REVERTED' | 'VOIDED'
  previousStatus?: PieceStatus | null
  newStatus?: PieceStatus | null
  occurredAt: string
}

/** "29 de oct de 2026 · Bizcochada a Esmaltada", or "… · Pieza creada en En proceso". */
export function historyEntryText(entry: HistoryEntryLike): string {
  const date = pieceDate(entry.occurredAt)
  const { previousStatus, newStatus } = entry
  if (entry.eventType === 'VOIDED') return `${date} · Pieza anulada`
  if (entry.eventType === 'CREATED' || !previousStatus) {
    return newStatus ? `${date} · Pieza creada en ${pieceStatusLabel(newStatus)}` : `${date} · Pieza creada`
  }
  if (!newStatus) return `${date} · ${pieceStatusLabel(previousStatus)}`
  return `${date} · ${pieceStatusLabel(previousStatus)} a ${pieceStatusLabel(newStatus)}`
}

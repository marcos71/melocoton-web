import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { actionErrorText, isTimeout } from '../api/actionErrors'
import { ApiError, NETWORK_ERROR } from '../api/errors'
import type { PieceStatus } from '../api/pieceTypes'
import {
  piecesListKey,
  pieceConflictDetails,
  refetchFromFirstPage,
  useBulkChangePieceStatus,
  type usePiecesQuery,
  type PieceItem,
} from '../api/pieces'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DisabledReason } from '../components/DisabledReason'
import { Notice } from '../components/Notice'
import { PieceStatusTag } from '../components/PieceStatusTag'
import { StatusBadge } from '../components/StatusBadge'
import type { NoticeData } from '../lib/navState'
import { pieceStatusLabel } from '../lib/pieceStatus'
import { PiecesLoadMore } from './PiecesLoadMore'
import pieceStyles from './Pieces.module.css'
import screenStyles from './Screen.module.css'
import styles from './PieceSelection.module.css'

/** The technical cap of one operation (DI-69). */
export const MAX_BULK_PIECES = 500

const BULK_TIMEOUT_TEXT =
  'La API tardó demasiado. No sabemos si se aplicó: revisá la lista antes de intentar de nuevo.'

/** A notice for the screen to show; with `onRefresh` it comes with an "Actualizar lista" button. */
export type NoticeRequest = { notice: NoticeData; onRefresh?: () => void }

type PieceSelectionProps = {
  query: ReturnType<typeof usePiecesQuery>
  /** The status filter of the list: selecting needs one origin status chosen first (DI-50). */
  status: PieceStatus | 'ALL'
  onNotice: (request: NoticeRequest) => void
  /** "Cancelar selección": leave the mode keeping the filters. */
  onCancel: () => void
  /** The operation was applied: leave the mode. */
  onDone: () => void
}

type Selection = {
  /** The status every piece shares; the most common one when they differ. */
  commonStatus: PieceStatus | null
  nextStatus: PieceStatus | null
  /** Some piece differs from the rest or has no next status (6h). */
  mixed: boolean
  studentCount: number
}

function analyse(items: PieceItem[]): Selection {
  const counts = new Map<PieceStatus, number>()
  for (const item of items) counts.set(item.status, (counts.get(item.status) ?? 0) + 1)
  let commonStatus: PieceStatus | null = null
  let best = 0
  for (const [candidate, count] of counts) {
    if (count > best) {
      commonStatus = candidate
      best = count
    }
  }
  const nextStatus = items.find((item) => item.status === commonStatus)?.advanceTo ?? null
  return {
    commonStatus,
    nextStatus,
    mixed: counts.size > 1 || items.some((item) => !item.advanceTo),
    studentCount: new Set(items.map((item) => item.student.id)).size,
  }
}

function pieces(count: number): string {
  return count === 1 ? '1 pieza' : `${count} piezas`
}

function students(count: number): string {
  return count === 1 ? '1 alumno' : `${count} alumnos`
}

/**
 * CU-14, RF-29, RF-30, DI-50, DI-69, DI-83, DI-84: tick pieces and move them to the next status in
 * one operation. Each piece is kept as it was shown when it was ticked, and its status then is
 * the `expectedStatus` sent (D-34).
 */
export function PieceSelection({ query, status, onNotice, onCancel, onDone }: PieceSelectionProps) {
  const queryClient = useQueryClient()
  const bulk = useBulkChangePieceStatus()
  const [selected, setSelected] = useState<Map<number, PieceItem>>(() => new Map())
  const [summaryOpen, setSummaryOpen] = useState(false)
  const summaryButton = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const cardAt = useCallback((index: number) => listRef.current?.children[index], [])

  // Only after an origin status is chosen do the pieces show (6b).
  if (status === 'ALL') return null

  const loaded = query.data ?? []
  const eligible = loaded.filter((piece) => piece.advanceTo)
  const everyEligibleTicked = eligible.length > 0 && eligible.every((piece) => selected.has(piece.id))
  const chosen = [...selected.values()]
  const count = chosen.length
  const { commonStatus, nextStatus, mixed, studentCount } = analyse(chosen)
  const hasNext = query.hasNextPage

  function toggle(piece: PieceItem) {
    setSelected((previous) => {
      const next = new Map(previous)
      if (next.has(piece.id)) next.delete(piece.id)
      else next.set(piece.id, piece)
      return next
    })
  }

  function toggleAll() {
    setSelected((previous) => {
      if (everyEligibleTicked) return new Map()
      const next = new Map(previous)
      for (const piece of eligible) if (!next.has(piece.id)) next.set(piece.id, piece)
      return next
    })
  }

  function refreshList() {
    setSelected(new Map())
    void refetchFromFirstPage(queryClient, piecesListKey)
  }

  function onBulkError(error: unknown) {
    setSummaryOpen(false)
    if (error instanceof ApiError && error.code === NETWORK_ERROR) {
      if (isTimeout(error)) {
        // Unknown if it applied: the hook already reloads the list, so the selection starts over.
        setSelected(new Map())
        onNotice({ notice: { kind: 'error', text: BULK_TIMEOUT_TEXT } })
      } else {
        onNotice({ notice: { kind: 'error', text: actionErrorText(error) } })
      }
      return
    }
    const conflicts = error instanceof ApiError ? pieceConflictDetails(error) : null
    if (error instanceof ApiError && error.code === 'status_conflict' && conflicts) {
      const items = conflicts.map((entry) => {
        const owner = selected.get(entry.id)?.student.name
        const who = owner ? ` (${owner})` : ''
        return entry.reason === 'VOIDED'
          ? `${entry.name}${who} fue anulada mientras tanto.`
          : `Alguien modificó ${entry.name}${who} mientras elegías.`
      })
      onNotice({
        notice: {
          kind: 'error',
          text: 'No se aplicó ningún cambio',
          items,
          footer: 'Actualizá la lista y volvé a elegir.',
        },
        onRefresh: refreshList,
      })
      return
    }
    onNotice({ notice: { kind: 'error', text: actionErrorText(error) }, onRefresh: refreshList })
  }

  function confirm() {
    bulk.mutate(
      chosen.map((piece) => ({ pieceId: piece.id, expectedStatus: piece.status })),
      {
        onSuccess: (result) => {
          setSummaryOpen(false)
          onNotice({
            notice: {
              kind: 'success',
              text:
                result.count === 1
                  ? `1 pieza pasó a ${pieceStatusLabel(result.newStatus)}.`
                  : `${result.count} piezas pasaron a ${pieceStatusLabel(result.newStatus)}.`,
              footer: 'Los alumnos ya lo ven en Mis piezas.',
            },
          })
          onDone()
        },
        onError: onBulkError,
      },
    )
  }

  function cancelSummary() {
    setSummaryOpen(false)
    summaryButton.current?.focus()
  }

  function badgeFor(piece: PieceItem): string | null {
    const snapshot = selected.get(piece.id)
    if (!mixed || !snapshot) return null
    if (!snapshot.advanceTo) return 'Sin estado siguiente'
    return snapshot.status === commonStatus ? null : 'Otro estado'
  }

  const targetText = nextStatus ? ` a ${pieceStatusLabel(nextStatus)}` : ''

  return (
    <>
      <div className={styles.toolbar}>
        <button type="button" className={screenStyles.secondaryButton} onClick={toggleAll}>
          {everyEligibleTicked
            ? 'Quitar selección'
            : hasNext
              ? `Seleccionar las ${loaded.length} cargadas`
              : 'Seleccionar todas'}
        </button>
        <button type="button" className={screenStyles.secondaryButton} onClick={onCancel}>
          Cancelar selección
        </button>
        {hasNext && !everyEligibleTicked && (
          <p className={styles.hint}>Hay más piezas: tocá Cargar más para sumarlas.</p>
        )}
      </div>

      {mixed && (
        <Notice
          kind="error"
          text="No se puede continuar. Elegiste piezas en estados distintos o piezas Terminadas, que no tienen estado siguiente. Sacá las marcadas."
        />
      )}

      <ul ref={listRef} className={pieceStyles.list}>
        {loaded.map((piece) => {
          const badge = badgeFor(piece)
          return (
            <li key={piece.id}>
              <label className={styles.card}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={selected.has(piece.id)}
                  onChange={() => toggle(piece)}
                />
                <span className={styles.body}>
                  <span className={pieceStyles.name}>{piece.name}</span>
                  <span className={pieceStyles.student}>De {piece.student.name}</span>
                  <PieceStatusTag status={piece.status} />
                  {badge && <StatusBadge>{badge}</StatusBadge>}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      <PiecesLoadMore query={query} cardAt={cardAt} />

      <div className={styles.bar}>
        <p aria-live="polite" className={styles.counter}>
          {`${count} ${count === 1 ? 'seleccionada' : 'seleccionadas'} de ${loaded.length}${hasNext ? ' cargadas' : ''}`}
        </p>
        {count === 0 ? (
          <DisabledReason primary label="Ver resumen" reason="Elegí al menos una pieza." />
        ) : count > MAX_BULK_PIECES ? (
          <DisabledReason primary label="Ver resumen" reason="Elegí hasta 500 piezas por vez." />
        ) : mixed || !commonStatus || !nextStatus ? (
          <DisabledReason primary label="Ver resumen" reason="Sacá las piezas marcadas." />
        ) : (
          <button
            ref={summaryButton}
            type="button"
            className={screenStyles.button}
            onClick={() => setSummaryOpen(true)}
          >
            {`Ver resumen: ${pieces(count)}${targetText}`}
          </button>
        )}
      </div>

      {summaryOpen && commonStatus && nextStatus && (
        <ConfirmDialog
          title="Resumen de la operación"
          description={`${pieces(count)} de ${students(studentCount)} ${count === 1 ? 'pasará' : 'pasarán'} de ${pieceStatusLabel(commonStatus)} a ${pieceStatusLabel(nextStatus)}.`}
          confirmLabel="Confirmar cambio"
          pendingLabel="Aplicando el cambio…"
          pending={bulk.isPending}
          onConfirm={confirm}
          onCancel={cancelSummary}
        >
          <div className={styles.dialogBody}>
            <p className={styles.dialogText}>Se aplica a todas o a ninguna.</p>
            <Notice
              kind="warning"
              text="No se puede deshacer. Si te equivocás en una pieza, la podés retroceder de a una desde su detalle."
            />
            {bulk.isPending && (
              <p role="status" className={styles.dialogText}>
                {count === 1 ? 'Es 1 pieza.' : `Son ${count} piezas.`} Tarda unos segundos.
              </p>
            )}
          </div>
        </ConfirmDialog>
      )}
    </>
  )
}

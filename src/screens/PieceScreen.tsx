import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { actionErrorText, readErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import type { PieceStatus } from '../api/pieceTypes'
import {
  pieceConflictDetails,
  useChangePieceStatus,
  usePieceQuery,
  type PieceDetail,
} from '../api/pieces'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Notice } from '../components/Notice'
import { PieceHistory } from '../components/PieceHistory'
import { PieceProgress } from '../components/PieceProgress'
import { PieceStatusTag } from '../components/PieceStatusTag'
import { QueryError } from '../components/QueryError'
import { useBackTarget } from '../layout/backTarget'
import { listFromState, noticeFromState, type NoticeData } from '../lib/navState'
import { pieceStatusLabel } from '../lib/pieceStatus'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { useRouteId } from '../lib/useRouteId'
import styles from './PieceScreen.module.css'
import { PieceUnavailable } from './PieceUnavailable'
import screenStyles from './Screen.module.css'

const TIMEOUT_TEXT =
  'La API tardó demasiado. No sabemos si se guardó: revisá la pieza antes de intentar de nuevo.'

/** The change the confirmation dialog is about: an advance or a revert (RN-05), to the status the API offered. */
type PendingChange = { kind: 'advance' | 'revert'; to: PieceStatus }

/** CU-13, RF-26 to RF-28: a piece with its status actions, its data and its history (screen 6, DI-81). */
export function PieceScreen() {
  const id = useRouteId()
  const location = useLocation()
  const listUrl = listFromState(location.state, '/pieces')
  const piece = usePieceQuery(id)
  const [gone, setGone] = useState(false)
  useBackTarget({ to: listUrl ?? '/pieces', label: 'Piezas' })

  const notFound = piece.error instanceof ApiError && piece.error.status === 404
  if (!Number.isInteger(id) || gone || notFound) {
    return (
      <PieceUnavailable
        backTo={listUrl ?? '/pieces'}
        backLabel="Volver a Piezas"
        text="Puede haber sido anulada. Volvé a Piezas para ver las demás."
      />
    )
  }
  if (piece.data) {
    return (
      <PieceDetailView
        piece={piece.data}
        detailsLoading={piece.isPlaceholderData}
        listUrl={listUrl}
        onGone={() => setGone(true)}
      />
    )
  }
  if (piece.isError) {
    return (
      <section className={screenStyles.screen}>
        <QueryError
          title="No pudimos cargar la pieza"
          reason={readErrorText(piece.error)}
          onRetry={() => void piece.refetch()}
          retrying={piece.isFetching}
        />
        <Link className={screenStyles.secondaryButton} to={listUrl ?? '/pieces'}>
          Volver a Piezas
        </Link>
      </section>
    )
  }
  return (
    <section className={screenStyles.screen}>
      <p role="status">Cargando la pieza…</p>
    </section>
  )
}

/** What the person is told when the change did not apply, or `null` when the piece is gone (404 or voided meanwhile). */
function failureNotice(error: unknown, piece: PieceDetail): NoticeData | null {
  if (error instanceof ApiError) {
    if (error.status === 404) return null
    if (error.code === 'status_conflict') {
      const voided = pieceConflictDetails(error)?.some(
        (conflict) => conflict.id === piece.id && conflict.reason === 'VOIDED',
      )
      if (voided) return null
    }
    if (error.code === 'duplicate_piece_name') {
      return {
        kind: 'error',
        text: `No se aplicó el cambio. ${piece.student.name} ya tiene otra pieza sin terminar llamada ${piece.name}. Cambiá el nombre de una de las dos y volvé a intentar.`,
      }
    }
    if (error.code === 'status_conflict' || error.code === 'invalid_transition') {
      return {
        kind: 'error',
        text: `No se aplicó el cambio. Alguien cambió ${piece.name} mientras tanto. Actualizamos la pieza: revisá su estado y volvé a intentar.`,
      }
    }
  }
  return { kind: 'error', text: actionErrorText(error, { onTimeout: TIMEOUT_TEXT }) }
}

type PieceDetailViewProps = {
  piece: PieceDetail
  /** Notes and history come with the detail, not with the list the piece was first read from. */
  detailsLoading: boolean
  listUrl: string | null
  onGone: () => void
}

function PieceDetailView({ piece, detailsLoading, listUrl, onGone }: PieceDetailViewProps) {
  const location = useLocation()
  const headingRef = useHeadingFocus()
  const changeStatus = useChangePieceStatus()
  const [notice, setNotice] = useState<NoticeData | null>(() => noticeFromState(location.state))
  const [change, setChange] = useState<PendingChange | null>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  const focusNotice = useRef(false)
  const openerRef = useRef<HTMLElement | null>(null)
  const childState = listUrl ? { from: listUrl } : undefined

  // The notice of an action takes the focus: the button that opened the dialog may be gone.
  useEffect(() => {
    if (notice && focusNotice.current) {
      focusNotice.current = false
      noticeRef.current?.focus()
    }
  }, [notice])

  function announce(next: NoticeData) {
    focusNotice.current = true
    setNotice(next)
  }

  function open(next: PendingChange, opener: HTMLElement) {
    openerRef.current = opener
    setChange(next)
  }

  function cancel() {
    setChange(null)
    openerRef.current?.focus()
  }

  function confirm() {
    if (!change) return
    const { kind, to } = change
    changeStatus.mutate(
      { id: piece.id, expectedStatus: piece.status, newStatus: to },
      {
        onSuccess: (updated) => {
          setChange(null)
          const label = pieceStatusLabel(updated.status)
          announce({
            kind: 'success',
            text:
              kind === 'advance'
                ? `${updated.name} pasó a ${label}.`
                : `${updated.name} volvió a ${label}. Quedó como corrección.`,
          })
        },
        onError: (error) => {
          setChange(null)
          const failure = failureNotice(error, piece)
          if (failure) announce(failure)
          else onGone()
        },
      },
    )
  }

  const advanceTo = piece.advanceTo ?? null
  const revertTo = piece.revertTo ?? null
  const currentLabel = pieceStatusLabel(piece.status)

  return (
    <section className={styles.page}>
      <div className={styles.titleBlock}>
        <h1 ref={headingRef} tabIndex={-1} className={screenStyles.title}>
          {piece.name}
        </h1>
        <p className={styles.owner}>De {piece.student.name}</p>
      </div>

      <div ref={noticeRef} tabIndex={-1} className={styles.noticeArea}>
        {notice && <Notice {...notice} onClose={() => setNotice(null)} />}
      </div>

      <section className={styles.card} aria-labelledby="piece-status">
        <div className={styles.statusRow}>
          <PieceStatusTag status={piece.status} />
          <h2 id="piece-status">Estado actual</h2>
        </div>
        <PieceProgress status={piece.status} />
        {(advanceTo || revertTo) && (
          <div className={screenStyles.actions}>
            {advanceTo && (
              <button
                type="button"
                className={screenStyles.button}
                onClick={(event) => open({ kind: 'advance', to: advanceTo }, event.currentTarget)}
              >
                Pasar a {pieceStatusLabel(advanceTo)}
              </button>
            )}
            {revertTo && (
              <button
                type="button"
                className={screenStyles.secondaryButton}
                onClick={(event) => open({ kind: 'revert', to: revertTo }, event.currentTarget)}
              >
                Volver a {pieceStatusLabel(revertTo)}
              </button>
            )}
          </div>
        )}
      </section>

      <section className={styles.card} aria-labelledby="piece-data">
        <h2 id="piece-data" className={styles.cardTitle}>
          Datos
        </h2>
        <dl className={styles.data}>
          <dt>Nombre</dt>
          <dd>{piece.name}</dd>
          <dt>Notas</dt>
          <dd>{detailsLoading ? 'Cargando notas…' : piece.notes ? piece.notes : 'Sin notas'}</dd>
        </dl>
        <Link
          className={screenStyles.secondaryButton}
          to={`/pieces/${piece.id}/edit`}
          state={childState}
        >
          Editar nombre y notas
        </Link>
      </section>

      <section className={styles.card} aria-labelledby="piece-history">
        <h2 id="piece-history" className={styles.cardTitle}>
          Historial
        </h2>
        {detailsLoading ? (
          <p className={styles.muted}>Cargando historial…</p>
        ) : (
          <PieceHistory entries={piece.history} showAuthor />
        )}
      </section>

      <div className={styles.voidBlock}>
        <Link
          className={screenStyles.secondaryButton}
          to={`/pieces/${piece.id}/void`}
          state={childState}
        >
          Anular pieza
        </Link>
        <p>La pieza deja de verse en las listas, también para el alumno.</p>
      </div>

      {change && (
        <ConfirmDialog
          title={change.kind === 'advance' ? 'Avance individual' : `Volver a ${pieceStatusLabel(change.to)}`}
          description={
            change.kind === 'advance'
              ? `${piece.name} · ${piece.student.name} pasa de ${currentLabel} a ${pieceStatusLabel(change.to)}.`
              : `${piece.name} vuelve de ${currentLabel} a ${pieceStatusLabel(change.to)}. Queda registrado como corrección.`
          }
          confirmLabel="Confirmar"
          pendingLabel="Guardando…"
          pending={changeStatus.isPending}
          onConfirm={confirm}
          onCancel={cancel}
        />
      )}
    </section>
  )
}

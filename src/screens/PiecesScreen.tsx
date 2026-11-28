import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { actionErrorText, readErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import type { PieceStatus } from '../api/pieceTypes'
import {
  pieceConflictDetails,
  useChangePieceStatus,
  usePiecesQuery,
  type PieceFilters,
  type PieceItem,
} from '../api/pieces'
import { useStudentDirectoryQuery } from '../api/students'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DisabledReason } from '../components/DisabledReason'
import { Notice } from '../components/Notice'
import { PieceStatusTag } from '../components/PieceStatusTag'
import { QueryError } from '../components/QueryError'
import { StatusFilter } from '../components/StatusFilter'
import { StudentPicker } from '../components/StudentPicker'
import { noticeFromState, type NoticeData } from '../lib/navState'
import { PIECE_STATUSES, pieceStatusLabel, pieceStatusPlural } from '../lib/pieceStatus'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { PieceSelection, type NoticeRequest } from './PieceSelection'
import { PiecesLoadMore } from './PiecesLoadMore'
import styles from './Pieces.module.css'
import screenStyles from './Screen.module.css'

type UrlStatus = PieceStatus | 'ALL'

const STATUS_OPTIONS: { value: UrlStatus; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  ...PIECE_STATUSES.map((status) => ({ value: status, label: pieceStatusLabel(status) })),
]
/** The states a piece can leave: Terminada has no next one (RN-04). */
const ORIGIN_OPTIONS = STATUS_OPTIONS.filter(
  (option) => option.value !== 'ALL' && option.value !== 'FINISHED',
)
const SKELETON_CARDS = [0, 1, 2]
const CHANGE_TIMEOUT_TEXT =
  'La API tardó demasiado. No sabemos si se guardó: revisá la pieza antes de intentar de nuevo.'

/** An invalid value in the URL is ignored, so the API never gets a malformed filter. */
function parseStatus(raw: string | null): UrlStatus {
  return PIECE_STATUSES.find((status) => status === raw) ?? 'ALL'
}

function parseStudent(raw: string | null): number | null {
  return raw !== null && /^[1-9]\d{0,14}$/.test(raw) ? Number(raw) : null
}

type ShownNotice = NoticeRequest & { id: number; focus: boolean }

/** The error notice of an individual advance (6g). */
function advanceErrorNotice(error: unknown, piece: PieceItem): NoticeData {
  const conflicting = error instanceof ApiError ? pieceConflictDetails(error) : null
  const voided =
    (error instanceof ApiError && error.status === 404) ||
    (conflicting?.some((entry) => entry.id === piece.id && entry.reason === 'VOIDED') ?? false)
  if (voided) {
    return { kind: 'error', text: `No se aplicó el cambio. ${piece.name} fue anulada mientras tanto.` }
  }
  const changed =
    error instanceof ApiError && (error.code === 'status_conflict' || error.code === 'invalid_transition')
  if (changed) {
    return {
      kind: 'error',
      text: `No se aplicó el cambio. Alguien cambió ${piece.name} mientras tanto. Actualizamos la lista: revisá su estado y volvé a intentar.`,
    }
  }
  return { kind: 'error', text: actionErrorText(error, { onTimeout: CHANGE_TIMEOUT_TEXT }) }
}

function emptyFilterText(studentName: string | null, status: UrlStatus): string {
  const plural = status === 'ALL' ? null : pieceStatusPlural(status).toLowerCase()
  if (studentName && plural) return `${studentName} no tiene piezas ${plural}.`
  if (studentName) return `${studentName} no tiene piezas.`
  return `No hay piezas ${plural}.`
}

/** CU-13, CU-14, RF-29, RF-32, DI-78: the pieces of every student, with filters in the URL. */
export function PiecesScreen() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const headingRef = useHeadingFocus()

  const status = parseStatus(params.get('status'))
  const studentId = parseStudent(params.get('student'))

  const [selecting, setSelecting] = useState(false)
  const [notice, setNotice] = useState<ShownNotice | null>(() => {
    const fromState = noticeFromState(location.state)
    return fromState ? { id: 1, notice: fromState, focus: false } : null
  })
  const [advancing, setAdvancing] = useState<PieceItem | null>(null)
  const advanceOpener = useRef<HTMLElement | null>(null)
  const selectButton = useRef<HTMLButtonElement>(null)
  const restoreSelectFocus = useRef(false)
  const noticeCounter = useRef(1)
  const listRef = useRef<HTMLUListElement>(null)
  const noticeRef = useRef<HTMLDivElement>(null)

  const filters: PieceFilters = {
    ...(studentId === null ? {} : { studentId }),
    ...(status === 'ALL' ? {} : { status }),
  }
  const directory = useStudentDirectoryQuery('ALL')
  const pieces = usePiecesQuery(filters, { autoRefresh: !selecting })
  const changeStatus = useChangePieceStatus()

  useEffect(() => {
    if (!selecting && restoreSelectFocus.current) {
      restoreSelectFocus.current = false
      selectButton.current?.focus()
    }
  }, [selecting])

  // A new notice takes the focus: the piece it talks about may have left the list.
  useEffect(() => {
    if (notice?.focus) noticeRef.current?.focus()
  }, [notice])

  const cardAt = useCallback((index: number) => listRef.current?.children[index], [])

  function showNotice(request: NoticeRequest) {
    noticeCounter.current += 1
    setNotice({ ...request, id: noticeCounter.current, focus: true })
  }

  function setParam(name: string, value: string | null) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value === null) next.delete(name)
        else next.set(name, value)
        return next
      },
      { replace: true },
    )
    setNotice(null)
  }

  function startAdvance(piece: PieceItem, opener: HTMLElement) {
    advanceOpener.current = opener
    setAdvancing(piece)
  }

  function cancelAdvance() {
    setAdvancing(null)
    advanceOpener.current?.focus()
  }

  function confirmAdvance(piece: PieceItem) {
    if (!piece.advanceTo) return
    changeStatus.mutate(
      { id: piece.id, expectedStatus: piece.status, newStatus: piece.advanceTo },
      {
        onSuccess: (updated) => {
          setAdvancing(null)
          showNotice({
            notice: { kind: 'success', text: `${updated.name} pasó a ${pieceStatusLabel(updated.status)}.` },
          })
        },
        onError: (error) => {
          setAdvancing(null)
          showNotice({ notice: advanceErrorNotice(error, piece) })
        },
      },
    )
  }

  function leaveSelection(restoreFocus: boolean) {
    restoreSelectFocus.current = restoreFocus
    setSelecting(false)
  }

  const from = location.pathname + location.search
  const newPieceTo = studentId === null ? '/pieces/new' : `/pieces/new?student=${studentId}`
  const studentName = directory.data?.find((student) => student.id === studentId)?.name ?? null
  const items = pieces.data ?? []
  const hasFilters = studentId !== null || status !== 'ALL'
  // A failed next page leaves the status in error but keeps the loaded pieces, which stay on screen.
  const hasData = pieces.data !== undefined
  const canSelect = hasData && items.length > 0
  // An emptied list ends the selection screen, whatever the flag says.
  const inSelection = selecting && canSelect
  const showList = canSelect && !selecting

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 ref={headingRef} tabIndex={-1} className={screenStyles.title}>
          Piezas
        </h1>
        {!inSelection && (
          <Link className={screenStyles.button} to={newPieceTo}>
            Nueva pieza
          </Link>
        )}
      </div>

      {notice && (
        <div ref={noticeRef} className={styles.noticeArea} tabIndex={-1}>
          <Notice {...notice.notice} />
          {notice.onRefresh && (
            <button
              type="button"
              className={screenStyles.button}
              onClick={() => {
                setNotice(null)
                notice.onRefresh?.()
              }}
            >
              Actualizar lista
            </button>
          )}
        </div>
      )}

      <div className={styles.filters}>
        <StudentPicker
          label="Alumno"
          students={directory.data}
          state={directory.isPending ? 'loading' : directory.isError ? 'error' : 'ready'}
          onRetry={() => void directory.refetch()}
          value={studentId}
          onChange={(id) => setParam('student', id === null ? null : String(id))}
          allOptionLabel="Todos los alumnos"
        />
        {inSelection && status === 'ALL' && <p className={styles.prompt}>¿Qué piezas vas a pasar de estado?</p>}
        <StatusFilter
          options={inSelection ? ORIGIN_OPTIONS : STATUS_OPTIONS}
          value={status}
          onChange={(value) => setParam('status', value === 'ALL' ? null : value)}
        />
        {!inSelection && canSelect && status === 'FINISHED' && (
          <DisabledReason
            label="Seleccionar varias"
            reason="Las piezas Terminadas no tienen estado siguiente."
          />
        )}
        {!inSelection && canSelect && status !== 'FINISHED' && (
          <button
            ref={selectButton}
            type="button"
            className={screenStyles.secondaryButton}
            onClick={() => setSelecting(true)}
          >
            Seleccionar varias
          </button>
        )}
      </div>

      <p aria-live="polite" className={styles.count}>
        {showList
          ? pieces.hasNextPage
            ? `${items.length} piezas cargadas. Hay más.`
            : items.length === 1
              ? '1 pieza'
              : `${items.length} piezas`
          : ''}
      </p>

      {pieces.isPending && (
        <div>
          <p role="status">Cargando las piezas…</p>
          <ul className={styles.list} aria-hidden="true">
            {SKELETON_CARDS.map((card) => (
              <li key={card} className={styles.skeleton} />
            ))}
          </ul>
        </div>
      )}

      {pieces.isError && !hasData && (
        <QueryError
          title="No pudimos cargar las piezas"
          reason={readErrorText(pieces.error)}
          onRetry={() => void pieces.refetch()}
          retrying={pieces.isFetching}
        />
      )}

      {hasData && items.length === 0 && (
        <div className={screenStyles.empty}>
          {hasFilters ? (
            <>
              <h2 className={styles.emptyTitle}>No hay piezas con este filtro</h2>
              <p className={styles.emptyText}>
                {emptyFilterText(studentId === null ? null : (studentName ?? 'Este alumno'), status)}
              </p>
              <button
                type="button"
                className={screenStyles.secondaryButton}
                onClick={() => setParams({}, { replace: true })}
              >
                Quitar filtros
              </button>
            </>
          ) : (
            <>
              <svg className={styles.splash} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                <circle cx="14" cy="16" r="5" />
                <circle cx="32" cy="12" r="3" />
                <circle cx="36" cy="30" r="6" />
                <circle cx="18" cy="36" r="3" />
              </svg>
              <h2 className={styles.emptyTitle}>Todavía no hay piezas</h2>
              <p className={styles.emptyText}>
                Creá la primera con <strong>Nueva pieza</strong>.
              </p>
            </>
          )}
        </div>
      )}

      {inSelection && (
        <PieceSelection
          // Changing the student or the status starts a new selection.
          key={`${studentId ?? ''}-${status}`}
          query={pieces}
          status={status}
          onNotice={showNotice}
          onCancel={() => leaveSelection(true)}
          onDone={() => leaveSelection(false)}
        />
      )}

      {showList && (
        <>
          <ul ref={listRef} className={styles.list}>
            {items.map((piece) => (
              <li key={piece.id} className={styles.card}>
                <Link
                  className={styles.cardLink}
                  to={`/pieces/${piece.id}`}
                  state={{ from }}
                  aria-label={`${piece.name}, de ${piece.student.name}, ${pieceStatusLabel(piece.status)}`}
                >
                  <span id={`piece-${piece.id}-name`} className={styles.name}>
                    {piece.name}
                  </span>
                  <span className={styles.student}>De {piece.student.name}</span>
                  <PieceStatusTag status={piece.status} />
                </Link>
                {piece.advanceTo && (
                  <button
                    type="button"
                    className={`${screenStyles.secondaryButton} ${styles.advance}`}
                    aria-describedby={`piece-${piece.id}-name`}
                    onClick={(event) => startAdvance(piece, event.currentTarget)}
                  >
                    Pasar a {pieceStatusLabel(piece.advanceTo)}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <PiecesLoadMore query={pieces} cardAt={cardAt} />
        </>
      )}

      {canSelect && <p className={styles.footer}>Las piezas anuladas no se muestran.</p>}

      {advancing?.advanceTo && (
        <ConfirmDialog
          title="Avance individual"
          description={`${advancing.name} · ${advancing.student.name} pasa de ${pieceStatusLabel(advancing.status)} a ${pieceStatusLabel(advancing.advanceTo)}.`}
          confirmLabel="Confirmar"
          pendingLabel="Guardando…"
          pending={changeStatus.isPending}
          onConfirm={() => confirmAdvance(advancing)}
          onCancel={cancelAdvance}
        />
      )}
    </section>
  )
}

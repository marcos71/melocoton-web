import { useCallback, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { readErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import { myPiecesListKey, useMyPiecesQuery, type MyPieceItem } from '../api/myPieces'
import { refetchFromFirstPage } from '../api/pagination'
import { LoadMore } from '../components/LoadMore'
import { Notice } from '../components/Notice'
import { PieceProgress } from '../components/PieceProgress'
import { PieceStatusTag } from '../components/PieceStatusTag'
import { QueryError } from '../components/QueryError'
import { noticeFromState, type NoticeData } from '../lib/navState'
import { pieceDate, pieceStatusLabel, pieceStep } from '../lib/pieceStatus'
import { useFocusFirstNew } from '../lib/useFocusFirstNew'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import styles from './MyPieces.module.css'
import screenStyles from './Screen.module.css'

const SKELETON_CARDS = [0, 1, 2]

function accessibleName(piece: MyPieceItem): string {
  return `${piece.name}, ${pieceStatusLabel(piece.status)}, paso ${pieceStep(piece.status)} de 4`
}

/** The next page failed because its cursor no longer matches the list (400 validation_error). */
function isStaleCursor(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400
}

/** Screen 2a, RF-31, CU-15: the student's own pieces with their state, newest update first. */
export function MyPiecesScreen() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const headingRef = useHeadingFocus()
  const pieces = useMyPiecesQuery()
  const [notice, setNotice] = useState<NoticeData | null>(() => noticeFromState(location.state))

  const items = pieces.data ?? []
  const listRef = useRef<HTMLUListElement>(null)

  // After "Cargar más piezas" the focus moves to the first new card (DI-87); it only moves, nothing is activated.
  const focusAt = useCallback((index: number) => listRef.current?.querySelectorAll('a')[index]?.focus(), [])
  const markFirstNew = useFocusFirstNew(items.length, focusAt)

  function loadMore() {
    markFirstNew()
    void pieces.fetchNextPage()
  }

  const isEmpty = pieces.isSuccess && items.length === 0

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 ref={headingRef} tabIndex={-1} className={screenStyles.title}>
          Mis piezas
        </h1>
        {!isEmpty && (
          <Link className={screenStyles.button} to="/pieces/new">
            Nueva pieza
          </Link>
        )}
      </div>

      {notice && <Notice {...notice} onClose={() => setNotice(null)} />}

      {pieces.isPending && (
        <div>
          <p role="status">Cargando tus piezas…</p>
          <ul className={styles.skeletons} aria-hidden="true">
            {SKELETON_CARDS.map((card) => (
              <li key={card} className={styles.skeleton} />
            ))}
          </ul>
        </div>
      )}

      {pieces.isError && pieces.data === undefined && (
        <QueryError
          title="No pudimos cargar tus piezas"
          reason={readErrorText(pieces.error)}
          onRetry={() => void pieces.refetch()}
          retrying={pieces.isFetching}
        />
      )}

      {isEmpty && (
        <div className={styles.empty}>
          <svg className={styles.splash} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <circle cx="14" cy="16" r="5" />
            <circle cx="32" cy="12" r="3" />
            <circle cx="36" cy="30" r="6" />
            <circle cx="18" cy="36" r="3" />
          </svg>
          <h2>Todavía no tenés piezas</h2>
          <p>Cuando crees una o la docente la cargue, la vas a ver acá con su estado.</p>
          <Link className={screenStyles.button} to="/pieces/new">
            Crear mi primera pieza
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <>
          <ul ref={listRef} className={styles.list}>
            {items.map((piece) => (
              <li key={piece.id}>
                <Link
                  className={styles.card}
                  to={`/pieces/${piece.id}`}
                  aria-label={accessibleName(piece)}
                >
                  <span className={styles.cardName}>{piece.name}</span>
                  <span className={styles.cardTags}>
                    <PieceStatusTag status={piece.status} />
                    <PieceProgress status={piece.status} />
                  </span>
                  <span className={styles.cardMeta}>Actualizada el {pieceDate(piece.updatedAt)}</span>
                  <span className={styles.cardMore}>Ver historial ›</span>
                </Link>
              </li>
            ))}
          </ul>
          <LoadMore
            hasNext={pieces.hasNextPage}
            loading={pieces.isFetchingNextPage}
            error={pieces.isFetchNextPageError}
            staleCursor={pieces.isFetchNextPageError && isStaleCursor(pieces.error)}
            onLoad={loadMore}
            onRefresh={() => void refetchFromFirstPage(queryClient, myPiecesListKey)}
          />
          <p className={styles.footer}>No se muestran piezas anuladas.</p>
        </>
      )}
    </section>
  )
}

import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { readErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import type { MyPieceDetail } from '../api/myPieces'
import { QueryError } from '../components/QueryError'
import { useBackTarget } from '../layout/backTarget'
import styles from './MyPieces.module.css'
import screenStyles from './Screen.module.css'
import { PieceUnavailable } from './PieceUnavailable'

const UNAVAILABLE_TEXT = 'Un docente la quitó de tu lista. Volvé a Mis piezas para ver las demás.'

/** Back target of the gate's own states; the loaded screens declare theirs. */
function BackToList() {
  useBackTarget({ to: '/pieces', label: 'Mis piezas' })
  return null
}

/** Screen 2e (DI-75): voided, someone else's or missing look the same, and there is no retry. */
export function MyPieceUnavailable() {
  return (
    <>
      <BackToList />
      <PieceUnavailable backTo="/pieces" backLabel="Volver a Mis piezas" text={UNAVAILABLE_TEXT} />
    </>
  )
}

type MyPieceGateProps = {
  id: number
  query: UseQueryResult<MyPieceDetail>
  children: (piece: MyPieceDetail) => ReactNode
}

/** The states the student's piece screens share: loading, not available (404, no retry) and a failed read. */
export function MyPieceGate({ id, query, children }: MyPieceGateProps) {
  if (!Number.isInteger(id)) return <MyPieceUnavailable />
  if (query.isSuccess) return <>{children(query.data)}</>
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <MyPieceUnavailable />
    return (
      <section className={screenStyles.screen}>
        <BackToList />
        <QueryError
          title="No pudimos cargar la pieza"
          reason={readErrorText(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
        <Link className={screenStyles.secondaryButton} to="/pieces">
          Volver a Mis piezas
        </Link>
      </section>
    )
  }
  return (
    <section className={screenStyles.screen}>
      <BackToList />
      <p role="status">Cargando la pieza…</p>
      <ul className={styles.skeletons} aria-hidden="true">
        <li className={styles.skeleton} />
      </ul>
    </section>
  )
}

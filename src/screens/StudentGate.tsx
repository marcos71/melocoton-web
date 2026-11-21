import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { readErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import type { StudentProfile } from '../api/students'
import { QueryError } from '../components/QueryError'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import styles from './Screen.module.css'

function StudentNotFound() {
  const headingRef = useHeadingFocus()
  return (
    <section className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Alumno
      </h1>
      <div role="alert" className={styles.alert}>
        <p className={styles.alertTitle}>
          <strong>Error:</strong> No encontramos a este alumno.
        </p>
      </div>
      <Link className={styles.link} to="/students">
        Volver a Alumnos
      </Link>
    </section>
  )
}

type StudentGateProps = {
  id: number
  query: UseQueryResult<StudentProfile>
  /** Shown while the student loads, for example "Cargando ficha…". */
  loadingText: string
  /** The title of the Error block when the read fails. */
  errorTitle: string
  children: (student: StudentProfile) => ReactNode
}

/** The states every student screen shares: loading, not found (404, no retry) and a failed read (4.5). */
export function StudentGate({ id, query, loadingText, errorTitle, children }: StudentGateProps) {
  if (!Number.isInteger(id)) return <StudentNotFound />
  if (query.isSuccess) return <>{children(query.data)}</>
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <StudentNotFound />
    return (
      <section className={styles.screen}>
        <QueryError
          title={errorTitle}
          reason={readErrorText(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
        <Link className={styles.link} to="/students">
          Volver a Alumnos
        </Link>
      </section>
    )
  }
  return (
    <section className={styles.screen}>
      <p role="status">{loadingText}</p>
    </section>
  )
}

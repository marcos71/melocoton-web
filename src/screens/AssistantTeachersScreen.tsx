import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import {
  useAssistantTeachersQuery,
  useDeactivateAssistantTeacher,
  type AssistantTeacher,
  type StatusFilter,
} from '../api/assistantTeachers'
import { errorMessage } from '../api/errors'
import { ConfirmDialog } from '../components/ConfirmDialog'
import screenStyles from './Screen.module.css'
import styles from './AssistantTeachersScreen.module.css'

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'all', label: 'Todos' },
]

const EMPTY_TEXT: Record<StatusFilter, string> = {
  active: 'No hay docentes secundarios activos.',
  inactive: 'No hay docentes secundarios inactivos.',
  all: 'Todavía no hay docentes secundarios.',
}

type Feedback = { kind: 'success' | 'error'; text: string }

function messageFromRouterState(state: unknown): string | null {
  const message = (state as { message?: unknown } | null)?.message
  return typeof message === 'string' ? message : null
}

/** CU-02 D1 and D1a: list, filter and deactivate assistant teachers (RF-53). */
export function AssistantTeachersScreen() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const raw = params.get('status')
  const filter: StatusFilter = raw === 'inactive' || raw === 'all' ? raw : 'active'

  const teachers = useAssistantTeachersQuery(filter)
  const deactivate = useDeactivateAssistantTeacher()
  const [target, setTarget] = useState<AssistantTeacher | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(() => {
    const message = messageFromRouterState(location.state)
    return message ? { kind: 'success', text: message } : null
  })

  function confirmDeactivation() {
    if (!target) return
    const teacher = target
    deactivate.mutate(teacher.id, {
      onSuccess: () => {
        setTarget(null)
        setFeedback({ kind: 'success', text: `${teacher.name} quedó desactivado.` })
      },
      onError: (error) => {
        setTarget(null)
        setFeedback({ kind: 'error', text: errorMessage(error) })
      },
    })
  }

  return (
    <section className={screenStyles.screen}>
      <Link className={screenStyles.link} to="/admin">
        <span aria-hidden="true">← </span>Ajustes
      </Link>
      <h1 className={screenStyles.title}>Docentes secundarios</h1>

      <Link className={screenStyles.button} to="/admin/assistant-teachers/new">
        Agregar docente
      </Link>

      <div role="group" aria-label="Filtrar por estado" className={styles.filters}>
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            className={filter === option.value ? `${styles.filter} ${styles.pressed}` : styles.filter}
            onClick={() => setParams({ status: option.value }, { replace: true })}
          >
            {option.label}
          </button>
        ))}
      </div>

      {feedback && (
        <p
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          className={feedback.kind === 'error' ? screenStyles.alert : screenStyles.notice}
        >
          {feedback.text}
        </p>
      )}

      {teachers.isPending && <p role="status">Cargando docentes…</p>}

      {teachers.isError && (
        <div role="alert" className={screenStyles.alert}>
          <p className={screenStyles.alertTitle}>No se pudo cargar la lista.</p>
          <p>{teachers.error.message}</p>
          <button
            type="button"
            className={screenStyles.button}
            onClick={() => void teachers.refetch()}
            disabled={teachers.isFetching}
          >
            {teachers.isFetching ? 'Reintentando…' : 'Reintentar'}
          </button>
        </div>
      )}

      {teachers.isSuccess && teachers.data.length === 0 && (
        <p className={screenStyles.empty}>{EMPTY_TEXT[filter]}</p>
      )}

      {teachers.isSuccess && teachers.data.length > 0 && (
        <ul className={styles.list}>
          {teachers.data.map((teacher) => (
            <li key={teacher.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <h2 className={styles.name}>{teacher.name}</h2>
                <span className={teacher.active ? styles.active : styles.inactive}>
                  {teacher.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p className={styles.detail}>{teacher.email}</p>
              <p className={styles.detail}>{teacher.phone}</p>
              {teacher.active && (
                <button
                  type="button"
                  className={screenStyles.secondaryButton}
                  aria-label={`Desactivar a ${teacher.name}`}
                  onClick={() => {
                    setFeedback(null)
                    setTarget(teacher)
                  }}
                >
                  Desactivar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {target && (
        <ConfirmDialog
          title={`¿Desactivar a ${target.name}?`}
          description="No va a poder iniciar sesión. En esta versión no se puede reactivar."
          confirmLabel="Desactivar"
          pendingLabel="Desactivando…"
          pending={deactivate.isPending}
          onConfirm={confirmDeactivation}
          onCancel={() => setTarget(null)}
        />
      )}
    </section>
  )
}

import { Link } from 'react-router'
import { useHealthQuery, type HealthResponse } from '../api/health'
import screenStyles from './Screen.module.css'
import styles from './HealthScreen.module.css'

type Status = HealthResponse['status']

const API_STATUS_TEXT: Record<Status, string> = {
  UP: 'Funcionando',
  DOWN: 'Con problemas',
}

const DATABASE_STATUS_TEXT: Record<Status, string> = {
  UP: 'Conectada',
  DOWN: 'Sin conexión',
}

/** Checks the connection with melocoton-api through GET /api/v1/health. */
export function HealthScreen() {
  const health = useHealthQuery()

  return (
    <section className={screenStyles.screen}>
      <Link className={screenStyles.link} to="/">
        <span aria-hidden="true">← </span>Volver al inicio
      </Link>
      <h1 className={screenStyles.title}>Estado de la conexión</h1>

      {health.isPending && <p role="status">Consultando el estado de la API…</p>}

      {health.isError && (
        <div role="alert" className={`${styles.card} ${styles.down}`}>
          <p className={styles.headline}>Error: No se pudo consultar el estado de la API.</p>
          <p>{health.error.message}</p>
          <button
            type="button"
            className={styles.button}
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
          >
            {health.isFetching ? 'Reintentando…' : 'Reintentar'}
          </button>
        </div>
      )}

      {health.isSuccess && (
        <div
          role="status"
          className={`${styles.card} ${health.data.status === 'UP' ? styles.up : styles.down}`}
        >
          <p className={styles.headline}>
            {health.data.status === 'UP'
              ? '✓ La API y la base de datos están funcionando.'
              : 'Error: La API responde, pero algo no está funcionando.'}
          </p>
          <dl className={styles.list}>
            <div className={styles.row}>
              <dt>API</dt>
              <dd>{API_STATUS_TEXT[health.data.status]}</dd>
            </div>
            <div className={styles.row}>
              <dt>Base de datos</dt>
              <dd>{DATABASE_STATUS_TEXT[health.data.database]}</dd>
            </div>
          </dl>
          <button
            type="button"
            className={styles.button}
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
          >
            {health.isFetching ? 'Consultando…' : 'Volver a consultar'}
          </button>
        </div>
      )}
    </section>
  )
}

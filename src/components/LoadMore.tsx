import screenStyles from '../screens/Screen.module.css'
import styles from './LoadMore.module.css'

type LoadMoreProps = {
  /** Whether the API said there is another page; without it nothing is rendered. */
  hasNext: boolean
  /** The next page is on its way. */
  loading: boolean
  /** The next page failed; the loaded cards stay where they are. */
  error: boolean
  /** The failure was a 400: the cursor no longer matches, so only a fresh list helps (DI-87). */
  staleCursor: boolean
  onLoad: () => void
  /** Goes back to the first page. */
  onRefresh: () => void
}

/** "Cargar más piezas" below the last card of a paged list, with its loading and error states (DI-87). */
export function LoadMore({ hasNext, loading, error, staleCursor, onLoad, onRefresh }: LoadMoreProps) {
  if (!hasNext) return null
  return (
    <div className={styles.block}>
      {error && (
        <p role="alert" className={styles.alert}>
          <strong>Error:</strong>{' '}
          {staleCursor ? 'La lista cambió mientras la mirabas.' : 'No pudimos cargar más piezas.'}
        </p>
      )}
      {error ? (
        <button
          type="button"
          className={screenStyles.secondaryButton}
          onClick={staleCursor ? onRefresh : onLoad}
        >
          {staleCursor ? 'Actualizar lista' : 'Reintentar'}
        </button>
      ) : (
        <button type="button" className={screenStyles.secondaryButton} disabled={loading} onClick={onLoad}>
          {loading ? 'Cargando más piezas…' : 'Cargar más piezas'}
        </button>
      )}
      {loading && <p role="status">Cargando más piezas…</p>}
    </div>
  )
}

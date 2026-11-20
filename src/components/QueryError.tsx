import screenStyles from '../screens/Screen.module.css'

type QueryErrorProps = {
  /** What could not be done, for example "No se pudo cargar la lista." */
  title: string
  /** The reason, already in Spanish. */
  reason: string
  onRetry: () => void
  retrying: boolean
}

/** Error block of a failed read: the word "Error", the reason and a Reintentar button. */
export function QueryError({ title, reason, onRetry, retrying }: QueryErrorProps) {
  return (
    <div role="alert" className={screenStyles.alert}>
      <p className={screenStyles.alertTitle}>
        <strong>Error:</strong> {title}
      </p>
      <p>{reason}</p>
      <button type="button" className={screenStyles.button} onClick={onRetry} disabled={retrying}>
        {retrying ? 'Reintentando…' : 'Reintentar'}
      </button>
    </div>
  )
}

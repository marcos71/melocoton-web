import { Link } from 'react-router'
import type { NoticeData, NoticeKind } from '../lib/navState'
import styles from './Notice.module.css'

const WORDS: Record<NoticeKind, string> = {
  success: 'Listo',
  info: 'Info',
  warning: 'Atención',
  error: 'Error',
}

type NoticeProps = NoticeData & {
  /** Shows the ✕ "Cerrar aviso" button. */
  onClose?: () => void
}

/**
 * A notice that starts with its word in bold (Listo, Info, Atención, Error), with an optional
 * list and link. An error is announced as an alert; the others as a status.
 */
export function Notice({ kind, text, items, footer, link, onClose }: NoticeProps) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`${styles.notice} ${styles[kind]}`}>
      <div className={styles.body}>
        <p className={styles.text}>
          <strong>{WORDS[kind]}:</strong> {text}
        </p>
        {items && items.length > 0 && (
          <ul className={styles.items}>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {footer && <p className={styles.text}>{footer}</p>}
        {link && (
          <Link className={styles.link} to={link.to}>
            {link.label}
          </Link>
        )}
      </div>
      {onClose && (
        <button type="button" className={styles.close} aria-label="Cerrar aviso" onClick={onClose}>
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  )
}

import { useId, type ReactNode } from 'react'
import styles from './DisabledReason.module.css'

type DisabledReasonProps = {
  /** The label of the action that is not available. */
  label: string
  /** Why it is not available, in text. */
  reason: string
  /** Looks like the primary button (the next thing to do) instead of the secondary one. */
  primary?: boolean
  /** Something to do about it, for example a link, shown after the reason. */
  children?: ReactNode
}

/**
 * An action that is not available now: dotted border, `aria-disabled` (so it keeps the
 * focus and the reason is read) and the reason in text linked to it (1.4).
 */
export function DisabledReason({ label, reason, primary = false, children }: DisabledReasonProps) {
  const reasonId = useId()
  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={reasonId}
        className={primary ? `${styles.button} ${styles.primary}` : styles.button}
      >
        {label}
      </button>
      <p id={reasonId} className={styles.reason}>
        {reason}
      </p>
      {children}
    </div>
  )
}

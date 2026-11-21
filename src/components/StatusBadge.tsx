import type { ReactNode } from 'react'
import styles from './StatusBadge.module.css'

type StatusBadgeProps = {
  /** `outline` for an active state, `filled` for an inactive one: never only color. */
  variant?: 'outline' | 'filled'
  children: ReactNode
}

/** Text label with a border or a fill: Activo, Inactivo, Fija, Suelta, Recuperación. */
export function StatusBadge({ variant = 'outline', children }: StatusBadgeProps) {
  return (
    <span className={variant === 'filled' ? `${styles.badge} ${styles.filled}` : styles.badge}>
      {children}
    </span>
  )
}

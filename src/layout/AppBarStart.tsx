import { Link } from 'react-router'
import { useCurrentBackTarget } from './backTarget'
import styles from './AppLayout.module.css'

/** The left side of the app bar: the back button when the screen declared one, else the brand. */
export function AppBarStart() {
  const target = useCurrentBackTarget()
  if (!target) return <span className={styles.brand}>Melocotón</span>
  return (
    <Link
      className={styles.back}
      to={target.to}
      state={target.state}
      aria-label={`Volver a ${target.label}`}
    >
      <svg className={styles.backIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M15 5 8 12l7 7" />
      </svg>
      <span className={styles.backLabel}>{target.label}</span>
    </Link>
  )
}

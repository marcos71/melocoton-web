import { Outlet } from 'react-router'
import styles from './AppLayout.module.css'

/** Frame of the screens that need no session: login, password recovery, connection check. */
export function PublicLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.appBar}>
        <span className={styles.brand}>Melocotón</span>
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}

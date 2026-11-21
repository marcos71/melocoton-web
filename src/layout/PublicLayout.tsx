import { Outlet } from 'react-router'
import { AppBarStart } from './AppBarStart'
import { BackTargetProvider } from './BackTargetProvider'
import styles from './AppLayout.module.css'

/** Frame of the screens that need no session: login, password recovery, connection check. */
export function PublicLayout() {
  return (
    <BackTargetProvider>
      <div className={styles.shell}>
        <header className={styles.appBar}>
          <AppBarStart />
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </BackTargetProvider>
  )
}

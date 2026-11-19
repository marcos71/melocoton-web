import { NavLink, Outlet } from 'react-router'
import { useSession } from '../auth/session'
import { AccountMenu } from './AccountMenu'
import { TABS_BY_ROLE } from './tabs'
import styles from './AppLayout.module.css'

export function AppLayout() {
  const { user } = useSession()
  if (!user) return null
  const tabs = TABS_BY_ROLE[user.role]

  return (
    <div className={styles.shell}>
      <header className={styles.appBar}>
        <span className={styles.brand}>Melocotón</span>
        <AccountMenu />
      </header>

      <main className={styles.content}>
        <Outlet />
      </main>

      <nav className={styles.tabBar} aria-label="Navegación principal">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
          >
            <span className={styles.tabIcon} aria-hidden="true" />
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

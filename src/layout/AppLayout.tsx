import { Link, NavLink, Outlet } from 'react-router'
import { ROLES, ROLE_LABELS, useRole, type Role } from '../auth/role'
import { TABS_BY_ROLE } from './tabs'
import styles from './AppLayout.module.css'

type AppLayoutProps = {
  /** Temporary role picker until authentication exists (iteration 1). */
  showRoleSwitch?: boolean
}

export function AppLayout({ showRoleSwitch = import.meta.env.DEV }: AppLayoutProps) {
  const { role, setRole } = useRole()
  const tabs = TABS_BY_ROLE[role]

  return (
    <div className={styles.shell}>
      <header className={styles.appBar}>
        <span className={styles.brand}>Melocotón</span>
        <Link className={styles.appBarLink} to="/health">
          Conexión
        </Link>
      </header>

      {showRoleSwitch && (
        <div className={styles.roleSwitch}>
          <label htmlFor="dev-role">Rol (provisorio, hasta el inicio de sesión)</label>
          <select
            id="dev-role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            {ROLES.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      )}

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

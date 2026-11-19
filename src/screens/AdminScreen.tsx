import { Link } from 'react-router'
import styles from './Screen.module.css'

/** Settings (lead teacher). "Parámetros" arrives in a later iteration. */
export function AdminScreen() {
  return (
    <section className={styles.screen}>
      <h1 className={styles.title}>Ajustes</h1>
      <ul className={styles.menuList}>
        <li>
          <Link className={styles.menuLink} to="/admin/assistant-teachers">
            <span className={styles.menuLinkTitle}>Docentes secundarios</span>
            <span className={styles.menuLinkHint}>Crear, consultar y desactivar cuentas.</span>
          </Link>
        </li>
      </ul>
    </section>
  )
}

import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ROLE_LABELS } from '../auth/role'
import { useSession } from '../auth/session'
import styles from './AccountMenu.module.css'

/**
 * The person's name in the app bar; opens a panel with their role, settings
 * (lead teacher only), the connection check and logout. A disclosure, not a
 * role="menu": it holds a few ordinary links and a button.
 */
export function AccountMenu() {
  const { user, logOut } = useSession()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!user) return null

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {user.name}
      </button>
      <div id={panelId} className={styles.panel} hidden={!open}>
        <p className={styles.role}>{ROLE_LABELS[user.role]}</p>
        {user.role === 'LEAD_TEACHER' && (
          <Link className={styles.item} to="/admin" onClick={() => setOpen(false)}>
            Ajustes
          </Link>
        )}
        <Link className={styles.item} to="/health" onClick={() => setOpen(false)}>
          Estado de la conexión
        </Link>
        <button
          type="button"
          className={styles.item}
          onClick={() => {
            setOpen(false)
            logOut()
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

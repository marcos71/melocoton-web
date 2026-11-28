import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import styles from './ConfirmDialog.module.css'
import screenStyles from '../screens/Screen.module.css'

type ConfirmDialogProps = {
  title: string
  description: string
  confirmLabel: string
  pendingLabel: string
  /** Text of the safe option; use a specific one when "Cancelar" would be ambiguous. */
  cancelLabel?: string
  /** Extra text between the description and the buttons; keep it non-focusable (the focus trap knows only the two buttons). */
  children?: ReactNode
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Confirmation of a consequential action: focus starts on the cancel button, Escape cancels. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Cancelar',
  children,
  pending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !pending) {
      event.stopPropagation()
      onCancel()
    }
    if (event.key === 'Tab') {
      // Keep the focus inside the dialog: it has only these two buttons, in DOM order.
      const first = cancelRef.current
      const last = confirmRef.current?.disabled ? cancelRef.current : confirmRef.current
      if (pending) {
        event.preventDefault()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }

  return (
    <div className={styles.backdrop}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={styles.dialog}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
        {children}
        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={screenStyles.secondaryButton}
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={screenStyles.button}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

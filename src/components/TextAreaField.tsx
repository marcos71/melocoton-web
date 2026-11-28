import { useId, type ComponentProps } from 'react'
import styles from '../screens/Screen.module.css'

type TextAreaFieldProps = Omit<ComponentProps<'textarea'>, 'id'> & {
  label: string
  /** Validation message; also linked to the textarea for screen readers. */
  error?: string
  hint?: string
}

/** A labelled textarea whose hint and error are announced with it; mirrors `TextField`. */
export function TextAreaField({ label, error, hint, ...textarea }: TextAreaFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      <textarea
        rows={4}
        {...textarea}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {error && (
        <p id={errorId} className={styles.fieldError}>
          <strong>Error:</strong> {error}
        </p>
      )}
    </div>
  )
}

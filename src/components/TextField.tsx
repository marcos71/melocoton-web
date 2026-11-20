import { useId, type ComponentProps } from 'react'
import styles from '../screens/Screen.module.css'

type TextFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  label: string
  /** Validation message; also linked to the input for screen readers. */
  error?: string
  hint?: string
}

/** A labelled input whose hint and error are announced with it. */
export function TextField({ label, error, hint, ...input }: TextFieldProps) {
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
      <input
        {...input}
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

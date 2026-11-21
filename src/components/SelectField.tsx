import { useId, type ComponentProps } from 'react'
import styles from '../screens/Screen.module.css'

type SelectFieldProps = Omit<ComponentProps<'select'>, 'id'> & {
  label: string
  /** Validation message; also linked to the select for screen readers. */
  error?: string
  hint?: string
}

/** A native select with a visible label, whose hint and error are announced with it. */
export function SelectField({ label, error, hint, children, ...select }: SelectFieldProps) {
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
      <select
        {...select}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[select['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className={styles.fieldError}>
          <strong>Error:</strong> {error}
        </p>
      )}
    </div>
  )
}

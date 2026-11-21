import { useId } from 'react'
import styles from './RadioCardGroup.module.css'

export type RadioCardOption<T extends string> = {
  value: T
  label: string
  /** Secondary line, for example "Cupo: 8". */
  description?: string
  /** Why the option cannot be chosen; also makes it unavailable. */
  unavailableReason?: string
}

type RadioCardGroupProps<T extends string> = {
  legend: string
  options: RadioCardOption<T>[]
  /** `null` while nothing is chosen. */
  value: T | null
  onChange: (value: T) => void
  error?: string
  hint?: string
}

/**
 * A fieldset of radio options as 44 px cards, each with a secondary line and, when it cannot
 * be chosen, the reason in text. An unavailable option keeps the focus (`aria-disabled`).
 */
export function RadioCardGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  error,
  hint,
}: RadioCardGroupProps<T>) {
  const id = useId()
  const name = `${id}-group`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <fieldset className={styles.group} aria-describedby={describedBy || undefined}>
      <legend className={styles.legend}>{legend}</legend>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {options.map((option, index) => {
        const unavailable = option.unavailableReason !== undefined
        const detailId = `${id}-detail-${index}`
        const hasDetail = unavailable || option.description !== undefined
        return (
          <label
            key={option.value}
            className={unavailable ? `${styles.card} ${styles.unavailable}` : styles.card}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              aria-disabled={unavailable ? true : undefined}
              aria-describedby={hasDetail ? detailId : undefined}
              onChange={() => {
                if (!unavailable) onChange(option.value)
              }}
            />
            <span className={styles.texts}>
              <span className={styles.label}>{option.label}</span>
              {hasDetail && (
                <span id={detailId} className={styles.description}>
                  {option.unavailableReason ?? option.description}
                </span>
              )}
            </span>
          </label>
        )
      })}
      {error && (
        <p id={errorId} className={styles.error}>
          <strong>Error:</strong> {error}
        </p>
      )}
    </fieldset>
  )
}

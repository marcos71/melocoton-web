import styles from './StatusFilter.module.css'

export type StatusFilterOption<T extends string> = { value: T; label: string }

type StatusFilterProps<T extends string> = {
  options: StatusFilterOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Accessible name of the group. */
  label?: string
}

/** Segmented filter (for example Activos / Inactivos / Todos); the pressed option is bold and inverted. */
export function StatusFilter<T extends string>({
  options,
  value,
  onChange,
  label = 'Filtrar por estado',
}: StatusFilterProps<T>) {
  return (
    <div role="group" aria-label={label} className={styles.filters}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={value === option.value ? `${styles.filter} ${styles.pressed}` : styles.filter}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

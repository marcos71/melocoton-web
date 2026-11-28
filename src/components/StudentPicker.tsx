import { useId, useState, type Ref } from 'react'
import {
  Autocomplete,
  Button,
  Dialog,
  DialogTrigger,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  SearchField,
} from 'react-aria-components'
import type { StudentDirectoryEntry } from '../api/students'
import { normalize } from '../lib/text'
import screenStyles from '../screens/Screen.module.css'
import styles from './StudentPicker.module.css'

/** The key of the "all students" option; student options use their numeric id. */
const ALL = 'all'

type StudentPickerProps = {
  label: string
  students: StudentDirectoryEntry[] | undefined
  state: 'loading' | 'error' | 'ready'
  onRetry: () => void
  value: number | null
  onChange: (id: number | null) => void
  /** Filter only ("Todos los alumnos"): an option that clears the choice. */
  allOptionLabel?: string
  /** Form only ("Elegí un alumno"): what the trigger says while nothing is chosen. */
  placeholder?: string
  error?: string
  hint?: string
  /** Goes to the trigger button, so a form can focus it. */
  ref?: Ref<HTMLButtonElement>
}

/** An inactive student stays findable but is marked in text (RF-31). */
function displayName(student: StudentDirectoryEntry): string {
  return student.active ? student.name : `${student.name} (inactivo)`
}

/** DI-85: the same rule as the Alumnos search, without accents or case. */
function matches(textValue: string, input: string): boolean {
  return normalize(textValue).includes(normalize(input.trim()))
}

function resultText(count: number): string {
  if (count === 0) return ''
  return count === 1 ? '1 alumno' : `${count} alumnos`
}

/**
 * A student picked from a searchable list (DI-85, DI-90): a field-like button opens a full-screen
 * panel on the phone, so the keyboard never covers the results.
 */
export function StudentPicker({
  label,
  students,
  state,
  onRetry,
  value,
  onChange,
  allOptionLabel,
  placeholder,
  error,
  hint,
  ref,
}: StudentPickerProps) {
  const id = useId()
  const labelId = `${id}-label`
  const valueId = `${id}-value`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  const selected = students?.find((student) => student.id === value)
  const emptyText = allOptionLabel ?? placeholder ?? ''
  const currentText = selected ? displayName(selected) : emptyText

  return (
    <div className={styles.field}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      {hint && (
        <p id={hintId} className={screenStyles.hint}>
          {hint}
        </p>
      )}
      {state === 'loading' && (
        <div className={styles.loading}>
          <span role="status">Cargando alumnos…</span>
        </div>
      )}
      {state === 'error' && (
        <div className={styles.failed}>
          <p>No pudimos cargar los alumnos.</p>
          <button type="button" className={screenStyles.secondaryButton} onClick={onRetry}>
            Reintentar
          </button>
        </div>
      )}
      {state === 'ready' && (
        <DialogTrigger>
          <Button
            ref={ref}
            className={styles.trigger}
            data-invalid={error ? '' : undefined}
            aria-labelledby={`${labelId} ${valueId}`}
            aria-describedby={describedBy || undefined}
          >
            <span id={valueId} className={selected ? undefined : styles.muted}>
              {currentText}
            </span>
            <span aria-hidden="true"> ▾</span>
          </Button>
          <ModalOverlay isDismissable className={styles.overlay}>
            <Modal className={styles.panel}>
              <Dialog className={styles.dialog} aria-label="Elegí un alumno">
                {({ close }) => (
                  <PickerPanel
                    students={students ?? []}
                    value={value}
                    allOptionLabel={allOptionLabel}
                    onPick={(picked) => {
                      onChange(picked)
                      close()
                    }}
                  />
                )}
              </Dialog>
            </Modal>
          </ModalOverlay>
        </DialogTrigger>
      )}
      {error && (
        <p id={errorId} className={screenStyles.fieldError}>
          <strong>Error:</strong> {error}
        </p>
      )}
    </div>
  )
}

type PickerPanelProps = {
  students: StudentDirectoryEntry[]
  value: number | null
  allOptionLabel?: string
  onPick: (id: number | null) => void
}

/** The open panel: its search text lives here, so it starts empty every time the panel opens. */
function PickerPanel({ students, value, allOptionLabel, onPick }: PickerPanelProps) {
  const [query, setQuery] = useState('')
  const searching = query.trim() !== ''
  const found = students.filter((student) => matches(displayName(student), query)).length

  return (
    <>
      <Autocomplete inputValue={query} onInputChange={setQuery} filter={matches}>
        <div className={styles.header}>
          <SearchField autoFocus className={styles.search}>
            <Label className={styles.searchLabel}>Buscar por nombre</Label>
            <Input className={styles.input} inputMode="search" placeholder="Buscar por nombre" />
          </SearchField>
          <Button slot="close" className={styles.cancel}>
            Cancelar
          </Button>
        </div>
        <p role="status" className={styles.results}>
          {resultText(found)}
        </p>
        <ListBox
          aria-label="Alumnos"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[value ?? ALL]}
          onSelectionChange={(keys) => {
            const [key] = keys === 'all' ? [] : keys
            if (key !== undefined) onPick(key === ALL ? null : Number(key))
          }}
          renderEmptyState={() => (
            <p className={styles.empty}>
              {searching
                ? `No hay alumnos que coincidan con «${query.trim()}». Revisá cómo lo escribiste.`
                : 'No hay alumnos para elegir.'}
            </p>
          )}
          className={styles.list}
        >
          {allOptionLabel && !searching && (
            <ListBoxItem
              id={ALL}
              textValue={allOptionLabel}
              className={styles.option}
              onPress={value === null ? () => onPick(null) : undefined}
            >
              {({ isSelected }) => (
                <>
                  {isSelected && <span aria-hidden="true">✓ </span>}
                  {allOptionLabel}
                </>
              )}
            </ListBoxItem>
          )}
          {students.map((student) => (
            <ListBoxItem
              key={student.id}
              id={student.id}
              textValue={displayName(student)}
              className={styles.option}
              onPress={value === student.id ? () => onPick(student.id) : undefined}
            >
              {({ isSelected }) => (
                <>
                  {isSelected && <span aria-hidden="true">✓ </span>}
                  {displayName(student)}
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBox>
      </Autocomplete>
    </>
  )
}

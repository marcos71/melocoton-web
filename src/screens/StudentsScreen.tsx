import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { readErrorText } from '../api/actionErrors'
import { useActiveSlotsQuery, type SlotItem } from '../api/slots'
import {
  useStudentsQuery,
  type StatusFilter as ApiStatus,
  type StudentItem,
  type StudentsFilters,
} from '../api/students'
import { QueryError } from '../components/QueryError'
import { SelectField } from '../components/SelectField'
import { StatusBadge } from '../components/StatusBadge'
import { StatusFilter } from '../components/StatusFilter'
import { TextField } from '../components/TextField'
import { bySlotTime, enrollmentLabel, formatSlot } from '../lib/format'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import screenStyles from './Screen.module.css'
import styles from './StudentsScreen.module.css'

type UrlStatus = 'active' | 'inactive' | 'all'
type UrlType = 'monthly' | 'drop-in'

const STATUS_OPTIONS: { value: UrlStatus; label: string }[] = [
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'all', label: 'Todos' },
]

const API_STATUS: Record<UrlStatus, ApiStatus> = {
  active: 'ACTIVE',
  inactive: 'INACTIVE',
  all: 'ALL',
}

const SEARCH_DELAY_MS = 300
const SKELETON_ROWS = [0, 1, 2]

/** An invalid value in the URL is ignored, so the API never gets a malformed filter (2.1). */
function parseStatus(raw: string | null): UrlStatus {
  return raw === 'inactive' || raw === 'all' ? raw : 'active'
}

function parseType(raw: string | null): UrlType | null {
  return raw === 'monthly' || raw === 'drop-in' ? raw : null
}

function parseSlot(raw: string | null): number | null {
  return raw !== null && /^[1-9]\d{0,14}$/.test(raw) ? Number(raw) : null
}

/** Lower case and without accents, so "lucia" finds "Lucía". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function turnText(student: StudentItem): string | null {
  if (student.enrollmentType !== 'MONTHLY') return null
  return student.fixedSlot ? formatSlot(student.fixedSlot) : 'Sin turno fijo'
}

function accessibleName(student: StudentItem): string {
  const parts = [
    student.name,
    student.active ? 'Activo' : 'Inactivo',
    enrollmentLabel(student.enrollmentType),
  ]
  const turn = turnText(student)
  if (turn) parts.push(turn)
  return parts.join(', ')
}

function slotOptions(slots: SlotItem[], selected: number | null, loaded: boolean) {
  const sorted = [...slots].sort(bySlotTime)
  const options = sorted.map((slot) => ({ id: slot.id, label: formatSlot(slot) }))
  if (selected !== null && !sorted.some((slot) => slot.id === selected)) {
    options.push({ id: selected, label: loaded ? `Turno ${selected} (inactivo)` : `Turno ${selected}` })
  }
  return options
}

/** CU-02 M2, RF-04, DI-46: find a student and open the profile; filters live in the URL. */
export function StudentsScreen() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const headingRef = useHeadingFocus()

  const status = parseStatus(params.get('status'))
  const type = parseType(params.get('type'))
  const slot = parseSlot(params.get('slot'))
  const query = params.get('q') ?? ''

  const [text, setText] = useState(query)

  // The search is kept in `q` after a pause, replacing the history entry (2.1).
  useEffect(() => {
    if (text === query) return
    const timer = setTimeout(() => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (text.trim() === '') next.delete('q')
          else next.set('q', text)
          return next
        },
        { replace: true },
      )
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text, query, setParams])

  function setParam(name: string, value: string | null) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value === null) next.delete(name)
        else next.set(name, value)
        return next
      },
      { replace: true },
    )
  }

  const filters: StudentsFilters = {
    status: API_STATUS[status],
    ...(type ? { enrollmentType: type === 'monthly' ? 'MONTHLY' : 'DROP_IN' } : {}),
    ...(slot !== null ? { slotId: slot } : {}),
  }
  const students = useStudentsQuery(filters)
  const slots = useActiveSlotsQuery()

  const needle = normalize(query.trim())
  const visible = useMemo(
    () =>
      (students.data ?? [])
        .filter((student) => needle === '' || normalize(student.name).includes(needle))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [students.data, needle],
  )

  const hasExtraFilters = type !== null || slot !== null || needle !== ''
  const options = slotOptions(slots.data ?? [], slot, slots.isSuccess)

  function clearFilters() {
    setText('')
    setParams({}, { replace: true })
  }

  function emptyMessage(): string {
    if (hasExtraFilters) return 'Ningún alumno coincide con los filtros.'
    if (status === 'active') return 'No hay alumnos activos.'
    if (status === 'inactive') return 'No hay alumnos inactivos.'
    return 'Todavía no hay alumnos.'
  }

  const from = location.pathname + location.search

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 ref={headingRef} tabIndex={-1} className={screenStyles.title}>
          Alumnos
        </h1>
        <Link className={screenStyles.button} to="/students/new">
          Nuevo alumno
        </Link>
      </div>

      <div className={styles.filters}>
        <div className={styles.search}>
          <TextField
            label="Buscar por nombre"
            type="search"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {text !== '' && (
            <button
              type="button"
              className={styles.clear}
              aria-label="Borrar búsqueda"
              onClick={() => setText('')}
            >
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>
        <StatusFilter
          options={STATUS_OPTIONS}
          value={status}
          onChange={(value) => setParam('status', value === 'active' ? null : value)}
        />
        <SelectField
          label="Modalidad"
          value={type ?? ''}
          onChange={(event) => setParam('type', event.target.value || null)}
        >
          <option value="">Todas</option>
          <option value="monthly">Mensual</option>
          <option value="drop-in">Clase suelta</option>
        </SelectField>
        <div className={styles.slotFilter}>
          <SelectField
            label="Turno fijo"
            value={slot !== null ? String(slot) : ''}
            disabled={slots.isError}
            aria-describedby={slots.isError ? 'slots-error' : undefined}
            onChange={(event) => setParam('slot', event.target.value || null)}
          >
            <option value="">Todos</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </SelectField>
          {slots.isError && (
            <p id="slots-error" className={styles.slotsError}>
              No se pudieron cargar los turnos.{' '}
              <button type="button" className={styles.linkButton} onClick={() => void slots.refetch()}>
                Reintentar
              </button>
            </p>
          )}
        </div>
      </div>

      <p aria-live="polite" className={styles.count}>
        {students.isSuccess && visible.length > 0
          ? visible.length === 1
            ? '1 alumno'
            : `${visible.length} alumnos`
          : ''}
      </p>

      {students.isPending && (
        <div>
          <p role="status">Cargando alumnos…</p>
          <ul className={styles.skeletons} aria-hidden="true">
            {SKELETON_ROWS.map((row) => (
              <li key={row} className={styles.skeleton} />
            ))}
          </ul>
        </div>
      )}

      {students.isError && (
        <QueryError
          title="No se pudo cargar la lista."
          reason={readErrorText(students.error)}
          onRetry={() => void students.refetch()}
          retrying={students.isFetching}
        />
      )}

      {students.isSuccess && visible.length === 0 && (
        <div className={screenStyles.empty}>
          {status === 'all' && !hasExtraFilters && (
            <svg className={styles.splash} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <circle cx="14" cy="16" r="5" />
              <circle cx="32" cy="12" r="3" />
              <circle cx="36" cy="30" r="6" />
              <circle cx="18" cy="36" r="3" />
            </svg>
          )}
          <p className={styles.emptyText}>{emptyMessage()}</p>
          {status === 'all' && !hasExtraFilters && (
            <p className={styles.emptyText}>
              Creá el primero con <strong>Nuevo alumno</strong>.
            </p>
          )}
          {hasExtraFilters && (
            <button type="button" className={screenStyles.secondaryButton} onClick={clearFilters}>
              Quitar filtros
            </button>
          )}
        </div>
      )}

      {students.isSuccess && visible.length > 0 && (
        <table className={styles.table}>
          <thead className={styles.head}>
            <tr>
              <th scope="col" className={styles.headCell}>
                Nombre
              </th>
              <th scope="col" className={styles.headCell}>
                Modalidad
              </th>
              <th scope="col" className={styles.headCell}>
                Turno fijo
              </th>
              <th scope="col" className={styles.headCell}>
                Estado
              </th>
            </tr>
          </thead>
          <tbody className={styles.body}>
            {visible.map((student) => {
              const turn = turnText(student)
              return (
                <tr key={student.id} className={styles.row}>
                  <td className={`${styles.cell} ${styles.nameCell}`}>
                    <Link
                      className={styles.rowLink}
                      to={`/students/${student.id}`}
                      state={{ from }}
                      aria-label={accessibleName(student)}
                    >
                      {student.name}
                    </Link>
                  </td>
                  <td className={`${styles.cell} ${styles.kind}`}>{enrollmentLabel(student.enrollmentType)}</td>
                  <td className={`${styles.cell} ${styles.turn}`}>
                    {turn === 'Sin turno fijo' ? <strong>{turn}</strong> : turn}
                  </td>
                  <td className={`${styles.cell} ${styles.state}`}>
                    <StatusBadge variant={student.active ? 'outline' : 'filled'}>
                      {student.active ? 'Activo' : 'Inactivo'}
                    </StatusBadge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

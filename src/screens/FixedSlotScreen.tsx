import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router'
import { actionErrorText, readErrorText } from '../api/actionErrors'
import { useAssignFixedSlot } from '../api/bookings'
import { ApiError } from '../api/errors'
import { slotsQueryKey, useActiveSlotsQuery, type SlotItem } from '../api/slots'
import { getStudent, studentDetailKey, useStudentQuery, type StudentProfile } from '../api/students'
import { DisabledReason } from '../components/DisabledReason'
import { QueryError } from '../components/QueryError'
import { RadioCardGroup, type RadioCardOption } from '../components/RadioCardGroup'
import { useBackTarget } from '../layout/backTarget'
import {
  bySlotTime,
  dayName,
  formatSlot,
  formatSlotShort,
  formatWeekdayPlural,
  overbookedText,
} from '../lib/format'
import { assignmentNotice } from '../lib/assignmentNotice'
import { listFromState, type StudentNavState } from '../lib/navState'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { useStudentId } from '../lib/useStudentId'
import styles from './Screen.module.css'
import formStyles from './StudentForms.module.css'
import { StudentGate } from './StudentGate'

const OVERBOOK_RULE =
  'Si una fecha ya está llena, igual se le guarda el lugar y la clase queda excedida.'

const ERROR_TEXTS: Record<string, string> = {
  slot_inactive: 'Ese turno está desactivado: no admite reservas nuevas. Elegí otro.',
  enrollment_type_mismatch: 'Solo un alumno mensual tiene turno fijo.',
  student_inactive: 'El alumno está inactivo.',
  fixed_students_full: 'Ese turno ya tiene 12 alumnos fijos. Elegí otro turno.',
}

/** Failures that say the chosen slot cannot be assigned: the choice is cleared. */
const CLEARS_CHOICE = new Set(['slot_inactive', 'fixed_students_full'])

/** CU-04 pasos 1-4, 3b, 3c; RF-08; DI-27, DI-42, DI-43: assign or replace a monthly student's fixed slot. */
export function FixedSlotScreen() {
  const id = useStudentId()
  const student = useStudentQuery(id)
  return (
    <StudentGate
      id={id}
      query={student}
      loadingText="Cargando ficha…"
      errorTitle="No se pudo cargar la ficha."
    >
      {(profile) => <FixedSlotForm student={profile} />}
    </StudentGate>
  )
}

/** Why a slot cannot be chosen, if it cannot: it is the student's own, or it has all its fixed places taken (DI-66). */
function unavailableReason(slot: SlotItem, current: StudentProfile['fixedSlot']): string | undefined {
  if (slot.id === current?.id) return 'Es su turno actual.'
  if (slot.fixedStudents >= slot.capacity) return `Completo: tiene ${slot.capacity} alumnos fijos.`
  return undefined
}

function FixedSlotForm({ student }: { student: StudentProfile }) {
  const navigate = useNavigate()
  const location = useLocation()
  const headingRef = useHeadingFocus()
  const slots = useActiveSlotsQuery()
  const queryClient = useQueryClient()
  const assign = useAssignFixedSlot(student.id)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const from = listFromState(location.state)
  const profileState: StudentNavState = from ? { from } : {}
  const current = student.fixedSlot ?? null
  const replacing = current !== null

  useBackTarget({ to: `/students/${student.id}`, label: 'Ficha', state: profileState })

  if (student.enrollmentType !== 'MONTHLY' || !student.active) {
    return (
      <section className={styles.screen}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          Turno fijo
        </h1>
        <p className={styles.empty}>
          {student.enrollmentType !== 'MONTHLY'
            ? 'Solo un alumno mensual tiene turno fijo.'
            : 'El alumno está inactivo: no se le asignan turnos ni clases.'}
        </p>
      </section>
    )
  }

  const sortedSlots = [...(slots.data ?? [])].sort(bySlotTime)
  const selected = sortedSlots.find((slot) => slot.id === selectedId) ?? null
  const options: RadioCardOption<string>[] = sortedSlots.map((slot) => {
    const overbooked = slot.upcomingOverbookedLessons.length
    const description = [
      `Fijos: ${slot.fixedStudents} de ${slot.capacity}`,
      ...(overbooked > 0 ? [overbookedText(overbooked)] : []),
    ].join(' · ')
    const reason = unavailableReason(slot, current)
    return {
      value: String(slot.id),
      label: formatSlot(slot),
      description,
      ...(reason === undefined ? {} : { unavailableReason: reason }),
    }
  })

  const title = replacing ? 'Cambiar turno fijo' : 'Asignar turno fijo'
  const actionLabel = replacing ? 'Reemplazar turno' : 'Asignar turno fijo'
  const pendingLabel = replacing ? 'Reemplazando…' : 'Asignando…'

  /**
   * A 404 does not say what is missing, and the message is not read: the student is read again.
   * If it still exists the slot was the missing one; if not, the profile read shows the not-found screen.
   */
  async function resolveNotFound() {
    try {
      await queryClient.fetchQuery({
        queryKey: studentDetailKey(student.id),
        queryFn: () => getStudent(student.id),
        staleTime: 0,
      })
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return
      setApiError(actionErrorText(error))
      return
    }
    setSelectedId(null)
    setApiError('Ese turno ya no existe. Elegí otro.')
    void queryClient.invalidateQueries({ queryKey: slotsQueryKey })
  }

  function onSubmit() {
    if (!selected) return
    setApiError(null)
    assign.mutate(selected.id, {
      onSuccess: (result) => {
        const state: StudentNavState = {
          ...(from ? { from } : {}),
          notice: assignmentNotice(result, current),
        }
        void navigate(`/students/${student.id}`, { replace: true, state })
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'not_found') {
          void resolveNotFound()
          return
        }
        // The choice no longer holds; the slots were already read again when the call settled.
        if (error instanceof ApiError && CLEARS_CHOICE.has(error.code)) setSelectedId(null)
        setApiError(actionErrorText(error, { byCode: ERROR_TEXTS }))
      },
    })
  }

  return (
    <section className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        {title}
      </h1>
      {current && <p>Turno actual: {formatSlot(current)}</p>}

      {slots.isPending && <p role="status">Cargando turnos…</p>}

      {slots.isError && (
        <QueryError
          title="No se pudieron cargar los turnos."
          reason={readErrorText(slots.error)}
          onRetry={() => void slots.refetch()}
          retrying={slots.isFetching}
        />
      )}

      {slots.isSuccess && sortedSlots.length === 0 && (
        <p className={styles.empty}>
          Todavía no hay turnos. Crealos en <Link to="/slots">Turnos</Link>.
        </p>
      )}

      {slots.isSuccess && sortedSlots.length > 0 && (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <RadioCardGroup
            legend="Elegí el turno"
            options={options}
            value={selected ? String(selected.id) : null}
            onChange={(value) => {
              setApiError(null)
              setSelectedId(Number(value))
            }}
          />

          <div className={formStyles.summary} aria-live="polite">
            {selected && current && (
              <>
                <p className={formStyles.summaryTitle}>
                  ¿Reemplazar {formatSlotShort(current)} por {formatSlotShort(selected)}?
                </p>
                <p>
                  Se cancelan sus clases fijas del {dayName(current.dayOfWeek)} que todavía no
                  empezaron y se generan las del {dayName(selected.dayOfWeek)}. {OVERBOOK_RULE}
                </p>
              </>
            )}
            {selected && !current && (
              <p>
                Se generan sus clases fijas de {formatWeekdayPlural(selected.dayOfWeek)}.{' '}
                {OVERBOOK_RULE}
              </p>
            )}
          </div>

          {apiError && (
            <p role="alert" className={styles.alert}>
              <strong>Error:</strong> {apiError}
            </p>
          )}

          <div className={styles.actions}>
            {selected ? (
              <button type="submit" className={styles.button} disabled={assign.isPending}>
                {assign.isPending ? pendingLabel : actionLabel}
              </button>
            ) : (
              <DisabledReason primary label={actionLabel} reason="Elegí un turno." />
            )}
            <Link
              className={styles.secondaryButton}
              to={`/students/${student.id}`}
              state={profileState}
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router'
import { actionErrorText, readErrorText } from '../api/actionErrors'
import { useCreateDropInBooking } from '../api/bookings'
import { ApiError } from '../api/errors'
import { lessonsQueryKey, useLessons } from '../api/lessons'
import { slotsQueryKey, useActiveSlotsQuery } from '../api/slots'
import { getStudent, studentDetailKey, useStudentQuery, type StudentProfile } from '../api/students'
import { DisabledReason } from '../components/DisabledReason'
import { Notice } from '../components/Notice'
import { QueryError } from '../components/QueryError'
import { RadioCardGroup } from '../components/RadioCardGroup'
import { SelectField } from '../components/SelectField'
import { useBackTarget } from '../layout/backTarget'
import {
  lessonButtonText,
  lessonInSentence,
  lessonKey,
  lessonOption,
  upcomingLessons,
} from '../lib/dropInLessons'
import { bySlotTime, formatSlot } from '../lib/format'
import { listFromState, type StudentNavState } from '../lib/navState'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { useNow } from '../lib/useNow'
import { useRouteId } from '../lib/useRouteId'
import { addMonths, workshopToday } from '../lib/workshopTime'
import dropInStyles from './DropInBookingScreen.module.css'
import styles from './Screen.module.css'
import { StudentGate } from './StudentGate'

/** DI-44: a drop-in class can be booked up to three months ahead. */
const MONTHS_AHEAD = 3
const PAGE_SIZE = 10

const MISMATCH_TEXT = 'La clase suelta es solo para alumnos de clase suelta.'

const ERROR_TEXTS: Record<string, string> = {
  capacity_full: 'No queda lugar en esa clase. Elegí otra fecha.',
  already_booked: 'El alumno ya está anotado en esa clase.',
  lesson_already_started: 'Esa clase ya empezó. Elegí otra fecha.',
  slot_inactive: 'Ese turno está desactivado: no admite reservas nuevas. Elegí otra clase.',
  enrollment_type_mismatch: MISMATCH_TEXT,
  student_inactive: 'El alumno está inactivo.',
}

/** Failures that say the chosen lesson no longer holds: the choice is cleared. */
const CLEARS_CHOICE = new Set([
  'capacity_full',
  'already_booked',
  'lesson_already_started',
  'invalid_lesson_date',
  'slot_inactive',
])

/** CU-04 pasos 1-4; RF-09, RF-11; RN-03; DI-41, DI-43, DI-44, DI-56: book a drop-in class. */
export function DropInBookingScreen() {
  const id = useRouteId()
  const student = useStudentQuery(id)
  return (
    <StudentGate
      id={id}
      query={student}
      loadingText="Cargando ficha…"
      errorTitle="No se pudo cargar la ficha."
    >
      {(profile) => <DropInBookingForm student={profile} />}
    </StudentGate>
  )
}

function DropInBookingForm({ student }: { student: StudentProfile }) {
  const navigate = useNavigate()
  const location = useLocation()
  const headingRef = useHeadingFocus()
  const queryClient = useQueryClient()
  const book = useCreateDropInBooking(student.id)
  const now = useNow()
  const today = workshopToday(now)

  const [slotFilter, setSlotFilter] = useState<number | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE_SIZE)
  const [apiError, setApiError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  /** Index of the first row added by "Mostrar más fechas", whose radio takes the focus. */
  const focusIndex = useRef<number | null>(null)

  const slots = useActiveSlotsQuery()
  const sortedSlots = [...(slots.data ?? [])].sort(bySlotTime)
  // A filter whose slot is gone (it was deactivated) is the same as no filter.
  const slotId = sortedSlots.find((slot) => slot.id === slotFilter)?.id
  const lessons = useLessons({
    from: today,
    to: addMonths(today, MONTHS_AHEAD),
    ...(slotId === undefined ? {} : { slotId }),
  })

  const from = listFromState(location.state)
  const profileState: StudentNavState = from ? { from } : {}
  const profilePath = `/students/${student.id}`

  useBackTarget({ to: profilePath, label: `Ficha de ${student.name}`, state: profileState })

  const rows = lessons.isSuccess ? upcomingLessons(lessons.data, now) : []
  const visibleRows = rows.slice(0, shown)
  const booked = new Set(student.upcomingLessons.map(lessonKey))
  const options = visibleRows.map((lesson) => lessonOption(lesson, booked, today))
  // Only an available row can be chosen, so a row that fills up meanwhile drops out of the choice.
  const selected =
    visibleRows.find(
      (lesson, index) =>
        lessonKey(lesson) === selectedKey && options[index]?.unavailableReason === undefined,
    ) ?? null

  useEffect(() => {
    if (focusIndex.current === null) return
    const radios = listRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    radios?.[focusIndex.current]?.focus()
    focusIndex.current = null
  }, [shown])

  if (student.enrollmentType !== 'DROP_IN' || !student.active) {
    return (
      <section className={styles.screen}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          Anotar clase suelta
        </h1>
        <p className={styles.empty}>
          {student.enrollmentType !== 'DROP_IN'
            ? MISMATCH_TEXT
            : 'El alumno está inactivo: no se le asignan turnos ni clases.'}
        </p>
      </section>
    )
  }

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
    setSelectedKey(null)
    setApiError('Ese turno ya no existe. Elegí otra clase.')
    void queryClient.invalidateQueries({ queryKey: slotsQueryKey })
    void queryClient.invalidateQueries({ queryKey: lessonsQueryKey })
  }

  function onSubmit() {
    if (!selected) return
    setApiError(null)
    book.mutate(
      { slotId: selected.slotId, lessonDate: selected.lessonDate },
      {
        onSuccess: () => {
          const state: StudentNavState = {
            ...(from ? { from } : {}),
            notice: {
              kind: 'success',
              text: `Anotamos a ${student.name} ${lessonInSentence(selected)}.`,
            },
          }
          void navigate(profilePath, { replace: true, state })
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'not_found') {
            void resolveNotFound()
            return
          }
          // The mutation reads the student, the lessons and the slots again (onSettled).
          if (error instanceof ApiError && CLEARS_CHOICE.has(error.code)) setSelectedKey(null)
          setApiError(actionErrorText(error, { byCode: ERROR_TEXTS }))
        },
      },
    )
  }

  function showMore() {
    focusIndex.current = visibleRows.length
    setShown(shown + PAGE_SIZE)
  }

  const errorBlock = apiError && (
    <p role="alert" className={styles.alert}>
      <strong>Error:</strong> {apiError}
    </p>
  )
  const cancel = (
    <Link className={styles.secondaryButton} to={profilePath} state={profileState}>
      Cancelar
    </Link>
  )

  return (
    <section className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Anotar clase suelta
      </h1>

      {slots.isError && (
        <QueryError
          title="No se pudieron cargar los turnos."
          reason={readErrorText(slots.error)}
          onRetry={() => void slots.refetch()}
          retrying={slots.isFetching}
        />
      )}

      {sortedSlots.length > 0 && (
        <SelectField
          label="Turno"
          value={slotId === undefined ? '' : String(slotId)}
          onChange={(event) => {
            setApiError(null)
            setSelectedKey(null)
            setShown(PAGE_SIZE)
            setSlotFilter(event.target.value === '' ? null : Number(event.target.value))
          }}
        >
          <option value="">Todos los turnos</option>
          {sortedSlots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {formatSlot(slot)}
            </option>
          ))}
        </SelectField>
      )}

      {lessons.isPending && <p role="status">Cargando clases…</p>}

      {lessons.isError && (
        <QueryError
          title="No se pudieron cargar las clases."
          reason={readErrorText(lessons.error)}
          onRetry={() => void lessons.refetch()}
          retrying={lessons.isFetching}
        />
      )}

      {lessons.isSuccess && rows.length === 0 && (
        <>
          <Notice
            kind="info"
            text="No hay clases en los próximos 3 meses."
            {...(slots.isSuccess && sortedSlots.length === 0
              ? { link: { to: '/slots', label: 'Crealos en Turnos' } }
              : {})}
          />
          {errorBlock}
          {cancel}
        </>
      )}

      {rows.length > 0 && (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <div ref={listRef} className={styles.form}>
            <RadioCardGroup
              legend="Elegí la clase"
              options={options}
              value={selected ? lessonKey(selected) : null}
              onChange={(value) => {
                setApiError(null)
                setSelectedKey(value)
              }}
            />
            {rows.length > visibleRows.length && (
              <button
                type="button"
                className={`${styles.secondaryButton} ${dropInStyles.more}`}
                onClick={showMore}
              >
                Mostrar más fechas
              </button>
            )}
          </div>

          {errorBlock}

          <div className={styles.actions}>
            {selected ? (
              <button type="submit" className={styles.button} disabled={book.isPending}>
                {book.isPending ? 'Anotando…' : lessonButtonText(selected)}
              </button>
            ) : (
              <DisabledReason primary label="Anotar clase suelta" reason="Elegí una clase." />
            )}
            {cancel}
          </div>
        </form>
      )}
    </section>
  )
}

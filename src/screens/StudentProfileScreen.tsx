import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { actionErrorText } from '../api/actionErrors'
import { useCancelDropInBooking } from '../api/bookings'
import { useActiveSlotsQuery } from '../api/slots'
import { useStudentQuery, type StudentProfile, type UpcomingLesson } from '../api/students'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DisabledReason } from '../components/DisabledReason'
import { Notice } from '../components/Notice'
import { PhoneLink } from '../components/PhoneLink'
import { StatusBadge } from '../components/StatusBadge'
import { useBackTarget } from '../layout/backTarget'
import {
  bookingTypeLabel,
  enrollmentLabel,
  formatDate,
  formatLessonDate,
  formatLongDate,
  formatSlot,
} from '../lib/format'
import { listFromState, noticeFromState, type NoticeData, type StudentNavState } from '../lib/navState'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { useNow } from '../lib/useNow'
import { useStudentId } from '../lib/useStudentId'
import { useWideScreen } from '../lib/useWideScreen'
import { lessonStarted } from '../lib/workshopTime'
import screenStyles from './Screen.module.css'
import styles from './StudentProfileScreen.module.css'
import { StudentGate } from './StudentGate'

const INACTIVE_REASON = 'El alumno está inactivo: no se le asignan turnos ni clases.'
const VISIBLE_LESSONS = 6

const CANCEL_ERRORS: Record<string, string> = {
  lesson_already_started: 'La clase ya empezó, así que no se puede cancelar.',
  status_conflict: 'La clase ya no está prevista, así que no se puede cancelar.',
  not_found: 'No encontramos esa clase. Actualizamos la lista.',
}

/** DI-46, CU-04: the student's data and upcoming classes, and the actions of the iteration. */
export function StudentProfileScreen() {
  const id = useStudentId()
  const student = useStudentQuery(id)
  return (
    <StudentGate
      id={id}
      query={student}
      loadingText="Cargando ficha…"
      errorTitle="No se pudo cargar la ficha."
    >
      {(profile) => <Profile student={profile} />}
    </StudentGate>
  )
}

function emptyLessonsText(student: StudentProfile): string {
  if (student.enrollmentType === 'DROP_IN') return 'No tiene clases sueltas anotadas.'
  return student.fixedSlot
    ? 'No tiene clases próximas.'
    : 'No tiene clases próximas. Asignale un turno fijo para generarlas.'
}

function Profile({ student }: { student: StudentProfile }) {
  const location = useLocation()
  const headingRef = useHeadingFocus()
  const upcomingRef = useRef<HTMLHeadingElement>(null)
  const now = useNow()
  const wide = useWideScreen()
  const monthly = student.enrollmentType === 'MONTHLY'
  const dropIn = !monthly

  const [notice, setNotice] = useState<NoticeData | null>(() => noticeFromState(location.state))
  const [expanded, setExpanded] = useState(false)
  const [target, setTarget] = useState<UpcomingLesson | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const cancel = useCancelDropInBooking(student.id)
  const slots = useActiveSlotsQuery({ enabled: monthly && student.active && !student.fixedSlot })

  const listUrl = listFromState(location.state)
  useBackTarget({ to: listUrl ?? '/students', label: 'Alumnos' })
  const childState: StudentNavState = listUrl ? { from: listUrl } : {}
  const lessons = student.upcomingLessons
  const shown = wide || expanded ? lessons : lessons.slice(0, VISIBLE_LESSONS)
  const noSlotsInWorkshop = slots.isSuccess && slots.data.length === 0

  function confirmCancel() {
    if (!target) return
    const lesson = target
    setCancelError(null)
    cancel.mutate(lesson.bookingId, {
      onSuccess: () => {
        setTarget(null)
        setNotice({ kind: 'success', text: `Cancelamos la clase del ${formatLessonDate(lesson.lessonDate)}.` })
        upcomingRef.current?.focus()
      },
      onError: (error) => {
        setTarget(null)
        setCancelError(actionErrorText(error, { byCode: CANCEL_ERRORS }))
      },
    })
  }

  return (
    <section className={styles.page}>
      <div className={styles.titleBlock}>
        <h1 ref={headingRef} tabIndex={-1} className={screenStyles.title}>
          {student.name}
        </h1>
        <div>
          <StatusBadge variant={student.active ? 'outline' : 'filled'}>
            {student.active ? 'Activo' : 'Inactivo'}
          </StatusBadge>
        </div>
      </div>

      {notice && <Notice {...notice} onClose={() => setNotice(null)} />}

      <div className={styles.columns}>
        <div className={styles.column}>
          <section className={styles.section} aria-labelledby="student-data">
            <h2 id="student-data" className={styles.sectionTitle}>
              Datos
            </h2>
            <dl className={styles.data}>
              <dt>Modalidad</dt>
              <dd>{enrollmentLabel(student.enrollmentType)}</dd>
              {monthly && student.monthlyStartDate && (
                <>
                  <dt>Ingreso</dt>
                  <dd>{formatDate(student.monthlyStartDate)}</dd>
                </>
              )}
              <dt>Teléfono</dt>
              <dd>
                <PhoneLink name={student.name} phone={student.phone} />
              </dd>
              <dt>Email</dt>
              <dd>{student.email}</dd>
            </dl>
            <Link className={screenStyles.secondaryButton} to={`/students/${student.id}/edit`} state={childState}>
              Editar datos
            </Link>
          </section>

          {monthly && (
            <section className={styles.section} aria-labelledby="student-fixed-slot">
              <h2 id="student-fixed-slot" className={styles.sectionTitle}>
                Turno fijo
              </h2>
              {student.fixedSlot ? (
                <>
                  <p className={styles.plain}>{formatSlot(student.fixedSlot)}</p>
                  {student.active ? (
                    <Link
                      className={screenStyles.secondaryButton}
                      to={`/students/${student.id}/fixed-slot`}
                      state={childState}
                    >
                      Cambiar turno fijo
                    </Link>
                  ) : (
                    <DisabledReason label="Cambiar turno fijo" reason={INACTIVE_REASON} />
                  )}
                </>
              ) : (
                <>
                  <p className={styles.plain}>
                    <strong>Todavía no tiene turno fijo.</strong>
                  </p>
                  {!student.active && (
                    <DisabledReason primary label="Asignar turno fijo" reason={INACTIVE_REASON} />
                  )}
                  {student.active && noSlotsInWorkshop && (
                    <DisabledReason
                      primary
                      label="Asignar turno fijo"
                      reason="Todavía no hay turnos. Crealos en Turnos."
                    >
                      <Link className={screenStyles.secondaryButton} to="/slots">
                        Ir a Turnos
                      </Link>
                    </DisabledReason>
                  )}
                  {student.active && !noSlotsInWorkshop && (
                    <Link
                      className={screenStyles.button}
                      to={`/students/${student.id}/fixed-slot`}
                      state={childState}
                    >
                      Asignar turno fijo
                    </Link>
                  )}
                </>
              )}
            </section>
          )}
        </div>

        <section className={styles.section} aria-labelledby="student-lessons">
          {cancelError && <Notice kind="error" text={cancelError} />}
          <h2
            id="student-lessons"
            ref={upcomingRef}
            tabIndex={-1}
            className={styles.sectionTitle}
          >
            Próximas clases
          </h2>

          {dropIn &&
            (student.active ? (
              // TODO(DI-56): the route is registered when GET /lessons exists.
              <Link
                className={screenStyles.button}
                to={`/students/${student.id}/drop-in/new`}
                state={childState}
              >
                Anotar clase suelta
              </Link>
            ) : (
              <DisabledReason primary label="Anotar clase suelta" reason={INACTIVE_REASON} />
            ))}

          {lessons.length === 0 && <p className={screenStyles.empty}>{emptyLessonsText(student)}</p>}

          {lessons.length > 0 && (
            <ul className={styles.lessons}>
              {shown.map((lesson) => {
                const started = lessonStarted(lesson.lessonDate, lesson.startTime, now)
                const cancellable = lesson.type === 'DROP_IN' && student.active
                return (
                  <li key={lesson.bookingId} className={styles.lesson}>
                    <div className={styles.lessonMain}>
                      <span className={styles.lessonDate}>
                        {formatLessonDate(lesson.lessonDate)} · {lesson.startTime} a {lesson.endTime}
                      </span>
                      <StatusBadge>{bookingTypeLabel(lesson.type)}</StatusBadge>
                    </div>
                    {cancellable && !started && (
                      <button
                        type="button"
                        className={screenStyles.secondaryButton}
                        aria-label={`Cancelar la clase suelta del ${formatLongDate(lesson.lessonDate)}, ${lesson.startTime}`}
                        onClick={() => {
                          setCancelError(null)
                          setTarget(lesson)
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                    {cancellable && started && (
                      <p className={styles.started}>Ya empezó: no se puede cancelar.</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {!wide && lessons.length > VISIBLE_LESSONS && (
            <button
              type="button"
              className={screenStyles.secondaryButton}
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Ver menos clases' : `Ver las ${lessons.length} clases`}
            </button>
          )}
        </section>
      </div>

      {target && (
        <ConfirmDialog
          title={`¿Cancelar la clase suelta del ${formatLongDate(target.lessonDate)}, ${target.startTime}?`}
          description="Se libera el lugar. No genera recuperación y, si la pagó, el pago no cambia."
          confirmLabel="Cancelar clase"
          pendingLabel="Cancelando…"
          cancelLabel="Volver"
          pending={cancel.isPending}
          onConfirm={confirmCancel}
          onCancel={() => setTarget(null)}
        />
      )}
    </section>
  )
}

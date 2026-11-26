import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { readErrorText } from '../api/actionErrors'
import { useLessons, type Lesson } from '../api/lessons'
import { useActiveSlotsQuery, type SlotItem } from '../api/slots'
import { Notice } from '../components/Notice'
import { QueryError } from '../components/QueryError'
import { bySlotTime, formatLessonDate, formatSlot, overbookedText } from '../lib/format'
import { noticeFromState, type NoticeData } from '../lib/navState'
import {
  SLOT_CAPACITY,
  isFullOfFixedStudents,
  nextLessonBySlot,
  normalizeSlotTime,
  overbookedLessons,
} from '../lib/slotRules'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { useNow } from '../lib/useNow'
import { addDays, workshopToday } from '../lib/workshopTime'
import screenStyles from './Screen.module.css'
import styles from './SlotsScreen.module.css'

/** DI-62, DI-67: one read from today to today + 7, so a slot whose lesson today already started still shows next week's. */
const LESSON_DAYS = 7
const SKELETON_ROWS = [0, 1, 2]

function overbookedNotice(slots: readonly SlotItem[]): NoticeData | null {
  const overbooked = overbookedLessons(slots)
  if (overbooked.length === 0) return null
  return {
    kind: 'warning',
    text: 'Hay clases excedidas.',
    items: overbooked.map(({ slot, lessonDate, occupancy, capacity }) => {
      const { startTime, endTime } = normalizeSlotTime(slot)
      return `${formatLessonDate(lessonDate)}, ${startTime} a ${endTime}: ${occupancy} alumnos para ${capacity} lugares`
    }),
    footer: 'Para resolverlo, cancelá alguna clase suelta de ese día.',
  }
}

/** CU-03, RF-06, DI-43, DI-62, DI-66: the active slots with their fixed students, next class and overbooked dates. */
export function SlotsScreen() {
  const location = useLocation()
  const headingRef = useHeadingFocus()
  const now = useNow()
  const today = workshopToday(now)
  const slots = useActiveSlotsQuery()
  const lessons = useLessons({ from: today, to: addDays(today, LESSON_DAYS) })
  const [arrivalNotice, setArrivalNotice] = useState<NoticeData | null>(() =>
    noticeFromState(location.state),
  )

  const sorted = [...(slots.data ?? [])].sort(bySlotTime)
  const overbooked = overbookedNotice(sorted)
  const nextLessons = lessons.data ? nextLessonBySlot(lessons.data, now) : null

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 ref={headingRef} tabIndex={-1} className={screenStyles.title}>
          Turnos
        </h1>
        <p>Cada turno tiene cupo para {SLOT_CAPACITY} alumnos.</p>
        <Link className={`${screenStyles.button} ${styles.newButton}`} to="/slots/new">
          Nuevo turno
        </Link>
      </div>

      {arrivalNotice && <Notice {...arrivalNotice} onClose={() => setArrivalNotice(null)} />}
      {overbooked && <Notice {...overbooked} />}

      {slots.isPending && (
        <div>
          <p role="status">Cargando turnos…</p>
          <ul className={styles.list} aria-hidden="true">
            {SKELETON_ROWS.map((row) => (
              <li key={row} className={styles.skeleton} />
            ))}
          </ul>
        </div>
      )}

      {slots.isError && slots.data === undefined && (
        <QueryError
          title="No se pudieron cargar los turnos."
          reason={readErrorText(slots.error)}
          onRetry={() => void slots.refetch()}
          retrying={slots.isFetching}
        />
      )}

      {slots.data !== undefined && sorted.length === 0 && (
        <div className={screenStyles.empty}>
          <svg className={styles.splash} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <circle cx="14" cy="16" r="5" />
            <circle cx="32" cy="12" r="3" />
            <circle cx="36" cy="30" r="6" />
            <circle cx="18" cy="36" r="3" />
          </svg>
          <p className={styles.emptyText}>Todavía no hay turnos.</p>
          <p className={styles.emptyText}>
            Creá el primero con <strong>Nuevo turno</strong>.
          </p>
        </div>
      )}

      {slots.data !== undefined && sorted.length > 0 && (
        <>
          <p aria-live="polite" className={styles.count}>
            {sorted.length === 1 ? '1 turno' : `${sorted.length} turnos`}
          </p>
          <div role="status" className={styles.occupancyStatus}>
            {lessons.isError && lessons.data === undefined && (
              <>
                <p>No se pudo cargar la ocupación de las próximas clases.</p>
                <button
                  type="button"
                  className={screenStyles.secondaryButton}
                  disabled={lessons.isFetching}
                  onClick={() => void lessons.refetch()}
                >
                  {lessons.isFetching ? 'Reintentando…' : 'Reintentar'}
                </button>
              </>
            )}
          </div>
          <ul className={styles.list}>
            {sorted.map((slot) => (
              <SlotCard key={slot.id} slot={slot} next={nextLessons?.get(slot.id)} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function SlotCard({ slot, next }: { slot: SlotItem; next: Lesson | undefined }) {
  const full = isFullOfFixedStudents(slot)
  const overbooked = slot.upcomingOverbookedLessons.length
  return (
    <li className={styles.card}>
      <h2 className={styles.cardTitle}>{formatSlot(normalizeSlotTime(slot))}</h2>
      <p>
        Fijos: {slot.fixedStudents} de {slot.capacity}
        {full ? ' (completo)' : ''}
        {overbooked > 0 && (
          <>
            {' · '}
            <strong>{overbookedText(overbooked)}</strong>
          </>
        )}
      </p>
      {next && (
        <p>
          Próxima: {formatLessonDate(next.lessonDate)} · {next.occupancy} de {next.capacity} lugares
          {next.overbooked ? ' (excedida)' : ''}
        </p>
      )}
      {slot.scheduleEditable && (
        <Link
          className={`${screenStyles.secondaryButton} ${styles.editButton}`}
          to={`/slots/${slot.id}/edit`}
        >
          Corregir día u horario
        </Link>
      )}
    </li>
  )
}

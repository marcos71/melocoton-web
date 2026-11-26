import type { FixedSlotAssignment } from '../api/bookings'
import type { StudentProfile } from '../api/students'
import { dayName, formatLessonDate, formatSlotInSentence, formatSlotLower } from './format'
import type { NoticeData } from './navState'

/** The result of assigning, as the notice the profile shows (6.2). */
export function assignmentNotice(result: FixedSlotAssignment, previous: StudentProfile['fixedSlot']): NoticeData {
  const slot = formatSlotInSentence(result.fixedSlot)
  if (result.overbookedLessons.length > 0) {
    return {
      kind: 'warning',
      text: `${capitalizeFirst(slot)} tiene clases excedidas.`,
      items: result.overbookedLessons.map(
        (lesson) =>
          `${formatLessonDate(lesson.lessonDate)}: ${lesson.occupancy} alumnos para ${lesson.capacity} lugares`,
      ),
      footer:
        'Las clases fijas se guardaron igual. Para resolverlo, cancelá alguna clase suelta de esas fechas.',
      link: { to: '/slots', label: 'Ver en Turnos' },
    }
  }
  return {
    kind: 'success',
    text: previous
      ? `Cambiamos su turno fijo al ${formatSlotLower(result.fixedSlot)}. Se cancelaron sus clases del ${dayName(previous.dayOfWeek)} que no habían empezado.`
      : `Le asignamos ${slot}. Ya tiene sus clases fijas generadas.`,
  }
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

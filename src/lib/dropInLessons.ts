import type { Lesson } from '../api/lessons'
import type { RadioCardOption } from '../components/RadioCardGroup'
import { formatLessonDate, formatLongDate } from './format'
import { lessonStarted } from './workshopTime'

type LessonRef = Pick<Lesson, 'slotId' | 'lessonDate'>

/** The value of a lesson's radio: a lesson is its slot on a date. */
export function lessonKey({ slotId, lessonDate }: LessonRef): string {
  return `${slotId}|${lessonDate}`
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** The lessons that can still be shown: the ones that have not started (the API's flag or the clock). */
export function upcomingLessons(lessons: Lesson[], now: Date): Lesson[] {
  return lessons.filter(
    (lesson) => !lesson.started && !lessonStarted(lesson.lessonDate, lesson.startTime, now),
  )
}

/** "Mar 24 de nov", or "Hoy, vie 20 de nov" for today. */
export function lessonLabel(lessonDate: string, today: string): string {
  const date = formatLessonDate(lessonDate)
  return lessonDate === today ? `Hoy, ${lowerFirst(date)}` : date
}

/** "Quedan 3 lugares" / "Queda 1 lugar". */
export function freeSpotsText(freeSpots: number): string {
  return freeSpots === 1 ? 'Queda 1 lugar' : `Quedan ${freeSpots} lugares`
}

/**
 * The radio option of a lesson (6.1 of the design): an unavailable one says why in text,
 * "Ya está anotado." first (DI-41) and then "Completa" (RF-11, also when it is overbooked).
 */
export function lessonOption(lesson: Lesson, booked: ReadonlySet<string>, today: string): RadioCardOption<string> {
  const key = lessonKey(lesson)
  const base = {
    value: key,
    label: lessonLabel(lesson.lessonDate, today),
    subtitle: `${lesson.startTime} a ${lesson.endTime}`,
  }
  if (booked.has(key)) return { ...base, unavailableReason: 'Ya está anotado.' }
  if (lesson.freeSpots === 0) return { ...base, unavailableReason: 'Completa' }
  return { ...base, description: freeSpotsText(lesson.freeSpots) }
}

/** "el jue 26 de nov, 18:00", for the action button. */
export function lessonButtonText(lesson: Lesson): string {
  return `Anotar el ${lowerFirst(formatLessonDate(lesson.lessonDate))}, ${lesson.startTime}`
}

/** "el jueves 26 de noviembre, 18:00 a 20:00", for the notice. */
export function lessonInSentence(lesson: Lesson): string {
  return `el ${formatLongDate(lesson.lessonDate)}, ${lesson.startTime} a ${lesson.endTime}`
}

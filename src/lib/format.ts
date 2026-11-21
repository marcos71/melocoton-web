/** Texts of dates, slots and labels shared by the student screens (docs/pantallas_alumnos.md, 1.2). */

const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const SHORT_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function parts(date: string): { year: number; month: number; day: number; isoWeekday: number } {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return { year, month, day, isoWeekday: weekday === 0 ? 7 : weekday }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export type SlotTime = { dayOfWeek: number; startTime: string; endTime: string }

/** "Martes 18:00 a 20:00". */
export function formatSlot(slot: SlotTime): string {
  return `${capitalize(DAYS[slot.dayOfWeek - 1] ?? '')} ${slot.startTime} a ${slot.endTime}`
}

/** "el martes 18:00", for questions and notices. */
export function formatSlotShort(slot: Pick<SlotTime, 'dayOfWeek' | 'startTime'>): string {
  return `el ${DAYS[slot.dayOfWeek - 1] ?? ''} ${slot.startTime}`
}

/** "jueves 18:00 a 20:00": the slot in the middle of a sentence, without the article. */
export function formatSlotLower(slot: SlotTime): string {
  return `${DAYS[slot.dayOfWeek - 1] ?? ''} ${slot.startTime} a ${slot.endTime}`
}

/** "el jueves 18:00 a 20:00". */
export function formatSlotInSentence(slot: SlotTime): string {
  return `el ${formatSlotLower(slot)}`
}

/** "Martes": the name of an ISO day of the week, capitalized, for options and titles. */
export function dayLabel(dayOfWeek: number): string {
  return capitalize(DAYS[dayOfWeek - 1] ?? '')
}

/** "martes": the name of an ISO day of the week (1 is Monday). */
export function dayName(dayOfWeek: number): string {
  return DAYS[dayOfWeek - 1] ?? ''
}

/** "los jueves", for what a fixed slot generates. */
export function formatWeekdayPlural(dayOfWeek: number): string {
  const day = DAYS[dayOfWeek - 1] ?? ''
  return day.endsWith('s') ? `los ${day}` : `los ${day}s`
}

/** "Mar 24 de nov", for lists. */
export function formatLessonDate(date: string): string {
  const { month, day, isoWeekday } = parts(date)
  return `${SHORT_DAYS[isoWeekday - 1]} ${day} de ${SHORT_MONTHS[month - 1]}`
}

/** "martes 24 de noviembre", for dialogs. */
export function formatLongDate(date: string): string {
  const { month, day, isoWeekday } = parts(date)
  return `${DAYS[isoWeekday - 1]} ${day} de ${MONTHS[month - 1]}`
}

/** "2 de nov de 2026". */
export function formatDate(date: string): string {
  const { year, month, day } = parts(date)
  return `${day} de ${SHORT_MONTHS[month - 1]} de ${year}`
}

export type EnrollmentType = 'MONTHLY' | 'DROP_IN'
export type BookingType = 'FIXED' | 'DROP_IN' | 'MAKEUP'

const ENROLLMENT_LABELS: Record<EnrollmentType, string> = {
  MONTHLY: 'Mensual',
  DROP_IN: 'Clase suelta',
}

const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  FIXED: 'Fija',
  DROP_IN: 'Suelta',
  MAKEUP: 'Recuperación',
}

export function enrollmentLabel(type: EnrollmentType): string {
  return ENROLLMENT_LABELS[type]
}

export function bookingTypeLabel(type: BookingType): string {
  return BOOKING_TYPE_LABELS[type]
}

/** Slots in the order of the week: by day, then by start time. */
export function bySlotTime(a: SlotTime, b: SlotTime): number {
  return a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)
}

/** "1 clase excedida" / "3 clases excedidas". */
export function overbookedText(count: number): string {
  return count === 1 ? '1 clase excedida' : `${count} clases excedidas`
}

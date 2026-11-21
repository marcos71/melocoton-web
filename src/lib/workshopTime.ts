/** The workshop's clock: "today", "now" and "already started" are always in this zone (DI-27, DI-44). */
export const WORKSHOP_TIME_ZONE = 'America/Argentina/Buenos_Aires'

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: WORKSHOP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** The date (yyyy-MM-dd) and the time (HH:mm) of an instant on the workshop's wall clock. */
export function workshopNow(now: Date): { date: string; time: string } {
  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

/** Today's date (yyyy-MM-dd) in the workshop's zone. */
export function workshopToday(now: Date): string {
  return workshopNow(now).date
}

/** Whether a class that begins at `startTime` (HH:mm) on `lessonDate` has already begun. */
export function lessonStarted(lessonDate: string, startTime: string, now: Date): boolean {
  const current = workshopNow(now)
  if (lessonDate !== current.date) return lessonDate < current.date
  return startTime <= current.time
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function parseDate(date: string): { year: number; month: number; day: number } {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  return { year, month, day }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** The first day of the month of `date` (yyyy-MM-dd). */
export function firstOfMonth(date: string): string {
  const { year, month } = parseDate(date)
  return `${year}-${pad(month)}-01`
}

/**
 * `date` plus `months` months, like `LocalDate.plusMonths` in the API: if the day does not
 * exist in the target month, the last day of that month is used (30/11 + 3 months = 28/02).
 */
export function addMonths(date: string, months: number): string {
  const { year, month, day } = parseDate(date)
  const index = year * 12 + (month - 1) + months
  const targetYear = Math.floor(index / 12)
  const targetMonth = (index % 12) + 1
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth))
  return `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`
}

/** DI-58: the monthly start date goes from the first day of this month to today plus one month, inclusive. */
export function monthlyStartRange(today: string): { min: string; max: string } {
  return { min: firstOfMonth(today), max: addMonths(today, 1) }
}

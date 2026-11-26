/** Fixtures of the slot screens' tests, shaped like the API's responses. */

type SlotOverrides = Partial<{
  id: number
  dayOfWeek: number
  startTime: string
  endTime: string
  fixedStudents: number
  scheduleEditable: boolean
  active: boolean
  upcomingOverbookedLessons: { lessonDate: string; occupancy: number; capacity: number }[]
}>

export function slotItem(overrides: SlotOverrides = {}) {
  return {
    id: 2,
    dayOfWeek: 1,
    startTime: '10:00',
    endTime: '12:00',
    capacity: 12,
    active: true,
    fixedStudents: 0,
    scheduleEditable: false,
    upcomingOverbookedLessons: [],
    ...overrides,
  }
}

export const mondayMorning = slotItem()
export const tuesdayEvening = slotItem({ id: 3, dayOfWeek: 2, startTime: '18:00', endTime: '20:00' })
export const thursdayEvening = slotItem({ id: 4, dayOfWeek: 4, startTime: '18:00', endTime: '20:00' })

export function apiLesson(
  slotId: number,
  lessonDate: string,
  overrides: Partial<{
    dayOfWeek: number
    startTime: string
    endTime: string
    occupancy: number
    overbooked: boolean
    started: boolean
  }> = {},
) {
  const occupancy = overrides.occupancy ?? 9
  return {
    slotId,
    lessonDate,
    dayOfWeek: 1,
    startTime: '10:00',
    endTime: '12:00',
    capacity: 12,
    occupancy,
    freeSpots: Math.max(0, 12 - occupancy),
    overbooked: occupancy > 12,
    started: false,
    ...overrides,
  }
}

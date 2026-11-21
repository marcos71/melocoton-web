/** Fixtures of the student screens' tests, shaped like the API's responses. */

export const tuesdaySlot = {
  id: 3,
  dayOfWeek: 2,
  startTime: '18:00',
  endTime: '20:00',
  capacity: 8,
  active: true,
  upcomingOverbookedLessons: [],
}

export const mondaySlot = {
  id: 2,
  dayOfWeek: 1,
  startTime: '10:00',
  endTime: '12:00',
  capacity: 8,
  active: true,
  upcomingOverbookedLessons: [],
}

export const thursdaySlot = {
  id: 4,
  dayOfWeek: 4,
  startTime: '18:00',
  endTime: '20:00',
  capacity: 8,
  active: true,
  upcomingOverbookedLessons: [],
}

export const fixedTuesday = { id: 3, dayOfWeek: 2, startTime: '18:00', endTime: '20:00' }

export const luciaItem = {
  id: 11,
  name: 'Lucía Pérez',
  active: true,
  enrollmentType: 'MONTHLY',
  fixedSlot: fixedTuesday,
}

export const luisItem = {
  id: 12,
  name: 'Luis Gómez',
  active: true,
  enrollmentType: 'MONTHLY',
  fixedSlot: null,
}

export const lucasItem = {
  id: 13,
  name: 'Lucas Díaz',
  active: true,
  enrollmentType: 'DROP_IN',
  fixedSlot: null,
}

export const brunoItem = {
  id: 14,
  name: 'Bruno Ríos',
  active: false,
  enrollmentType: 'MONTHLY',
  fixedSlot: null,
}

export function lesson(
  bookingId: number,
  lessonDate: string,
  type: 'FIXED' | 'DROP_IN' | 'MAKEUP',
  overrides: Record<string, unknown> = {},
) {
  return {
    bookingId,
    lessonDate,
    type,
    slotId: 3,
    dayOfWeek: 2,
    startTime: '18:00',
    endTime: '20:00',
    ...overrides,
  }
}

export const luciaProfile = {
  id: 11,
  name: 'Lucía Pérez',
  email: 'lucia@ejemplo.com',
  phone: '11 5555-0101',
  active: true,
  enrollmentType: 'MONTHLY',
  monthlyStartDate: '2026-11-02',
  fixedSlot: fixedTuesday,
  upcomingLessons: [lesson(101, '2026-11-24', 'FIXED'), lesson(102, '2026-12-01', 'FIXED')],
}

export const luisProfile = {
  ...luciaProfile,
  id: 12,
  name: 'Luis Gómez',
  email: 'luis@ejemplo.com',
  phone: '11 5555-0102',
  fixedSlot: null,
  upcomingLessons: [],
}

export const lucasProfile = {
  id: 13,
  name: 'Lucas Díaz',
  email: 'lucas@ejemplo.com',
  phone: '11 5555-0104',
  active: true,
  enrollmentType: 'DROP_IN',
  monthlyStartDate: null,
  fixedSlot: null,
  upcomingLessons: [
    lesson(201, '2026-11-26', 'DROP_IN', {
      slotId: 5,
      dayOfWeek: 4,
      startTime: '10:00',
      endTime: '12:00',
    }),
  ],
}

export const brunoProfile = {
  ...luisProfile,
  id: 14,
  name: 'Bruno Ríos',
  email: 'bruno@ejemplo.com',
  phone: '11 5555-0105',
  active: false,
}

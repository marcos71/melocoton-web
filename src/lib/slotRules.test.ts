import { apiLesson, mondayMorning, slotItem, thursdayEvening, tuesdayEvening } from '../test/slots'
import {
  findOverlap,
  isFullOfFixedStudents,
  nextLessonBySlot,
  normalizeSlotTime,
  normalizeTime,
  overbookedLessons,
  slotsOfDay,
} from './slotRules'

describe('findOverlap', () => {
  const slots = [mondayMorning, tuesdayEvening, thursdayEvening]

  it('DI25_aSlotInsideAnotherOneOverlapsIt', () => {
    expect(findOverlap(2, '18:30', '19:00', slots)).toBe(tuesdayEvening)
  })

  it('DI25_aSlotThatContainsAnotherOneOverlapsIt', () => {
    expect(findOverlap(2, '17:00', '21:00', slots)).toBe(tuesdayEvening)
  })

  it('DI25_aPartialOverlapOnEitherSideCounts', () => {
    expect(findOverlap(2, '17:00', '18:30', slots)).toBe(tuesdayEvening)
    expect(findOverlap(2, '19:30', '21:00', slots)).toBe(tuesdayEvening)
  })

  it('DI25_slotsThatTouchDoNotOverlap', () => {
    expect(findOverlap(2, '16:00', '18:00', slots)).toBeUndefined()
    expect(findOverlap(2, '20:00', '22:00', slots)).toBeUndefined()
  })

  it('DI25_theSameTimesOnAnotherDayDoNotOverlap', () => {
    expect(findOverlap(3, '18:00', '20:00', slots)).toBeUndefined()
  })

  it('DI25_theSlotBeingCorrectedIsNotCountedAgainstItself', () => {
    expect(findOverlap(2, '18:00', '20:00', slots, tuesdayEvening.id)).toBeUndefined()
    expect(findOverlap(2, '18:00', '20:00', slots, mondayMorning.id)).toBe(tuesdayEvening)
  })

  it('DI25_timesWithSecondsAreComparedAsHoursAndMinutes', () => {
    const withSeconds = [slotItem({ id: 9, dayOfWeek: 5, startTime: '10:00:00', endTime: '12:00:00' })]
    expect(findOverlap(5, '12:00', '13:00', withSeconds)).toBeUndefined()
    expect(findOverlap(5, '11:59', '13:00', withSeconds)).toBe(withSeconds[0])
  })

  it('DI25_noSlotsMeansNoOverlap', () => {
    expect(findOverlap(1, '10:00', '12:00', [])).toBeUndefined()
  })
})

describe('slotsOfDay', () => {
  it('RF06_keepsOnlyTheDayAndSortsByStartTime', () => {
    const late = slotItem({ id: 7, startTime: '18:00', endTime: '20:00' })
    const early = slotItem({ id: 8, startTime: '08:00', endTime: '09:00' })

    expect(slotsOfDay([late, tuesdayEvening, early], 1).map((slot) => slot.id)).toEqual([8, 7])
  })
})

describe('normalizeTime', () => {
  it('RF06_cutsTheSecondsOffAndKeepsHoursAndMinutes', () => {
    expect(normalizeTime('18:00:00')).toBe('18:00')
    expect(normalizeTime('18:00')).toBe('18:00')
    expect(normalizeSlotTime(slotItem({ startTime: '09:30:00', endTime: '10:30:00' }))).toMatchObject({
      startTime: '09:30',
      endTime: '10:30',
    })
  })
})

describe('nextLessonBySlot', () => {
  // Friday 20 Nov 2026, 12:00 in the workshop.
  const now = new Date('2026-11-20T15:00:00Z')

  it('DI62_picksEachSlotsFirstLessonThatHasNotStarted', () => {
    const lessons = [
      apiLesson(2, '2026-11-26'),
      apiLesson(2, '2026-11-20', { startTime: '10:00' }),
      apiLesson(2, '2026-11-23'),
      apiLesson(4, '2026-11-20', { startTime: '18:00', endTime: '20:00' }),
      apiLesson(4, '2026-11-26', { startTime: '18:00', endTime: '20:00' }),
    ]

    const next = nextLessonBySlot(lessons, now)

    expect(next.get(2)?.lessonDate).toBe('2026-11-23')
    expect(next.get(4)?.lessonDate).toBe('2026-11-20')
  })

  it('DI62_aLessonThatStartsRightNowHasStarted', () => {
    const next = nextLessonBySlot([apiLesson(2, '2026-11-20', { startTime: '12:00:00' })], now)

    expect(next.has(2)).toBe(false)
  })

  it('DI62_aSlotWithoutLessonsHasNoNextOne', () => {
    expect(nextLessonBySlot([], now).size).toBe(0)
  })
})

describe('overbookedLessons', () => {
  it('DI43_joinsTheOverbookedDatesOfEverySlotByDateThenStartTime', () => {
    const monday = slotItem({
      id: 2,
      startTime: '10:00',
      upcomingOverbookedLessons: [{ lessonDate: '2026-12-07', occupancy: 13, capacity: 12 }],
    })
    const thursday = slotItem({
      id: 4,
      dayOfWeek: 4,
      startTime: '18:00',
      upcomingOverbookedLessons: [
        { lessonDate: '2026-12-03', occupancy: 13, capacity: 12 },
        { lessonDate: '2026-12-07', occupancy: 14, capacity: 12 },
      ],
    })

    const joined = overbookedLessons([thursday, monday])

    expect(joined.map((item) => [item.lessonDate, item.slot.id])).toEqual([
      ['2026-12-03', 4],
      ['2026-12-07', 2],
      ['2026-12-07', 4],
    ])
  })
})

describe('isFullOfFixedStudents', () => {
  it('DI66_aSlotWithAsManyFixedStudentsAsCapacityIsFull', () => {
    expect(isFullOfFixedStudents({ fixedStudents: 12, capacity: 12 })).toBe(true)
    expect(isFullOfFixedStudents({ fixedStudents: 11, capacity: 12 })).toBe(false)
    expect(isFullOfFixedStudents({ fixedStudents: 13, capacity: 12 })).toBe(true)
  })
})

import type { Lesson } from '../api/lessons'
import {
  freeSpotsText,
  lessonButtonText,
  lessonInSentence,
  lessonKey,
  lessonLabel,
  lessonOption,
  upcomingLessons,
} from './dropInLessons'

function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    slotId: 4,
    lessonDate: '2026-11-26',
    dayOfWeek: 4,
    startTime: '18:00',
    endTime: '20:00',
    capacity: 8,
    occupancy: 5,
    freeSpots: 3,
    overbooked: false,
    started: false,
    ...overrides,
  }
}

describe('drop-in lesson texts', () => {
  it('RF09_aLessonIsItsSlotOnADate', () => {
    expect(lessonKey(lesson())).toBe('4|2026-11-26')
  })

  it('RF09_todayIsLabelledHoyAndOtherDatesUseTheShortFormat', () => {
    expect(lessonLabel('2026-11-20', '2026-11-20')).toBe('Hoy, vie 20 de nov')
    expect(lessonLabel('2026-11-24', '2026-11-20')).toBe('Mar 24 de nov')
  })

  it('RF11_theFreeSpotsAreSaidInSingularAndPlural', () => {
    expect(freeSpotsText(1)).toBe('Queda 1 lugar')
    expect(freeSpotsText(3)).toBe('Quedan 3 lugares')
  })

  it('RF11_anOpenLessonShowsItsFreeSpotsAndNoReason', () => {
    expect(lessonOption(lesson(), new Set(), '2026-11-20')).toEqual({
      value: '4|2026-11-26',
      label: 'Jue 26 de nov',
      subtitle: '18:00 a 20:00',
      description: 'Quedan 3 lugares',
    })
  })

  it('RF11_aFullOrOverbookedLessonIsUnavailableAsCompleta', () => {
    const full = lessonOption(lesson({ freeSpots: 0, occupancy: 9, overbooked: true }), new Set(), '2026-11-20')
    expect(full.unavailableReason).toBe('Completa')
  })

  it('DI41_aLessonTheStudentAlreadyHasIsUnavailableEvenIfItIsFull', () => {
    const option = lessonOption(lesson({ freeSpots: 0 }), new Set(['4|2026-11-26']), '2026-11-20')
    expect(option.unavailableReason).toBe('Ya está anotado.')
  })

  it('RF09_theButtonAndTheNoticeNameTheChosenLesson', () => {
    expect(lessonButtonText(lesson())).toBe('Anotar el jue 26 de nov, 18:00')
    expect(lessonInSentence(lesson())).toBe('el jueves 26 de noviembre, 18:00 a 20:00')
  })

  it('RN03_lessonsThatAlreadyStartedAreLeftOut', () => {
    const now = new Date('2026-11-20T21:30:00Z') // 18:30 in the workshop
    const lessons = [
      lesson({ lessonDate: '2026-11-20', started: true }),
      lesson({ lessonDate: '2026-11-20' }),
      lesson({ lessonDate: '2026-11-20', startTime: '19:00', endTime: '21:00' }),
      lesson({ lessonDate: '2026-11-27' }),
    ]
    expect(upcomingLessons(lessons, now).map((l) => `${l.lessonDate} ${l.startTime}`)).toEqual([
      '2026-11-20 19:00',
      '2026-11-27 18:00',
    ])
  })
})

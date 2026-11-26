import {
  addDays,
  addMonths,
  firstOfMonth,
  lessonStarted,
  monthlyStartRange,
  workshopNow,
  workshopToday,
} from './workshopTime'

describe('workshopTime', () => {
  it('RF08_todayIsCountedInTheWorkshopZoneNotInTheDeviceZone', () => {
    // 01:30 UTC of the 21st is still the 20th at 22:30 in Buenos Aires.
    expect(workshopToday(new Date('2026-11-21T01:30:00Z'))).toBe('2026-11-20')
    expect(workshopNow(new Date('2026-11-21T01:30:00Z'))).toEqual({
      date: '2026-11-20',
      time: '22:30',
    })
    expect(workshopToday(new Date('2026-11-21T03:00:00Z'))).toBe('2026-11-21')
  })

  it('RF09_aLessonHasStartedWhenItsDayPassedOrTodaysStartTimeIsReached', () => {
    const now = new Date('2026-11-20T21:00:00Z') // 18:00 in the workshop
    expect(lessonStarted('2026-11-19', '20:00', now)).toBe(true)
    expect(lessonStarted('2026-11-20', '17:59', now)).toBe(true)
    expect(lessonStarted('2026-11-20', '18:00', now)).toBe(true)
    expect(lessonStarted('2026-11-20', '18:01', now)).toBe(false)
    expect(lessonStarted('2026-11-21', '09:00', now)).toBe(false)
  })

  it.each([
    ['2026-11-20', 1, '2026-12-20'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2026-11-30', 3, '2027-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2026-01-31', 1, '2026-02-28'],
    ['2026-11-20', 0, '2026-11-20'],
  ])('RF11_addMonthsKeepsThePlusMonthsRule_%s_plus_%i', (date, months, expected) => {
    expect(addMonths(date, months)).toBe(expected)
  })

  it('RF05_theFirstOfTheMonthAndTheMonthlyStartRange', () => {
    expect(firstOfMonth('2026-11-20')).toBe('2026-11-01')
    expect(monthlyStartRange('2026-11-20')).toEqual({ min: '2026-11-01', max: '2026-12-20' })
    expect(monthlyStartRange('2026-12-31')).toEqual({ min: '2026-12-01', max: '2027-01-31' })
    expect(monthlyStartRange('2027-01-31')).toEqual({ min: '2027-01-01', max: '2027-02-28' })
  })
})

describe('addDays', () => {
  it('RF06_addsDaysAcrossMonthsAndYears', () => {
    expect(addDays('2026-11-21', 6)).toBe('2026-11-27')
    expect(addDays('2026-11-28', 6)).toBe('2026-12-04')
    expect(addDays('2026-12-30', 6)).toBe('2027-01-05')
    expect(addDays('2028-02-27', 2)).toBe('2028-02-29')
  })
})

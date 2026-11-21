import {
  bookingTypeLabel,
  bySlotTime,
  dayName,
  enrollmentLabel,
  formatDate,
  formatLessonDate,
  formatLongDate,
  formatSlot,
  formatSlotInSentence,
  formatSlotLower,
  formatSlotShort,
  formatWeekdayPlural,
  overbookedText,
} from './format'

const tuesday = { dayOfWeek: 2, startTime: '18:00', endTime: '20:00' }

describe('format', () => {
  it('RF04_formatsTheSlotInTheThreeForms', () => {
    expect(formatSlot(tuesday)).toBe('Martes 18:00 a 20:00')
    expect(formatSlotShort(tuesday)).toBe('el martes 18:00')
    expect(formatSlotInSentence({ ...tuesday, dayOfWeek: 4 })).toBe('el jueves 18:00 a 20:00')
    expect(formatSlotLower({ ...tuesday, dayOfWeek: 4 })).toBe('jueves 18:00 a 20:00')
    expect(formatSlot({ ...tuesday, dayOfWeek: 3 })).toBe('Miércoles 18:00 a 20:00')
    expect(dayName(7)).toBe('domingo')
  })

  it('RF08_formatsTheWeekdayInPlural', () => {
    expect(formatWeekdayPlural(4)).toBe('los jueves')
    expect(formatWeekdayPlural(6)).toBe('los sábados')
    expect(formatWeekdayPlural(1)).toBe('los lunes')
  })

  it('RF09_formatsTheDatesOfTheLists', () => {
    expect(formatLessonDate('2026-11-24')).toBe('Mar 24 de nov')
    expect(formatLessonDate('2026-12-06')).toBe('Dom 6 de dic')
    expect(formatLongDate('2026-11-24')).toBe('martes 24 de noviembre')
    expect(formatDate('2026-11-02')).toBe('2 de nov de 2026')
  })

  it('RF04_labelsTheModalityAndTheBookingType', () => {
    expect(enrollmentLabel('MONTHLY')).toBe('Mensual')
    expect(enrollmentLabel('DROP_IN')).toBe('Clase suelta')
    expect(bookingTypeLabel('FIXED')).toBe('Fija')
    expect(bookingTypeLabel('DROP_IN')).toBe('Suelta')
    expect(bookingTypeLabel('MAKEUP')).toBe('Recuperación')
  })

  it('RF08_sortsSlotsByDayAndThenByStartTime', () => {
    const slots = [
      { dayOfWeek: 4, startTime: '10:00', endTime: '12:00' },
      tuesday,
      { dayOfWeek: 2, startTime: '10:00', endTime: '12:00' },
    ]
    expect([...slots].sort(bySlotTime).map(formatSlot)).toEqual([
      'Martes 10:00 a 12:00',
      'Martes 18:00 a 20:00',
      'Jueves 10:00 a 12:00',
    ])
  })

  it('DI43_overbookedTextUsesTheSingularAndThePlural', () => {
    expect(overbookedText(1)).toBe('1 clase excedida')
    expect(overbookedText(3)).toBe('3 clases excedidas')
  })
})

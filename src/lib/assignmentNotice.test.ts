import { assignmentNotice } from './assignmentNotice'

const thursday = { id: 4, dayOfWeek: 4, startTime: '18:00', endTime: '20:00' }
const tuesday = { id: 3, dayOfWeek: 2, startTime: '18:00', endTime: '20:00' }

describe('assignmentNotice', () => {
  it('RF08_firstAssignmentIsASuccessNotice', () => {
    expect(assignmentNotice({ fixedSlot: thursday, overbookedLessons: [] }, null)).toEqual({
      kind: 'success',
      text: 'Le asignamos el jueves 18:00 a 20:00. Ya tiene sus clases fijas generadas.',
    })
  })

  it('DI27_aReplacementNamesTheOldDayWhoseClassesWereCancelled', () => {
    expect(assignmentNotice({ fixedSlot: thursday, overbookedLessons: [] }, tuesday)).toEqual({
      kind: 'success',
      text: 'Cambiamos su turno fijo al jueves 18:00 a 20:00. Se cancelaron sus clases del martes que no habían empezado.',
    })
  })

  it('DI43_overbookedLessonsMakeAWarningThatListsThemAndLinksToSlots', () => {
    const notice = assignmentNotice(
      {
        fixedSlot: thursday,
        overbookedLessons: [
          { lessonDate: '2026-12-03', occupancy: 9, capacity: 8 },
          { lessonDate: '2026-12-10', occupancy: 10, capacity: 8 },
        ],
      },
      tuesday,
    )

    expect(notice).toEqual({
      kind: 'warning',
      text: 'El jueves 18:00 a 20:00 tiene clases excedidas.',
      items: ['Jue 3 de dic: 9 alumnos para 8 lugares', 'Jue 10 de dic: 10 alumnos para 8 lugares'],
      footer:
        'Las clases fijas se guardaron igual. Para resolverlo, cancelá alguna clase suelta de esas fechas.',
      link: { to: '/slots', label: 'Ver en Turnos' },
    })
  })
})

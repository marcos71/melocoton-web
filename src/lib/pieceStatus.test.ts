import {
  PIECE_STATUSES,
  PIECE_STATUS_HINT,
  historyEntryText,
  pieceDate,
  pieceStatusLabel,
  pieceStatusPlural,
  pieceStep,
} from './pieceStatus'

describe('pieceStatus', () => {
  it('RN04_knowsTheFourStatusesInOrder', () => {
    expect(PIECE_STATUSES.map(pieceStatusLabel)).toEqual([
      'En proceso',
      'Bizcochada',
      'Esmaltada',
      'Terminada',
    ])
    expect(PIECE_STATUSES.map(pieceStep)).toEqual([1, 2, 3, 4])
  })

  it('CU15_pluralsNameAGroupOfPieces', () => {
    expect(PIECE_STATUSES.map(pieceStatusPlural)).toEqual([
      'En proceso',
      'Bizcochadas',
      'Esmaltadas',
      'Terminadas',
    ])
  })

  it('DI86_everyStatusHasItsSentence', () => {
    for (const status of PIECE_STATUSES) expect(PIECE_STATUS_HINT[status]).not.toBe('')
  })

  it('RF28_datesAreOnTheWorkshopCalendar', () => {
    // 01:00 UTC is still the day before in Buenos Aires.
    expect(pieceDate('2026-10-30T01:00:00Z')).toBe('29 de oct de 2026')
  })

  it('RF28_aCreationReadsPiezaCreadaEn', () => {
    expect(
      historyEntryText({ eventType: 'CREATED', newStatus: 'IN_PROGRESS', occurredAt: '2026-10-29T15:00:00Z' }),
    ).toBe('29 de oct de 2026 · Pieza creada en En proceso')
  })

  it('RF28_anAdvanceReadsFromTo', () => {
    expect(
      historyEntryText({
        eventType: 'ADVANCED',
        previousStatus: 'BISQUE_FIRED',
        newStatus: 'GLAZED',
        occurredAt: '2026-10-29T15:00:00Z',
      }),
    ).toBe('29 de oct de 2026 · Bizcochada a Esmaltada')
  })
})

import { listFromState, noticeFromState } from './navState'

describe('navState', () => {
  it('RF04_readsAValidNoticeFromTheRouterState', () => {
    const notice = { kind: 'warning', text: 'Algo', items: ['a'] }
    expect(noticeFromState({ notice })).toEqual(notice)
  })

  it.each([null, undefined, {}, { notice: 'texto' }, { notice: { kind: 'otro', text: 'x' } }, { notice: { kind: 'info' } }])(
    'RF04_ignoresAMalformedNotice_%j',
    (state) => {
      expect(noticeFromState(state)).toBeNull()
    },
  )

  it('RF04_onlyAcceptsAListUrlOfTheStudentsTab', () => {
    expect(listFromState({ from: '/students?status=all&q=lu' })).toBe('/students?status=all&q=lu')
    expect(listFromState({ from: '/students' })).toBe('/students')
    expect(listFromState({ from: '/students/3' })).toBeNull()
    expect(listFromState({ from: 'https://example.com/students' })).toBeNull()
    expect(listFromState({ from: '/admin' })).toBeNull()
    expect(listFromState(null)).toBeNull()
  })

  it('RF32_readsTheListUrlOfAnotherTabWhenAsked', () => {
    expect(listFromState({ from: '/pieces?student=3&status=GLAZED' }, '/pieces')).toBe(
      '/pieces?student=3&status=GLAZED',
    )
    expect(listFromState({ from: '/pieces' }, '/pieces')).toBe('/pieces')
    expect(listFromState({ from: '/pieces/3' }, '/pieces')).toBeNull()
    expect(listFromState({ from: '/students?q=a' }, '/pieces')).toBeNull()
  })
})

import { normalize } from './text'

describe('normalize', () => {
  it('DI85_ignoresAccentsAndCase', () => {
    expect(normalize('Lucía P.')).toBe('lucia p.')
    expect(normalize('MARÍA')).toBe('maria')
  })
})

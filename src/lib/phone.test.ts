import { telHref } from './phone'

describe('telHref', () => {
  it.each([
    ['11 5555-0101', 'tel:1155550101'],
    ['+54 9 11 5555-0101', 'tel:+5491155550101'],
    ['(011) 5555 0101', 'tel:01155550101'],
    ['  +54 11 5555', 'tel:+54115555'],
  ])('DI51_keepsTheDigitsAndALeadingPlus_%s', (phone, expected) => {
    expect(telHref(phone)).toBe(expected)
  })

  it('DI51_returnsNullWhenNoDigitIsLeft', () => {
    expect(telHref('sin teléfono')).toBeNull()
    expect(telHref('+')).toBeNull()
  })
})

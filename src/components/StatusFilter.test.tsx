import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusFilter } from './StatusFilter'

const OPTIONS = [
  { value: 'a', label: 'Uno' },
  { value: 'b', label: 'Dos' },
]

describe('StatusFilter', () => {
  it('RNF21_marksOnlyTheSelectedOptionAsPressed', () => {
    render(<StatusFilter options={OPTIONS} value="b" onChange={() => {}} />)

    expect(screen.getByRole('button', { name: 'Uno' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Dos' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('RNF21_callsOnChangeWithTheValueOfTheClickedOption', async () => {
    const onChange = vi.fn()
    render(<StatusFilter options={OPTIONS} value="a" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Dos' }))

    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('RNF21_namesTheGroupWithTheLabelOrADefault', () => {
    const { rerender } = render(<StatusFilter options={OPTIONS} value="a" onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Filtrar por estado' })).toBeInTheDocument()

    rerender(<StatusFilter options={OPTIONS} value="a" onChange={() => {}} label="Modalidad" />)
    expect(screen.getByRole('group', { name: 'Modalidad' })).toBeInTheDocument()
  })
})

describe('StatusFilter pressed option', () => {
  it('RNF02_thePressedOptionKeepsAriaPressedAndItsOwnClassForTheCheckMark', () => {
    render(<StatusFilter options={OPTIONS} value="a" onChange={() => {}} />)

    const pressed = screen.getByRole('button', { name: 'Uno' })
    const other = screen.getByRole('button', { name: 'Dos' })

    expect(pressed).toHaveAttribute('aria-pressed', 'true')
    // The check mark is a ::before of this class (jsdom has no CSS), so only the class can be asserted.
    expect(pressed.className).toMatch(/pressed/)
    expect(other.className).not.toMatch(/pressed/)
  })
})

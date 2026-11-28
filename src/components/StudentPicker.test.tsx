import { readFileSync } from 'node:fs'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import type { StudentDirectoryEntry } from '../api/students'
import { StudentPicker } from './StudentPicker'

const STUDENTS: StudentDirectoryEntry[] = [
  { id: 1, name: 'Ana G.', phone: '1111', active: true },
  { id: 2, name: 'Lucía P.', phone: '2222', active: true },
  { id: 3, name: 'Mateo R.', phone: '3333', active: false },
]

function renderPicker(props: Partial<ComponentProps<typeof StudentPicker>> = {}) {
  const onChange = vi.fn()
  const onRetry = vi.fn()
  render(
    <StudentPicker
      label="Alumno"
      students={STUDENTS}
      state="ready"
      onRetry={onRetry}
      value={null}
      onChange={onChange}
      {...props}
    />,
  )
  return { onChange, onRetry }
}

const trigger = () => screen.getByRole('button', { name: /Alumno/ })

async function openPanel() {
  await userEvent.click(trigger())
  return screen.findByRole('dialog', { name: 'Elegí un alumno' })
}

describe('StudentPicker', () => {
  it('DI85_searchFiltersByNameIgnoringAccentsAndCase', async () => {
    renderPicker()
    await openPanel()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nombre' }), 'LUCIA')

    const options = screen.getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['Lucía P.'])
    expect(screen.getByText('1 alumno')).toBeInTheDocument()
  })

  it('DI85_anEmptySearchResultSaysSoAndKeepsTheListbox', async () => {
    renderPicker()
    await openPanel()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nombre' }), 'zzz')

    expect(screen.getByRole('listbox', { name: 'Alumnos' })).toBeInTheDocument()
    expect(
      screen.getByText('No hay alumnos que coincidan con «zzz». Revisá cómo lo escribiste.'),
    ).toBeInTheDocument()
  })

  it('DI85_theAllOptionComesFirstOnlyWithAnEmptySearch', async () => {
    renderPicker({ allOptionLabel: 'Todos los alumnos' })
    await openPanel()

    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Todos los alumnos')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nombre' }), 'ana')

    expect(screen.queryByRole('option', { name: /Todos los alumnos/ })).not.toBeInTheDocument()
  })

  it('RF31_inactiveStudentsAreMarkedInactiveInText', async () => {
    renderPicker()
    await openPanel()

    expect(screen.getByRole('option', { name: 'Mateo R. (inactivo)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ana G.' })).toBeInTheDocument()
  })

  it('DI85_whileLoadingThePickerShowsItsReasonAndCannotOpen', () => {
    renderPicker({ state: 'loading', students: undefined })

    expect(screen.getByRole('status')).toHaveTextContent('Cargando alumnos…')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('DI85_aDirectoryErrorOffersRetry', async () => {
    const { onRetry } = renderPicker({ state: 'error', students: undefined })

    expect(screen.getByText('No pudimos cargar los alumnos.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('DI85_theTriggerShowsThePlaceholderOrTheChosenStudent', () => {
    const { rerender } = render(
      <StudentPicker
        label="Alumno"
        students={STUDENTS}
        state="ready"
        onRetry={() => {}}
        value={null}
        onChange={() => {}}
        placeholder="Elegí un alumno"
      />,
    )
    expect(trigger()).toHaveTextContent('Elegí un alumno')

    rerender(
      <StudentPicker
        label="Alumno"
        students={STUDENTS}
        state="ready"
        onRetry={() => {}}
        value={2}
        onChange={() => {}}
        placeholder="Elegí un alumno"
      />,
    )
    expect(trigger()).toHaveTextContent('Lucía P.')
  })

  it('DI85_theCurrentValueIsMarkedWithACheck', async () => {
    renderPicker({ value: 2 })
    await openPanel()

    const chosen = screen.getByRole('option', { name: 'Lucía P.' })
    expect(chosen).toHaveTextContent('✓ Lucía P.')
    expect(within(screen.getByRole('option', { name: 'Ana G.' })).queryByText('✓')).toBeNull()
    expect(screen.getByRole('option', { name: 'Ana G.' })).not.toHaveTextContent('✓')
  })

  it('DI85_formErrorIsLinkedToTheTrigger', () => {
    renderPicker({ error: 'Elegí un alumno.', hint: 'Solo alumnos activos.' })

    const error = screen.getByText('Elegí un alumno.')
    expect(trigger().getAttribute('aria-describedby')).toContain(error.id)
    expect(error).toHaveTextContent('Error: Elegí un alumno.')
  })

  it('DI85_tappingAnOptionSelectsClosesAndReturnsFocus', async () => {
    const { onChange } = renderPicker()
    await openPanel()

    await userEvent.click(screen.getByRole('option', { name: 'Lucía P.' }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith(2)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })

  it('DI85_tappingTheAllOptionClearsTheChoice', async () => {
    const { onChange } = renderPicker({ value: 2, allOptionLabel: 'Todos los alumnos' })
    await openPanel()

    await userEvent.click(screen.getByRole('option', { name: 'Todos los alumnos' }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('DI85_tappingTheCurrentOptionAgainClosesWithoutLosingIt', async () => {
    const { onChange } = renderPicker({ value: 2 })
    await openPanel()

    await userEvent.click(screen.getByRole('option', { name: 'Lucía P.' }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith(2)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('DI85_enterOnTheActiveOptionCallsOnChangeAndCloses', async () => {
    const { onChange } = renderPicker()
    await openPanel()

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledExactlyOnceWith(2)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('DI85_escapeClearsTheSearchFirstThenClosesWithoutChanging', async () => {
    const { onChange } = renderPicker()
    await openPanel()
    const search = screen.getByRole('searchbox', { name: 'Buscar por nombre' })
    await userEvent.type(search, 'ana')

    await userEvent.keyboard('{Escape}')
    expect(search).toHaveValue('')
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    await waitFor(() => expect(trigger()).toHaveFocus())
  })

  it('DI90_cancelClosesWithoutChanging', async () => {
    const { onChange } = renderPicker()
    await openPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('RNF02_thePanelOverlayIsFixedAboveTheTabBar', () => {
    const css = readFileSync('src/components/StudentPicker.module.css', 'utf8')
    const overlay = /\.overlay\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(overlay).toMatch(/position:\s*fixed/)
    expect(overlay).toMatch(/z-index:\s*20/)
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { MemoryRouter } from 'react-router'
import type { StudentDirectoryEntry } from '../api/students'
import { PieceForm } from './PieceForm'

const STUDENTS: StudentDirectoryEntry[] = [
  { id: 1, name: 'Ana G.', phone: '1111', active: true },
  { id: 2, name: 'Lucía P.', phone: '2222', active: true },
]

function renderForm(props: Partial<ComponentProps<typeof PieceForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const view = render(
    <MemoryRouter>
      <PieceForm
        mode="create"
        defaultValues={{ name: '', notes: '' }}
        apiError={null}
        onSubmit={onSubmit}
        cancelTo="/pieces"
        submitLabel="Crear pieza"
        pendingLabel="Creando…"
        {...props}
      />
    </MemoryRouter>,
  )
  return { onSubmit, ...view }
}

const picker = (overrides: Partial<NonNullable<ComponentProps<typeof PieceForm>['studentPicker']>> = {}) => ({
  students: STUDENTS,
  state: 'ready' as const,
  onRetry: () => {},
  ...overrides,
})

describe('PieceForm', () => {
  it('RF24_nameIsRequiredAndUpTo100Chars', async () => {
    const { onSubmit } = renderForm()

    await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))
    expect(await screen.findByText('Escribí el nombre de la pieza.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true')

    await userEvent.click(screen.getByLabelText('Nombre'))
    await userEvent.paste('a'.repeat(101))
    await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))
    expect(await screen.findByText('Hasta 100 caracteres.', { selector: 'p' })).toHaveTextContent(
      'Error: Hasta 100 caracteres.',
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('RF24_aBlankNameIsNotAName', async () => {
    renderForm()

    await userEvent.type(screen.getByLabelText('Nombre'), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))

    expect(await screen.findByText('Escribí el nombre de la pieza.')).toBeInTheDocument()
  })

  it('DI72_notesUpTo500Chars', async () => {
    const { onSubmit } = renderForm()
    await userEvent.type(screen.getByLabelText('Nombre'), 'Bowl')

    await userEvent.click(screen.getByLabelText('Notas (opcional)'))
    await userEvent.paste('n'.repeat(501))
    await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))

    expect(await screen.findByText('Hasta 500 caracteres.', { selector: 'p:not([id$="-hint"])' }))
      .toHaveTextContent('Error: Hasta 500 caracteres.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('RF24_sendsTheTrimmedNameAndNotes', async () => {
    const { onSubmit } = renderForm()

    await userEvent.type(screen.getByLabelText('Nombre'), '  Bowl 1  ')
    await userEvent.type(screen.getByLabelText('Notas (opcional)'), ' Esmalte celeste ')
    await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ name: 'Bowl 1', notes: 'Esmalte celeste' })
  })

  it('RF27_saveIsDisabledWithAReasonWhileNothingChanged', async () => {
    const { onSubmit } = renderForm({
      mode: 'edit',
      defaultValues: { name: 'Bowl', notes: 'Celeste' },
      submitLabel: 'Guardar cambios',
    })

    const save = screen.getByRole('button', { name: 'Guardar cambios' })
    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(save).toHaveAccessibleDescription('No hay cambios para guardar.')
    await userEvent.click(save)
    expect(onSubmit).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Nombre'), ' 2')

    const enabled = screen.getByRole('button', { name: 'Guardar cambios' })
    expect(enabled).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByText('No hay cambios para guardar.')).not.toBeInTheDocument()
  })

  it('RF27_clearingTheNotesSendsAnEmptyString', async () => {
    const { onSubmit } = renderForm({
      mode: 'edit',
      defaultValues: { name: 'Bowl', notes: 'Celeste' },
      submitLabel: 'Guardar cambios',
    })

    await userEvent.clear(screen.getByLabelText('Notas (opcional)'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ name: 'Bowl', notes: '' })
  })

  it('RF24_showsTheErrorOfAnActionThatFailed', () => {
    renderForm({ apiError: 'No pudimos conectar.' })

    expect(screen.getByRole('alert')).toHaveTextContent('Error: No pudimos conectar.')
  })

  it('DI26_aFieldErrorFromTheApiIsShownOnTheNameAndFocused', async () => {
    const onSubmit = vi.fn(async (_values, { setFieldError }) => {
      setFieldError('name', 'Ya tenés una pieza con ese nombre.')
    })
    renderForm({ onSubmit })

    await userEvent.type(screen.getByLabelText('Nombre'), 'Bowl')
    await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))

    expect(await screen.findByText('Ya tenés una pieza con ese nombre.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
  })

  describe('with a student picker (teachers)', () => {
    it('DI85_setErrorFocusesTheTrigger', async () => {
      const { onSubmit } = renderForm({ studentPicker: picker() })
      await userEvent.type(screen.getByLabelText('Nombre'), 'Bowl')

      await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))

      const trigger = await screen.findByRole('button', { name: /Alumno/ })
      expect(trigger).toHaveFocus()
      expect(trigger).toHaveAccessibleDescription('Error: Elegí un alumno.')
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('RF24_sendsTheChosenStudent', async () => {
      const { onSubmit } = renderForm({ studentPicker: picker() })
      await userEvent.type(screen.getByLabelText('Nombre'), 'Bowl')

      await userEvent.click(screen.getByRole('button', { name: /Alumno/ }))
      await userEvent.click(await screen.findByRole('option', { name: 'Lucía P.' }))
      await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))

      await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ studentId: 2, name: 'Bowl' })
    })

    it('RF24_preselectsTheStudentWhenItIsInTheList', () => {
      renderForm({ studentPicker: picker({ defaultStudentId: 2 }) })

      expect(screen.getByRole('button', { name: /Alumno/ })).toHaveTextContent('Lucía P.')
    })

    it('RF24_ignoresAPreselectedStudentThatIsNotInTheList', () => {
      renderForm({ studentPicker: picker({ defaultStudentId: 99 }) })

      expect(screen.getByRole('button', { name: /Alumno/ })).toHaveTextContent('Elegí un alumno')
    })

    it('RF24_preselectsOnceTheListArrivesWithoutLosingWhatWasTyped', async () => {
      const view = renderForm({ studentPicker: picker({ students: undefined, state: 'loading', defaultStudentId: 2 }) })
      await userEvent.type(screen.getByLabelText('Nombre'), 'Bowl')
      expect(screen.getByText('Cargando alumnos…')).toBeInTheDocument()

      view.rerender(
        <MemoryRouter>
          <PieceForm
            mode="create"
            studentPicker={picker({ defaultStudentId: 2 })}
            defaultValues={{ name: '', notes: '' }}
            apiError={null}
            onSubmit={vi.fn()}
            cancelTo="/pieces"
            submitLabel="Crear pieza"
            pendingLabel="Creando…"
          />
        </MemoryRouter>,
      )

      expect(await screen.findByRole('button', { name: /Alumno/ })).toHaveTextContent('Lucía P.')
      expect(screen.getByLabelText('Nombre')).toHaveValue('Bowl')
    })

    it('RF24_noActiveStudentsDisablesCreateWithAReason', () => {
      renderForm({ studentPicker: picker({ students: [] }) })

      expect(
        screen.getByText(
          'No hay alumnos activos. Para crear una pieza tiene que haber al menos un alumno activo.',
        ),
      ).toBeInTheDocument()
      const create = screen.getByRole('button', { name: 'Crear pieza' })
      expect(create).toHaveAttribute('aria-disabled', 'true')
      expect(create).toHaveAccessibleDescription('No hay alumnos activos.')
    })

    it('DI85_aDirectoryErrorOffersRetryInTheForm', async () => {
      const onRetry = vi.fn()
      renderForm({ studentPicker: picker({ students: undefined, state: 'error', onRetry }) })

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

      expect(onRetry).toHaveBeenCalledOnce()
    })
  })
})

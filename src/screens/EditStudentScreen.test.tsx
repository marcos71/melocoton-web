import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'
import { brunoProfile, luciaProfile } from '../test/students'

const PROFILE = 'GET /api/v1/students/11'
const PATCH = 'PATCH /api/v1/students/11'

function renderEdit(options: { state?: unknown } = {}) {
  return renderApp({ role: 'LEAD_TEACHER', path: '/students/11/edit', state: options.state })
}

async function body(request: Request | undefined): Promise<unknown> {
  return request?.clone().json()
}

describe('EditStudentScreen', () => {
  it('RF04_showsALoadingTextAndThenTheFormWithTheCurrentData', async () => {
    stubApi({ [PROFILE]: () => jsonResponse(200, luciaProfile) })
    renderEdit()

    expect(await screen.findByText('Cargando ficha…')).toBeInTheDocument()
    const heading = await screen.findByRole('heading', { name: 'Editar datos' })
    expect(heading).toHaveFocus()
    expect(screen.getByLabelText('Nombre')).toHaveValue('Lucía Pérez')
    expect(screen.getByLabelText('Teléfono')).toHaveValue('11 5555-0101')
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Hasta 80 caracteres.')
    // Email and modality are plain text, not disabled fields.
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(screen.getByText('lucia@ejemplo.com')).toBeInTheDocument()
    expect(screen.getByText('Mensual')).toBeInTheDocument()
    expect(screen.getByText('El email y la modalidad no se cambian desde acá.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a Ficha' })).toHaveAttribute(
      'href',
      '/students/11',
    )
  })

  it('RF04_withoutChangesSavingIsUnavailableWithTheReason', async () => {
    stubApi({ [PROFILE]: () => jsonResponse(200, luciaProfile) })
    renderEdit()

    const save = await screen.findByRole('button', { name: 'Guardar cambios' })
    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(save).toHaveAccessibleDescription('No hay cambios para guardar.')

    await userEvent.type(screen.getByLabelText('Teléfono'), '0')

    expect(screen.getByRole('button', { name: 'Guardar cambios' })).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByText('No hay cambios para guardar.')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Teléfono'), '{Backspace}')

    expect(screen.getByText('No hay cambios para guardar.')).toBeInTheDocument()
  })

  it('RF04_sendsOnlyTheFieldThatChangedTrimmedAndReturnsToTheProfileWithTheNotice', async () => {
    const fetchFn = stubApi({
      [PROFILE]: () => jsonResponse(200, luciaProfile),
      [PATCH]: () => jsonResponse(200, { ...luciaProfile, phone: '11 4444-0000' }),
    })
    renderEdit({ state: { from: '/students?q=lu' } })
    const phone = await screen.findByLabelText('Teléfono')

    await userEvent.clear(phone)
    await userEvent.type(phone, ' 11 4444-0000 ')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('heading', { name: 'Lucía Pérez' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/students\/11$/)
    expect(screen.getByRole('status')).toHaveTextContent('Listo: Guardamos los cambios.')
    expect(await body(requestsTo(fetchFn, PATCH)[0])).toEqual({ phone: '11 4444-0000' })
    // The list URL travels back to the profile.
    expect(await screen.findByRole('link', { name: 'Volver a Alumnos' })).toHaveAttribute(
      'href',
      '/students?q=lu',
    )
  })

  it('RF04_sendsTheNameWhenItChanges', async () => {
    const fetchFn = stubApi({
      [PROFILE]: () => jsonResponse(200, luciaProfile),
      [PATCH]: () => jsonResponse(200, { ...luciaProfile, name: 'Lucía Pérez Díaz' }),
    })
    renderEdit()
    const name = await screen.findByLabelText('Nombre')

    await userEvent.type(name, ' Díaz')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await screen.findByRole('heading', { name: 'Lucía Pérez Díaz' })
    expect(await body(requestsTo(fetchFn, PATCH)[0])).toEqual({ name: 'Lucía Pérez Díaz' })
  })

  it('RF04_backAndCancelReturnToTheProfileKeepingTheList', async () => {
    stubApi({ [PROFILE]: () => jsonResponse(200, luciaProfile) })
    renderEdit({ state: { from: '/students?q=lu' } })

    await screen.findByRole('heading', { name: 'Editar datos' })
    await userEvent.click(screen.getByRole('link', { name: 'Cancelar' }))

    expect(await screen.findByRole('heading', { name: 'Lucía Pérez' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a Alumnos' })).toHaveAttribute(
      'href',
      '/students?q=lu',
    )
  })

  it('RF04_requiresTheNameAndThePhoneAndLimitsTheName', async () => {
    const fetchFn = stubApi({ [PROFILE]: () => jsonResponse(200, luciaProfile) })
    renderEdit()
    const name = await screen.findByLabelText('Nombre')

    await userEvent.clear(name)
    await userEvent.clear(screen.getByLabelText('Teléfono'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(screen.getByText('Ingresá el nombre.')).toBeInTheDocument()
    expect(screen.getByText('Ingresá el teléfono.')).toBeInTheDocument()

    fireEvent.change(name, { target: { value: 'a'.repeat(81) } })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('El nombre puede tener hasta 80 caracteres.')).toBeInTheDocument()
    expect(requestsTo(fetchFn, PATCH)).toHaveLength(0)
  })

  it('RF04_anInactiveStudentCanBeEdited', async () => {
    stubApi({
      'GET /api/v1/students/14': () => jsonResponse(200, brunoProfile),
      'PATCH /api/v1/students/14': () => jsonResponse(200, { ...brunoProfile, phone: '1' }),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/students/14/edit' })

    expect(await screen.findByLabelText('Nombre')).toHaveValue('Bruno Ríos')
    await userEvent.type(screen.getByLabelText('Teléfono'), '9')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).not.toHaveAttribute('aria-disabled')
  })

  it('RF04_aValidationErrorOfTheApiShowsInAnErrorBlockAndTheFormKeepsItsData', async () => {
    stubApi({
      [PROFILE]: () => jsonResponse(200, luciaProfile),
      [PATCH]: () => errorResponse(400, 'validation_error', 'Tenés que indicar al menos un dato para cambiar.'),
    })
    renderEdit()
    await userEvent.type(await screen.findByLabelText('Teléfono'), '0')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error: Tenés que indicar al menos un dato para cambiar.',
    )
    expect(screen.getByLabelText('Teléfono')).toHaveValue('11 5555-01010')
  })

  it('RF04_aMissingStudentOnSavingInvalidatesTheProfileAndShowsTheNotFoundScreen', async () => {
    let gone = false
    stubApi({
      [PROFILE]: () =>
        gone ? errorResponse(404, 'not_found', 'No existe ese alumno.') : jsonResponse(200, luciaProfile),
      [PATCH]: () => {
        gone = true
        return errorResponse(404, 'not_found', 'No existe ese alumno.')
      },
    })
    renderEdit()
    await userEvent.type(await screen.findByLabelText('Teléfono'), '0')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('No encontramos a este alumno.'),
    )
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Volver a Alumnos' })).toBeInTheDocument()
  })

  it('RF04_withoutConnectionTheErrorSaysNothingWasSaved', async () => {
    const fetchFn = stubApi({
      [PROFILE]: () => jsonResponse(200, luciaProfile),
      [PATCH]: () => Promise.reject(new TypeError('offline')),
    })
    renderEdit()
    await userEvent.type(await screen.findByLabelText('Teléfono'), '0')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó nada.')
    expect(requestsTo(fetchFn, PATCH)).toHaveLength(1)
  })

  it('RF04_aTimeoutTellsToCheckTheProfileBeforeTryingAgain', async () => {
    stubApi({
      [PROFILE]: () => jsonResponse(200, luciaProfile),
      [PATCH]: () => Promise.reject(new DOMException('slow', 'TimeoutError')),
    })
    renderEdit()
    await userEvent.type(await screen.findByLabelText('Teléfono'), '0')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No sabemos si se guardó: revisá la ficha antes de intentar de nuevo.',
    )
  })

  it('RF04_aMissingStudentShowsTheNotFoundScreen', async () => {
    stubApi({ [PROFILE]: () => errorResponse(404, 'not_found', 'No existe ese alumno.') })
    renderEdit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: No encontramos a este alumno.')
  })
})

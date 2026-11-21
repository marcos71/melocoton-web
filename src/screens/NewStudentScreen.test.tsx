import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'
import { luciaProfile } from '../test/students'

const CREATE = 'POST /api/v1/students'
const PROFILE_11 = 'GET /api/v1/students/11'

beforeEach(() => {
  // 12:00 in the workshop on Friday 20 November 2026.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-20T15:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

function renderNew() {
  return renderApp({ role: 'LEAD_TEACHER', path: '/students/new' })
}

async function fillBasics() {
  await userEvent.type(await screen.findByLabelText('Nombre'), ' Lucía Pérez ')
  await userEvent.type(screen.getByLabelText('Email'), ' lucia@ejemplo.com ')
  await userEvent.type(screen.getByLabelText('Teléfono'), '11 5555-0101')
}

function submit() {
  return userEvent.click(screen.getByRole('button', { name: 'Crear y enviar invitación' }))
}

describe('NewStudentScreen', () => {
  it('RF04_startsWithoutAModalityAndWithoutTheDateField', async () => {
    stubApi({})
    renderNew()

    expect(await screen.findByRole('heading', { name: 'Nuevo alumno' })).toHaveFocus()
    expect(
      screen.getByText(
        'Le vamos a enviar un email con un enlace para definir su contraseña. El enlace vence en 7 días.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Mensual' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Clase suelta' })).not.toBeChecked()
    expect(screen.queryByLabelText('Fecha de ingreso mensual')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Hasta 80 caracteres.')
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/students')
  })

  it('DI58_theMonthlyDateStartsTodayWithTheRangeInTheInput', async () => {
    stubApi({})
    renderNew()
    await userEvent.click(await screen.findByRole('radio', { name: 'Mensual' }))

    const date = screen.getByLabelText('Fecha de ingreso mensual')
    expect(date).toHaveValue('2026-11-20')
    expect(date).toHaveAttribute('min', '2026-11-01')
    expect(date).toHaveAttribute('max', '2026-12-20')
    expect(date).toHaveAccessibleDescription('Desde esta fecha se cuentan sus mensualidades.')
  })

  it('RF04_requiresEveryFieldAndTheModality', async () => {
    const fetchFn = stubApi({})
    renderNew()
    await screen.findByLabelText('Nombre')

    await submit()

    expect(screen.getByText('Ingresá el nombre.')).toBeInTheDocument()
    expect(screen.getByText('Ingresá el email.')).toBeInTheDocument()
    expect(screen.getByText('Ingresá el teléfono.')).toBeInTheDocument()
    expect(screen.getByText('Elegí la modalidad.')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Modalidad' })).toHaveAccessibleDescription(
      'Error: Elegí la modalidad.',
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('RF04_rejectsANameOfMoreThan80CharactersAndAnInvalidEmail', async () => {
    const fetchFn = stubApi({})
    renderNew()
    await screen.findByLabelText('Nombre')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'a'.repeat(81) } })
    await userEvent.type(screen.getByLabelText('Email'), 'no-es-un-email')
    await userEvent.type(screen.getByLabelText('Teléfono'), '1')
    await userEvent.click(screen.getByRole('radio', { name: 'Clase suelta' }))

    await submit()

    expect(screen.getByText('El nombre puede tener hasta 80 caracteres.')).toBeInTheDocument()
    expect(screen.getByText('Ingresá un email válido.')).toBeInTheDocument()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('RF04_aMonthlyStudentIsCreatedWithTrimmedValuesAndTheDateAndOpensItsProfile', async () => {
    const fetchFn = stubApi({
      [CREATE]: () => jsonResponse(201, luciaProfile),
      [PROFILE_11]: () => jsonResponse(200, luciaProfile),
    })
    renderNew()
    await fillBasics()
    await userEvent.click(screen.getByRole('radio', { name: 'Mensual' }))
    fireEvent.change(screen.getByLabelText('Fecha de ingreso mensual'), { target: { value: '2026-11-02' } })

    await submit()

    expect(await screen.findByRole('heading', { name: 'Lucía Pérez' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/students/11')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Listo: Creamos a Lucía Pérez y le enviamos la invitación a lucia@ejemplo.com. El enlace vence en 7 días.',
    )
    const [request] = requestsTo(fetchFn, CREATE)
    expect(await request?.clone().json()).toEqual({
      name: 'Lucía Pérez',
      email: 'lucia@ejemplo.com',
      phone: '11 5555-0101',
      enrollmentType: 'MONTHLY',
      monthlyStartDate: '2026-11-02',
    })
  })

  it('RF04_aMonthlyStudentSendsTheDateEvenWhenItStayedOnToday', async () => {
    const fetchFn = stubApi({
      [CREATE]: () => jsonResponse(201, luciaProfile),
      [PROFILE_11]: () => jsonResponse(200, luciaProfile),
    })
    renderNew()
    await fillBasics()
    await userEvent.click(screen.getByRole('radio', { name: 'Mensual' }))

    await submit()

    await screen.findByRole('heading', { name: 'Lucía Pérez' })
    const [request] = requestsTo(fetchFn, CREATE)
    expect(((await request?.clone().json()) as Record<string, unknown>).monthlyStartDate).toBe('2026-11-20')
  })

  it('RF04_aDropInStudentNeverSendsTheMonthlyDate', async () => {
    const fetchFn = stubApi({
      [CREATE]: () => jsonResponse(201, luciaProfile),
      [PROFILE_11]: () => jsonResponse(200, luciaProfile),
    })
    renderNew()
    await fillBasics()
    // It had a monthly date first, then the person changed the modality.
    await userEvent.click(screen.getByRole('radio', { name: 'Mensual' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Clase suelta' }))
    expect(screen.queryByLabelText('Fecha de ingreso mensual')).not.toBeInTheDocument()

    await submit()

    await screen.findByRole('heading', { name: 'Lucía Pérez' })
    const [request] = requestsTo(fetchFn, CREATE)
    const body = (await request?.clone().json()) as Record<string, unknown>
    expect(body.enrollmentType).toBe('DROP_IN')
    expect(body).not.toHaveProperty('monthlyStartDate')
  })

  it.each([
    ['2026-10-31', 'La fecha tiene que estar entre el 1 de nov de 2026 y el 20 de dic de 2026.'],
    ['2026-12-21', 'La fecha tiene que estar entre el 1 de nov de 2026 y el 20 de dic de 2026.'],
    ['', 'Ingresá la fecha de ingreso.'],
  ])('DI58_aMonthlyDateOutOfRangeIsRejectedBeforeSending_%s', async (value, message) => {
    const fetchFn = stubApi({})
    renderNew()
    await fillBasics()
    await userEvent.click(screen.getByRole('radio', { name: 'Mensual' }))
    fireEvent.change(screen.getByLabelText('Fecha de ingreso mensual'), { target: { value } })

    await submit()

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha de ingreso mensual')).toBeInvalid()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it.each(['2026-11-01', '2026-12-20'])('DI58_theLimitsOfTheRangeAreAccepted_%s', async (value) => {
    const fetchFn = stubApi({
      [CREATE]: () => jsonResponse(201, luciaProfile),
      [PROFILE_11]: () => jsonResponse(200, luciaProfile),
    })
    renderNew()
    await fillBasics()
    await userEvent.click(screen.getByRole('radio', { name: 'Mensual' }))
    fireEvent.change(screen.getByLabelText('Fecha de ingreso mensual'), { target: { value } })

    await submit()

    await screen.findByRole('heading', { name: 'Lucía Pérez' })
    expect(requestsTo(fetchFn, CREATE)).toHaveLength(1)
  })

  it('DI58_anInvalidMonthlyStartDateOfTheApiShowsOnTheDateField', async () => {
    stubApi({
      [CREATE]: () =>
        errorResponse(400, 'invalid_monthly_start_date', 'La fecha de ingreso no está permitida.'),
    })
    renderNew()
    await fillBasics()
    await userEvent.click(screen.getByRole('radio', { name: 'Mensual' }))

    await submit()

    const date = await screen.findByLabelText('Fecha de ingreso mensual')
    expect(date).toHaveAccessibleDescription(/La fecha de ingreso no está permitida\./)
    expect(date).toHaveFocus()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('CU02_3a_aRepeatedEmailShowsTheMessageOnTheEmailFieldAndFocusesIt', async () => {
    stubApi({ [CREATE]: () => errorResponse(409, 'email_already_used', 'Ya hay una cuenta con ese email.') })
    renderNew()
    await fillBasics()
    await userEvent.click(screen.getByRole('radio', { name: 'Clase suelta' }))

    await submit()

    const email = screen.getByLabelText('Email')
    expect(await screen.findByText('Ya hay una cuenta con ese email.')).toBeInTheDocument()
    expect(email).toHaveAccessibleDescription('Error: Ya hay una cuenta con ese email.')
    expect(email).toHaveFocus()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Abrir la ficha/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue(' Lucía Pérez ')
  })

  it('RF04_aValidationErrorOfTheApiShowsInAnErrorBlockAboveTheButton', async () => {
    stubApi({ [CREATE]: () => errorResponse(400, 'validation_error', 'Los datos enviados no son válidos.') })
    renderNew()
    await fillBasics()
    await userEvent.click(screen.getByRole('radio', { name: 'Clase suelta' }))

    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: Los datos enviados no son válidos.')
  })

  it('RF04_withoutConnectionTheErrorSaysNothingWasSavedAndTheFormKeepsItsData', async () => {
    const fetchFn = stubApi({ [CREATE]: () => Promise.reject(new TypeError('offline')) })
    renderNew()
    await fillBasics()
    await userEvent.click(screen.getByRole('radio', { name: 'Clase suelta' }))

    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error: No pudimos conectar. Revisá tu conexión e intentá de nuevo. No se guardó nada.',
    )
    expect(screen.getByLabelText('Teléfono')).toHaveValue('11 5555-0101')
    expect(screen.getByRole('radio', { name: 'Clase suelta' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Crear y enviar invitación' })).toBeEnabled()
    expect(requestsTo(fetchFn, CREATE)).toHaveLength(1)
  })

  it('RF04_aTimeoutTellsToCheckTheStudentsListBeforeTryingAgain', async () => {
    stubApi({ [CREATE]: () => Promise.reject(new DOMException('slow', 'TimeoutError')) })
    renderNew()
    await fillBasics()
    await userEvent.click(screen.getByRole('radio', { name: 'Clase suelta' }))

    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No sabemos si se guardó: revisá la lista de alumnos antes de intentar de nuevo.',
    )
  })

  it('RF04_aServerFailureShowsTheGenericText', async () => {
    stubApi({ [CREATE]: () => errorResponse(500, 'internal_error', 'boom') })
    renderNew()
    await fillBasics()
    await userEvent.click(screen.getByRole('radio', { name: 'Clase suelta' }))

    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error: Algo falló en la API. Probá de nuevo en un rato.',
    )
  })

  it('RF04_theButtonSaysCreandoWhileSending', async () => {
    stubApi({ [CREATE]: () => new Promise<Response>(() => {}) })
    renderNew()
    await fillBasics()
    await userEvent.click(screen.getByRole('radio', { name: 'Clase suelta' }))

    await submit()

    expect(await screen.findByRole('button', { name: 'Creando…' })).toBeDisabled()
  })

  it('RF04_cancelGoesBackToTheList', async () => {
    stubApi({
      'GET /api/v1/students': () => jsonResponse(200, []),
      'GET /api/v1/slots': () => jsonResponse(200, []),
    })
    renderNew()

    await userEvent.click(await screen.findByRole('link', { name: 'Cancelar' }))

    expect(await screen.findByRole('heading', { name: 'Alumnos' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/students$/)
  })
})

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { errorResponse, jsonResponse, renderApp, requestsTo, stubApi } from '../test/utils'

const DIRECTORY = 'GET /api/v1/students/directory'
const CREATE = 'POST /api/v1/pieces'

const STUDENTS = [
  { id: 2, name: 'Ana G.', phone: '1111', active: true },
  { id: 3, name: 'Lucía P.', phone: '2222', active: true },
]

const CREATED = {
  id: 21,
  name: 'Bowl 1',
  notes: null,
  status: 'IN_PROGRESS',
  advanceTo: 'BISQUE_FIRED',
  revertTo: null,
  createdAt: '2026-11-27T15:00:00Z',
  updatedAt: '2026-11-27T15:00:00Z',
  student: { id: 3, name: 'Lucía P.' },
  history: [],
}

function stubCreate(createHandler: () => Response = () => jsonResponse(201, CREATED)) {
  return stubApi({
    [DIRECTORY]: () => jsonResponse(200, STUDENTS),
    [CREATE]: createHandler,
    'GET /api/v1/pieces/21': () => jsonResponse(200, CREATED),
    'GET /api/v1/pieces': () => jsonResponse(200, { items: [], nextCursor: null }),
  })
}

async function chooseStudent(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: /Alumno/ }))
  await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nombre' }), name)
  await userEvent.click(screen.getByRole('option', { name }))
}

function renderNew(path = '/pieces/new') {
  return renderApp({ role: 'LEAD_TEACHER', path })
}

describe('NewPieceScreen (teacher)', () => {
  it('RF24_theTeacherChoosesAnActiveStudent', async () => {
    const fetchFn = stubCreate()
    renderNew()

    await chooseStudent('Lucía P.')
    await userEvent.type(screen.getByLabelText('Nombre'), 'Bowl 1')
    await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))

    expect(await screen.findByRole('heading', { name: 'Bowl 1' })).toBeInTheDocument()
    expect(requestsTo(fetchFn, DIRECTORY)[0]?.url).toContain('status=ACTIVE')
    expect(await requestsTo(fetchFn, CREATE)[0]?.json()).toEqual({ studentId: 3, name: 'Bowl 1' })
    expect(screen.getByRole('status')).toHaveTextContent('Listo: Creaste Bowl 1 para Lucía P.')
    expect(screen.getByTestId('location')).toHaveTextContent('/pieces/21')
  })

  it('RF24_preselectsTheStudentOfTheListFilter', async () => {
    stubCreate()
    renderNew('/pieces/new?student=3')

    const trigger = await screen.findByRole('button', { name: /Alumno/ })

    await within(trigger).findByText('Lucía P.')
  })

  it('RF24_notesAreSentWhenTheyHaveText', async () => {
    const fetchFn = stubCreate()
    renderNew('/pieces/new?student=3')

    await within(await screen.findByRole('button', { name: /Alumno/ })).findByText('Lucía P.')
    await userEvent.type(screen.getByLabelText('Nombre'), 'Bowl 1')
    await userEvent.type(screen.getByLabelText('Notas (opcional)'), 'Esmalte celeste')
    await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))

    await screen.findByRole('heading', { name: 'Bowl 1' })
    expect(await requestsTo(fetchFn, CREATE)[0]?.json()).toEqual({
      studentId: 3,
      name: 'Bowl 1',
      notes: 'Esmalte celeste',
    })
  })

  it('RF24_submittingWithoutAStudentAsksForOne', async () => {
    const fetchFn = stubCreate()
    renderNew()

    await screen.findByRole('button', { name: /Alumno/ })
    await userEvent.type(screen.getByLabelText('Nombre'), 'Bowl 1')
    await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))

    expect(await screen.findByText('Elegí un alumno.')).toBeInTheDocument()
    expect(requestsTo(fetchFn, CREATE)).toHaveLength(0)
  })

  it('CU12_V1a_anInactiveStudentErrorIsShownOnTheStudentField', async () => {
    stubCreate(() =>
      errorResponse(409, 'student_inactive', 'El alumno está inactivo: no se le pueden crear piezas.'),
    )
    renderNew('/pieces/new?student=3')

    await within(await screen.findByRole('button', { name: /Alumno/ })).findByText('Lucía P.')
    await userEvent.type(screen.getByLabelText('Nombre'), 'Bowl 1')
    await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))

    const trigger = await screen.findByRole('button', { name: /Alumno/ })
    expect(await screen.findByText('El alumno está inactivo: no se le pueden crear piezas.')).toBeInTheDocument()
    expect(trigger).toHaveAccessibleDescription(/El alumno está inactivo/)
    expect(screen.getByTestId('location')).toHaveTextContent('/pieces/new')
  })

  it('DI26_duplicateNameOnTheNameField', async () => {
    stubCreate(() =>
      errorResponse(409, 'duplicate_piece_name', 'Lucía P. ya tiene una pieza con ese nombre.'),
    )
    renderNew('/pieces/new?student=3')

    await within(await screen.findByRole('button', { name: /Alumno/ })).findByText('Lucía P.')
    await userEvent.type(screen.getByLabelText('Nombre'), 'Bowl 1')
    await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))

    expect(await screen.findByText('Lucía P. ya tiene una pieza con ese nombre.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
  })

  it('RF24_noActiveStudentsDisablesCreateWithAReason', async () => {
    stubApi({ [DIRECTORY]: () => jsonResponse(200, []) })
    renderNew()

    expect(
      await screen.findByText(
        'No hay alumnos activos. Para crear una pieza tiene que haber al menos un alumno activo.',
      ),
    ).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Crear pieza' })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('No hay alumnos activos.')
  })

  it('RF24_showsTheTimeoutText', async () => {
    stubCreate(() => {
      throw new DOMException('timeout', 'TimeoutError')
    })
    renderNew('/pieces/new?student=3')

    await within(await screen.findByRole('button', { name: /Alumno/ })).findByText('Lucía P.')
    await userEvent.type(screen.getByLabelText('Nombre'), 'Bowl 1')
    await userEvent.click(screen.getByRole('button', { name: 'Crear pieza' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error:')
    expect(screen.getByTestId('location')).toHaveTextContent('/pieces/new')
  })

  it('RF24_cancelGoesBackToTheListKeepingTheStudentFilter', async () => {
    stubCreate()
    renderNew('/pieces/new?student=3')

    await screen.findByRole('heading', { name: 'Nueva pieza' })

    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/pieces?student=3')
  })
})

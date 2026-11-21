import { screen } from '@testing-library/react'
import { jsonResponse, renderApp, stubApi } from '../test/utils'
import { luciaProfile } from '../test/students'

describe('student routes', () => {
  it('RF02_theAlumnosTabOpensTheListNotThePlaceholder', async () => {
    stubApi({
      'GET /api/v1/students': () => jsonResponse(200, []),
      'GET /api/v1/slots': () => jsonResponse(200, []),
    })
    renderApp({ role: 'LEAD_TEACHER', path: '/students' })

    expect(await screen.findByRole('heading', { name: 'Alumnos' })).toBeInTheDocument()
    expect(screen.queryByText(/Próximamente/)).not.toBeInTheDocument()
  })

  it.each(['/students/new', '/students/11', '/students/11/edit', '/students/11/fixed-slot'])(
    'RF02_theLeadTeacherOpens_%s',
    async (path) => {
      stubApi({
        'GET /api/v1/students/11': () => jsonResponse(200, luciaProfile),
        'GET /api/v1/slots': () => jsonResponse(200, []),
      })
      renderApp({ role: 'LEAD_TEACHER', path })

      await screen.findByRole('heading', { level: 1 })
      expect(screen.getByTestId('location')).toHaveTextContent(path)
    },
  )

  it.each([
    ['ASSISTANT_TEACHER', '/students/11', '/today', 'Hoy'],
    ['ASSISTANT_TEACHER', '/students/new', '/today', 'Hoy'],
    ['STUDENT', '/students/11/fixed-slot', '/home', 'Inicio'],
  ] as const)('RF02_%sCannotOpen_%s', async (role, path, home, title) => {
    const fetchFn = stubApi({})
    renderApp({ role, path })

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(home)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('DI56_theDropInRouteIsNotRegisteredYetSoItGoesHome', async () => {
    stubApi({ 'GET /api/v1/students/13': () => jsonResponse(200, luciaProfile) })
    renderApp({ role: 'LEAD_TEACHER', path: '/students/13/drop-in/new' })

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
  })
})

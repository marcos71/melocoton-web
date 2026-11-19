import { screen, waitFor } from '@testing-library/react'
import { renderApp } from '../test/utils'

describe('AdminScreen and role protection', () => {
  it('RF02_theLeadTeacherSeesTheSettingsWithTheAssistantTeachersEntry', async () => {
    renderApp({ role: 'LEAD_TEACHER', path: '/admin' })

    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Docentes secundarios/ })
    expect(link).toHaveAttribute('href', '/admin/assistant-teachers')
    expect(link).toHaveTextContent('Crear, consultar y desactivar cuentas.')
    expect(screen.queryByText(/Parámetros/)).not.toBeInTheDocument()
  })

  it.each(['ASSISTANT_TEACHER', 'STUDENT'] as const)(
    'RF02_%sCannotOpenTheAdminRoutes',
    async (role) => {
      const home = role === 'STUDENT' ? '/home' : '/today'
      for (const path of ['/admin', '/admin/assistant-teachers', '/admin/assistant-teachers/new']) {
        const { unmount } = renderApp({ role, path })

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(home))
        expect(screen.queryByRole('heading', { name: 'Ajustes' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: /Docentes secundarios/ })).not.toBeInTheDocument()
        await screen.findByRole('navigation', { name: 'Navegación principal' })
        unmount()
      }
    },
  )

  it('RF02_aStudentOnATeacherPathLandsOnTheStudentHome', async () => {
    renderApp({ role: 'STUDENT', path: '/today' })

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/home')
  })

  it('RF02_anUnknownPathGoesToTheRoleHome', async () => {
    renderApp({ role: 'LEAD_TEACHER', path: '/does-not-exist' })

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
  })
})

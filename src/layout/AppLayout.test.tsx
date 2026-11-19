import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/utils'

function tabLabels(): string[] {
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent ?? '')
}

describe('AppLayout', () => {
  it('RF02_showsTheStudentTabsAndOpensHome', async () => {
    renderApp({ role: 'STUDENT' })

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(tabLabels()).toEqual(['Inicio', 'Mis piezas', 'Calendario', 'Pagos'])
    expect(
      within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', {
        name: 'Inicio',
      }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('RF02_showsTheLeadTeacherTabsAndOpensToday', async () => {
    renderApp({ role: 'LEAD_TEACHER' })

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
    expect(tabLabels()).toEqual(['Hoy', 'Piezas', 'Turnos', 'Alumnos', 'Pagos'])
  })

  it('RF02_showsTheAssistantTeacherTabsAndOpensToday', async () => {
    renderApp({ role: 'ASSISTANT_TEACHER' })

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
    expect(tabLabels()).toEqual(['Hoy', 'Piezas'])
  })

  it('tabsOpenAComingSoonPlaceholder', async () => {
    renderApp({ role: 'STUDENT' })
    await screen.findByRole('heading', { name: 'Inicio' })

    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', {
        name: 'Calendario',
      }),
    )

    expect(screen.getByRole('heading', { name: 'Calendario' })).toBeInTheDocument()
    expect(screen.getByText(/Próximamente/)).toBeInTheDocument()
  })

  it('RF02_aPathOfAnotherRoleGoesToTheRoleHome', async () => {
    renderApp({ role: 'ASSISTANT_TEACHER', path: '/payments' })

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/today')
  })

  it('theAppBarHasNoRoleSwitchAnymore', async () => {
    renderApp({ role: 'STUDENT' })
    await screen.findByRole('heading', { name: 'Inicio' })

    expect(screen.queryByLabelText(/Rol/)).not.toBeInTheDocument()
  })
})

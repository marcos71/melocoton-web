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
  it('showsTheStudentTabsAndOpensHome', () => {
    renderApp({ role: 'STUDENT' })

    expect(tabLabels()).toEqual(['Inicio', 'Mis piezas', 'Calendario', 'Pagos'])
    expect(screen.getByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
  })

  it('showsTheLeadTeacherTabsAndOpensToday', () => {
    renderApp({ role: 'LEAD_TEACHER' })

    expect(tabLabels()).toEqual(['Hoy', 'Piezas', 'Turnos', 'Alumnos', 'Pagos'])
    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
  })

  it('showsTheAssistantTeacherTabsAndOpensToday', () => {
    renderApp({ role: 'ASSISTANT_TEACHER' })

    expect(tabLabels()).toEqual(['Hoy', 'Piezas'])
    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
  })

  it('tabsOpenAComingSoonPlaceholder', async () => {
    renderApp({ role: 'STUDENT' })

    await userEvent.click(screen.getByRole('link', { name: 'Calendario' }))

    expect(screen.getByRole('heading', { name: 'Calendario' })).toBeInTheDocument()
    expect(screen.getByText(/Próximamente/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('aPathOfAnotherRoleGoesToTheRoleHome', () => {
    renderApp({ role: 'ASSISTANT_TEACHER', path: '/payments' })

    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
  })

  it('switchingTheRoleChangesTheTabs', async () => {
    renderApp({ role: 'STUDENT' })

    await userEvent.selectOptions(screen.getByLabelText(/Rol/), 'LEAD_TEACHER')

    expect(tabLabels()).toEqual(['Hoy', 'Piezas', 'Turnos', 'Alumnos', 'Pagos'])
    expect(screen.getByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
  })

  it('theRoleSwitchCanBeHidden', () => {
    renderApp({ showRoleSwitch: false })

    expect(screen.queryByLabelText(/Rol/)).not.toBeInTheDocument()
  })

  it('linksToTheConnectionCheck', () => {
    renderApp()

    expect(screen.getByRole('link', { name: 'Conexión' })).toHaveAttribute('href', '/health')
  })
})

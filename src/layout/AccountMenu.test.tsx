import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp, TEST_USER_NAME } from '../test/utils'

async function openMenu() {
  await userEvent.click(await screen.findByRole('button', { name: TEST_USER_NAME }))
}

describe('AccountMenu', () => {
  it('RF02_showsTheNameAndTheRoleLabelAsText', async () => {
    renderApp({ role: 'ASSISTANT_TEACHER' })

    await openMenu()

    expect(screen.getByRole('button', { name: TEST_USER_NAME })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByText('Docente secundario')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Estado de la conexión' })).toHaveAttribute(
      'href',
      '/health',
    )
  })

  it('RF02_showsSettingsToTheLeadTeacher', async () => {
    renderApp({ role: 'LEAD_TEACHER' })
    await openMenu()
    expect(screen.getByRole('link', { name: 'Ajustes' })).toHaveAttribute('href', '/admin')
  })

  it.each(['STUDENT', 'ASSISTANT_TEACHER'] as const)(
    'RF02_doesNotShowSettingsTo%s',
    async (role) => {
      renderApp({ role })
      await openMenu()
      expect(screen.queryByRole('link', { name: 'Ajustes' })).not.toBeInTheDocument()
    },
  )

  it('closesWithEscapeAndReturnsTheFocusToTheButton', async () => {
    renderApp({ role: 'STUDENT' })
    await openMenu()

    await userEvent.keyboard('{Escape}')

    const button = screen.getByRole('button', { name: TEST_USER_NAME })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })

  it('closesWhenClickingOutside', async () => {
    renderApp({ role: 'STUDENT' })
    await openMenu()

    await userEvent.click(screen.getByRole('main'))

    expect(screen.getByRole('button', { name: TEST_USER_NAME })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('closesAfterChoosingAnItem', async () => {
    renderApp({ role: 'LEAD_TEACHER' })
    await openMenu()

    await userEvent.click(screen.getByRole('link', { name: 'Ajustes' }))

    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: TEST_USER_NAME })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})

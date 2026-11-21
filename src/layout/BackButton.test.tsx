import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { AppBarStart } from './AppBarStart'
import { useBackTarget } from './backTarget'
import { BackTargetProvider } from './BackTargetProvider'

function Detail() {
  useBackTarget({ to: '/list', label: 'Alumnos', state: { from: '/students?q=lu' } })
  return <h1>Detalle</h1>
}

function List() {
  const location = useLocation()
  return <h1>Lista {JSON.stringify(location.state)}</h1>
}

function renderBar() {
  return render(
    <MemoryRouter initialEntries={['/detail']}>
      <BackTargetProvider>
        <header>
          <AppBarStart />
        </header>
        <Routes>
          <Route path="/detail" element={<Detail />} />
          <Route path="/list" element={<List />} />
        </Routes>
      </BackTargetProvider>
    </MemoryRouter>,
  )
}

describe('AppBarStart', () => {
  it('showsTheBrandWhenTheScreenDeclaresNoBackTarget', () => {
    render(
      <MemoryRouter>
        <BackTargetProvider>
          <AppBarStart />
        </BackTargetProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Melocotón')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('showsTheBackButtonWithTheLabelAndAnAccessibleNameInPlaceOfTheBrand', async () => {
    renderBar()

    const back = await screen.findByRole('link', { name: 'Volver a Alumnos' })
    expect(back).toHaveTextContent('Alumnos')
    expect(back).toHaveAttribute('href', '/list')
    expect(back.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByText('Melocotón')).not.toBeInTheDocument()
  })

  it('navigatesWithTheDeclaredRouterStateAndThenShowsTheBrandAgain', async () => {
    renderBar()

    await userEvent.click(await screen.findByRole('link', { name: 'Volver a Alumnos' }))

    expect(
      await screen.findByRole('heading', { name: 'Lista {"from":"/students?q=lu"}' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Melocotón')).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { PieceUnavailable } from './PieceUnavailable'

describe('PieceUnavailable', () => {
  it('RN20_saysThePieceIsNotAvailableAndOffersOnlyTheWayBack', () => {
    render(
      <MemoryRouter>
        <PieceUnavailable
          backTo="/pieces"
          backLabel="Volver a Mis piezas"
          text="Un docente la quitó de tu lista. Volvé a Mis piezas para ver las demás."
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Info: Esta pieza ya no está disponible')
    expect(
      screen.getByText('Un docente la quitó de tu lista. Volvé a Mis piezas para ver las demás.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a Mis piezas' })).toHaveAttribute('href', '/pieces')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })
})

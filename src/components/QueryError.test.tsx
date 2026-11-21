import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryError } from './QueryError'

describe('QueryError', () => {
  it('RNF02_showsTheWordErrorTheTitleAndTheReason', () => {
    render(
      <QueryError title="No se pudo cargar." reason="Sin conexión." onRetry={() => {}} retrying={false} />,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Error')
    expect(alert).toHaveTextContent('No se pudo cargar.')
    expect(alert).toHaveTextContent('Sin conexión.')
  })

  it('RNF02_retryButtonCallsOnRetry', async () => {
    const onRetry = vi.fn()
    render(<QueryError title="t" reason="r" onRetry={onRetry} retrying={false} />)

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('RNF02_whileRetryingTheButtonIsDisabledAndSaysSo', () => {
    render(<QueryError title="t" reason="r" onRetry={() => {}} retrying />)

    expect(screen.getByRole('button', { name: 'Reintentando…' })).toBeDisabled()
  })
})

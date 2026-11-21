import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

function renderDialog(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      title="¿Seguro?"
      description="Descripción"
      confirmLabel="Aceptar"
      pendingLabel="Aceptando…"
      pending={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('DI52_putsTheSafeOptionFirstSoItIsOnTheLeftInARow', () => {
    renderDialog()

    const buttons = screen.getAllByRole('button')

    expect(buttons.map((button) => button.textContent)).toEqual(['Cancelar', 'Aceptar'])
  })

  it('DI52_usesACustomCancelLabel', () => {
    renderDialog({ cancelLabel: 'Volver' })

    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
  })

  it('RNF21_startsWithTheFocusOnTheCancelButton', () => {
    renderDialog()

    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('RNF21_escapeCancels', async () => {
    const { onCancel } = renderDialog()

    await userEvent.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('RNF21_escapeDoesNothingWhilePending', async () => {
    const { onCancel } = renderDialog({ pending: true })

    await userEvent.keyboard('{Escape}')

    expect(onCancel).not.toHaveBeenCalled()
  })

  it('RNF21_tabCyclesFromCancelToTheActionAndBack', async () => {
    renderDialog()
    const cancel = screen.getByRole('button', { name: 'Cancelar' })
    const confirm = screen.getByRole('button', { name: 'Aceptar' })

    await userEvent.tab()
    expect(confirm).toHaveFocus()
    await userEvent.tab()
    expect(cancel).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(confirm).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(cancel).toHaveFocus()
  })

  it('RNF21_showsThePendingLabelAndDisablesBothButtonsWhilePending', () => {
    renderDialog({ pending: true })

    expect(screen.getByRole('button', { name: 'Aceptando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })
})

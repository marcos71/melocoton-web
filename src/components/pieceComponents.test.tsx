import { render, screen } from '@testing-library/react'
import { PieceHistory, type PieceHistoryEntry } from './PieceHistory'
import { PieceProgress } from './PieceProgress'
import { PieceStatusTag } from './PieceStatusTag'
import type { PieceStatus } from '../api/pieceTypes'

const STATUSES: [PieceStatus, string, number][] = [
  ['IN_PROGRESS', 'En proceso', 1],
  ['BISQUE_FIRED', 'Bizcochada', 2],
  ['GLAZED', 'Esmaltada', 3],
  ['FINISHED', 'Terminada', 4],
]

describe('piece status components', () => {
  it.each(STATUSES)('RNF02_everyPieceStatusShowsItsNameAndStep (%s)', (status, label, step) => {
    render(
      <>
        <PieceStatusTag status={status} />
        <PieceProgress status={status} />
      </>,
    )

    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByText(`Paso ${step} de 4`)).toBeInTheDocument()
  })

  it('RNF02_theProgressSegmentsAreDecorative', () => {
    const { container } = render(<PieceProgress status="GLAZED" />)

    expect(container.querySelector('[aria-hidden="true"]')?.children).toHaveLength(4)
  })
})

const REVERT: PieceHistoryEntry = {
  eventType: 'REVERTED',
  previousStatus: 'GLAZED',
  newStatus: 'BISQUE_FIRED',
  occurredAt: '2026-10-29T15:00:00Z',
  correction: true,
  changedBy: { id: 2, name: 'Marta' },
}
const CREATED: PieceHistoryEntry = {
  eventType: 'CREATED',
  newStatus: 'IN_PROGRESS',
  occurredAt: '2026-10-01T15:00:00Z',
  correction: false,
  changedBy: { id: 2, name: 'Marta' },
}

describe('PieceHistory', () => {
  it('RF28_aRevertShowsAsACorrection', () => {
    render(<PieceHistory entries={[REVERT, CREATED]} showAuthor={false} />)

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('29 de oct de 2026 · Esmaltada a Bizcochada')
    expect(items[0]).toHaveTextContent('Corrección')
    expect(items[1]).toHaveTextContent('1 de oct de 2026 · Pieza creada en En proceso')
    expect(items[1]).not.toHaveTextContent('Corrección')
  })

  it('CP21_aRevertShowsAsACorrectionInTheHistory', () => {
    render(<PieceHistory entries={[REVERT]} showAuthor={false} />)

    expect(screen.getByText('Corrección')).toBeInTheDocument()
  })

  it('RF28_theStudentHistoryDoesNotNameWhoChangedIt', () => {
    render(<PieceHistory entries={[REVERT]} showAuthor={false} />)

    expect(screen.queryByText(/Marta/)).not.toBeInTheDocument()
  })

  it('RF28_theTeacherHistoryNamesWhoChangedIt', () => {
    render(<PieceHistory entries={[REVERT]} showAuthor />)

    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(
      '29 de oct de 2026 · Esmaltada a Bizcochada · Marta',
    )
  })
})

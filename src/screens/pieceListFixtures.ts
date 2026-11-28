import type { PieceItem } from '../api/pieces'

/** Fixtures of the teacher's piece list tests, shaped like the API's responses. */
export function piece(id: number, overrides: Partial<PieceItem> = {}): PieceItem {
  return {
    id,
    name: `Pieza ${id}`,
    status: 'BISQUE_FIRED',
    advanceTo: 'GLAZED',
    revertTo: 'IN_PROGRESS',
    updatedAt: '2026-10-29T15:00:00Z',
    student: { id: 7, name: 'Lucía P.' },
    ...overrides,
  }
}

export function page(items: PieceItem[], nextCursor: string | null = null) {
  return { items, nextCursor }
}

export function param(request: Request | undefined, name: string): string | null {
  return request ? new URL(request.url).searchParams.get(name) : null
}

export const lucia = { id: 7, name: 'Lucía P.', phone: '1111', active: true }
export const mateo = { id: 8, name: 'Mateo R.', phone: '2222', active: false }

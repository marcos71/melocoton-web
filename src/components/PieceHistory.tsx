import type { HistoryEntryLike } from '../lib/pieceStatus'
import { historyEntryText } from '../lib/pieceStatus'
import { StatusBadge } from './StatusBadge'
import styles from './PieceHistory.module.css'

export type PieceHistoryEntry = HistoryEntryLike & {
  correction: boolean
  /** Only the teachers' history says who made the change. */
  changedBy?: { id: number; name: string }
}

type PieceHistoryProps = {
  /** Newest first, as the API sends them. */
  entries: readonly PieceHistoryEntry[]
  /** The teachers see who changed it; the student does not. */
  showAuthor: boolean
}

/** "29 de oct de 2026 · Bizcochada a Esmaltada", with "Corrección" on a revert (RN-05). */
export function PieceHistory({ entries, showAuthor }: PieceHistoryProps) {
  return (
    <ul className={styles.history}>
      {entries.map((entry, index) => (
        <li key={`${entry.occurredAt}-${index}`} className={styles.entry}>
          <span>
            {historyEntryText(entry)}
            {showAuthor && entry.changedBy ? ` · ${entry.changedBy.name}` : ''}
          </span>
          {entry.correction && <StatusBadge>Corrección</StatusBadge>}
        </li>
      ))}
    </ul>
  )
}

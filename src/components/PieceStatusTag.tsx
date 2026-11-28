import type { PieceStatus } from '../api/pieceTypes'
import { pieceStatusLabel } from '../lib/pieceStatus'
import styles from './PieceStatusTag.module.css'

const SHAPE: Record<PieceStatus, string> = {
  IN_PROGRESS: styles.inProgress ?? '',
  BISQUE_FIRED: styles.bisqueFired ?? '',
  GLAZED: styles.glazed ?? '',
  FINISHED: styles.finished ?? '',
}

/** The status of a piece as text with its own shape (RNF-02): never only color. */
export function PieceStatusTag({ status }: { status: PieceStatus }) {
  return <span className={`${styles.tag} ${SHAPE[status]}`}>{pieceStatusLabel(status)}</span>
}

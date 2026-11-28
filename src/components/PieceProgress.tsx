import type { PieceStatus } from '../api/pieceTypes'
import { PIECE_STATUSES, PIECE_STEP_COUNT, pieceStep } from '../lib/pieceStatus'
import styles from './PieceProgress.module.css'

/** Four segments (decoration) and the text "Paso n de 4", which is what carries the meaning. */
export function PieceProgress({ status }: { status: PieceStatus }) {
  const step = pieceStep(status)
  return (
    <div className={styles.progress}>
      <span className={styles.segments} aria-hidden="true">
        {PIECE_STATUSES.map((segment, index) => (
          <span
            key={segment}
            className={index < step ? `${styles.segment} ${styles.done}` : styles.segment}
          />
        ))}
      </span>
      <span className={styles.text}>
        Paso {step} de {PIECE_STEP_COUNT}
      </span>
    </div>
  )
}

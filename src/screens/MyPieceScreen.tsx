import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useMyPieceQuery, type MyPieceDetail } from '../api/myPieces'
import { DisabledReason } from '../components/DisabledReason'
import { Notice } from '../components/Notice'
import { PieceHistory } from '../components/PieceHistory'
import { PieceProgress } from '../components/PieceProgress'
import { PieceStatusTag } from '../components/PieceStatusTag'
import { useBackTarget } from '../layout/backTarget'
import { noticeFromState, type NoticeData } from '../lib/navState'
import { PIECE_STATUS_HINT } from '../lib/pieceStatus'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { useRouteId } from '../lib/useRouteId'
import { MyPieceGate } from './MyPieceGate'
import styles from './MyPieces.module.css'
import screenStyles from './Screen.module.css'

/** Screen 2b, RF-27, RF-28: a piece of the student with its state, notes and history. */
export function MyPieceScreen() {
  const id = useRouteId()
  const piece = useMyPieceQuery(id)
  return <MyPieceGate id={id} query={piece}>{(loaded) => <MyPiece piece={loaded} />}</MyPieceGate>
}

function MyPiece({ piece }: { piece: MyPieceDetail }) {
  const location = useLocation()
  const headingRef = useHeadingFocus()
  const [notice, setNotice] = useState<NoticeData | null>(() => noticeFromState(location.state))
  useBackTarget({ to: '/pieces', label: 'Mis piezas' })

  return (
    <section className={styles.page}>
      <h1 ref={headingRef} tabIndex={-1} className={screenStyles.title}>
        {piece.name}
      </h1>

      {notice && <Notice {...notice} onClose={() => setNotice(null)} />}

      <div className={styles.panel}>
        <div className={styles.statusRow}>
          <PieceStatusTag status={piece.status} />
          <span className={styles.statusLabel}>Estado actual</span>
        </div>
        <PieceProgress status={piece.status} />
        <p>{PIECE_STATUS_HINT[piece.status]}</p>
      </div>

      <section className={styles.panel} aria-labelledby="piece-data">
        <h2 id="piece-data">Datos</h2>
        <dl className={styles.facts}>
          <div>
            <dt>Nombre</dt>
            <dd>{piece.name}</dd>
          </div>
          <div>
            <dt>Notas</dt>
            <dd>{piece.notes ? piece.notes : 'Sin notas'}</dd>
          </div>
        </dl>
        {piece.editable ? (
          <div className={screenStyles.actions}>
            <Link className={screenStyles.secondaryButton} to={`/pieces/${piece.id}/edit`}>
              Editar nombre y notas
            </Link>
          </div>
        ) : (
          <DisabledReason
            label="Editar nombre y notas"
            reason="Solo se puede editar mientras está En proceso."
          />
        )}
      </section>

      <section className={styles.panel} aria-labelledby="piece-history">
        <h2 id="piece-history">Historial</h2>
        <PieceHistory entries={piece.history} showAuthor={false} />
      </section>
    </section>
  )
}

import { Link } from 'react-router'
import { Notice } from '../components/Notice'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import styles from './Screen.module.css'

type PieceUnavailableProps = {
  /** Where "Volver a ..." goes. */
  backTo: string
  backLabel: string
  /** What happened, after the title; it says nothing about whose piece it was (DI-75). */
  text: string
}

/** Screen 2e: the piece is voided, someone else's or missing; no retry, only the way back. */
export function PieceUnavailable({ backTo, backLabel, text }: PieceUnavailableProps) {
  const focusRef = useHeadingFocus()
  return (
    <section ref={focusRef} tabIndex={-1} className={styles.screen}>
      <Notice kind="info" text="Esta pieza ya no está disponible" footer={text} />
      <Link className={styles.button} to={backTo}>
        {backLabel}
      </Link>
    </section>
  )
}

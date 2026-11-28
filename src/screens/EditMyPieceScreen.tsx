import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { actionErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import { useEditMyPiece, useMyPieceQuery, type MyPieceDetail } from '../api/myPieces'
import { Notice } from '../components/Notice'
import { useBackTarget } from '../layout/backTarget'
import type { StudentNavState } from '../lib/navState'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { useRouteId } from '../lib/useRouteId'
import { MyPieceGate, MyPieceUnavailable } from './MyPieceGate'
import { PieceForm, type PieceFormHelpers, type PieceFormValues } from './PieceForm'
import styles from './Screen.module.css'

const TIMEOUT_TEXT =
  'La API tardó demasiado. No sabemos si se guardó: revisá tus piezas antes de intentar de nuevo.'

/** Screen 2, RF-27: the student edits name and notes while the piece is In progress (RN-04). */
export function EditMyPieceScreen() {
  const id = useRouteId()
  const piece = useMyPieceQuery(id)
  return <MyPieceGate id={id} query={piece}>{(loaded) => <EditMyPiece piece={loaded} />}</MyPieceGate>
}

function EditMyPiece({ piece }: { piece: MyPieceDetail }) {
  const navigate = useNavigate()
  const edit = useEditMyPiece(piece.id)
  const headingRef = useHeadingFocus()
  const [apiError, setApiError] = useState<string | null>(null)
  useBackTarget({ to: `/pieces/${piece.id}`, label: piece.name })

  const failure = edit.error instanceof ApiError ? edit.error : null
  if (failure?.status === 404) return <MyPieceUnavailable />
  // The API is the one that knows (RN-04): either the read said so or the save was refused.
  if (!piece.editable || failure?.code === 'piece_not_editable') {
    return (
      <section className={styles.screen}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          Editar pieza
        </h1>
        <Notice
          kind="info"
          text="Esta pieza ya no se puede editar"
          footer="Solo se edita mientras está En proceso."
        />
        <Link className={styles.button} to={`/pieces/${piece.id}`}>
          Volver a la pieza
        </Link>
      </section>
    )
  }

  async function onSubmit(values: PieceFormValues, { setFieldError }: PieceFormHelpers) {
    setApiError(null)
    try {
      // An empty string clears the notes.
      await edit.mutateAsync({ name: values.name, notes: values.notes })
      const state: StudentNavState = { notice: { kind: 'success', text: 'Guardamos los cambios.' } }
      void navigate(`/pieces/${piece.id}`, { replace: true, state })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'duplicate_piece_name') {
        setFieldError('name', error.message)
      } else if (
        error instanceof ApiError &&
        (error.status === 404 || error.code === 'piece_not_editable')
      ) {
        // The screen swaps itself from the mutation's error.
      } else {
        setApiError(actionErrorText(error, { onTimeout: TIMEOUT_TEXT }))
      }
    }
  }

  return (
    <section className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Editar pieza
      </h1>
      <PieceForm
        mode="edit"
        defaultValues={{ name: piece.name, notes: piece.notes ?? '' }}
        apiError={apiError}
        onSubmit={onSubmit}
        cancelTo={`/pieces/${piece.id}`}
        submitLabel="Guardar cambios"
        pendingLabel="Guardando…"
      />
    </section>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router'
import { actionErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import { useCreateMyPiece } from '../api/myPieces'
import { useBackTarget } from '../layout/backTarget'
import type { StudentNavState } from '../lib/navState'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { PieceForm, type PieceFormHelpers, type PieceFormValues } from './PieceForm'
import styles from './Screen.module.css'

const TIMEOUT_TEXT =
  'La API tardó demasiado. No sabemos si se guardó: revisá tus piezas antes de intentar de nuevo.'

/** Screen 2, CU-12, RF-24: the student creates a piece; it starts In progress (RN-04). */
export function NewMyPieceScreen() {
  useBackTarget({ to: '/pieces', label: 'Mis piezas' })
  const navigate = useNavigate()
  const create = useCreateMyPiece()
  const headingRef = useHeadingFocus()
  const [apiError, setApiError] = useState<string | null>(null)

  async function onSubmit(values: PieceFormValues, { setFieldError }: PieceFormHelpers) {
    setApiError(null)
    try {
      const piece = await create.mutateAsync({
        name: values.name,
        ...(values.notes === '' ? {} : { notes: values.notes }),
      })
      const state: StudentNavState = {
        notice: { kind: 'success', text: `Creaste ${piece.name}.` },
      }
      void navigate(`/pieces/${piece.id}`, { replace: true, state })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'duplicate_piece_name') {
        setFieldError('name', error.message)
      } else {
        setApiError(actionErrorText(error, { onTimeout: TIMEOUT_TEXT }))
      }
    }
  }

  return (
    <section className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Nueva pieza
      </h1>
      <PieceForm
        mode="create"
        defaultValues={{ name: '', notes: '' }}
        apiError={apiError}
        onSubmit={onSubmit}
        cancelTo="/pieces"
        submitLabel="Crear pieza"
        pendingLabel="Creando…"
      />
    </section>
  )
}

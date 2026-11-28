import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { actionErrorText, readErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import { useEditPiece, usePieceQuery, type PieceDetail } from '../api/pieces'
import { QueryError } from '../components/QueryError'
import { useBackTarget } from '../layout/backTarget'
import { listFromState } from '../lib/navState'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { useRouteId } from '../lib/useRouteId'
import { PieceForm, type PieceFormHelpers, type PieceFormValues } from './PieceForm'
import { PieceUnavailable } from './PieceUnavailable'
import styles from './Screen.module.css'

const TIMEOUT_TEXT =
  'La API tardó demasiado. No sabemos si se guardó: revisá la pieza antes de intentar de nuevo.'

/** CU-13, RF-27: a teacher corrects the name and notes of a piece. */
export function EditPieceScreen() {
  const id = useRouteId()
  const location = useLocation()
  const headingRef = useHeadingFocus()
  const piece = usePieceQuery(id)
  const [gone, setGone] = useState(false)
  const listUrl = listFromState(location.state, '/pieces')
  const backToList = listUrl ?? '/pieces'
  useBackTarget({
    to: Number.isInteger(id) ? `/pieces/${id}` : backToList,
    label: piece.data?.name ?? 'Pieza',
    state: listUrl ? { from: listUrl } : undefined,
  })

  const notFound = piece.error instanceof ApiError && piece.error.status === 404
  if (!Number.isInteger(id) || gone || notFound) {
    return (
      <PieceUnavailable
        backTo={backToList}
        backLabel="Volver a Piezas"
        text="Puede haber sido anulada. Volvé a Piezas para ver las demás."
      />
    )
  }

  return (
    <section className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Editar pieza
      </h1>
      {/* The list stands in for the piece while it loads, but it has no notes: wait for the real one. */}
      {piece.data && !piece.isPlaceholderData ? (
        <EditForm piece={piece.data} listUrl={listUrl} onGone={() => setGone(true)} />
      ) : piece.isError ? (
        <>
          <QueryError
            title="No pudimos cargar la pieza"
            reason={readErrorText(piece.error)}
            onRetry={() => void piece.refetch()}
            retrying={piece.isFetching}
          />
          <Link className={styles.secondaryButton} to={backToList}>
            Volver a Piezas
          </Link>
        </>
      ) : (
        <p role="status">Cargando la pieza…</p>
      )}
    </section>
  )
}

type EditFormProps = { piece: PieceDetail; listUrl: string | null; onGone: () => void }

function EditForm({ piece, listUrl, onGone }: EditFormProps) {
  const navigate = useNavigate()
  const edit = useEditPiece(piece.id)
  const [apiError, setApiError] = useState<string | null>(null)

  async function onSubmit(values: PieceFormValues, { setFieldError }: PieceFormHelpers) {
    setApiError(null)
    try {
      // An empty string clears the notes.
      await edit.mutateAsync({ name: values.name, notes: values.notes })
      void navigate(`/pieces/${piece.id}`, {
        replace: true,
        state: {
          ...(listUrl ? { from: listUrl } : {}),
          notice: { kind: 'success', text: 'Guardamos los cambios.' },
        },
      })
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.code === 'status_conflict')) {
        onGone()
      } else if (error instanceof ApiError && error.code === 'duplicate_piece_name') {
        setFieldError('name', error.message)
      } else {
        setApiError(actionErrorText(error, { onTimeout: TIMEOUT_TEXT }))
      }
    }
  }

  return (
    <PieceForm
      mode="edit"
      defaultValues={{ name: piece.name, notes: piece.notes ?? '' }}
      apiError={apiError}
      onSubmit={onSubmit}
      cancelTo={`/pieces/${piece.id}`}
      submitLabel="Guardar cambios"
      pendingLabel="Guardando…"
    />
  )
}

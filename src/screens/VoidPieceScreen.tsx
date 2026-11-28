import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { actionErrorText, readErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import { usePieceQuery, useVoidPiece, type PieceDetail } from '../api/pieces'
import { Notice } from '../components/Notice'
import { QueryError } from '../components/QueryError'
import { TextAreaField } from '../components/TextAreaField'
import { useBackTarget } from '../layout/backTarget'
import { listFromState } from '../lib/navState'
import { pieceStatusLabel } from '../lib/pieceStatus'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { useRouteId } from '../lib/useRouteId'
import { PieceUnavailable } from './PieceUnavailable'
import styles from './PieceScreen.module.css'
import screenStyles from './Screen.module.css'

const REASON_MAX = 500
const TIMEOUT_TEXT =
  'La API tardó demasiado. No sabemos si se anuló: revisá la pieza antes de intentar de nuevo.'

const voidSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Escribí el motivo.')
    .max(REASON_MAX, `Hasta ${REASON_MAX} caracteres.`),
})

type VoidValues = z.infer<typeof voidSchema>

/** CU-15, RF-56, DI-82: a teacher voids a piece, always with a reason. */
export function VoidPieceScreen() {
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
    <section className={screenStyles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={screenStyles.title}>
        Anular pieza
      </h1>
      {piece.data ? (
        <VoidForm piece={piece.data} listUrl={listUrl} onGone={() => setGone(true)} />
      ) : piece.isError ? (
        <>
          <QueryError
            title="No pudimos cargar la pieza"
            reason={readErrorText(piece.error)}
            onRetry={() => void piece.refetch()}
            retrying={piece.isFetching}
          />
          <Link className={screenStyles.secondaryButton} to={backToList}>
            Volver a Piezas
          </Link>
        </>
      ) : (
        <p role="status">Cargando la pieza…</p>
      )}
    </section>
  )
}

type VoidFormProps = { piece: PieceDetail; listUrl: string | null; onGone: () => void }

function VoidForm({ piece, listUrl, onGone }: VoidFormProps) {
  const navigate = useNavigate()
  const voidPiece = useVoidPiece(piece.id)
  const [apiError, setApiError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VoidValues>({ resolver: zodResolver(voidSchema), defaultValues: { reason: '' } })
  const busy = isSubmitting || voidPiece.isPending

  async function onSubmit({ reason }: VoidValues) {
    setApiError(null)
    try {
      await voidPiece.mutateAsync(reason)
      void navigate(listUrl ?? '/pieces', {
        replace: true,
        state: {
          notice: { kind: 'success', text: `Anulaste ${piece.name}. Ya no aparece en las listas.` },
        },
      })
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.code === 'status_conflict')) {
        onGone()
      } else {
        setApiError(actionErrorText(error, { onTimeout: TIMEOUT_TEXT }))
      }
    }
  }

  return (
    <form className={screenStyles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <p className={styles.summary}>
        {piece.name} · {piece.student.name} · {pieceStatusLabel(piece.status)}
      </p>
      <Notice
        kind="warning"
        text="No se puede deshacer. La pieza deja de verse para todos, también para el alumno. El historial se conserva."
      />
      <TextAreaField
        label="Motivo"
        hint="Obligatorio. Hasta 500 caracteres. El alumno no lo ve."
        error={errors.reason?.message}
        {...register('reason')}
      />

      {apiError && (
        <p role="alert" className={screenStyles.alert}>
          <strong>Error:</strong> {apiError}
        </p>
      )}

      <div className={screenStyles.actions}>
        <button type="submit" className={screenStyles.button} disabled={busy}>
          {busy ? 'Anulando…' : 'Anular pieza'}
        </button>
        <Link
          className={screenStyles.secondaryButton}
          to={`/pieces/${piece.id}`}
          state={listUrl ? { from: listUrl } : undefined}
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}

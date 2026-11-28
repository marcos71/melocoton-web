import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { actionErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import { useCreatePiece } from '../api/pieces'
import { studentDirectoryRootKey, useStudentDirectoryQuery } from '../api/students'
import { useBackTarget } from '../layout/backTarget'
import { listFromState } from '../lib/navState'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { PieceForm, type PieceFormHelpers, type PieceFormValues } from './PieceForm'
import styles from './Screen.module.css'

const TIMEOUT_TEXT =
  'La API tardó demasiado. No sabemos si se guardó: revisá las piezas antes de intentar de nuevo.'

/** The student a list filter left in `?student=`, when it is a plausible id. */
function studentFromParams(params: URLSearchParams): number | null {
  const value = params.get('student')
  return value !== null && /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null
}

/** CU-12, RF-24, DI-79: a teacher creates a piece for one of the active students. */
export function NewPieceScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const headingRef = useHeadingFocus()
  const directory = useStudentDirectoryQuery('ACTIVE')
  const create = useCreatePiece()
  const [apiError, setApiError] = useState<string | null>(null)

  const studentId = studentFromParams(params)
  const listUrl = listFromState(location.state, '/pieces')
  const backTo = listUrl ?? (studentId === null ? '/pieces' : `/pieces?student=${studentId}`)
  useBackTarget({ to: backTo, label: 'Piezas' })

  async function onSubmit(values: PieceFormValues, { setFieldError }: PieceFormHelpers) {
    setApiError(null)
    if (values.studentId === undefined) return
    try {
      const piece = await create.mutateAsync({
        studentId: values.studentId,
        name: values.name,
        ...(values.notes === '' ? {} : { notes: values.notes }),
      })
      void navigate(`/pieces/${piece.id}`, {
        replace: true,
        state: {
          ...(listUrl ? { from: listUrl } : {}),
          notice: { kind: 'success', text: `Creaste ${piece.name} para ${piece.student.name}.` },
        },
      })
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'student_inactive' || error.status === 404)) {
        // The student changed meanwhile: the list the picker shows is old.
        void queryClient.invalidateQueries({ queryKey: studentDirectoryRootKey })
        setFieldError('studentId', error.message)
      } else if (error instanceof ApiError && error.code === 'duplicate_piece_name') {
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
        studentPicker={{
          students: directory.data,
          state: directory.isError ? 'error' : directory.isPending ? 'loading' : 'ready',
          onRetry: () => void directory.refetch(),
          defaultStudentId: studentId,
        }}
        defaultValues={{ name: '', notes: '' }}
        apiError={apiError}
        onSubmit={onSubmit}
        cancelTo={backTo}
        submitLabel="Crear pieza"
        pendingLabel="Creando…"
      />
    </section>
  )
}

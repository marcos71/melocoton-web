import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { StudentDirectoryEntry } from '../api/students'
import { DisabledReason } from '../components/DisabledReason'
import { StudentPicker } from '../components/StudentPicker'
import { TextAreaField } from '../components/TextAreaField'
import { TextField } from '../components/TextField'
import styles from './Screen.module.css'

const NAME_MAX = 100
const NOTES_MAX = 500

/** DI-72: name 1 to 100 and notes up to 500, both after trimming; a blank note means no notes. */
function buildSchema(withStudent: boolean) {
  return z
    .object({
      studentId: z.number({ error: 'Elegí un alumno.' }).optional(),
      name: z
        .string()
        .trim()
        .min(1, 'Escribí el nombre de la pieza.')
        .max(NAME_MAX, `Hasta ${NAME_MAX} caracteres.`),
      notes: z.string().trim().max(NOTES_MAX, `Hasta ${NOTES_MAX} caracteres.`),
    })
    .superRefine((values, context) => {
      if (withStudent && values.studentId === undefined) {
        context.addIssue({ code: 'custom', path: ['studentId'], message: 'Elegí un alumno.' })
      }
    })
}

type FormInput = z.input<ReturnType<typeof buildSchema>>
export type PieceFormValues = z.output<ReturnType<typeof buildSchema>>

/** What the screen can mark as wrong after the API answers (DI-26, CU-12 V1a). */
export type PieceFormHelpers = {
  setFieldError: (field: 'studentId' | 'name', message: string) => void
}

type StudentPickerConfig = {
  students: StudentDirectoryEntry[] | undefined
  state: 'loading' | 'error' | 'ready'
  onRetry: () => void
  /** Chosen once the list is read, when it is one of its students (the `?student=` of the list). */
  defaultStudentId?: number | null
}

type PieceFormProps = {
  mode: 'create' | 'edit'
  /** Only when a teacher creates: the student has to be chosen (DI-79). */
  studentPicker?: StudentPickerConfig
  defaultValues: { name: string; notes: string }
  /** The screen's own action is still running, besides the form's own submit. */
  pending?: boolean
  /** The text of an error that belongs to no field. */
  apiError: string | null
  /** Sends the values; the screen maps the API errors, with `setFieldError` for the ones of a field. */
  onSubmit: (values: PieceFormValues, helpers: PieceFormHelpers) => Promise<void>
  cancelTo: string
  submitLabel: string
  pendingLabel: string
}

/** The fields shared by the student's and the teacher's "Nueva pieza" and "Editar pieza" (screens 2 and 6). */
export function PieceForm({
  mode,
  studentPicker,
  defaultValues,
  pending = false,
  apiError,
  onSubmit,
  cancelTo,
  submitLabel,
  pendingLabel,
}: PieceFormProps) {
  const [schema] = useState(() => buildSchema(studentPicker !== undefined))
  const preselected =
    studentPicker?.defaultStudentId != null &&
    studentPicker.students?.some((student) => student.id === studentPicker.defaultStudentId)
      ? studentPicker.defaultStudentId
      : undefined
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, PieceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: defaultValues.name, notes: defaultValues.notes },
    // The directory arrives after the form: preselect then, without wiping what was typed meanwhile.
    ...(studentPicker
      ? {
          values: { studentId: preselected, name: defaultValues.name, notes: defaultValues.notes },
          resetOptions: { keepDirtyValues: true },
        }
      : {}),
  })

  const [name, notes] = useWatch({ control, name: ['name', 'notes'] })
  const unchanged =
    mode === 'edit' &&
    name.trim() === defaultValues.name.trim() &&
    notes.trim() === defaultValues.notes.trim()
  const noActiveStudents =
    studentPicker?.state === 'ready' && (studentPicker.students ?? []).length === 0
  const busy = isSubmitting || pending

  function setFieldError(field: 'studentId' | 'name', message: string) {
    setError(field, { type: 'server', message }, { shouldFocus: true })
  }

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit((values) => onSubmit(values, { setFieldError }))}
      noValidate
    >
      {studentPicker && !noActiveStudents && (
        <Controller
          control={control}
          name="studentId"
          render={({ field, fieldState }) => (
            <StudentPicker
              ref={field.ref}
              label="Alumno"
              placeholder="Elegí un alumno"
              students={studentPicker.students}
              state={studentPicker.state}
              onRetry={studentPicker.onRetry}
              value={field.value ?? null}
              onChange={(id) => {
                field.onChange(id ?? undefined)
                field.onBlur()
              }}
              error={fieldState.error?.message}
            />
          )}
        />
      )}
      {noActiveStudents && (
        <p className={styles.notice}>
          No hay alumnos activos. Para crear una pieza tiene que haber al menos un alumno activo.
        </p>
      )}
      <TextField
        label="Nombre"
        hint="Hasta 100 caracteres. Para un juego, numeralas: Bowl 1, Bowl 2."
        autoComplete="off"
        error={errors.name?.message}
        {...register('name')}
      />
      <TextAreaField
        label="Notas (opcional)"
        hint="Hasta 500 caracteres."
        error={errors.notes?.message}
        {...register('notes')}
      />

      {apiError && (
        <p role="alert" className={styles.alert}>
          <strong>Error:</strong> {apiError}
        </p>
      )}

      <div className={styles.actions}>
        {noActiveStudents ? (
          <DisabledReason primary label={submitLabel} reason="No hay alumnos activos." />
        ) : unchanged ? (
          <DisabledReason primary label={submitLabel} reason="No hay cambios para guardar." />
        ) : (
          <button type="submit" className={styles.button} disabled={busy}>
            {busy ? pendingLabel : submitLabel}
          </button>
        )}
        <Link className={styles.secondaryButton} to={cancelTo}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}

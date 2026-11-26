import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { actionErrorText } from '../api/actionErrors'
import { useStudentQuery, useUpdateStudent, type StudentProfile } from '../api/students'
import { DisabledReason } from '../components/DisabledReason'
import { TextField } from '../components/TextField'
import { useBackTarget } from '../layout/backTarget'
import { enrollmentLabel } from '../lib/format'
import { listFromState, type StudentNavState } from '../lib/navState'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { useRouteId } from '../lib/useRouteId'
import styles from './Screen.module.css'
import formStyles from './StudentForms.module.css'
import { StudentGate } from './StudentGate'

const editSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Ingresá el nombre.')
    .max(80, 'El nombre puede tener hasta 80 caracteres.'),
  phone: z.string().trim().min(1, 'Ingresá el teléfono.'),
})

type EditValues = z.infer<typeof editSchema>

/** CU-02 M1 (data only), DI-46, DI-53: correct a student's name and phone. */
export function EditStudentScreen() {
  const id = useRouteId()
  const student = useStudentQuery(id)
  return (
    <StudentGate
      id={id}
      query={student}
      loadingText="Cargando ficha…"
      errorTitle="No se pudo cargar la ficha."
    >
      {(profile) => <EditForm student={profile} />}
    </StudentGate>
  )
}

function EditForm({ student }: { student: StudentProfile }) {
  const navigate = useNavigate()
  const location = useLocation()
  const update = useUpdateStudent(student.id)
  const headingRef = useHeadingFocus()
  const [apiError, setApiError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: student.name, phone: student.phone },
  })

  const [name, phone] = useWatch({ control, name: ['name', 'phone'] })
  const changed = name.trim() !== student.name || phone.trim() !== student.phone
  const from = listFromState(location.state)
  const profileState: StudentNavState = from ? { from } : {}
  useBackTarget({ to: `/students/${student.id}`, label: 'Ficha', state: profileState })

  async function onSubmit(values: EditValues) {
    setApiError(null)
    const body = {
      ...(values.name !== student.name ? { name: values.name } : {}),
      ...(values.phone !== student.phone ? { phone: values.phone } : {}),
    }
    try {
      await update.mutateAsync(body)
    } catch (error) {
      setApiError(
        actionErrorText(error, { byCode: { not_found: 'No encontramos a este alumno.' } }),
      )
      return
    }
    const state: StudentNavState = {
      ...(from ? { from } : {}),
      notice: { kind: 'success', text: 'Guardamos los cambios.' },
    }
    void navigate(`/students/${student.id}`, { replace: true, state })
  }

  return (
    <section className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Editar datos
      </h1>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label="Nombre"
          hint="Hasta 80 caracteres."
          autoComplete="off"
          maxLength={80}
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Teléfono"
          type="tel"
          autoComplete="off"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <div>
          <dl className={formStyles.readOnly}>
            <dt>Email</dt>
            <dd>{student.email}</dd>
            <dt>Modalidad</dt>
            <dd>{enrollmentLabel(student.enrollmentType)}</dd>
          </dl>
          <p className={styles.hint}>El email y la modalidad no se cambian desde acá.</p>
        </div>

        {apiError && (
          <p role="alert" className={styles.alert}>
            <strong>Error:</strong> {apiError}
          </p>
        )}

        <div className={styles.actions}>
          {changed ? (
            <button type="submit" className={styles.button} disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
            </button>
          ) : (
            <DisabledReason primary label="Guardar cambios" reason="No hay cambios para guardar." />
          )}
          <Link className={styles.secondaryButton} to={`/students/${student.id}`} state={profileState}>
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  )
}

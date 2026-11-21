import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { actionErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import { useCreateStudent } from '../api/students'
import { RadioCardGroup } from '../components/RadioCardGroup'
import { TextField } from '../components/TextField'
import { useBackTarget } from '../layout/backTarget'
import { formatDate } from '../lib/format'
import type { StudentNavState } from '../lib/navState'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { monthlyStartRange, workshopToday } from '../lib/workshopTime'
import styles from './Screen.module.css'

const TIMEOUT_TEXT =
  'La API tardó demasiado. No sabemos si se guardó: revisá la lista de alumnos antes de intentar de nuevo.'

function buildSchema({ min, max }: { min: string; max: string }) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, 'Ingresá el nombre.')
        .max(80, 'El nombre puede tener hasta 80 caracteres.'),
      email: z
        .string()
        .trim()
        .min(1, 'Ingresá el email.')
        .refine((value) => z.email().safeParse(value).success, 'Ingresá un email válido.'),
      phone: z.string().trim().min(1, 'Ingresá el teléfono.'),
      enrollmentType: z.enum(['MONTHLY', 'DROP_IN'], 'Elegí la modalidad.'),
      monthlyStartDate: z.string(),
    })
    .superRefine((values, context) => {
      if (values.enrollmentType !== 'MONTHLY') return
      const date = values.monthlyStartDate
      const message = !/^\d{4}-\d{2}-\d{2}$/.test(date)
        ? 'Ingresá la fecha de ingreso.'
        : date < min || date > max
          ? `La fecha tiene que estar entre el ${formatDate(min)} y el ${formatDate(max)}.`
          : null
      if (message) context.addIssue({ code: 'custom', path: ['monthlyStartDate'], message })
    })
}

type NewStudentInput = z.input<ReturnType<typeof buildSchema>>
type NewStudentValues = z.output<ReturnType<typeof buildSchema>>

/** CU-02 pasos 1-4, 3a, 3b; RF-04, RF-05; DI-46, DI-53, DI-58: create a student and send the invitation. */
export function NewStudentScreen() {
  useBackTarget({ to: '/students', label: 'Alumnos' })
  const navigate = useNavigate()
  const create = useCreateStudent()
  const headingRef = useHeadingFocus()
  const [apiError, setApiError] = useState<string | null>(null)
  const [today] = useState(() => workshopToday(new Date()))
  const range = useMemo(() => monthlyStartRange(today), [today])
  const schema = useMemo(() => buildSchema(range), [range])
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewStudentInput, unknown, NewStudentValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', monthlyStartDate: today },
  })
  const monthly = useWatch({ control, name: 'enrollmentType' }) === 'MONTHLY'

  async function onSubmit(values: NewStudentValues) {
    setApiError(null)
    const isMonthly = values.enrollmentType === 'MONTHLY'
    try {
      const student = await create.mutateAsync({
        name: values.name,
        email: values.email,
        phone: values.phone,
        enrollmentType: values.enrollmentType,
        ...(isMonthly ? { monthlyStartDate: values.monthlyStartDate } : {}),
      })
      const state: StudentNavState = {
        notice: {
          kind: 'success',
          text: `Creamos a ${student.name} y le enviamos la invitación a ${values.email}. El enlace vence en 7 días.`,
        },
      }
      void navigate(`/students/${student.id}`, { replace: true, state })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'email_already_used') {
        setError('email', { type: 'server', message: error.message }, { shouldFocus: true })
      } else if (error instanceof ApiError && error.code === 'invalid_monthly_start_date' && isMonthly) {
        setError('monthlyStartDate', { type: 'server', message: error.message }, { shouldFocus: true })
      } else {
        setApiError(actionErrorText(error, { onTimeout: TIMEOUT_TEXT }))
      }
    }
  }

  return (
    <section className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Nuevo alumno
      </h1>
      <p>
        Le vamos a enviar un email con un enlace para definir su contraseña. El enlace vence en 7
        días.
      </p>

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
          label="Email"
          type="email"
          autoComplete="off"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Teléfono"
          type="tel"
          autoComplete="off"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <Controller
          control={control}
          name="enrollmentType"
          render={({ field }) => (
            <RadioCardGroup
              legend="Modalidad"
              value={field.value ?? null}
              onChange={field.onChange}
              error={errors.enrollmentType?.message}
              options={[
                { value: 'MONTHLY', label: 'Mensual' },
                { value: 'DROP_IN', label: 'Clase suelta' },
              ]}
            />
          )}
        />
        {monthly && (
          <TextField
            label="Fecha de ingreso mensual"
            hint="Desde esta fecha se cuentan sus mensualidades."
            type="date"
            min={range.min}
            max={range.max}
            error={errors.monthlyStartDate?.message}
            {...register('monthlyStartDate')}
          />
        )}

        {apiError && (
          <p role="alert" className={styles.alert}>
            <strong>Error:</strong> {apiError}
          </p>
        )}

        <div className={styles.actions}>
          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'Creando…' : 'Crear y enviar invitación'}
          </button>
          <Link className={styles.secondaryButton} to="/students">
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  )
}

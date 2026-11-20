import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { useCreateAssistantTeacher } from '../api/assistantTeachers'
import { ApiError, errorMessage } from '../api/errors'
import { TextField } from '../components/TextField'
import { zodResolver } from '@hookform/resolvers/zod'
import styles from './Screen.module.css'

const newTeacherSchema = z.object({
  name: z.string().trim().min(1, 'Ingresá el nombre.'),
  email: z
    .string()
    .trim()
    .min(1, 'Ingresá el email.')
    .refine((value) => z.email().safeParse(value).success, 'Ingresá un email válido.'),
  phone: z.string().trim().min(1, 'Ingresá el teléfono.'),
})

type NewTeacherValues = z.infer<typeof newTeacherSchema>

/** CU-02 D1: create an assistant teacher; the API sends the invitation email (RF-53). */
export function NewAssistantTeacherScreen() {
  const navigate = useNavigate()
  const create = useCreateAssistantTeacher()
  const [apiError, setApiError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewTeacherValues>({
    resolver: zodResolver(newTeacherSchema),
    defaultValues: { name: '', email: '', phone: '' },
  })

  async function onSubmit(values: NewTeacherValues) {
    setApiError(null)
    try {
      await create.mutateAsync(values)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'email_already_used') {
        setError('email', { type: 'server', message: error.message })
      } else {
        setApiError(errorMessage(error))
      }
      return
    }
    void navigate('/admin/assistant-teachers', {
      state: { message: `Le enviamos la invitación a ${values.email}.` },
    })
  }

  return (
    <section className={styles.screen}>
      <h1 className={styles.title}>Agregar docente secundario</h1>
      <p>
        Le vamos a enviar un email con un enlace para definir su contraseña. El enlace vence en 7
        días.
      </p>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label="Nombre"
          autoComplete="off"
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

        {apiError && (
          <p role="alert" className={styles.alert}>
            <strong>Error:</strong> {apiError}
          </p>
        )}

        <div className={styles.actions}>
          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'Creando…' : 'Crear y enviar invitación'}
          </button>
          <Link className={styles.link} to="/admin/assistant-teachers">
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  )
}

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { requestPasswordReset } from '../api/auth'
import { errorMessage } from '../api/errors'
import { TextField } from '../components/TextField'
import { zodResolver } from '@hookform/resolvers/zod'
import styles from './Screen.module.css'

const forgotSchema = z.object({
  email: z.string().trim().min(1, 'Ingresá tu email.'),
})

type ForgotValues = z.infer<typeof forgotSchema>

/** CU-01 2c: ask for a link to define a new password. The API always answers 202 (DI-33). */
export function ForgotPasswordScreen() {
  const [sent, setSent] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: ForgotValues) {
    setApiError(null)
    try {
      await requestPasswordReset(values.email)
      setSent(true)
    } catch (error) {
      setApiError(errorMessage(error))
    }
  }

  return (
    <section className={styles.screen}>
      <h1 className={styles.title}>Recuperar contraseña</h1>

      {sent ? (
        <p role="status" className={styles.notice}>
          Si el email corresponde a una cuenta activa, te llegará un enlace para definir una
          contraseña nueva. El enlace vence en una hora.
        </p>
      ) : (
        <>
          <p>Te enviamos un enlace para definir una contraseña nueva.</p>
          <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              error={errors.email?.message}
              {...register('email')}
            />

            {apiError && (
              <p role="alert" className={styles.alert}>
                <strong>Error:</strong> {apiError}
              </p>
            )}

            <button type="submit" className={styles.button} disabled={isSubmitting}>
              {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        </>
      )}

      <Link className={styles.secondaryButton} to="/login">
        Volver a ingresar
      </Link>
    </section>
  )
}

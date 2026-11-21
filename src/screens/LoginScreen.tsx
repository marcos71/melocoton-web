import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { errorMessage } from '../api/errors'
import { NOTICE_TEXT, useSession } from '../auth/session'
import { TextField } from '../components/TextField'
import { zodResolver } from '@hookform/resolvers/zod'
import styles from './Screen.module.css'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Ingresá tu email.'),
  password: z.string().min(1, 'Ingresá tu contraseña.'),
})

type LoginValues = z.infer<typeof loginSchema>

/** CU-01: log in with email and password. */
export function LoginScreen() {
  const { logIn, notice } = useSession()
  const [apiError, setApiError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginValues) {
    setApiError(null)
    try {
      await logIn(values.email, values.password)
    } catch (error) {
      setApiError(errorMessage(error))
      setValue('password', '')
      setFocus('password')
    }
  }

  return (
    <section className={styles.screen}>
      <h1 className={styles.title}>Ingresar</h1>

      {notice && (
        <p role="status" className={styles.notice}>
          {NOTICE_TEXT[notice]}
        </p>
      )}

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        {apiError && (
          <p role="alert" className={styles.alert}>
            <strong>Error:</strong> {apiError}
          </p>
        )}

        <button type="submit" className={styles.button} disabled={isSubmitting}>
          {isSubmitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <Link className={styles.secondaryButton} to="/forgot-password">
        ¿Olvidaste tu contraseña?
      </Link>
      <Link className={styles.secondaryButton} to="/health">
        Estado de la conexión
      </Link>
    </section>
  )
}

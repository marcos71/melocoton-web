import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router'
import { z } from 'zod'
import { setPassword } from '../api/auth'
import { ApiError, errorMessage } from '../api/errors'
import { tokenStore } from '../auth/tokenStore'
import { TextField } from '../components/TextField'
import { zodResolver } from '@hookform/resolvers/zod'
import styles from './Screen.module.css'

// DI-29 / DI-33: 10 to 128 characters.
const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, 'La contraseña tiene que tener al menos 10 caracteres.')
      .max(128, 'La contraseña puede tener hasta 128 caracteres.'),
    confirmation: z.string(),
  })
  .refine((values) => values.password === values.confirmation, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmation'],
  })

type SetPasswordValues = z.infer<typeof setPasswordSchema>

/** The link carries its token in the fragment, so it never reaches a server log (DI-33). */
function tokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token')
  return token ? token : null
}

/** CU-01 2c and 2e: define the password from an invitation or a reset link. */
export function SetPasswordScreen() {
  const token = tokenFromHash(useLocation().hash)
  const [done, setDone] = useState(false)
  const [failure, setFailure] = useState<{ message: string; expired: boolean } | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: '', confirmation: '' },
  })

  if (!token) {
    return (
      <section className={styles.screen}>
        <h1 className={styles.title}>Definí tu contraseña</h1>
        <div role="alert" className={styles.alert}>
          <p>
            <strong>Error:</strong> El enlace no es válido. Pedí uno nuevo.</p>
        </div>
        <Link className={styles.secondaryButton} to="/forgot-password">
          Pedir un enlace nuevo
        </Link>
      </section>
    )
  }

  const onSubmit = async (values: SetPasswordValues) => {
    setFailure(null)
    try {
      await setPassword(token, values.password)
      // The API closed every open session of this account, including one on this device.
      tokenStore.clear('password-changed')
      setDone(true)
    } catch (error) {
      setFailure({
        message: errorMessage(error),
        expired: error instanceof ApiError && error.code === 'link_expired',
      })
    }
  }

  if (done) {
    return (
      <section className={styles.screen}>
        <h1 className={styles.title}>Definí tu contraseña</h1>
        <p role="status" className={styles.notice}>
          Listo, tu contraseña quedó guardada.
        </p>
        <Link className={styles.button} to="/login">
          Ingresar
        </Link>
      </section>
    )
  }

  return (
    <section className={styles.screen}>
      <h1 className={styles.title}>Definí tu contraseña</h1>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          hint="Entre 10 y 128 caracteres."
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Repetí la contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirmation?.message}
          {...register('confirmation')}
        />

        {failure && (
          <div role="alert" className={styles.alert}>
            <p>
              <strong>Error:</strong> {failure.message}
            </p>
            {failure.expired && (
              <Link className={styles.secondaryButton} to="/forgot-password">
                Pedir un enlace nuevo
              </Link>
            )}
          </div>
        )}

        <button type="submit" className={styles.button} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </section>
  )
}

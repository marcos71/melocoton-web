import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { actionErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import { slotOverlapDetails, type SlotItem } from '../api/slots'
import { DisabledReason } from '../components/DisabledReason'
import { SelectField } from '../components/SelectField'
import { TextField } from '../components/TextField'
import { dayLabel, formatSlotLower, type SlotTime } from '../lib/format'
import { findOverlap, normalizeSlotTime, normalizeTime, slotsOfDay } from '../lib/slotRules'
import styles from './Screen.module.css'

export type SlotValues = { dayOfWeek: number; startTime: string; endTime: string }

const DAYS = [1, 2, 3, 4, 5, 6, 7]

const TIMEOUT_TEXT =
  'La API tardó demasiado. No sabemos si se guardó: revisá la lista de turnos antes de intentar de nuevo.'

function overlapText(slot: SlotTime): string {
  return `Se superpone con el turno del ${formatSlotLower(normalizeSlotTime(slot))}.`
}

/** DI-25: the day and times are required, the end is after the start and no active slot is in the way. */
function slotSchema(slots: readonly SlotItem[] | undefined, ignoringId: number | undefined) {
  return z
    .object({
      dayOfWeek: z.string().min(1, 'Elegí el día.'),
      startTime: z.string().min(1, 'Ingresá la hora de inicio.'),
      endTime: z.string().min(1, 'Ingresá la hora de fin.'),
    })
    .superRefine((values, context) => {
      if (!values.dayOfWeek || !values.startTime || !values.endTime) return
      if (normalizeTime(values.endTime) <= normalizeTime(values.startTime)) {
        context.addIssue({
          code: 'custom',
          path: ['endTime'],
          message: 'La hora de fin tiene que ser posterior a la de inicio.',
        })
        return
      }
      const overlapping = findOverlap(
        Number(values.dayOfWeek),
        values.startTime,
        values.endTime,
        slots ?? [],
        ignoringId,
      )
      if (overlapping) context.addIssue({ code: 'custom', path: ['endTime'], message: overlapText(overlapping) })
    })
}

type FormValues = z.infer<ReturnType<typeof slotSchema>>

type SlotFormProps = {
  /** The slot being corrected; absent when creating one (everything starts empty). */
  original?: SlotItem
  /** The active slots already read, `undefined` while they load or if the read failed. */
  slots: readonly SlotItem[] | undefined
  slotsFailed: boolean
  submitLabel: string
  pendingLabel: string
  /** Sends the values; throws the `ApiError` of a failed call. */
  onSubmit: (values: SlotValues) => Promise<void>
  /** Gives the screen the first look at an API error; `true` means it dealt with it. */
  onApiError?: (error: unknown) => boolean
}

/** The day, start and end fields shared by "Nuevo turno" and "Corregir horario" (docs/pantallas_turnos.md, 3 and 4). */
export function SlotForm({
  original,
  slots,
  slotsFailed,
  submitLabel,
  pendingLabel,
  onSubmit,
  onApiError,
}: SlotFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)
  const dayHintId = useId()
  const {
    register,
    handleSubmit,
    control,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(slotSchema(slots, original?.id)),
    defaultValues: {
      dayOfWeek: original ? String(original.dayOfWeek) : '',
      startTime: original ? normalizeTime(original.startTime) : '',
      endTime: original ? normalizeTime(original.endTime) : '',
    },
  })

  const [dayOfWeek, startTime, endTime] = useWatch({
    control,
    name: ['dayOfWeek', 'startTime', 'endTime'],
  })
  const changed =
    original === undefined ||
    dayOfWeek !== String(original.dayOfWeek) ||
    startTime !== normalizeTime(original.startTime) ||
    endTime !== normalizeTime(original.endTime)

  const dayHint = dayHintText(slots, slotsFailed, dayOfWeek, original?.id)

  async function submit(values: FormValues) {
    setApiError(null)
    try {
      await onSubmit({
        dayOfWeek: Number(values.dayOfWeek),
        startTime: normalizeTime(values.startTime),
        endTime: normalizeTime(values.endTime),
      })
    } catch (error) {
      if (onApiError?.(error)) return
      if (error instanceof ApiError && error.code === 'slot_overlap') {
        const details = slotOverlapDetails(error)
        setError('endTime', { type: 'server', message: details ? overlapText(details) : error.message })
        setFocus('endTime')
        return
      }
      setApiError(actionErrorText(error, { onTimeout: TIMEOUT_TEXT }))
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate>
      <div className={styles.field}>
        <SelectField
          label="Día"
          aria-describedby={dayHint ? dayHintId : undefined}
          error={errors.dayOfWeek?.message}
          {...register('dayOfWeek')}
        >
          {original === undefined && <option value="">Elegí el día</option>}
          {DAYS.map((day) => (
            <option key={day} value={day}>
              {dayLabel(day)}
            </option>
          ))}
        </SelectField>
        {dayHint && (
          <p id={dayHintId} className={styles.hint} aria-live="polite">
            {dayHint}
          </p>
        )}
      </div>
      <TextField
        label="Hora de inicio"
        type="time"
        error={errors.startTime?.message}
        {...register('startTime')}
      />
      <TextField
        label="Hora de fin"
        type="time"
        error={errors.endTime?.message}
        {...register('endTime')}
      />

      {apiError && (
        <p role="alert" className={styles.alert}>
          <strong>Error:</strong> {apiError}
        </p>
      )}

      <div className={styles.actions}>
        {changed ? (
          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? pendingLabel : submitLabel}
          </button>
        ) : (
          <DisabledReason primary label={submitLabel} reason="No hay cambios para guardar." />
        )}
        <Link className={styles.secondaryButton} to="/slots">
          Cancelar
        </Link>
      </div>
    </form>
  )
}

/** The slots of the chosen day, or why they cannot be listed (3.1). */
function dayHintText(
  slots: readonly SlotItem[] | undefined,
  slotsFailed: boolean,
  dayOfWeek: string,
  ignoringId: number | undefined,
): string | null {
  if (slotsFailed) {
    return 'No pudimos cargar los turnos existentes: la superposición se revisa al guardar.'
  }
  if (!slots || !dayOfWeek) return null
  const sameDay = slotsOfDay(slots, Number(dayOfWeek)).filter((slot) => slot.id !== ignoringId)
  if (sameDay.length === 0) return 'Ese día no hay turnos.'
  const times = sameDay.map((slot) => `${normalizeTime(slot.startTime)} a ${normalizeTime(slot.endTime)}`)
  return `Ese día ya hay: ${times.join(' · ')}.`
}

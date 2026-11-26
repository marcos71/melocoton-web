import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { readErrorText } from '../api/actionErrors'
import { ApiError } from '../api/errors'
import {
  useActiveSlotsQuery,
  useSlotQuery,
  useUpdateSlot,
  type SlotItem,
  type UpdateSlotRequest,
} from '../api/slots'
import { QueryError } from '../components/QueryError'
import { useBackTarget } from '../layout/backTarget'
import { formatSlotInSentence } from '../lib/format'
import type { StudentNavState } from '../lib/navState'
import { normalizeSlotTime, normalizeTime } from '../lib/slotRules'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import { useRouteId } from '../lib/useRouteId'
import styles from './Screen.module.css'
import { SlotForm, type SlotValues } from './SlotForm'

/** Why the form is not offered, when the API says so before the data on screen does. */
type Blocked = 'bookings' | 'inactive' | 'missing'

/** CU-03, RF-07, DI-45, DI-63: correct the day and time of a slot that never had a booking. */
export function EditSlotScreen() {
  const id = useRouteId()
  const slot = useSlotQuery(id)
  const [blocked, setBlocked] = useState<Blocked | null>(null)
  useBackTarget({ to: '/slots', label: 'Turnos' })

  if (!Number.isInteger(id) || blocked === 'missing') return <Message text="No encontramos este turno." error />
  if (slot.isError && slot.error instanceof ApiError && slot.error.status === 404) {
    return <Message text="No encontramos este turno." error />
  }
  if (slot.data === undefined && slot.isError) {
    return (
      <section className={styles.screen}>
        <QueryError
          title="No se pudo cargar el turno."
          reason={readErrorText(slot.error)}
          onRetry={() => void slot.refetch()}
          retrying={slot.isFetching}
        />
        <BackToSlots />
      </section>
    )
  }
  if (slot.data === undefined) {
    return (
      <section className={styles.screen}>
        <p role="status">Cargando turno…</p>
      </section>
    )
  }
  if (blocked === 'inactive' || !slot.data.active) {
    return <Message text="Este turno está desactivado: no se puede editar." />
  }
  if (blocked === 'bookings' || !slot.data.scheduleEditable) {
    return <Message text="Este turno ya tiene reservas: el día y el horario no se pueden cambiar." />
  }
  return <EditForm key={scheduleKey(slot.data)} slot={slot.data} onBlocked={setBlocked} />
}

/** Changes only when the day or a time changes, so a refetch with the same schedule keeps what was typed. */
function scheduleKey(slot: SlotItem): string {
  return `${slot.dayOfWeek}|${normalizeTime(slot.startTime)}|${normalizeTime(slot.endTime)}`
}

function BackToSlots() {
  return (
    <Link className={styles.secondaryButton} to="/slots">
      Volver a Turnos
    </Link>
  )
}

/** A screen without form: the reason in text and the way back. */
function Message({ text, error = false }: { text: string; error?: boolean }) {
  const headingRef = useHeadingFocus()
  return (
    <section className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Corregir horario
      </h1>
      {error ? (
        <div role="alert" className={styles.alert}>
          <p className={styles.alertTitle}>
            <strong>Error:</strong> {text}
          </p>
        </div>
      ) : (
        <p className={styles.empty}>{text}</p>
      )}
      <BackToSlots />
    </section>
  )
}

function EditForm({ slot, onBlocked }: { slot: SlotItem; onBlocked: (reason: Blocked) => void }) {
  const navigate = useNavigate()
  const headingRef = useHeadingFocus()
  const slots = useActiveSlotsQuery()
  const update = useUpdateSlot(slot.id)

  async function onSubmit(values: SlotValues) {
    const body: UpdateSlotRequest = {
      ...(values.dayOfWeek !== slot.dayOfWeek ? { dayOfWeek: values.dayOfWeek } : {}),
      ...(values.startTime !== normalizeTime(slot.startTime) ? { startTime: values.startTime } : {}),
      ...(values.endTime !== normalizeTime(slot.endTime) ? { endTime: values.endTime } : {}),
    }
    const updated = normalizeSlotTime(await update.mutateAsync(body))
    const state: StudentNavState = {
      notice: { kind: 'success', text: `El turno ahora es ${formatSlotInSentence(updated)}.` },
    }
    void navigate('/slots', { replace: true, state })
  }

  function onApiError(error: unknown): boolean {
    if (!(error instanceof ApiError)) return false
    if (error.code === 'slot_has_bookings') onBlocked('bookings')
    else if (error.code === 'status_conflict') onBlocked('inactive')
    else if (error.code === 'not_found') onBlocked('missing')
    else return false
    return true
  }

  return (
    <section className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Corregir horario
      </h1>
      <p>Como el turno todavía no tiene reservas, podés corregir el día y el horario.</p>
      <SlotForm
        original={slot}
        slots={slots.data}
        slotsFailed={slots.isError}
        submitLabel="Guardar cambios"
        pendingLabel="Guardando…"
        onSubmit={onSubmit}
        onApiError={onApiError}
      />
    </section>
  )
}

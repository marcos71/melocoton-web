import { useNavigate } from 'react-router'
import { useActiveSlotsQuery, useCreateSlot } from '../api/slots'
import { useBackTarget } from '../layout/backTarget'
import { formatSlotLower } from '../lib/format'
import type { StudentNavState } from '../lib/navState'
import { SLOT_CAPACITY, normalizeSlotTime } from '../lib/slotRules'
import { useHeadingFocus } from '../lib/useHeadingFocus'
import styles from './Screen.module.css'
import { SlotForm, type SlotValues } from './SlotForm'

/** CU-03, RF-06, DI-25, DI-64: create a slot with a day and a start and end time. */
export function NewSlotScreen() {
  const navigate = useNavigate()
  const headingRef = useHeadingFocus()
  const slots = useActiveSlotsQuery()
  const create = useCreateSlot()
  useBackTarget({ to: '/slots', label: 'Turnos' })

  async function onSubmit(values: SlotValues) {
    const slot = normalizeSlotTime(await create.mutateAsync(values))
    const state: StudentNavState = {
      notice: { kind: 'success', text: `Creamos el turno del ${formatSlotLower(slot)}.` },
    }
    void navigate('/slots', { replace: true, state })
  }

  return (
    <section className={styles.screen}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        Nuevo turno
      </h1>
      <p>El cupo es de {SLOT_CAPACITY} alumnos.</p>
      <SlotForm
        slots={slots.data}
        slotsFailed={slots.isError}
        submitLabel="Crear turno"
        pendingLabel="Creando…"
        onSubmit={onSubmit}
      />
    </section>
  )
}

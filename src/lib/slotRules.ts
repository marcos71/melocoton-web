import type { Lesson } from '../api/lessons'
import type { SlotItem } from '../api/slots'
import { bySlotTime, type SlotTime } from './format'
import { lessonStarted } from './workshopTime'

/** "18:00:00" and "18:00" are the same time: the API may send seconds, the screens show HH:mm. */
export function normalizeTime(time: string): string {
  return time.slice(0, 5)
}

/** The slot with its times as HH:mm. */
export function normalizeSlotTime<T extends SlotTime>(slot: T): T {
  return { ...slot, startTime: normalizeTime(slot.startTime), endTime: normalizeTime(slot.endTime) }
}

/** The slots of one ISO day, in order of start time. */
export function slotsOfDay<T extends SlotTime>(slots: readonly T[], dayOfWeek: number): T[] {
  return slots.filter((slot) => slot.dayOfWeek === dayOfWeek).sort(bySlotTime)
}

/**
 * The slot that a new day and time would overlap, or `undefined` (DI-25): same day, and each
 * one starts before the other ends. Two slots that touch (one ends when the other starts) do
 * not overlap. `ignoringId` leaves out the slot being corrected.
 */
export function findOverlap<T extends SlotTime & { id: number }>(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  slots: readonly T[],
  ignoringId?: number,
): T | undefined {
  const start = normalizeTime(startTime)
  const end = normalizeTime(endTime)
  return slotsOfDay(slots, dayOfWeek).find(
    (slot) =>
      slot.id !== ignoringId &&
      start < normalizeTime(slot.endTime) &&
      normalizeTime(slot.startTime) < end,
  )
}

/** Each slot's next lesson that has not started yet, by slot id (DI-62). */
export function nextLessonBySlot(lessons: readonly Lesson[], now: Date): Map<number, Lesson> {
  const next = new Map<number, Lesson>()
  const sorted = [...lessons].sort(
    (a, b) =>
      a.lessonDate.localeCompare(b.lessonDate) ||
      normalizeTime(a.startTime).localeCompare(normalizeTime(b.startTime)),
  )
  for (const lesson of sorted) {
    if (next.has(lesson.slotId)) continue
    if (lessonStarted(lesson.lessonDate, normalizeTime(lesson.startTime), now)) continue
    next.set(lesson.slotId, lesson)
  }
  return next
}

export type OverbookedLesson = {
  slot: SlotItem
  lessonDate: string
  occupancy: number
  capacity: number
}

/** The overbooked lessons of every slot together, by date and then start time (DI-43). */
export function overbookedLessons(slots: readonly SlotItem[]): OverbookedLesson[] {
  return slots
    .flatMap((slot) => slot.upcomingOverbookedLessons.map((lesson) => ({ slot, ...lesson })))
    .sort(
      (a, b) =>
        a.lessonDate.localeCompare(b.lessonDate) ||
        normalizeTime(a.slot.startTime).localeCompare(normalizeTime(b.slot.startTime)),
    )
}

/** Every slot has the same capacity (DI-64); the responses also carry it, but it is not chosen or edited. */
export const SLOT_CAPACITY = 12

/** A slot has as many fixed students as its capacity: no fixed student fits (DI-66). */
export function isFullOfFixedStudents(slot: Pick<SlotItem, 'fixedStudents' | 'capacity'>): boolean {
  return slot.fixedStudents >= slot.capacity
}

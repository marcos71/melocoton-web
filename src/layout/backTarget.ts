import { createContext, useContext, useEffect } from 'react'

/** Where the app bar's back button goes (docs/diseno_visual.md, section 6). */
export type BackTarget = {
  to: string
  /** The name of the previous screen, for example "Alumnos". */
  label: string
  /** Router state handed to that screen. It has to be JSON-serializable. */
  state?: unknown
}

type BackTargetContextValue = {
  target: BackTarget | null
  setTarget: (target: BackTarget | null) => void
}

export const BackTargetContext = createContext<BackTargetContextValue>({
  target: null,
  setTarget: () => {},
})

/** The current back target, for the app bar. */
export function useCurrentBackTarget(): BackTarget | null {
  return useContext(BackTargetContext).target
}

/**
 * A screen that is not the root of a tab declares where "back" goes; the app bar shows it
 * in place of the brand and it is cleared when the screen unmounts.
 */
export function useBackTarget({ to, label, state }: BackTarget): void {
  const { setTarget } = useContext(BackTargetContext)
  // The state object is a new one on every render; its JSON keeps the effect from re-running.
  const stateKey = JSON.stringify(state ?? null)
  useEffect(() => {
    const parsed: unknown = JSON.parse(stateKey)
    setTarget({ to, label, ...(parsed === null ? {} : { state: parsed }) })
    return () => setTarget(null)
  }, [to, label, stateKey, setTarget])
}

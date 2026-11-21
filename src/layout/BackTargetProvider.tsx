import { useMemo, useState, type ReactNode } from 'react'
import { BackTargetContext, type BackTarget } from './backTarget'

/** Holds the back target the current screen declared; both layouts wrap their shell in it. */
export function BackTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<BackTarget | null>(null)
  const value = useMemo(() => ({ target, setTarget }), [target])
  return <BackTargetContext.Provider value={value}>{children}</BackTargetContext.Provider>
}

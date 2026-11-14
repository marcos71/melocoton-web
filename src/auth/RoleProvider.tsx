import { useMemo, useState, type ReactNode } from 'react'
import { RoleContext, type Role } from './role'

export function RoleProvider({
  initialRole = 'STUDENT',
  children,
}: {
  initialRole?: Role
  children: ReactNode
}) {
  const [role, setRole] = useState<Role>(initialRole)
  const value = useMemo(() => ({ role, setRole }), [role])
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

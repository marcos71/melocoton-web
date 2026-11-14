import { Navigate, Route, Routes } from 'react-router'
import { useRole } from './auth/role'
import { AppLayout } from './layout/AppLayout'
import { TABS_BY_ROLE } from './layout/tabs'
import { ComingSoonScreen } from './screens/ComingSoonScreen'
import { HealthScreen } from './screens/HealthScreen'

/** Routes for the current role; any other path goes to the role's home tab. */
export function AppRoutes({ showRoleSwitch }: { showRoleSwitch?: boolean }) {
  const { role } = useRole()
  const tabs = TABS_BY_ROLE[role]
  const home = tabs[0].path

  return (
    <Routes>
      <Route element={<AppLayout showRoleSwitch={showRoleSwitch} />}>
        <Route index element={<Navigate to={home} replace />} />
        {tabs.map((tab) => (
          <Route key={tab.path} path={tab.path} element={<ComingSoonScreen title={tab.label} />} />
        ))}
        <Route path="/health" element={<HealthScreen />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  )
}

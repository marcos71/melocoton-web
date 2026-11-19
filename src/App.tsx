import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { RedirectIfAuthenticated, RequireSession } from './auth/guards'
import { useSession } from './auth/session'
import { ADMIN_PATHS, homePath } from './layout/access'
import { AppLayout } from './layout/AppLayout'
import { PublicLayout } from './layout/PublicLayout'
import { TABS_BY_ROLE } from './layout/tabs'
import { AdminScreen } from './screens/AdminScreen'
import { AssistantTeachersScreen } from './screens/AssistantTeachersScreen'
import { ComingSoonScreen } from './screens/ComingSoonScreen'
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen'
import { HealthScreen } from './screens/HealthScreen'
import { LoginScreen } from './screens/LoginScreen'
import { NewAssistantTeacherScreen } from './screens/NewAssistantTeacherScreen'
import { SetPasswordScreen } from './screens/SetPasswordScreen'

/** Screens of the lead teacher's settings (RF-02: no other role gets these routes). */
const ADMIN_SCREENS: Record<(typeof ADMIN_PATHS)[number], ReactElement> = {
  '/admin': <AdminScreen />,
  '/admin/assistant-teachers': <AssistantTeachersScreen />,
  '/admin/assistant-teachers/new': <NewAssistantTeacherScreen />,
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <LoginScreen />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <RedirectIfAuthenticated>
              <ForgotPasswordScreen />
            </RedirectIfAuthenticated>
          }
        />
        <Route path="/set-password" element={<SetPasswordScreen />} />
        <Route path="/health" element={<HealthScreen />} />
      </Route>
      <Route
        path="*"
        element={
          <RequireSession>
            <RoleRoutes />
          </RequireSession>
        }
      />
    </Routes>
  )
}

/** Routes for the current role; any other path goes to the role's home tab. */
function RoleRoutes() {
  const { user } = useSession()
  if (!user) return null
  const home = homePath(user.role)

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to={home} replace />} />
        {TABS_BY_ROLE[user.role].map((tab) => (
          <Route key={tab.path} path={tab.path} element={<ComingSoonScreen title={tab.label} />} />
        ))}
        {user.role === 'LEAD_TEACHER' &&
          ADMIN_PATHS.map((path) => (
            <Route key={path} path={path} element={ADMIN_SCREENS[path]} />
          ))}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  )
}

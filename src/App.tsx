import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { RedirectIfAuthenticated, RequireSession } from './auth/guards'
import { useSession } from './auth/session'
import { ADMIN_PATHS, SLOT_PATHS, STUDENT_PATHS, homePath } from './layout/access'
import { AppLayout } from './layout/AppLayout'
import { PublicLayout } from './layout/PublicLayout'
import { TABS_BY_ROLE } from './layout/tabs'
import { AdminScreen } from './screens/AdminScreen'
import { AssistantTeachersScreen } from './screens/AssistantTeachersScreen'
import { ComingSoonScreen } from './screens/ComingSoonScreen'
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen'
import { HealthScreen } from './screens/HealthScreen'
import { DropInBookingScreen } from './screens/DropInBookingScreen'
import { EditSlotScreen } from './screens/EditSlotScreen'
import { EditStudentScreen } from './screens/EditStudentScreen'
import { FixedSlotScreen } from './screens/FixedSlotScreen'
import { LoginScreen } from './screens/LoginScreen'
import { NewAssistantTeacherScreen } from './screens/NewAssistantTeacherScreen'
import { NewSlotScreen } from './screens/NewSlotScreen'
import { NewStudentScreen } from './screens/NewStudentScreen'
import { SetPasswordScreen } from './screens/SetPasswordScreen'
import { SlotsScreen } from './screens/SlotsScreen'
import { StudentProfileScreen } from './screens/StudentProfileScreen'
import { StudentsScreen } from './screens/StudentsScreen'

/** Screens of the lead teacher's settings (RF-02: no other role gets these routes). */
const ADMIN_SCREENS: Record<(typeof ADMIN_PATHS)[number], ReactElement> = {
  '/admin': <AdminScreen />,
  '/admin/assistant-teachers': <AssistantTeachersScreen />,
  '/admin/assistant-teachers/new': <NewAssistantTeacherScreen />,
}

/**
 * Screens of the Alumnos tab beyond the list (DI-46, DI-53): the lead teacher only.
 */
const STUDENT_SCREENS: Partial<Record<(typeof STUDENT_PATHS)[number], ReactElement>> = {
  '/students/new': <NewStudentScreen />,
  '/students/:id': <StudentProfileScreen />,
  '/students/:id/edit': <EditStudentScreen />,
  '/students/:id/fixed-slot': <FixedSlotScreen />,
  '/students/:id/drop-in/new': <DropInBookingScreen />,
}

/** Screens of the Turnos tab beyond the list (DI-62): the lead teacher only. */
const SLOT_SCREENS: Record<(typeof SLOT_PATHS)[number], ReactElement> = {
  '/slots/new': <NewSlotScreen />,
  '/slots/:id/edit': <EditSlotScreen />,
}

/** Tabs that already have their screen; the others show the placeholder. */
const TAB_SCREENS: Record<string, ReactElement> = {
  '/slots': <SlotsScreen />,
  '/students': <StudentsScreen />,
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
          <Route
            key={tab.path}
            path={tab.path}
            element={TAB_SCREENS[tab.path] ?? <ComingSoonScreen title={tab.label} />}
          />
        ))}
        {user.role === 'LEAD_TEACHER' &&
          ADMIN_PATHS.map((path) => (
            <Route key={path} path={path} element={ADMIN_SCREENS[path]} />
          ))}
        {user.role === 'LEAD_TEACHER' &&
          STUDENT_PATHS.map((path) => {
            const element = STUDENT_SCREENS[path]
            return element ? <Route key={path} path={path} element={element} /> : null
          })}
        {user.role === 'LEAD_TEACHER' &&
          SLOT_PATHS.map((path) => <Route key={path} path={path} element={SLOT_SCREENS[path]} />)}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  )
}

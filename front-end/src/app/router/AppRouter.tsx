import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useAuth } from '../../features/auth/context/useAuth.ts'
import AccountPage from '../../features/auth/pages/AccountPage.tsx'
import CategoriesPage from '../../features/categories/pages/CategoriesPage.tsx'
import DepartmentsPage from '../../features/departments/pages/DepartmentsPage.tsx'
import OrganizationsPage from '../../features/organizations/pages/OrganizationsPage.tsx'
import OcrPage from '../../features/ocr/pages/OcrPage.tsx'
import ChatPage from '../../features/chat/pages/ChatPage.tsx'
import AppLayout from '../../layouts/AppLayout/AppLayout.tsx'
import Workspace from '../../pages/Workspace.tsx'
import ForbiddenPage from '../../pages/ForbiddenPage.tsx'
import NotFoundPage from '../../pages/NotFoundPage.tsx'
import type { Role } from '../../shared/types/domain.ts'
import { routes, canAccess } from './access.ts'

function Guard({ roles }: { roles: Role[] }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading')
    return (
      <p className="p-8" role="status">
        Restoring your session…
      </p>
    )
  if (auth.status === 'error')
    return (
      <div className="p-8" role="alert">
        Unable to restore your session.{' '}
        <button className="text-link" onClick={auth.retryBootstrap}>
          Try again
        </button>
      </div>
    )
  if (!auth.user)
    return (
      <Navigate
        replace
        to="/login"
        state={{ from: location.pathname + location.search + location.hash }}
      />
    )
  if (!canAccess(auth.user, roles)) return <Navigate replace to="/403" />
  return <Outlet />
}

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={null} />
        <Route
          path="login"
          element={<AccountPage key="login" mode="login" />}
        />
        <Route
          path="forgot-password"
          element={<AccountPage key="forgot" mode="forgot" />}
        />
        {routes.map((route) => (
          <Route key={route.path} element={<Guard roles={route.roles} />}>
            <Route
              path={route.path}
              element={
                route.path === '/change-password' ? (
                  <AccountPage key="change" mode="change" />
                ) : route.path === '/admin/departments' ? (
                  <DepartmentsPage />
                ) : route.path === '/admin/organizations' ? (
                  <OrganizationsPage />
                ) : route.path === '/admin/categories' ? (
                  <CategoriesPage />
                ) : route.path === '/ocr' ? (
                  <OcrPage />
                ) : route.path === '/chat' ? (
                  <ChatPage />
                ) : (
                  <Workspace title={route.label} />
                )
              }
            />
          </Route>
        ))}
        <Route path="403" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

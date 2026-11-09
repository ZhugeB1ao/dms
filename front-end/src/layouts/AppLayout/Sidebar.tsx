import Button from '../../shared/components/Button.tsx'
import { CloseIcon } from '../../shared/components/Icons.tsx'
import { NavLink } from 'react-router'
import { useAuth } from '../../features/auth/context/useAuth.ts'
import { routes, canAccess } from '../../app/router/access.ts'

export interface SidebarProps {
  mobile?: boolean
  onClose?: () => void
  collapsed?: boolean
}

export default function Sidebar({
  mobile = false,
  onClose,
  collapsed = false,
}: SidebarProps) {
  const { user } = useAuth()
  const displayName = user?.displayName?.trim() || user?.email || 'User'
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => Array.from(part)[0])
    .filter(Boolean)
  const avatar = (
    initials.length > 1
      ? `${initials[0]}${initials[initials.length - 1]}`
      : Array.from(displayName).slice(0, 2).join('')
  ).toLocaleUpperCase('en')
  const roleLabels = {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee',
  }

  function handleNavigation() {
    if (mobile && onClose) onClose()
  }

  return (
    <aside
      id={mobile ? 'mobile-sidebar' : 'desktop-sidebar'}
      className={`sidebar ${mobile ? 'sidebar--mobile' : 'sidebar--desktop'}`}
      inert={collapsed}
      aria-hidden={collapsed || undefined}
      aria-label="Sidebar"
    >
      <div className="flex min-h-16 items-center justify-between gap-4 px-5">
        <span className="brand" translate="no">
          App
        </span>
        {mobile ? (
          <Button variant="icon" aria-label="Close sidebar" onClick={onClose}>
            <CloseIcon />
          </Button>
        ) : null}
      </div>
      {user ? (
        <nav aria-label="Navigation" className="flex flex-col gap-1 px-3 py-4">
          {routes
            .filter(
              (route) =>
                route.path !== '/profile' && canAccess(user, route.roles),
            )
            .map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                onClick={handleNavigation}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'is-active' : ''}`
                }
              >
                {route.label}
              </NavLink>
            ))}
        </nav>
      ) : null}
      {user && canAccess(user, ['ADMIN', 'MANAGER', 'EMPLOYEE']) && (
        <div className="sidebar-profile-area">
          <NavLink
            to="/profile"
            onClick={handleNavigation}
            aria-label={`Personal profile: ${displayName}`}
            title={displayName}
            className={({ isActive }) =>
              `sidebar-profile${isActive ? ' is-active' : ''}`
            }
          >
            <span className="sidebar-profile-avatar" aria-hidden="true">
              {avatar}
            </span>
            <span className="sidebar-profile-copy">
              <span className="sidebar-profile-name">{displayName}</span>
              <span className="sidebar-profile-role">
                {user.roles.map((role) => roleLabels[role]).join(' · ')}
              </span>
            </span>
          </NavLink>
        </div>
      )}
    </aside>
  )
}

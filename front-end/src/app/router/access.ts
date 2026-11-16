import type { Role, RouteConfig, User } from '../../shared/types/domain.ts'

const staff: Role[] = ['MANAGER', 'EMPLOYEE']
const docRoles: Role[] = ['ADMIN', ...staff]

export const routes: RouteConfig[] = [
  { path: '/dashboard', label: 'Overview', roles: ['ADMIN', ...staff] },
  { path: '/documents', label: 'Documents', roles: docRoles },
  {
    path: '/documents/incoming',
    label: 'Incoming correspondence',
    roles: docRoles,
    showInSidebar: false,
  },
  {
    path: '/documents/outgoing',
    label: 'Outgoing correspondence',
    roles: docRoles,
    showInSidebar: false,
  },
  {
    path: '/documents/internal',
    label: 'Internal correspondence',
    roles: docRoles,
    showInSidebar: false,
  },
  { path: '/records', label: 'Records', roles: staff },
  { path: '/ocr', label: 'OCR & Documents', roles: ['ADMIN', ...staff] },
  { path: '/chat', label: 'AI Assistant', roles: ['ADMIN', ...staff] },
  { path: '/tasks', label: 'My tasks', roles: staff },
  { path: '/approvals', label: 'Pending approvals', roles: ['MANAGER'] },
  { path: '/admin/users', label: 'Users', roles: ['ADMIN'] },
  {
    path: '/profile',
    label: 'Personal profile',
    roles: ['ADMIN', ...staff],
    showInSidebar: false,
  },
  { path: '/admin/departments', label: 'Departments', roles: ['ADMIN'] },
  { path: '/admin/organizations', label: 'Organizations', roles: ['ADMIN'] },
  { path: '/admin/categories', label: 'Categories', roles: ['ADMIN'] },
  {
    path: '/change-password',
    label: 'Change password',
    roles: ['ADMIN', ...staff],
  },
]

export const canAccess = (
  user: { roles?: string[] } | User | null | undefined,
  roles: string[],
): boolean => Boolean(user?.roles?.some((role) => roles.includes(role)))

export function safeDestination(
  value: unknown,
  user: { roles?: string[] } | User | null | undefined,
): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  )
    return '/dashboard'
  const path = value.split(/[?#]/)[0]
  const detail = /^\/documents\/([1-9]\d*)$/.exec(path)
  if (
    detail &&
    Number.isSafeInteger(Number(detail[1])) &&
    canAccess(user, docRoles)
  )
    return value
  const route = routes.find((route) => route.path === path)
  return route && canAccess(user, route.roles) ? value : '/dashboard'
}

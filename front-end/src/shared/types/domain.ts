export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE'

export interface User {
  id: string
  username?: string
  email?: string
  displayName?: string
  roles: Role[]
  departmentId?: string | null
}

export interface RouteConfig {
  path: string
  label: string
  roles: Role[]
}

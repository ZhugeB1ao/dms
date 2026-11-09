import type { Role } from '../../shared/types/domain.ts'

/** Mirrors account-service `AccountResponse`. */
export interface ManagedAccount {
  id: number
  username: string
  email: string
  departmentId: number | null
  position: string | null
  role: Role
  active: boolean
  mustChangePassword: boolean
}
/** Mirrors `UpdateAccountRequest` (username cannot be changed). */
export interface AccountWrite {
  email: string
  departmentId: number
  position: string | null
  role: Role
}
/** Mirrors `CreateAccountRequest`. */
export type CreateAccountInput = AccountWrite & {
  username: string
  tempPassword: string
}
export interface AccountQuery {
  /** Zero-based, as in the API. */
  page: number
  size: 10 | 20 | 50
  departmentId?: number
  role?: Role
  active?: boolean
}
/** Mirrors `PageResponseAccountResponse`. */
export interface AccountPageResult {
  content: ManagedAccount[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
export type UserAction = 'deactivate' | 'activate' | 'resetPassword'

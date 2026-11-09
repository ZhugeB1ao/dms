import { api } from '../../../shared/api/http.ts'
import type {
  AccountQuery,
  AccountPageResult,
  AccountWrite,
  CreateAccountInput,
  ManagedAccount,
} from '../types.ts'

export const usersApi = {
  list: (params: AccountQuery, signal?: AbortSignal) =>
    api
      .get<AccountPageResult>('/accounts', { params, signal })
      .then((r) => r.data),
  create: (input: CreateAccountInput, signal?: AbortSignal) =>
    api
      .post<ManagedAccount>('/accounts', input, { signal })
      .then((r) => r.data),
  update: (id: number, input: AccountWrite, signal?: AbortSignal) =>
    api
      .put<ManagedAccount>(`/accounts/${id}`, input, { signal })
      .then((r) => r.data),
  setActive: (id: number, active: boolean, signal?: AbortSignal) =>
    api
      .patch<ManagedAccount>(`/accounts/${id}/status`, { active }, { signal })
      .then((r) => r.data),
  resetPassword: async (
    id: number,
    input: { tempPassword: string },
    signal?: AbortSignal,
  ): Promise<void> => {
    await api.post(`/accounts/${id}/reset-password`, input, { signal })
  },
  me: (signal?: AbortSignal) =>
    api.get<ManagedAccount>('/accounts/me', { signal }).then((r) => r.data),
}

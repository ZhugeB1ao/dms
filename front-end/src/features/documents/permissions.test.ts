import { expect, it } from 'vitest'
import { canViewDocument, canEditDraft, canDeleteDraft } from './permissions.ts'
import type { User } from '../../shared/types/domain.ts'

const doc = { departmentId: 2, createdBy: 3, assigneeIds: [4], status: 'DRAFT' }
it.each([
  ['ADMIN', '9', '9', true, true],
  ['MANAGER', '2', '2', true, true],
  ['MANAGER', '2', '9', false, false],
  ['EMPLOYEE', '3', '2', true, true],
  ['EMPLOYEE', '4', '2', true, false],
  ['EMPLOYEE', '8', '2', false, false],
] as const)('checks %s %s scope', (role, id, departmentId, view, edit) => {
  const user: User = { id, departmentId, roles: [role] }
  expect(canViewDocument(user, doc)).toBe(view)
  expect(canEditDraft(user, doc)).toBe(edit)
  expect(canDeleteDraft(user, doc)).toBe(edit)
  for (const status of ['READY_TO_PUBLISH', 'PUBLISHED', 'UNKNOWN']) {
    expect(canEditDraft(user, { ...doc, status })).toBe(false)
  }
})
it('denies missing users and unknown roles', () => {
  expect(canViewDocument(null, doc)).toBe(false)
  expect(canEditDraft({ id: '3', roles: [] }, doc)).toBe(false)
})
it('does not combine Manager authority with Employee assignee scope', () => {
  const user: User = {
    id: '4',
    departmentId: '9',
    roles: ['MANAGER', 'EMPLOYEE'],
  }
  expect(canViewDocument(user, doc)).toBe(true)
  expect(canEditDraft(user, doc)).toBe(false)
  expect(canDeleteDraft(user, doc)).toBe(false)
})

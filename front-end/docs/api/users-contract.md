# Account management / profile — FE proposal v0.1.0

This is a mock-first FE-owned proposal, not a backend-approved contract. OpenAPI is in `openapi-users.proposal.yaml` (JSON, valid YAML syntax, using the same JSON Schema conventions as the existing auth proposal).

All operations use `VITE_API_BASE_URL` through the shared authenticated `api` client. No component imports mock data. User management and options require ADMIN; `/users/me` allows ADMIN, MANAGER and EMPLOYEE. The actor is resolved from the token, never the request body. Existing auth endpoints and their public User schema remain unchanged.

| Operation      | Method/path                    | Response                                             |
| -------------- | ------------------------------ | ---------------------------------------------------- |
| List           | GET /users                     | 200 AccountPageResult                                |
| Create         | POST /users                    | 201 ManagedAccount                                   |
| Edit           | PUT /users/:id                 | 200 ManagedAccount                                   |
| Disable        | PATCH /users/:id/deactivate    | 200 ManagedAccount                                   |
| Reactivate     | PATCH /users/:id/activate      | 200 ManagedAccount                                   |
| Reset password | POST /users/:id/reset-password | 204, no body                                         |
| Own profile    | GET /users/me                  | 200 Profile                                          |
| Departments    | GET /departments               | 200 DepartmentOption[]                               |
| Positions      | GET /categories?type=POSITION  | 200 CategoryItem[]; client projects id/name/isActive |

List parameters: page (1-based, default 1), pageSize (10/20/50, default 10), q (trimmed, max 254), departmentId, role (ADMIN/MANAGER/EMPLOYEE), status (ACTIVE/INACTIVE). Filters combine with AND. Name/email search ignores case. Sort by email then id before slicing. Response: `{items, page, pageSize, total}`. Out-of-range pages return empty items with the correct total; UI moves to the last valid page.

ManagedAccount: id, email, displayName, roles (exactly one role in an array), departmentId (string/null), positionId (number/null), status. Profile additionally includes departmentName/positionName, each string/null. No response contains passwords, hashes or reset tokens.

Create/edit accept email, displayName, roles, departmentId and positionId. Create also requires initialPassword. Status/id are assigned by the mock, not the input. Email is trimmed/lowercased for storage and uniqueness; name is trimmed and limited to 120 characters; email max 254. MANAGER/EMPLOYEE require a department. ADMIN may have none. Position is optional and never grants permissions. An inactive option may be retained only if it is already assigned to the edited account. It cannot be newly assigned.

Create makes an ACTIVE account. Disable retains its data and revokes old access/refresh metadata. Reactivate allows a new login, never revives old sessions. Reset requires an ACTIVE account and `{newPassword}`; confirmPassword remains UI-only. It revokes the target user's sessions. Passwords are 8–128 characters and are not trimmed. Self-disable, self-role change and self-admin reset return 409; use the existing change-password page for your own password.

Error shape: `{code, message, fieldErrors?}`. 401 means unauthenticated/expired (shared refresh once then login); 403 insufficient permissions or ACCOUNT_INACTIVE at login; 404 missing target; 409 EMAIL_EXISTS, SELF_ACTION_NOT_ALLOWED or INVALID_ACCOUNT_STATE; 422 validation. 403/409 are not retried. Field errors are shown beside controls and the first error is focused once controls are re-enabled.

Mock limits: one active browser session at a time, 28 initial accounts, state/passwords only in memory and reset on reload. The original four demo credentials remain Demo12345!. Epochs invalidate restored stale synthetic metadata during the same page lifetime. This does not implement real cookies, database persistence, multi-user concurrency, password hashing or email delivery. A real backend must enforce the same authorization and lifecycle invariants.

Backend migration: compare endpoint paths/methods, paging origin, option ID types, role/status enums, error codes and reset policy. Adapt usersApi/accountOptionsApi/authApi; disable MSW and set base URL. Verify real refresh cookies, CORS/credentials/CSRF, session revocation and concurrent edits independently. Do not send category-service's demo `Bearer ADMIN` token to the real user API.

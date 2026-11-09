# Base UI

## Interface language

English is the application UI language. Use English for navigation, headings, buttons, labels, placeholders, accessibility text, validation, notifications and authored demo data. Use English locale formatting for displayed dates/times. Keep route paths, API field names and enum codes stable. Preserve user-entered names, document contents and backend business data in their original language; interface translation must not rewrite that content. Project documentation may remain Vietnamese.

## Shared dropdown

Use `src/shared/components/Select.tsx` for single-selection dropdowns in filters and forms. It accepts native select props, including `value`/`onChange`, `defaultValue`, `name`, `required`, `disabled`, `ref` and ARIA attributes. Supply a visible linked label and normal option children:

```tsx
<label htmlFor="department">Department</label>
<Select id="department" name="departmentId" defaultValue="" required>
  <option value="">Select a department</option>
  <option value="office-a">Administration</option>
</Select>
```

`Select.css` owns shared colors, focus, disabled/error states and picker styling. Override the `--select-*` tokens to theme the dropdown across pages; use `className` only for page-specific layout. Browser-native keyboard/type-ahead, validation and FormData are retained. The styled popup uses [customizable native selects](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select); browsers without support retain their native option popup. No dropdown library is required.

Picker placement prefers opening downward (`position-try-order: normal`); the browser only uses an upward fallback when the default placement cannot fit. Avoid `most-block-size`, which can choose the upper side even when there is sufficient space below. Real-browser regression coverage checks filters, pagination, create/edit account and category forms, including constrained viewport cases.

## Account management and personal profile

Admin can manage accounts at `/admin/users`: search, combined department/role/status filters, pagination, create/edit, disable/reactivate and reset password with confirmation. All three roles can view their own `/profile` and use the existing `/change-password` page. Unauthorized menus/actions are hidden or disabled and mock endpoints enforce the same role checks.

This feature uses MSW and the shared authenticated API, including department/position dropdowns; category-service is not needed for this workflow. The mock contains 28 accounts and retains the original four demo logins. New/edited accounts and passwords are in memory and reset on reload. Password reset sends no email. See [user API proposal](docs/api/users-contract.md) and [acceptance notes](docs/account-management-acceptance.md). Real backend integration is a later verification step.

## Project planning documents

- [Business analysis proposal](docs/superpowers/specs/2026-10-29-document-records-business-analysis.md): proposed document workflows and roles.
- [Frontend auth scope](docs/superpowers/specs/2026-10-29-auth-role-scope.md): the original checklist and mock-first decisions.
- [Frontend auth implementation plan](docs/superpowers/plans/2026-10-29-frontend-auth-roles.md): implementation plan and completion notes.
- [Mock acceptance notes](docs/auth-acceptance.md): verification performed on 29 October 2026 and known limitations.
- [Auth API proposal](docs/api/auth-contract.md): FE-owned contract and mock limitations.

The planning documents are historical proposals, not approved backend contracts.
For the current source structure, use the section below and the code itself.

## Source structure

- `src/app/`: app setup, routing and route access rules.
- `src/layouts/AppLayout/`: shared layout, header and sidebar.
- `src/features/auth/`: mock login pages, auth API and context, plus the separate
  `SignupDemoModal` and `SignupDemoForm` components.
- `src/pages/`: shared workspace, 403 and 404 pages.
- `src/shared/`: reusable components, HTTP client and styles.
- `src/mocks/`, `src/config/`, `src/test/`: mock API, environment and test setup.

Other feature directories and contexts can be added when the corresponding
features are implemented. State management uses React Context.

## DMS frontend foundation

React + JavaScript, Vite, Tailwind, React Router, Axios, Context and MSW.
This repository includes mock authentication and role navigation. Business pages
are placeholders; document CRUD and a real backend are not implemented.

```sh
npm ci
npm run dev
```

After installing dependencies once, `npm run dev` starts the app and mock API
together. Open `/login`. All demo accounts use **Demo12345!**:

| Email              | Role               |
| ------------------ | ------------------ |
| admin@demo.test    | Admin              |
| manager@demo.test  | Manager, office-a  |
| employee@demo.test | Employee, office-a |
| other@demo.test    | Employee, office-b |

Admin has system management menus, Manager has department work and approvals,
Employee has personal/assigned work. Admin does not inherit document permissions.
Guests are redirected to login; forbidden routes show403; unknown routes show404.

Login/forgot/change-password pages share a small form component. Signup remains
the original UI demonstration only and does not create a business account.

```sh
npm run check
npm run lint
npm run format
```

`check` runs lint (zero warnings), formatting, tests and production build.
Tests cover concurrent refresh, one-retry limits, failed refresh, stale responses,
roles, document scope, recovery and password change. See `docs/api/auth-contract.md`
and `docs/api/openapi-auth.proposal.yaml` for the FE-owned proposal, version0.1.0.
The contract is explicitly included in Git because schema tests depend on it;
other planning documents remain ignored as configured in this repository.

### Mock session and expiry demo

Access tokens stay in memory (5 minutes). Synthetic mock session metadata stays
in sessionStorage (8 hours), allowing page reload. This is not a real HttpOnly
refresh cookie. Clear site sessionStorage or close the tab to reset the mock
session. No credentials or access token are written into browser storage.

In browser DevTools on the running Vite page:

```js
const { api, authHttp } = await import('/src/shared/api/http.js')
await authHttp.post('/demo/session', { scenario: 'access-expired' })
await api.get('/demo/documents/a') // refresh then retry (employee/manager office-a)
await api.get('/demo/documents/b') // 403 for office-a accounts
await authHttp.post('/demo/session', { scenario: 'refresh-expired' })
await api.get('/demo/documents/a') // session cleared; redirected to login
```

Forgot-password sends no real email. Changing a mock password revokes the current
session; the changed demo password lasts until page reload, after which fixtures
reset to Demo12345!. This mock is not persistent user/password storage.

### Connecting a future backend

Copy `.env.example` to `.env.local`, set `VITE_ENABLE_MOCKS=false` and
`VITE_API_BASE_URL` to the real API, then restart Vite. Map schema differences in
`src/features/auth/api/authApi.js`; UI and route guards keep using the same interface.
Production never starts MSW. Configure hosting to serve index.html for frontend
routes, without rewriting API or asset URLs. Verify real cookie HttpOnly/Secure/
SameSite, CORS and CSRF behavior with the backend separately. No real backend
integration has been claimed or tested.

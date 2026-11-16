# FE-3 acceptance — 15 November 2026

Branch: `feature/fe3-document-drafts`; base `ccc2f84`. Implementation is uncommitted. Mode: development MSW, English UI. Real BE-3/FS-3 integration remains pending.

## Implemented

- Incoming, Outgoing, Internal lists with API status/type/department filters, URL state, 10/20/50 paging and clamp after deleting the final row.
- Draft/Ready to publish/Published badges, Unknown fallback, scope and state based actions.
- Create/edit form with native validation, field errors, active lookups, preserved inactive selections, staff department and Admin department selection.
- Shared CrudFormDialog and ConfirmDeactivateDialog reused; pending closes guarded, custom Delete labels, lookup-dependent submit lock.
- DELETE confirmation/version handling; conflicts preserve the document and require reload.
- Deep-linked detail with keyboard-accessible Information, Attachments and Status history tabs. Attachment metadata only; file operations explicitly unavailable.
- Admin access to all registered routes and document departments; Manager/Employee scopes checked independently by MSW.

## Automated verification

TDD red/green recorded for permissions, API/HTTP contract, shared dialog behavior, Admin route access, page/form/delete/detail behavior, stale status, unavailable URL filters and unknown status rendering. Baseline before FE-3: 15 files, 78 tests passed.

Final `npm run check` on 15/11/2026: **27 files, 124 tests passed**; ESLint with zero warnings, Prettier, TypeScript and production build all passed. `git diff --check` also passed. No new dependencies.

Independent code review found mixed-role mutation scope, aborted action loading state, hidden unavailable filters and unsafe unknown status keys. Each was reproduced, fixed and rechecked. Browser QA additionally found focus loss from a disabled list trigger; actions now use guarded aria-disabled while fetching detail. API field focus runs after the pending fieldset becomes enabled. Mobile detail actions were moved below the title and the table retains its own horizontal scroll area.

## Browser QA

Playwright CLI, local Vite at 127.0.0.1:5174, MSW enabled in the process environment. Verified:

- Admin create via all required fields; list receives new row; edit changes summary; delete from detail returns to list and decrements total.
- Escape closes an idle edit dialog and returns focus to the exact table trigger. Shared tests cover all pending close paths and double submit; browser tabs support ArrowRight/Home/End.
- Information/history/attachment metadata; no file-operation success simulated.
- Back/Forward restores status filter URL and selected option; verified again after restarting the mock worker.
- Desktop 1366×768 and 1920×1080; mobile 390×844. List/detail document width equals viewport width (390px); only the table scrolls horizontally.
- During source edits/HMR, the mock worker intermittently bypassed requests and Vite returned 502. Reloading the page restored interception; create/edit/delete were verified after reload. The public worker matches installed MSW 3.0.3. No claim of an underlying MSW fix.

Screenshots are local ignored QA artifacts in `output/playwright/fe3-*.png` at repository root.

## GitNexus and review scope

Runner `node .gitnexus/run.cjs analyze --index-only` completed: 3,178 nodes, 6,644 edges, 202 flows. New source files were exposed to diff using intent-to-add; no content is staged and no commit/push was made.

Final MCP `detect_changes({repo:'docs',scope:'all'})`: **36 files, 232 symbols, 16 affected flows, risk critical**, with no partial/truncated flag in that result. Affected areas include document list/detail/form, independent mock authorization/reset, shared dialogs, AppRouter and login destination/role checks. Shared dialog callers include CategoriesPage, DepartmentsPage, OrganizationsPage and DocumentFormDialog; the full regression suite passed.

Index limitation: its process builder separately warns of 10 dropped entry-point candidates, 293 branches omitted and one bounded walk. Rebuilding retained those built-in limits. Therefore this report is not proof that every execution path is covered; source review and tests supplement UNKNOWN/missing graph edges. No installed tool files were modified to suppress warnings.

## Integration blockers

- BE-3 OpenAPI/controller not present in this checkout: real endpoints, permissions, validation, version conflicts and durable deletion not verified.
- FS-3 file area absent: upload/download/remove and file cleanup on document deletion not implemented or verified.
- Mock data resets on browser reload. Set `VITE_ENABLE_MOCKS=true` and restart Vite for the demo; `.env` was left unchanged.

See [documents contract](api/documents-contract.md) for handoff details. Passing mock checks means the mock milestone is ready; it does not mean the full integrated FE-3 ticket is complete.

## Documents sidebar consolidation — 15 November 2026

Implemented the [navigation plan](superpowers/plans/2026-11-15-documents-sidebar-consolidation.md): one Documents menu entry, `/documents` redirects to Incoming with replace while preserving query/hash. Existing direction and detail routes, role checks, filters and paging remain available. Optional `showInSidebar` metadata controls presentation only; profile remains outside the menu.

- Scope: four production files and three existing test files; no new dependency, page or component.
- TDD: baseline 16 navigation tests; new redirect and menu assertions failed before implementation. Final targeted run: 32 tests passed.
- Final `npm run check`: 28 files, 141 tests passed; lint, formatting, TypeScript and production build passed. The first full run caught an unsupported RTL query option in new tests; removed it and reran the complete check successfully.
- Independent review of the incremental seven-file diff: no findings.
- Browser with MSW: desktop 1366×768 and mobile 390×844; one Documents entry, all three tabs, detail active state, mobile drawer closes after selecting Documents, Back/Forward restores status filter. Screenshots: ignored `output/playwright/sidebar-documents-desktop.png` and `sidebar-documents-mobile.png` at repository root.
- Refreshed GitNexus index at 15:02 UTC. Final `detect_changes(scope: all)`: 44 files, 252 symbols, 21 affected flows, risk critical; no partial/truncated flag. This includes all pre-existing FE-3 and unrelated workspace edits, not only sidebar consolidation. The process-builder coverage limitations documented above still apply; graph results are supplemented by source review and tests.

No commit/push. Existing backend/file-service integration blockers remain unchanged.

# Frontend Alias Imports — Branch, Commit and Push Plan

> **For agentic workers:** Use executing-plans to execute this plan task by task. This document is a plan only; creating the branch, editing source, committing and pushing are subsequent execution steps.

**Goal:** Publish the current frontend alias migration and sidebar improvements on a new remote branch, after fixing the reviewed keyboard focus regression.

**Architecture:** Branch from the current FE-3 branch so existing document features remain available. Keep the current alias configuration and use native React refs/DOM focus for the sidebar correction. Publish one coherent commit containing the reviewed frontend changes, regression fix, tests and this plan.

**Tech Stack:** Git, PowerShell, React, TypeScript, Vite, Vitest, React Testing Library, Playwright, GitNexus. No new dependencies.

**Spec:** [Publication specification](#spec) in this document; user request dated 2026-11-17 and the preceding code review.

## Spec

- Starting branch: feature/fe3-document-drafts, HEAD a2333e73a3699f7b2a6d07246a083a989b06f6e5.
- Cached upstream: origin/feature/fe3-document-drafts; ahead/behind was 0/0 when this plan was written. Recheck against the remote at execution time.
- Proposed new branch: refactor/frontend-alias-imports. No matching local/cached remote branch was found; verify remotely before creating it.
- Scope: the current 93 tracked frontend file changes (293 alias imports, 2 configuration files, sidebar/navigation changes and account-page cleanup), the P2 focus correction, its tests and this plan.
- Exclude the 8 untracked .playwright-mcp/ logs/snapshots/images, ignored output/, build output, node_modules, secrets and unrelated work.
- Commit title: refactor(frontend): adopt alias imports and improve sidebar navigation
- Push the new branch to origin and set its upstream. A PR is not part of this execution; if requested later, its initial base should be feature/fe3-document-drafts because the new branch inherits FE-3 commits.

## Global Constraints

- Use the user's existing Git author and committer identity (configured user.name: huytran130405). Do not replace Git identity or author/committer environment values with an assistant identity.
- Do not add an assistant name, signature, attribution footer, Co-authored-by or Signed-off-by trailer to the commit or any future PR description. Do not use --signoff. Preserve any existing cryptographic signing configuration belonging to the user.
- Preserve all existing work. Do not force-push, reset/clean the workspace, or bypass hooks.
- Stage explicit reviewed paths; do not use git add . or git add -A.
- Before editing existing symbols: upstream impact plus context; confirm UNKNOWN with source reference searches and warn about HIGH/CRITICAL risk.
- Before committing: npm run check and GitNexus detect-changes must run successfully, with no unresolved partial/truncated report. A high graph risk is reviewed and documented, not treated as a test failure or an all-clear.
- Follow front-end/AGENTS.md for source edits. Execution includes the proposed P2 fix only when the user assigns this plan for implementation; this plan itself does not edit source.

## Review Focus

1. Keyboard: closing focuses the replacement Open sidebar button; opening focuses the visible sidebar control, never BODY or an inert node.
2. Mobile: the native dialog still restores focus to its opener after Escape/close; resizing to desktop closes the mobile dialog.
3. Imports: TypeScript, Vitest and production build continue resolving @/ to src, including CSS/JSON/dynamic imports.
4. Commit content: only the approved frontend paths and this plan are staged; the existing .playwright-mcp/ artifacts remain untracked.
5. Publication: branch ancestry is retained, author/committer are the user, no attribution trailers appear, and the remote branch SHA equals local HEAD.

## Task 1 — Confirm scope and create the branch

**Files:** Read Git state and the current diff; no source changes.
**Interfaces:** Consumes the working tree above; produces a new branch with the same base SHA and unchanged working files.

- [ ] Run git status --short, git diff --cached, git diff HEAD --stat and git diff HEAD --name-only. Record the reviewed file list before any edits; inspect unexpected differences instead of including them automatically.
- [ ] Run git var GIT_AUTHOR_IDENT and git var GIT_COMMITTER_IDENT. Expected: the user's identity for both; do not alter identity to make the check pass.
- [ ] Run git fetch origin, then compare HEAD and origin/feature/fe3-document-drafts. Expected: the recorded base still applies. If the upstream moved, inspect the divergence before deciding whether any integration is needed; do not rebase a dirty tree automatically.
- [ ] Run git ls-remote --heads origin refactor/frontend-alias-imports and git branch --list refactor/frontend-alias-imports. Expected: neither exists. If occupied, select an unused suffixed branch name and use that same name throughout the remaining steps.
- [ ] Run git switch -c refactor/frontend-alias-imports. Expected: the new branch points at the same HEAD and preserves the full dirty diff.

## Task 2 — Fix the reviewed desktop focus regression with TDD

**Files:** Modify front-end/src/layouts/AppLayout/AppLayout.tsx, Header.tsx, Sidebar.tsx and front-end/src/shared/components/Button.tsx only as needed; extend front-end/src/layouts/AppLayout/Sidebar.test.tsx.
**Interfaces:** Consumes the new branch and current sidebar callbacks; produces focus-safe desktop toggling without changing mobile dialog behavior or route permissions.

- [ ] Run GitNexus context/upstream impact on AppLayout, Header and Sidebar. Text-search their JSX consumers for UNKNOWN results. Existing caller chain: AppRouter renders AppLayout, which renders Header and both Sidebar variants; graph JSX caller coverage can be incomplete.
- [ ] RED: add keyboard regression assertions to Sidebar.test.tsx. With a desktop route rendered, focus Close sidebar and activate via Enter; expect Open sidebar to have focus after collapse. Activate Open sidebar via Enter; expect the visible desktop Close sidebar control to have focus. Exercise Space activation as well. Verify collapsed sidebar links cannot receive focus.
- [ ] Run npm test -- src/layouts/AppLayout/Sidebar.test.tsx from front-end/. Expected before the fix: focus assertions fail. jsdom does not fully implement inert/visibility, so validate the browser-only behavior in the Playwright step too.
- [ ] GREEN: keep focus ownership in AppLayout; use native React refs for the two replacement controls and focus the correct visible element after the desktop state update. Preserve the existing mobile showModal/close path. Add no helper framework or dependency.
- [ ] Repeat the focused test command. Expected: all sidebar assertions pass.
- [ ] Use the installed Playwright tooling against a local mock-enabled dev server: desktop Enter/Space collapse/open must keep focus on the replacement control; mobile open/Escape must restore the opener; crossing to desktop must close the mobile dialog. Store probes/screenshots under ignored output/, outside the commit.

## Task 3 — Validate, stage and commit

**Files:** The approved tracked frontend changes, the Task 2 changes and this plan.
**Interfaces:** Consumes validated working files; produces one reviewed local commit.

- [ ] From front-end/, run npm run check. Expected: zero lint warnings, formatting passes, all tests pass and production build succeeds. The pre-fix baseline had 145 passing tests; use the actual new total after regression coverage is added.
- [ ] From the repository root, run node .gitnexus/run.cjs detect-changes --scope all --repo docs. Also inspect the full MCP report if CLI listing is shortened. Expected: successful analysis without partial/truncated flags. Inspect touched flows; if index recovery is required, use the documented index-only workflow and rerun the check before committing.
- [ ] Run git diff --check and review the entire final diff against the recorded scope. Expected: no whitespace errors, no unrelated modifications, and the P2 finding resolved.
- [ ] Stage existing reviewed files and this exact plan path:

```powershell
git add -u -- front-end/src front-end/vite.config.ts front-end/tsconfig.app.json
git add -- front-end/docs/superpowers/plans/2026-11-17-publish-frontend-alias-imports.md
```

- [ ] Run git diff --cached --name-status, git diff --cached --check and git diff --cached. Expected: only the approved file list plus this plan; no .playwright-mcp/, output/, secrets or other source changes. Keep all regression tests green after any adjustments.
- [ ] Create the commit with the configured user identity and no attribution:

```powershell
git commit -m 'refactor(frontend): adopt alias imports and improve sidebar navigation'
```

- [ ] Inspect git log -1 --format=fuller and git log -1 --format=%B. Expected: the user's Author/Committer and no assistant attribution or signature trailer. If a hook inserts one, resolve that before pushing; do not bypass hooks or publish it silently.
- [ ] Inspect git status --short and git diff --exit-code -- front-end/src front-end/vite.config.ts front-end/tsconfig.app.json. Expected: no unpublished tracked frontend edits; preexisting .playwright-mcp/ artifacts may remain untracked. Resolve unexpected hook changes before proceeding.

## Task 4 — Push and verify remote publication

**Files:** Git references only; no application edits.
**Interfaces:** Consumes the reviewed commit; produces a matching origin branch and configured upstream.

- [ ] Run git push -u origin refactor/frontend-alias-imports, using the actual branch name selected in Task 1. Expected: the branch is published without force.
- [ ] Compare git rev-parse HEAD with git ls-remote --heads origin refactor/frontend-alias-imports. Expected: identical commit SHA.
- [ ] Run git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'. Expected: origin/refactor/frontend-alias-imports (or the selected unused name).
- [ ] Report the final branch, commit SHA, push result and actual check results. Include any remaining untracked artifacts. Any future PR title/body must describe the code and validation without assistant signatures or attribution.

## Completion criteria

- [ ] Desktop P2 focus issue is fixed and empirically verified; mobile behavior remains working.
- [ ] Required checks and staged diff review are complete.
- [ ] The new branch exists on origin with exactly the verified local commit.
- [ ] Commit metadata uses the user's identity; neither commit text nor any future PR description contains assistant attribution.

## Implementation notes

The focus fix also updates ButtonProps to the native React 19 ComponentPropsWithRef type and corrects the sidebar visibility transition in shared/styles/styles.css: opening is visible immediately, while closing hides visibility after its exit animation. Existing slow-login timing test failed once under load and passed independently; final full checks must be green before publication.

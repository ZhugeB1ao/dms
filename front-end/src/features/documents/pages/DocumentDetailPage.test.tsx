import { expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { documentStore } from '@/mocks/documents.ts'
import { documentServer, renderDocumentRoute } from '@/test/documentFeature.tsx'

it('loads a deep link, navigates tabs by keyboard and keeps published documents read-only', async () => {
  await renderDocumentRoute('/documents/3')
  const user = userEvent.setup()
  const information = await screen.findByRole('tab', { name: 'Information' })
  expect(screen.queryByRole('button', { name: 'Edit draft' })).toBeNull()
  information.focus()
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('tab', { name: 'Attachments' })).toHaveFocus()
  await screen.findByText('Sample document.pdf')
  expect(screen.getByText(/This document is read-only\./)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Preview' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Download' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Versions' })).toBeVisible()
  expect(screen.queryByLabelText(/Upload attachment/i)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  await user.keyboard('{End}')
  expect(screen.getByRole('tab', { name: 'Status history' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await screen.findByRole('list', { name: 'Status history' })
  await user.keyboard('{Home}')
  expect(screen.getByRole('tab', { name: 'Information' })).toHaveFocus()
})
it.each([
  ['/documents/9999', 'admin', /no longer exists/],
  ['/documents/2', 'employee', /permission/],
])('handles inaccessible detail %s as %s', async (path, username, message) => {
  await renderDocumentRoute(path, username)
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(screen.queryByRole('tab')).toBeNull()
})
it('displays Record as link for staff, plain text for admin, None when null, and fetches fallback when dossier summary omitted', async () => {
  const staffView = await renderDocumentRoute('/documents/7', 'employee')
  expect(
    await screen.findByRole('link', { name: /HS-2026-01 — Recruitment 2026/ }),
  ).toHaveAttribute('href', '/records/1')
  staffView.unmount()

  const adminView = await renderDocumentRoute('/documents/7', 'admin')
  expect(await screen.findByText(/HS-2026-01 — Recruitment 2026/)).toBeVisible()
  expect(screen.queryByRole('link', { name: /HS-2026-01/ })).toBeNull()
  adminView.unmount()

  const unattachedView = await renderDocumentRoute('/documents/3', 'admin')
  await screen.findByRole('heading', { name: 'Incoming document 3' })
  expect(screen.getByText('Record').closest('div')).toHaveTextContent('None')
  unattachedView.unmount()

  documentServer.use(
    http.get('/api/documents/7', () =>
      HttpResponse.json({
        ...documentStore.documents[6],
        dossier: null,
      }),
    ),
  )
  await renderDocumentRoute('/documents/7', 'employee')
  expect(
    await screen.findByRole('link', { name: /HS-2026-01 — Recruitment 2026/ }),
  ).toHaveAttribute('href', '/records/1')
})

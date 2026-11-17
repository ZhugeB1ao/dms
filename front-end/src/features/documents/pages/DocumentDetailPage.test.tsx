import { expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderDocumentRoute } from '@/test/documentFeature.tsx'

it('loads a deep link, navigates tabs by keyboard and keeps published documents read-only', async () => {
  await renderDocumentRoute('/documents/3')
  const user = userEvent.setup()
  const information = await screen.findByRole('tab', { name: 'Information' })
  expect(screen.queryByRole('button', { name: 'Edit draft' })).toBeNull()
  information.focus()
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('tab', { name: 'Attachments' })).toHaveFocus()
  await screen.findByText('Sample document.pdf')
  await screen.findByText(/File upload and download are not available yet/)
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

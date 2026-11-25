import { expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAccountRoute } from '@/test/userFeature.tsx'
import { MemoryRouter } from 'react-router'
import { authHttp, session } from '@/shared/api/http.ts'
import AuthProvider from '@/features/auth/context/AuthProvider.tsx'
import Sidebar from '@/layouts/AppLayout/Sidebar.tsx'

it('places the desktop close button inside the sidebar and supports reopening', async () => {
  await renderAccountRoute('/dashboard')
  const sidebar = await screen.findByRole('complementary', { name: 'Sidebar' })
  const close = within(sidebar).getByRole('button', { name: 'Close sidebar' })
  expect(
    within(screen.getByRole('banner')).queryByRole('button', {
      name: 'Close sidebar',
    }),
  ).toBeNull()
  await userEvent.click(close)
  expect(sidebar).toHaveAttribute('aria-hidden', 'true')
  const open = screen
    .getAllByRole('button', { name: 'Open sidebar' })
    .find(
      (button) => button.getAttribute('aria-controls') === 'desktop-sidebar',
    )!
  await userEvent.click(open)
  expect(sidebar).not.toHaveAttribute('aria-hidden')
  expect(
    within(sidebar).getByRole('button', { name: 'Close sidebar' }),
  ).toBeVisible()
})

it('opens the read-only profile from the identity card outside the menu', async () => {
  await renderAccountRoute('/dashboard')
  const sidebar = await screen.findByRole('complementary', { name: 'Sidebar' })
  const card = within(sidebar).getByRole('link', { name: /Personal profile/ })
  expect(card).toHaveTextContent('admin')
  expect(card).toHaveTextContent('Admin')
  expect(within(sidebar).getByRole('navigation')).not.toContainElement(card)
  await userEvent.click(card)
  const profile = await screen.findByRole('region', {
    name: 'Personal profile',
  })
  expect(await within(profile).findByText('admin@demo.test')).toBeVisible()
  expect(within(profile).queryByRole('textbox')).toBeNull()
})

it.each(['admin', 'manager', 'employee'])(
  'shows one Documents entry for %s and opens Incoming',
  async (username) => {
    await renderAccountRoute('/dashboard', username)
    const nav = within(
      await screen.findByRole('navigation', { name: 'Navigation' }),
    )
    const links = nav.getAllByRole('link', { name: 'Documents' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/documents')
    expect(
      nav.queryByRole('link', {
        name: /^(Incoming|Outgoing|Internal) correspondence$/,
      }),
    ).toBeNull()
    await userEvent.click(links[0])
    expect(
      await screen.findByRole('heading', { name: 'Incoming documents' }),
    ).toBeVisible()
  },
)

it.each([
  ['/documents/incoming', true],
  ['/documents/outgoing', true],
  ['/documents/internal', true],
  ['/documents/1', true],
  ['/records', false],
  ['/ocr', false],
  ['/documents-other', false],
] as const)('matches Documents active state at %s', async (path, active) => {
  await renderAccountRoute(path)
  const nav = within(
    await screen.findByRole('navigation', { name: 'Navigation' }),
  )
  const link = nav.getByRole('link', { name: 'Documents' })
  if (active) {
    expect(link).toHaveClass('is-active')
    expect(link).toHaveAttribute('aria-current', 'page')
  } else {
    expect(link).not.toHaveClass('is-active')
    expect(link).not.toHaveAttribute('aria-current')
  }
})

it('closes the mobile sidebar when choosing Documents and keeps profile separate', async () => {
  const { data } = await authHttp.post('/auth/login', {
    username: 'admin',
    password: 'Demo12345!',
  })
  session.set(data.accessToken, data.refreshToken)
  const onClose = vi.fn()
  render(
    <MemoryRouter initialEntries={['/documents/internal']}>
      <AuthProvider>
        <Sidebar mobile onClose={onClose} />
      </AuthProvider>
    </MemoryRouter>,
  )
  const nav = await screen.findByRole('navigation', { name: 'Navigation' })
  expect(within(nav).getAllByRole('link', { name: 'Documents' })).toHaveLength(
    1,
  )
  expect(nav).not.toContainElement(
    screen.getByRole('link', { name: /Personal profile/ }),
  )
  await userEvent.click(within(nav).getByRole('link', { name: 'Documents' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

it.each(['{Enter}', ' '])(
  'keeps focus on the visible desktop toggle with %s',
  async (key) => {
    await renderAccountRoute('/dashboard')
    const sidebar = await screen.findByRole('complementary', {
      name: 'Sidebar',
    })
    const close = within(sidebar).getByRole('button', { name: 'Close sidebar' })
    close.focus()
    await userEvent.keyboard(key)
    const open = screen
      .getAllByRole('button', { name: 'Open sidebar' })
      .find(
        (button) => button.getAttribute('aria-controls') === 'desktop-sidebar',
      )!
    await waitFor(() => expect(open).toHaveFocus())
    expect(sidebar).toHaveAttribute('inert')
    await userEvent.keyboard(key)
    await waitFor(() => expect(close).toHaveFocus())
    expect(sidebar).not.toHaveAttribute('inert')
  },
)

import { expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import {
  renderAccountRoute,
  featureServer,
} from '../../../test/userFeature.tsx'

it.each(['admin', 'manager', 'employee'])(
  'shows only the authenticated profile for %s',
  async (username) => {
    await renderAccountRoute('/profile', username)
    const profile = within(
      await screen.findByRole('region', { name: 'Personal profile' }),
    )
    expect(await profile.findByText(`${username}@demo.test`)).toBeVisible()
    expect(
      profile.getByRole('link', { name: 'Change password' }),
    ).toHaveAttribute('href', '/change-password')
    expect(profile.queryByRole('textbox')).toBeNull()
  },
)
it.each(['manager', 'employee'])(
  'denies management route and hides its menu for %s',
  async (username) => {
    await renderAccountRoute('/admin/users', username)
    expect(await screen.findByRole('heading', { name: /403/ })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Users' })).toBeNull()
  },
)
it('changes password and preserves the success message on the login destination', async () => {
  const user = userEvent.setup()
  await renderAccountRoute('/change-password', 'employee')
  const form = within(
    await screen.findByRole('region', { name: 'Change password' }),
  )
  await user.type(form.getByLabelText('Current password'), 'Demo12345!')
  await user.type(form.getByLabelText('New password'), 'Next12345!')
  await user.type(form.getByLabelText('Confirm password'), 'Next12345!')
  await user.click(form.getByRole('button', { name: 'Change password' }))
  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeVisible()
  expect(
    screen.getByText('Password changed successfully. Please log in again.'),
  ).toBeVisible()
})
it('does not display a delayed profile after logging out', async () => {
  let started!: () => void
  const pending = new Promise<void>((resolve) => {
    started = resolve
  })
  const employee = {
    id: 3,
    username: 'employee',
    email: 'employee@demo.test',
    departmentId: 1,
    position: null,
    role: 'EMPLOYEE',
    active: true,
    mustChangePassword: false,
  }
  // The first call restores the session; the second one is the profile page.
  featureServer.use(
    http.get(
      'http://localhost/api/accounts/me',
      () => HttpResponse.json(employee),
      { once: true },
    ),
    http.get(
      'http://localhost/api/accounts/me',
      async () => {
        started()
        await delay(150)
        return HttpResponse.json({
          ...employee,
          email: 'private-old@demo.test',
        })
      },
      { once: true },
    ),
  )
  await renderAccountRoute('/profile', 'employee')
  await pending
  await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
  await screen.findByRole('heading', { name: 'Log in' })
  await new Promise((r) => setTimeout(r, 200))
  expect(screen.queryByText('private-old@demo.test')).toBeNull()
})

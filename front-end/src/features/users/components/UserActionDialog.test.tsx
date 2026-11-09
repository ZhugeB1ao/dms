import { expect, it } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import {
  renderAccountRoute,
  featureServer,
} from '../../../test/userFeature.tsx'
import { authHttp } from '../../../shared/api/http.ts'

it('cancels without disabling and confirms the real lifecycle operation', async () => {
  const user = userEvent.setup()
  await renderAccountRoute()
  const row = await screen.findByRole('row', { name: /employee@demo.test/ })
  const trigger = within(row).getByRole('button', { name: 'Deactivate' })
  await user.click(trigger)
  const dialog = within(
    await screen.findByRole('dialog', { name: 'Deactivate account' }),
  )
  expect(dialog.getByText(/employee@demo.test/)).toBeVisible()
  await user.click(dialog.getByRole('button', { name: 'Cancel' }))
  expect(trigger).toHaveFocus()
  expect(within(row).getByText('Active')).toBeVisible()
  await user.click(trigger)
  await user.click(
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Confirm',
    }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const updated = await screen.findByRole('row', { name: /employee@demo.test/ })
  expect(
    within(updated).getByRole('button', { name: 'Reactivate' }),
  ).toBeVisible()
  await expect(
    authHttp.post('/auth/login', {
      username: 'employee',
      password: 'Demo12345!',
    }),
  ).rejects.toMatchObject({ response: { status: 401 } })
})
it('requires matching passwords for reset and accepts only the new password afterwards', async () => {
  const user = userEvent.setup()
  await renderAccountRoute()
  await user.click(
    within(
      await screen.findByRole('row', { name: /employee@demo.test/ }),
    ).getByRole('button', { name: 'Reset password' }),
  )
  const dialog = within(
    await screen.findByRole('dialog', { name: 'Reset password' }),
  )
  await user.type(dialog.getByLabelText('Temporary password'), 'Reset12345!')
  await user.type(dialog.getByLabelText('Confirm password'), 'Different123!')
  await user.click(dialog.getByRole('button', { name: 'Confirm' }))
  expect(await dialog.findByText('Passwords do not match.')).toBeVisible()
  await user.clear(dialog.getByLabelText('Confirm password'))
  await user.type(dialog.getByLabelText('Confirm password'), 'Reset12345!')
  await user.click(dialog.getByRole('button', { name: 'Confirm' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await expect(
    authHttp.post('/auth/login', {
      username: 'employee',
      password: 'Demo12345!',
    }),
  ).rejects.toMatchObject({ response: { status: 401 } })
  expect(
    (
      await authHttp.post('/auth/login', {
        username: 'employee',
        password: 'Reset12345!',
      })
    ).status,
  ).toBe(200)
})
it.each([403, 400])(
  'keeps the confirmation open and reports a failed action with status %s',
  async (status) => {
    const user = userEvent.setup()
    await renderAccountRoute()
    featureServer.use(
      http.patch('http://localhost/api/accounts/3/status', () =>
        HttpResponse.json(
          { code: 'FAILED', message: 'The account could not be updated.' },
          { status },
        ),
      ),
    )
    await user.click(
      within(
        await screen.findByRole('row', { name: /employee@demo.test/ }),
      ).getByRole('button', { name: 'Deactivate' }),
    )
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Confirm' }))
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      status === 403
        ? 'You do not have permission'
        : 'The account could not be updated.',
    )
    expect(screen.queryByText('Action completed successfully.')).toBeNull()
  },
)
it('sends only one mutation when confirmation is clicked twice rapidly', async () => {
  let requests = 0
  featureServer.use(
    http.patch('http://localhost/api/accounts/3/status', async () => {
      requests++
      await delay(100)
      return HttpResponse.json({
        id: 3,
        username: 'employee',
        email: 'employee@demo.test',
        departmentId: 1,
        position: null,
        role: 'EMPLOYEE',
        active: false,
        mustChangePassword: false,
      })
    }),
  )
  const user = userEvent.setup()
  await renderAccountRoute()
  await user.click(
    within(
      await screen.findByRole('row', { name: /employee@demo.test/ }),
    ).getByRole('button', { name: 'Deactivate' }),
  )
  await user.dblClick(
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Confirm',
    }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(requests).toBe(1)
})

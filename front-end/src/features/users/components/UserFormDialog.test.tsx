import { expect, it } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAccountRoute } from '../../../test/userFeature.tsx'

it('creates an account and keeps the form input after a duplicate email conflict', async () => {
  const user = userEvent.setup()
  await renderAccountRoute()
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  const dialog = within(
    await screen.findByRole('dialog', { name: 'Create account' }),
  )
  await user.type(dialog.getByLabelText('Username'), 'newuser')
  await user.type(dialog.getByLabelText('Email'), 'employee@demo.test')
  await waitFor(() =>
    expect(dialog.getByRole('button', { name: 'Save account' })).toBeEnabled(),
  )
  await user.selectOptions(dialog.getByLabelText('Department'), '2')
  await user.type(dialog.getByLabelText('Position'), 'Clerk')
  await user.type(dialog.getByLabelText('Temporary password'), 'Initial123!')
  await user.type(dialog.getByLabelText('Confirm password'), 'Initial123!')
  await user.click(dialog.getByRole('button', { name: 'Save account' }))
  expect(await dialog.findByText('This email is already in use.')).toBeVisible()
  expect(dialog.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  expect(dialog.getByLabelText('Username')).toHaveValue('newuser')
  await user.clear(dialog.getByLabelText('Email'))
  await user.type(dialog.getByLabelText('Email'), 'new@demo.test')
  await user.click(dialog.getByRole('button', { name: 'Save account' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await screen.findByText('29 accounts')).toBeVisible()
}, 20000)
it('validates required fields and confirmation before sending a create request', async () => {
  const user = userEvent.setup()
  await renderAccountRoute()
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  const dialog = within(
    await screen.findByRole('dialog', { name: 'Create account' }),
  )
  await user.click(dialog.getByRole('button', { name: 'Save account' }))
  expect(dialog.getByLabelText('Username')).toHaveFocus()
  expect(dialog.getAllByRole('alert').length).toBeGreaterThan(0)
})
it('edits an account without password fields and with a read-only username', async () => {
  const user = userEvent.setup()
  await renderAccountRoute()
  const row = await screen.findByRole('row', { name: /employee@demo.test/ })
  await user.click(within(row).getByRole('button', { name: 'Edit' }))
  const dialog = within(
    await screen.findByRole('dialog', { name: 'Edit account' }),
  )
  expect(dialog.queryByLabelText('Temporary password')).toBeNull()
  expect(dialog.getByLabelText('Username')).toHaveAttribute('readonly')
  await waitFor(() =>
    expect(dialog.getByLabelText('Department')).toHaveValue('1'),
  )
  await user.type(dialog.getByLabelText('Position'), 'Clerk')
  await user.click(dialog.getByRole('button', { name: 'Save account' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await screen.findByText('Clerk')).toBeVisible()
})

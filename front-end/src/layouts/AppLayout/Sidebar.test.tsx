import { expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAccountRoute } from '../../test/userFeature.tsx'

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

import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import DocumentStatusBadge from '@/features/documents/components/DocumentStatusBadge.tsx'

it.each(['ARCHIVED', '__proto__', 'constructor'])(
  'treats unknown status %s as read-only Unknown',
  (status) => {
    render(<DocumentStatusBadge status={status} />)
    expect(screen.getByText('Unknown')).toBeVisible()
  },
)

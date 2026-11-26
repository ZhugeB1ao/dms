import type { ComponentProps } from 'react'
import { CrudFormDialog } from '@/shared/components/CrudPageLayout.tsx'
import FormField from '@/shared/components/FormField.tsx'

export default function WorkflowReasonDialog({
  reasonError,
  documentNumber,
  ...form
}: Omit<ComponentProps<typeof CrudFormDialog>, 'children'> & {
  reasonError?: string
  documentNumber?: string
}) {
  return (
    <CrudFormDialog {...form} danger>
      {documentNumber && <p>Document number {documentNumber}</p>}
      <FormField name="reason" label="Reason" error={reasonError} required>
        <textarea
          id="reason"
          name="reason"
          rows={4}
          required
          autoFocus
          aria-invalid={Boolean(reasonError)}
          aria-describedby={reasonError ? 'reason-error' : undefined}
        />
      </FormField>
      <p className="text-sm text-neutral-400">
        Your reason will be recorded in the status history.
      </p>
    </CrudFormDialog>
  )
}

import { useCallback, type ComponentProps } from 'react'
import { CrudFormDialog } from '@/shared/components/CrudPageLayout.tsx'
import Button from '@/shared/components/Button.tsx'
import FormField from '@/shared/components/FormField.tsx'
import Select from '@/shared/components/Select.tsx'
import { useFetch } from '@/shared/hooks/useFetch.ts'
import { documentWorkflowApi } from '@/features/documents/api/documentWorkflowApi.ts'
import { documentError } from '@/features/documents/api/documentErrors.ts'

export default function SubmitForApprovalDialog({
  documentId,
  reviewerError,
  ...form
}: Omit<ComponentProps<typeof CrudFormDialog>, 'children'> & {
  documentId: number
  reviewerError?: string
}) {
  const { data, loading, error, retry } = useFetch(
    useCallback(
      (signal: AbortSignal) =>
        documentWorkflowApi.reviewers(documentId, signal),
      [documentId],
    ),
  )
  return (
    <CrudFormDialog
      {...form}
      submitDisabled={form.submitDisabled || !data?.length}
    >
      {loading && <p role="status">Loading reviewers…</p>}
      {error !== undefined && (
        <p role="alert">
          {documentError(error).message}{' '}
          <Button onClick={retry}>Retry reviewers</Button>
        </p>
      )}
      {data?.length === 0 && <p>No eligible reviewers for this document.</p>}
      {!!data?.length && (
        <FormField
          name="reviewerId"
          label="Reviewer"
          error={reviewerError}
          required
        >
          <Select
            id="reviewerId"
            name="reviewerId"
            required
            autoFocus
            aria-invalid={Boolean(reviewerError)}
            aria-describedby={reviewerError ? 'reviewerId-error' : undefined}
          >
            <option value="">Choose a reviewer</option>
            {data.map((reviewer) => (
              <option key={reviewer.id} value={reviewer.id}>
                {reviewer.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}
    </CrudFormDialog>
  )
}

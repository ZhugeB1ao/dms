import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { CrudFormDialog } from '@/shared/components/CrudPageLayout.tsx'
import Button from '@/shared/components/Button.tsx'
import FormField from '@/shared/components/FormField.tsx'
import Select from '@/shared/components/Select.tsx'
import { useFetch } from '@/shared/hooks/useFetch.ts'
import { dossiersApi } from '@/features/dossiers/api/dossiersApi.ts'
import { dossierError } from '@/features/dossiers/api/dossierErrors.ts'

type Props = {
  dossierId: number
  onClose: () => void
  onAttached: () => void
}

export default function AttachDocumentDialog({
  dossierId,
  onClose,
  onAttached,
}: Props) {
  const titleId = useId()
  const modalRef = useRef<HTMLDialogElement>(null)
  const pending = useRef<AbortController | null>(null)
  const availableQuery = useFetch(
    useCallback(
      (signal: AbortSignal) =>
        dossiersApi.listAvailableDocuments(dossierId, signal),
      [dossierId],
    ),
  )
  const available = availableQuery.data
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ReturnType<typeof dossierError> | null>(
    null,
  )
  const [fields, setFields] = useState<Record<string, string>>({})

  useEffect(() => {
    const trigger = window.document.activeElement as HTMLElement | null
    const dialog = modalRef.current!
    dialog.showModal()
    return () => {
      pending.current?.abort()
      dialog.close()
      trigger?.focus()
    }
  }, [])

  useLayoutEffect(() => {
    if (submitting) return
    const elements = modalRef.current?.querySelector('form')?.elements ?? []
    const first = Array.from(elements).find(
      (element) =>
        'name' in element && Object.hasOwn(fields, String(element.name)),
    )
    ;(first as HTMLElement | undefined)?.focus()
  }, [fields, submitting])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || !available || !available.length) return
    const data = new FormData(event.currentTarget)
    const documentId = Number(data.get('documentId'))
    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
      setFields({ documentId: 'Select a document.' })
      return
    }
    setFields({})
    const controller = new AbortController()
    pending.current = controller
    setSubmitting(true)
    setError(null)
    try {
      await dossiersApi.attachDocument(dossierId, documentId, controller.signal)
      if (!controller.signal.aborted) onAttached()
    } catch (caught) {
      if (controller.signal.aborted) return
      const failure = dossierError(caught)
      setError(failure)
      setFields(failure.fields)
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null
        setSubmitting(false)
      }
    }
  }

  return (
    <CrudFormDialog
      modalRef={modalRef}
      titleId={titleId}
      title="Attach document"
      formKey={`attach-${dossierId}-${available?.length ?? 0}`}
      modalMessage={error?.message}
      submitting={submitting}
      submitDisabled={!available || available.length === 0}
      isCreate={false}
      onClose={onClose}
      onSubmit={submit}
    >
      {availableQuery.error !== undefined ? (
        <div role="alert" className="text-sm text-red-200">
          {dossierError(availableQuery.error).message}{' '}
          <Button variant="secondary" onClick={availableQuery.retry}>
            Retry documents
          </Button>
        </div>
      ) : availableQuery.loading ? (
        <p role="status">Loading available documents…</p>
      ) : available && available.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No unattached documents are available in this department.
        </p>
      ) : (
        <fieldset disabled={submitting} className="flex flex-col gap-4 min-w-0">
          <FormField
            name="documentId"
            label="Document"
            error={fields.documentId}
            required
          >
            <Select
              id="documentId"
              name="documentId"
              required
              defaultValue=""
              aria-invalid={Boolean(fields.documentId)}
              aria-describedby={
                fields.documentId ? 'documentId-error' : undefined
              }
            >
              <option value="">Select a document</option>
              {available?.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.summary}
                  {doc.docNumber ? ` (${doc.docNumber})` : ''}
                </option>
              ))}
            </Select>
          </FormField>
        </fieldset>
      )}
    </CrudFormDialog>
  )
}

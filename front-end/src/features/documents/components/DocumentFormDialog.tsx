import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useAuth } from '@/features/auth/context/useAuth.ts'
import { categoryApi } from '@/features/categories/api/categoryApi.ts'
import { departmentApi } from '@/features/departments/api/departmentApi.ts'
import { organizationApi } from '@/features/organizations/api/organizationApi.ts'
import { CrudFormDialog } from '@/shared/components/CrudPageLayout.tsx'
import Button from '@/shared/components/Button.tsx'
import FormField from '@/shared/components/FormField.tsx'
import Select from '@/shared/components/Select.tsx'
import { useFetch } from '@/shared/hooks/useFetch.ts'
import { documentsApi } from '@/features/documents/api/documentsApi.ts'
import { documentError } from '@/features/documents/api/documentErrors.ts'
import { canEditDraft } from '@/features/documents/permissions.ts'
import {
  documentDirections,
  type DocumentDetail,
  type DocumentDirection,
  type DraftInput,
  type Lookup,
} from '@/features/documents/types.ts'

const selectFields = [
  ['documentTypeId', 'documentType', 'Document type'],
  ['urgencyId', 'urgency', 'Urgency'],
  ['confidentialityId', 'confidentiality', 'Confidentiality'],
  ['issuingOrganizationId', 'issuingOrganization', 'Issuing organization'],
  ['departmentId', 'department', 'Responsible department'],
] as const
type Options = Record<keyof DocumentDetail['lookups'], Lookup[]>
const loadOptions = (signal: AbortSignal): Promise<Options> =>
  Promise.all([
    categoryApi.listActive(undefined, signal),
    organizationApi.listActive(signal),
    departmentApi.listActive(signal),
  ]).then(([categories, organizations, departments]) => ({
    documentType: categories.filter((c) => c.type === 'DOC_TYPE'),
    urgency: categories.filter((c) => c.type === 'URGENCY'),
    confidentiality: categories.filter((c) => c.type === 'CONFIDENTIALITY'),
    issuingOrganization: organizations,
    department: departments,
  }))
type Props = {
  document: DocumentDetail | null
  direction: DocumentDirection
  onClose: () => void
  onSaved: (document: DocumentDetail) => void
  onReloaded: (document: DocumentDetail) => void
  /** Called when saving finds the edited document deleted (404). */
  onGone?: () => void
}

export default function DocumentFormDialog({
  document: initialDocument,
  direction,
  onClose,
  onSaved,
  onReloaded,
  onGone,
}: Props) {
  const { user } = useAuth()
  const [document, setDocument] = useState(initialDocument)
  const lookups = useFetch(loadOptions)
  const options = lookups.data
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ReturnType<typeof documentError> | null>(
    null,
  )
  const [fields, setFields] = useState<Record<string, string>>({})
  const modalRef = useRef<HTMLDialogElement>(null)
  const pending = useRef<AbortController | null>(null)
  const admin = user?.roles.includes('ADMIN')
  // 404/409 only mean "stale version" when editing; a create has nothing to reload.
  const stale =
    Boolean(document) && (error?.status === 409 || error?.status === 404)
  const unavailable =
    !options ||
    (!admin && !document && !user?.departmentId) ||
    Boolean(document && !canEditDraft(user, document))

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
  // Layout effect: focus moves in the same commit that renders the errors.
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
    if (pending.current || unavailable || stale) return
    const form = event.currentTarget
    const data = new FormData(form)
    const errors: Record<string, string> = {}
    for (const element of Array.from(form.elements)) {
      if (
        (element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement) &&
        !element.validity.valid
      )
        errors[element.name] = element.validationMessage
    }
    const summary = String(data.get('summary') ?? '').trim()
    if (!summary || summary.length > 1000)
      errors.summary = 'Enter a summary of 1–1000 characters.'
    setFields(errors)
    if (Object.keys(errors).length) {
      return
    }
    const input: DraftInput = {
      direction: document?.direction ?? direction,
      summary,
      documentTypeId: Number(data.get('documentTypeId')),
      urgencyId: Number(data.get('urgencyId')),
      confidentialityId: Number(data.get('confidentialityId')),
      issuingOrganizationId: Number(data.get('issuingOrganizationId')),
      departmentId: admin
        ? Number(data.get('departmentId'))
        : (document?.departmentId ?? Number(user?.departmentId)),
    }
    const controller = new AbortController()
    pending.current = controller
    setSubmitting(true)
    setError(null)
    try {
      const saved = document
        ? await documentsApi.update(
            document.id,
            { ...input, version: document.version },
            controller.signal,
          )
        : await documentsApi.create(input, controller.signal)
      if (!controller.signal.aborted) onSaved(saved)
    } catch (caught) {
      if (controller.signal.aborted) return
      const failure = documentError(caught)
      setError(failure)
      setFields(failure.fields)
      if (document && failure.status === 404) onGone?.()
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null
        setSubmitting(false)
      }
    }
  }

  async function reload() {
    if (!document || pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setSubmitting(true)
    try {
      const fresh = await documentsApi.get(document.id, controller.signal)
      if (!controller.signal.aborted) {
        setDocument(fresh)
        onReloaded(fresh)
        setFields({})
        setError(null)
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        // Keep the 409 lock on a failed reload, or Save would reuse the stale version.
        const failure = documentError(caught)
        setError(failure.status === 404 ? failure : { ...failure, status: 409 })
      }
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
      titleId="document-form-title"
      title={document ? 'Edit draft' : 'Create draft'}
      formKey={`${document?.id ?? 'new'}-${document?.version ?? 0}`}
      modalMessage={error?.message}
      submitting={submitting}
      submitDisabled={unavailable || stale}
      isCreate={!document}
      onClose={onClose}
      onSubmit={submit}
    >
      <p className="text-sm text-neutral-400">
        {documentDirections[document?.direction ?? direction]} correspondence
      </p>
      {lookups.error !== undefined ? (
        <div role="alert">
          Unable to load form options.{' '}
          <Button onClick={lookups.retry}>Retry options</Button>
        </div>
      ) : (
        !options && <p role="status">Loading options…</p>
      )}
      {!admin && !document && !user?.departmentId && (
        <p role="alert">
          Your account has no department. Contact an administrator.
        </p>
      )}
      {document && !canEditDraft(user, document) && (
        <p role="alert">This document can no longer be edited.</p>
      )}
      {options && (
        <fieldset disabled={submitting} className="flex flex-col gap-4 min-w-0">
          <FormField
            name="summary"
            label="Summary"
            error={fields.summary}
            required
          >
            <textarea
              id="summary"
              name="summary"
              required
              maxLength={1000}
              rows={3}
              defaultValue={document?.summary ?? ''}
              aria-invalid={Boolean(fields.summary)}
              aria-describedby={fields.summary ? 'summary-error' : undefined}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3"
            />
          </FormField>
          {selectFields.map(([field, key, label]) => {
            const old = document?.lookups[key]
            const choices =
              old && !options[key].some((o) => o.id === old.id)
                ? [...options[key], { ...old, isActive: false }]
                : options[key]
            const department = key === 'department' && !admin
            return (
              <FormField
                key={field}
                name={field}
                label={label}
                error={fields[field]}
                required
              >
                <Select
                  id={field}
                  name={field}
                  required
                  disabled={department}
                  defaultValue={
                    document?.[field] ??
                    (department ? (user?.departmentId ?? '') : '')
                  }
                  aria-invalid={Boolean(fields[field])}
                  aria-describedby={
                    fields[field] ? `${field}-error` : undefined
                  }
                >
                  <option value="">Select an option</option>
                  {choices.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                      {!option.isActive ? ' (inactive)' : ''}
                    </option>
                  ))}
                </Select>
              </FormField>
            )
          })}
        </fieldset>
      )}
      {document && error?.status === 409 && (
        <div>
          <p className="text-sm mb-2">
            Reloading will discard your unsaved changes.
          </p>
          <Button disabled={submitting} onClick={reload}>
            Discard changes and reload
          </Button>
        </div>
      )}
    </CrudFormDialog>
  )
}

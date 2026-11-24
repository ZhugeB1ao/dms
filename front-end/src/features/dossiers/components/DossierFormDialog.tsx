import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { CrudFormDialog } from '@/shared/components/CrudPageLayout.tsx'
import FormField from '@/shared/components/FormField.tsx'
import { dossiersApi } from '@/features/dossiers/api/dossiersApi.ts'
import { dossierError } from '@/features/dossiers/api/dossierErrors.ts'
import type { Dossier, DossierInput } from '@/features/dossiers/types.ts'

type Props = {
  dossier: Dossier | null
  onClose: () => void
  onSaved: (dossier: Dossier) => void
}

export default function DossierFormDialog({
  dossier,
  onClose,
  onSaved,
}: Props) {
  const titleId = useId()
  const modalRef = useRef<HTMLDialogElement>(null)
  const pending = useRef<AbortController | null>(null)
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
    if (pending.current) return
    const data = new FormData(event.currentTarget)
    const errors: Record<string, string> = {}

    const code = String(data.get('code') ?? '').trim()
    if (!code || code.length > 50)
      errors.code = 'Enter a record code of 1–50 characters.'

    const name = String(data.get('name') ?? '').trim()
    if (!name || name.length > 255)
      errors.name = 'Enter a record name of 1–255 characters.'

    const yearRaw = String(data.get('year') ?? '').trim()
    const year = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : NaN
    if (!Number.isInteger(year) || year < 1900 || year > 2100)
      errors.year = 'Enter a year between 1900 and 2100.'

    setFields(errors)
    if (Object.keys(errors).length) return

    const input: DossierInput = { code, name, year }
    const controller = new AbortController()
    pending.current = controller
    setSubmitting(true)
    setError(null)
    try {
      const saved = dossier
        ? await dossiersApi.update(dossier.id, input, controller.signal)
        : await dossiersApi.create(input, controller.signal)
      if (!controller.signal.aborted) onSaved(saved)
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
      title={dossier ? 'Edit record' : 'New record'}
      formKey={`${dossier?.id ?? 'new'}-${dossier?.code ?? ''}-${dossier?.year ?? ''}`}
      modalMessage={error?.message}
      submitting={submitting}
      isCreate={!dossier}
      onClose={onClose}
      onSubmit={submit}
    >
      <fieldset disabled={submitting} className="flex flex-col gap-4 min-w-0">
        <FormField name="code" label="Record code" error={fields.code} required>
          <input
            id="code"
            name="code"
            type="text"
            required
            maxLength={50}
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={dossier?.code ?? ''}
            placeholder="e.g. HS-2026-01"
            className="font-mono"
            aria-invalid={Boolean(fields.code)}
            aria-describedby={fields.code ? 'code-error' : undefined}
          />
        </FormField>

        <FormField name="name" label="Record name" error={fields.name} required>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={255}
            defaultValue={dossier?.name ?? ''}
            placeholder="e.g. Recruitment 2026"
            aria-invalid={Boolean(fields.name)}
            aria-describedby={fields.name ? 'name-error' : undefined}
          />
        </FormField>

        <FormField name="year" label="Year" error={fields.year} required>
          <input
            id="year"
            name="year"
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            required
            defaultValue={
              dossier ? String(dossier.year) : String(new Date().getFullYear())
            }
            aria-invalid={Boolean(fields.year)}
            aria-describedby={fields.year ? 'year-error' : undefined}
          />
        </FormField>
      </fieldset>
    </CrudFormDialog>
  )
}

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import axios from 'axios'
import { getApiErrorMessage } from '../api/http.ts'

export interface UseCrudPageOptions<T extends { id: number }> {
  fetchList: (statusFilter: string, signal: AbortSignal) => Promise<T[]>
  createItem: (
    payload: Record<string, unknown>,
    signal: AbortSignal,
  ) => Promise<T>
  updateItem: (
    id: number,
    payload: Record<string, unknown>,
    signal: AbortSignal,
  ) => Promise<T>
  deactivateItem: (id: number, signal?: AbortSignal) => Promise<T>
  loadErrorMessage: string
  deactivateErrorMessage: string
  conflictField?: string
  conflictDefaultMessage?: string
  preparePayload?: (
    rawValues: Record<string, FormDataEntryValue>,
    editingItem: T | null,
    items: T[],
  ) => {
    payload?: Record<string, unknown>
    errors?: Record<string, string>
  }
}

export function useCrudPage<T extends { id: number }>({
  fetchList,
  createItem,
  updateItem,
  deactivateItem,
  loadErrorMessage,
  deactivateErrorMessage,
  conflictField = 'code',
  conflictDefaultMessage = 'Dữ liệu đã tồn tại.',
  preparePayload,
}: UseCrudPageOptions<T>) {
  const [items, setItems] = useState<T[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
  const [editingItem, setEditingItem] = useState<T | null>(null)
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({})
  const [modalMessage, setModalMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [deactivatingItem, setDeactivatingItem] = useState<T | null>(null)
  const [deactivateError, setDeactivateError] = useState('')

  const modalRef = useRef<HTMLDialogElement>(null)
  const confirmModalRef = useRef<HTMLDialogElement>(null)
  const busy = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
  const revision = useRef(0)

  const titleId = useId()
  const confirmTitleId = useId()

  useEffect(() => () => requestRef.current?.abort(), [])

  useEffect(() => {
    const current = ++revision.current
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError('')

    fetchList(statusFilter, controller.signal)
      .then((data) => {
        if (current === revision.current && !controller.signal.aborted) {
          setItems(data)
        }
      })
      .catch((err) => {
        if (current === revision.current && !controller.signal.aborted) {
          setError(getApiErrorMessage(err, loadErrorMessage))
        }
      })
      .finally(() => {
        if (current === revision.current && !controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [fetchList, statusFilter, loadErrorMessage])

  function openCreateModal() {
    setDialogMode('create')
    setEditingItem(null)
    setModalErrors({})
    setModalMessage('')
    modalRef.current?.showModal()
  }

  function openEditModal(item: T) {
    setDialogMode('edit')
    setEditingItem(item)
    setModalErrors({})
    setModalMessage('')
    modalRef.current?.showModal()
  }

  function closeModal() {
    modalRef.current?.close()
    setDialogMode(null)
    setEditingItem(null)
  }

  function openDeactivateModal(item: T) {
    setDeactivatingItem(item)
    setDeactivateError('')
    confirmModalRef.current?.showModal()
  }

  function closeConfirmModal() {
    confirmModalRef.current?.close()
    setDeactivatingItem(null)
    setDeactivateError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return

    const form = event.currentTarget
    const rawValues = Object.fromEntries(new FormData(form))
    const nextErrors: Record<string, string> = {}

    for (const input of form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >('input, select, textarea')) {
      if (!input.validity.valid) {
        nextErrors[input.name] = input.validity.valueMissing
          ? 'Trường này không được để trống.'
          : 'Giá trị không hợp lệ.'
      }
    }

    const prepared = preparePayload
      ? preparePayload(rawValues, editingItem, items)
      : { payload: rawValues as Record<string, unknown> }

    if (prepared.errors) {
      Object.assign(nextErrors, prepared.errors)
    }

    if (Object.keys(nextErrors).length > 0) {
      setModalErrors(nextErrors)
      const firstEl = form.elements.namedItem(Object.keys(nextErrors)[0])
      if (firstEl instanceof HTMLElement) firstEl.focus()
      return
    }

    const payload = prepared.payload ?? (rawValues as Record<string, unknown>)

    busy.current = true
    setSubmitting(true)
    setModalErrors({})
    setModalMessage('')

    const controller = new AbortController()
    try {
      if (dialogMode === 'create') {
        const created = await createItem(payload, controller.signal)
        setItems((prev) => [...prev, created])
      } else if (editingItem) {
        const updated = await updateItem(
          editingItem.id,
          payload,
          controller.signal,
        )
        setItems((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        )
      }
      closeModal()
    } catch (err) {
      if (controller.signal.aborted) return
      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 409 || err.response?.status === 400)
      ) {
        const fieldErrors = err.response.data?.fieldErrors as
          Record<string, string> | undefined
        const msg = getApiErrorMessage(err, conflictDefaultMessage)
        const resolvedErrors =
          fieldErrors && Object.keys(fieldErrors).length > 0
            ? fieldErrors
            : { [conflictField]: msg }
        setModalErrors(resolvedErrors)
        const targetKey = Object.keys(resolvedErrors)[0]
        const targetEl = form.elements.namedItem(targetKey)
        if (targetEl instanceof HTMLElement) targetEl.focus()
      } else {
        setModalMessage(
          getApiErrorMessage(err, 'Có lỗi xảy ra. Vui lòng thử lại.'),
        )
      }
    } finally {
      busy.current = false
      setSubmitting(false)
    }
  }

  async function handleConfirmDeactivate() {
    if (!deactivatingItem || busy.current) return
    busy.current = true
    setSubmitting(true)
    setDeactivateError('')

    const controller = new AbortController()
    requestRef.current = controller
    try {
      const deactivated = await deactivateItem(
        deactivatingItem.id,
        controller.signal,
      )
      if (controller.signal.aborted) return
      setItems((prev) =>
        statusFilter === 'active'
          ? prev.filter((item) => item.id !== deactivated.id)
          : prev.map((item) =>
              item.id === deactivated.id ? deactivated : item,
            ),
      )
      closeConfirmModal()
    } catch (err) {
      if (controller.signal.aborted) return
      const msg = getApiErrorMessage(err, deactivateErrorMessage)
      setDeactivateError(msg)
      setError(msg)
    } finally {
      busy.current = false
      if (!controller.signal.aborted) setSubmitting(false)
    }
  }

  return {
    items,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    loading,
    error,
    dialogMode,
    editingItem,
    modalErrors,
    modalMessage,
    submitting,
    deactivatingItem,
    deactivateError,
    modalRef,
    confirmModalRef,
    titleId,
    confirmTitleId,
    openCreateModal,
    openEditModal,
    closeModal,
    openDeactivateModal,
    closeConfirmModal,
    handleSubmit,
    handleConfirmDeactivate,
  }
}

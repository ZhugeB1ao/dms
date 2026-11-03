import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import axios from 'axios'
import Button from '../../../shared/components/Button.tsx'
import {
  CloseIcon,
  DeactivateIcon,
  EditIcon,
  SearchIcon,
} from '../../../shared/components/Icons.tsx'
import {
  CATEGORY_TYPES,
  categoryApi,
  type CategoryItem,
} from '../api/categoryApi.ts'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Trạng thái Form Modal (Thêm / Sửa)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null)
  const [editingItem, setEditingItem] = useState<CategoryItem | null>(null)
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({})
  const [modalMessage, setModalMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Trạng thái Modal Xác nhận Ngưng dùng
  const [deactivatingItem, setDeactivatingItem] = useState<CategoryItem | null>(
    null,
  )

  const modalRef = useRef<HTMLDialogElement>(null)
  const confirmModalRef = useRef<HTMLDialogElement>(null)
  const busy = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
  const revision = useRef(0)

  const titleId = useId()
  const confirmTitleId = useId()

  useEffect(() => () => requestRef.current?.abort(), [])

  // Tải danh sách danh mục (hỗ trợ hủy request khi filter thay đổi)
  useEffect(() => {
    const current = ++revision.current
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError('')

    const request =
      statusFilter === 'active'
        ? categoryApi.listActive(typeFilter || undefined, controller.signal)
        : categoryApi.list({ type: typeFilter || undefined }, controller.signal)

    request
      .then((data) => {
        if (current === revision.current && !controller.signal.aborted) {
          setCategories(data)
        }
      })
      .catch((err) => {
        if (current === revision.current && !controller.signal.aborted) {
          const msg = axios.isAxiosError(err)
            ? err.response?.data?.message
            : undefined
          setError(msg || 'Không thể tải danh sách danh mục.')
        }
      })
      .finally(() => {
        if (current === revision.current && !controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [typeFilter, statusFilter])

  // Lọc client-side tức thì theo search input
  const filtered = categories.filter((item) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.symbol && item.symbol.toLowerCase().includes(q))
    )
  })

  // Đóng/Mở Modal Thêm/Sửa
  function openCreateModal() {
    setDialogMode('create')
    setEditingItem(null)
    setModalErrors({})
    setModalMessage('')
    modalRef.current?.showModal()
  }

  function openEditModal(item: CategoryItem) {
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

  // Đóng/Mở Modal Xác nhận Ngưng dùng
  function openDeactivateModal(item: CategoryItem) {
    setDeactivatingItem(item)
    confirmModalRef.current?.showModal()
  }

  function closeConfirmModal() {
    confirmModalRef.current?.close()
    setDeactivatingItem(null)
  }

  // Xử lý Submit Form Thêm/Sửa
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return

    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    const nextErrors: Record<string, string> = {}

    for (const input of form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('input, select')) {
      if (!input.validity.valid) {
        nextErrors[input.name] = input.validity.valueMissing
          ? 'Trường này không được để trống.'
          : 'Giá trị không hợp lệ.'
      }
    }

    if (Object.keys(nextErrors).length) {
      setModalErrors(nextErrors)
      const firstEl = form.elements.namedItem(Object.keys(nextErrors)[0])
      if (firstEl instanceof HTMLElement) firstEl.focus()
      return
    }

    busy.current = true
    setSubmitting(true)
    setModalErrors({})
    setModalMessage('')

    const controller = new AbortController()
    try {
      if (dialogMode === 'create') {
        const created = await categoryApi.create(values, controller.signal)
        setCategories((prev) => [...prev, created])
      } else if (editingItem) {
        const updated = await categoryApi.update(
          editingItem.id,
          values,
          controller.signal,
        )
        setCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        )
      }
      closeModal()
    } catch (err) {
      if (controller.signal.aborted) return
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const msg = err.response.data?.message || 'Mã danh mục đã tồn tại.'
        setModalErrors({ code: msg })
        const codeEl = form.elements.namedItem('code')
        if (codeEl instanceof HTMLElement) codeEl.focus()
      } else {
        const msg = axios.isAxiosError(err)
          ? err.response?.data?.message
          : undefined
        setModalMessage(msg || 'Có lỗi xảy ra. Vui lòng thử lại.')
      }
    } finally {
      busy.current = false
      setSubmitting(false)
    }
  }

  // Xử lý Xác nhận Ngưng dùng (Deactivate)
  async function handleConfirmDeactivate() {
    if (!deactivatingItem || busy.current) return
    busy.current = true
    setSubmitting(true)

    try {
      const deactivated = await categoryApi.deactivate(deactivatingItem.id)
      setCategories((prev) =>
        prev.map((c) => (c.id === deactivated.id ? deactivated : c)),
      )
      closeConfirmModal()
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message
        : undefined
      setError(msg || 'Không thể ngưng dùng danh mục.')
    } finally {
      busy.current = false
      setSubmitting(false)
    }
  }

  return (
    <section className="p-6 sm:p-10">
      {/* TẦNG 1: HEADER & CTA BUTTON */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="mt-3 text-3xl">Categories</h1>
        <Button
          variant="primary"
          onClick={openCreateModal}
          className="!rounded-full px-5 py-2 font-medium"
        >
          + Create category
        </Button>
      </div>

      {/* TẦNG 2: TOOLBAR / FILTER BAR (OPENAI STYLE) */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search input bo tròn */}
        <div className="relative flex-1 min-w-[220px] max-w-[320px]">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8e8e8e] pointer-events-none">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            aria-label="Search categories"
            className="!min-h-[38px] !rounded-full !pl-10 !pr-4 !py-1.5 !bg-[#121212] !border-[#292929] !text-sm placeholder:!text-[#8e8e8e]"
          />
        </div>

        {/* Lọc Type */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
          className="!min-h-[38px] !w-auto !rounded-full !px-4 !py-1.5 !bg-[#121212] !border-[#292929] !text-sm !text-[#e5e5e5]"
        >
          <option value="">All types</option>
          {Object.entries(CATEGORY_TYPES).map(([code, label]) => (
            <option key={code} value={code}>
              {label} ({code})
            </option>
          ))}
        </select>

        {/* Lọc Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="!min-h-[38px] !w-auto !rounded-full !px-4 !py-1.5 !bg-[#121212] !border-[#292929] !text-sm !text-[#e5e5e5]"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
        </select>

        {/* Bộ đếm kết quả */}
        <span className="text-sm text-[#8e8e8e] ml-2">
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </span>
      </div>

      {/* THÔNG BÁO LỖI NẾU CÓ */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* TẦNG 3: BẢNG DỮ LIỆU PHẲNG */}
      <div className="overflow-x-auto rounded-xl border border-[#292929]/80 bg-[#121212]/30">
        <table className="data-table" aria-label="Categories table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Status</th>
              <th scope="col">Code</th>
              <th scope="col">Symbol</th>
              <th scope="col">Type</th>
              <th scope="col" className="text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-[#8e8e8e]">
                  Loading categories…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-[#8e8e8e]">
                  No categories found.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isActive = item.isActive
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-[#1e1e1e]/40 ${
                      !isActive ? 'row-inactive' : ''
                    }`}
                  >
                    <td className="font-medium text-[#f5f5f5]">{item.name}</td>
                    <td>
                      <span
                        className={
                          isActive ? 'text-[#f5f5f5]' : 'text-[#737373]'
                        }
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{item.code}</td>
                    <td className="font-mono text-xs text-[#a3a3a3]">
                      {item.symbol || '—'}
                    </td>
                    <td className="text-xs text-[#a3a3a3]">
                      {CATEGORY_TYPES[item.type] || item.type}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button
                          variant="icon"
                          aria-label={`Edit ${item.name}`}
                          onClick={() => openEditModal(item)}
                          className="!w-8 !h-8 !rounded-lg text-[#dedede] hover:text-white"
                        >
                          <EditIcon />
                        </Button>
                        {isActive && (
                          <Button
                            variant="icon"
                            aria-label={`Deactivate ${item.name}`}
                            onClick={() => openDeactivateModal(item)}
                            className="!w-8 !h-8 !rounded-lg button--danger-icon"
                          >
                            <DeactivateIcon />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: THÊM MỚI / CHỈNH SỬA DANH MỤC */}
      <dialog
        ref={modalRef}
        className="auth-dialog"
        aria-labelledby={titleId}
        onClick={(e) => e.target === e.currentTarget && closeModal()}
      >
        <div className="auth-panel">
          <Button
            variant="icon"
            aria-label="Close dialog"
            onClick={closeModal}
            className="modal-close"
          >
            <CloseIcon />
          </Button>

          <h2 id={titleId} className="modal-title !text-2xl mb-6">
            {dialogMode === 'create' ? 'Create category' : 'Edit category'}
          </h2>

          {modalMessage && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-200 text-sm">
              {modalMessage}
            </div>
          )}

          <form
            key={`${dialogMode}-${editingItem?.id ?? 'new'}`}
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-4"
          >
            <div>
              <label htmlFor="category-type" className="field-label">
                Loại danh mục *
              </label>
              <select
                id="category-type"
                name="type"
                defaultValue={editingItem?.type || 'DOC_TYPE'}
                required
                aria-invalid={Boolean(modalErrors.type) || undefined}
              >
                {Object.entries(CATEGORY_TYPES).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label} ({code})
                  </option>
                ))}
              </select>
              {modalErrors.type && (
                <div className="field-error">{modalErrors.type}</div>
              )}
            </div>

            <div>
              <label htmlFor="category-code" className="field-label">
                Mã danh mục (Code) *
              </label>
              <input
                id="category-code"
                name="code"
                type="text"
                defaultValue={editingItem?.code || ''}
                required
                maxLength={50}
                placeholder="VD: QD, CV, KHAN..."
                className="font-mono uppercase"
                aria-invalid={Boolean(modalErrors.code) || undefined}
              />
              {modalErrors.code && (
                <div className="field-error">{modalErrors.code}</div>
              )}
            </div>

            <div>
              <label htmlFor="category-name" className="field-label">
                Tên danh mục (Name) *
              </label>
              <input
                id="category-name"
                name="name"
                type="text"
                defaultValue={editingItem?.name || ''}
                required
                maxLength={255}
                placeholder="VD: Quyết định, Công văn..."
                aria-invalid={Boolean(modalErrors.name) || undefined}
              />
              {modalErrors.name && (
                <div className="field-error">{modalErrors.name}</div>
              )}
            </div>

            <div>
              <label htmlFor="category-symbol" className="field-label">
                Ký hiệu (Symbol)
              </label>
              <input
                id="category-symbol"
                name="symbol"
                type="text"
                defaultValue={editingItem?.symbol || ''}
                maxLength={20}
                placeholder="VD: QĐ, K, M..."
                className="font-mono"
              />
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="secondary"
                type="button"
                onClick={closeModal}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting
                  ? 'Saving…'
                  : dialogMode === 'create'
                    ? 'Create'
                    : 'Save'}
              </Button>
            </div>
          </form>
        </div>
      </dialog>

      {/* MODAL 2: XÁC NHẬN NGƯNG DÙNG (CONFIRM DEACTIVATE) */}
      <dialog
        ref={confirmModalRef}
        className="auth-dialog"
        aria-labelledby={confirmTitleId}
        onClick={(e) => e.target === e.currentTarget && closeConfirmModal()}
      >
        <div className="auth-panel">
          <Button
            variant="icon"
            aria-label="Close dialog"
            onClick={closeConfirmModal}
            className="modal-close"
          >
            <CloseIcon />
          </Button>

          <h2
            id={confirmTitleId}
            className="modal-title !text-xl mb-3 text-red-400"
          >
            Ngưng dùng danh mục
          </h2>
          <p className="text-sm text-[#bdbdbd] mb-6 leading-relaxed">
            Bạn có chắc chắn muốn ngưng dùng danh mục{' '}
            <strong className="text-white font-mono">
              {deactivatingItem?.name}
            </strong>{' '}
            (mã: <code className="text-white">{deactivatingItem?.code}</code>)?
            Danh mục sau khi ngưng dùng sẽ không xuất hiện trong các dropdown
            tạo mới.
          </p>

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={closeConfirmModal}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={handleConfirmDeactivate}
              disabled={submitting}
              className="!bg-red-600 hover:!bg-red-500 !text-white"
            >
              {submitting ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </div>
        </div>
      </dialog>
    </section>
  )
}

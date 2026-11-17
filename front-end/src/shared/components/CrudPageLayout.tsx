import Select from '@/shared/components/Select.tsx'
import type { FormEvent, ReactNode, RefObject } from 'react'
import Button from '@/shared/components/Button.tsx'
import {
  CloseIcon,
  DeactivateIcon,
  EditIcon,
  ReactivateIcon,
  SearchIcon,
} from '@/shared/components/Icons.tsx'
import {
  crudFilterClassName,
  crudRowIconClassName,
} from '@/shared/components/crudStyles.ts'

export interface CrudHeaderProps {
  title: string
  createLabel: string
  onCreate: () => void
}

export function CrudHeader({ title, createLabel, onCreate }: CrudHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <h1 className="mt-3 text-3xl">{title}</h1>
      <Button
        variant="primary"
        onClick={onCreate}
        className="!rounded-full px-5 py-2 font-medium"
      >
        {createLabel}
      </Button>
    </div>
  )
}

const defaultStatusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active only' },
]

export interface CrudToolbarProps {
  /** Omit `onSearchChange` to hide the search box (e.g. the API has no keyword search). */
  search?: string
  onSearchChange?: (value: string) => void
  searchAriaLabel?: string
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  statusOptions?: { value: string; label: string }[]
  resultCount: number
  resultNoun?: [singular: string, plural: string]
  error?: string
  extraFilters?: ReactNode
  /** Rendered after the status filter, e.g. a "Clear filters" button. */
  actions?: ReactNode
}

export function CrudToolbar({
  search = '',
  onSearchChange,
  searchAriaLabel,
  statusFilter,
  onStatusFilterChange,
  statusOptions = defaultStatusOptions,
  resultCount,
  resultNoun = ['result', 'results'],
  error,
  extraFilters,
  actions,
}: CrudToolbarProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[220px] max-w-[320px]">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8e8e8e] pointer-events-none">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              aria-label={searchAriaLabel}
              className="!min-h-[38px] !rounded-full !pl-10 !pr-4 !py-1.5 !bg-[#121212] !border-[#292929] !text-sm placeholder:!text-[#8e8e8e]"
            />
          </div>
        )}

        {extraFilters}

        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          aria-label="Filter by status"
          className={crudFilterClassName}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {actions}

        <span className="text-sm text-[#8e8e8e] ml-2" role="status">
          {resultCount} {resultCount === 1 ? resultNoun[0] : resultNoun[1]}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-sm">
          {error}
        </div>
      )}
    </>
  )
}

export interface CrudRowActionsProps {
  itemName: string
  isActive: boolean
  onEdit: () => void
  onDeactivate: () => void
  /** Shows a reactivate button on inactive rows when given. */
  onReactivate?: () => void
  /** Disables deactivate/reactivate and shows this text as the tooltip. */
  statusDisabledReason?: string
  /** Extra icon actions rendered after the built-in ones. */
  children?: ReactNode
}

export function CrudRowActions({
  itemName,
  isActive,
  onEdit,
  onDeactivate,
  onReactivate,
  statusDisabledReason,
  children,
}: CrudRowActionsProps) {
  const editLabel = `Edit ${itemName}`
  const statusLabel = `${isActive ? 'Deactivate' : 'Reactivate'} ${itemName}`
  return (
    <div className="inline-flex items-center justify-end gap-1 align-middle">
      <Button
        variant="icon"
        aria-label={editLabel}
        title={editLabel}
        onClick={onEdit}
        className={crudRowIconClassName}
      >
        <EditIcon />
      </Button>
      {(isActive || onReactivate) && (
        <Button
          variant="icon"
          aria-label={statusLabel}
          title={statusDisabledReason ?? statusLabel}
          disabled={Boolean(statusDisabledReason)}
          onClick={isActive ? onDeactivate : onReactivate}
          className={`${crudRowIconClassName} ${isActive ? 'row-action--danger' : ''}`}
        >
          {isActive ? <DeactivateIcon /> : <ReactivateIcon />}
        </Button>
      )}
      {children}
    </div>
  )
}

export interface CrudFormDialogProps {
  modalRef: RefObject<HTMLDialogElement | null>
  titleId: string
  title: string
  formKey: string
  modalMessage?: string
  submitting: boolean
  isCreate: boolean
  submitDisabled?: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  children: ReactNode
}

export function CrudFormDialog({
  modalRef,
  titleId,
  title,
  formKey,
  modalMessage,
  submitting,
  isCreate,
  submitDisabled = false,
  onClose,
  onSubmit,
  children,
}: CrudFormDialogProps) {
  return (
    <dialog
      ref={modalRef}
      className="auth-dialog"
      aria-labelledby={titleId}
      onClick={(e) => !submitting && e.target === e.currentTarget && onClose()}
      onCancel={(e) => {
        e.preventDefault()
        if (!submitting) onClose()
      }}
    >
      <div className="auth-panel">
        <Button
          variant="icon"
          aria-label="Close dialog"
          disabled={submitting}
          onClick={onClose}
          className="modal-close"
        >
          <CloseIcon />
        </Button>

        <h2 id={titleId} className="modal-title !text-2xl mb-6">
          {title}
        </h2>

        {modalMessage && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-200 text-sm"
          >
            {modalMessage}
          </div>
        )}

        <form
          key={formKey}
          onSubmit={onSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
          {children}

          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={submitting || submitDisabled}
            >
              {submitting ? 'Saving…' : isCreate ? 'Create' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  )
}

export interface ConfirmDeactivateDialogProps {
  confirmModalRef: RefObject<HTMLDialogElement | null>
  confirmTitleId: string
  title: string
  description: ReactNode
  errorMessage?: string
  submitting: boolean
  confirmLabel?: string
  pendingLabel?: string
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmDeactivateDialog({
  confirmModalRef,
  confirmTitleId,
  title,
  description,
  errorMessage,
  submitting,
  confirmLabel = 'Deactivate',
  pendingLabel = 'Deactivating…',
  onClose,
  onConfirm,
}: ConfirmDeactivateDialogProps) {
  return (
    <dialog
      ref={confirmModalRef}
      className="auth-dialog"
      aria-labelledby={confirmTitleId}
      onClick={(e) => !submitting && e.target === e.currentTarget && onClose()}
      onCancel={(e) => {
        e.preventDefault()
        if (!submitting) onClose()
      }}
    >
      <div className="auth-panel">
        <Button
          variant="icon"
          aria-label="Close dialog"
          disabled={submitting}
          onClick={onClose}
          className="modal-close"
        >
          <CloseIcon />
        </Button>

        <h2
          id={confirmTitleId}
          className="modal-title !text-xl mb-3 text-red-400"
        >
          {title}
        </h2>

        {errorMessage && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-200 text-sm"
          >
            {errorMessage}
          </div>
        )}

        <p className="text-sm text-[#bdbdbd] mb-6 leading-relaxed">
          {description}
        </p>

        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="!bg-red-600 hover:!bg-red-500 !text-white"
          >
            {submitting ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

export interface CrudPaginationProps {
  /** Zero-based page index. */
  page: number
  totalPages: number
  size: number
  onPageChange: (page: number) => void
  onSizeChange: (size: number) => void
  disabled?: boolean
}

export function CrudPagination({
  page,
  totalPages,
  size,
  onPageChange,
  onSizeChange,
  disabled = false,
}: CrudPaginationProps) {
  const pages = Math.max(1, totalPages)
  return (
    <div className="management-pagination">
      <div className="user-field">
        <label htmlFor="page-size">Rows per page</label>
        <Select
          id="page-size"
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
        >
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>
      <span>
        Page {page + 1} / {pages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={disabled || page <= 0}
          onClick={() => onPageChange(page - 1)}
        >
          Previous page
        </Button>
        <Button
          variant="secondary"
          disabled={disabled || page + 1 >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next page
        </Button>
      </div>
    </div>
  )
}

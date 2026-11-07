import type { FormEvent, ReactNode, RefObject } from 'react'
import Button from './Button.tsx'
import { CloseIcon, DeactivateIcon, EditIcon, SearchIcon } from './Icons.tsx'

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

export interface CrudToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  searchAriaLabel: string
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  resultCount: number
  error?: string
  extraFilters?: ReactNode
}

export function CrudToolbar({
  search,
  onSearchChange,
  searchAriaLabel,
  statusFilter,
  onStatusFilterChange,
  resultCount,
  error,
  extraFilters,
}: CrudToolbarProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-6">
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

        {extraFilters}

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          aria-label="Filter by status"
          className="!min-h-[38px] !w-auto !rounded-full !px-4 !py-1.5 !bg-[#121212] !border-[#292929] !text-sm !text-[#e5e5e5]"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
        </select>

        <span className="text-sm text-[#8e8e8e] ml-2">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
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
}

export function CrudRowActions({
  itemName,
  isActive,
  onEdit,
  onDeactivate,
}: CrudRowActionsProps) {
  return (
    <div className="inline-flex items-center justify-end gap-1">
      <Button
        variant="icon"
        aria-label={`Edit ${itemName}`}
        onClick={onEdit}
        className="!w-8 !h-8 !rounded-lg text-[#dedede] hover:text-white"
      >
        <EditIcon />
      </Button>
      {isActive && (
        <Button
          variant="icon"
          aria-label={`Deactivate ${itemName}`}
          onClick={onDeactivate}
          className="!w-8 !h-8 !rounded-lg button--danger-icon"
        >
          <DeactivateIcon />
        </Button>
      )}
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
  onClose,
  onSubmit,
  children,
}: CrudFormDialogProps) {
  return (
    <dialog
      ref={modalRef}
      className="auth-dialog"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="auth-panel">
        <Button
          variant="icon"
          aria-label="Close dialog"
          onClick={onClose}
          className="modal-close"
        >
          <CloseIcon />
        </Button>

        <h2 id={titleId} className="modal-title !text-2xl mb-6">
          {title}
        </h2>

        {modalMessage && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-200 text-sm">
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
            <Button variant="primary" type="submit" disabled={submitting}>
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
  onClose,
  onConfirm,
}: ConfirmDeactivateDialogProps) {
  return (
    <dialog
      ref={confirmModalRef}
      className="auth-dialog"
      aria-labelledby={confirmTitleId}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="auth-panel">
        <Button
          variant="icon"
          aria-label="Close dialog"
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
            {submitting ? 'Deactivating…' : 'Deactivate'}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

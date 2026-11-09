import { useCallback, useState } from 'react'
import {
  ConfirmDeactivateDialog,
  CrudFormDialog,
  CrudHeader,
  CrudRowActions,
  CrudToolbar,
} from '../../../shared/components/CrudPageLayout.tsx'
import { useCrudPage } from '../../../shared/hooks/useCrudPage.ts'
import {
  CATEGORY_TYPES,
  categoryApi,
  type CategoryItem,
} from '../api/categoryApi.ts'

export default function CategoriesPage() {
  const [typeFilter, setTypeFilter] = useState('')

  const fetchCategories = useCallback(
    (statusFilter: string, signal: AbortSignal) =>
      statusFilter === 'active'
        ? categoryApi.listActive(typeFilter || undefined, signal)
        : categoryApi.list({ type: typeFilter || undefined }, signal),
    [typeFilter],
  )

  const crud = useCrudPage<CategoryItem>({
    fetchList: fetchCategories,
    createItem: categoryApi.create,
    updateItem: categoryApi.update,
    deactivateItem: categoryApi.deactivate,
    loadErrorMessage: 'Unable to load categories.',
    deactivateErrorMessage: 'Unable to deactivate this category.',
    conflictField: 'code',
    conflictDefaultMessage: 'This category code already exists.',
  })

  const filtered = crud.items.filter((item) => {
    const q = crud.search.trim().toLowerCase()
    if (!q) return true
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.symbol && item.symbol.toLowerCase().includes(q))
    )
  })

  return (
    <section className="p-6 sm:p-10">
      <CrudHeader
        title="Categories"
        createLabel="+ Create category"
        onCreate={crud.openCreateModal}
      />

      <CrudToolbar
        search={crud.search}
        onSearchChange={crud.setSearch}
        searchAriaLabel="Search categories"
        statusFilter={crud.statusFilter}
        onStatusFilterChange={crud.setStatusFilter}
        resultCount={filtered.length}
        error={crud.error}
        extraFilters={
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
        }
      />

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
            {crud.loading ? (
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
              filtered.map((item) => (
                <tr
                  key={item.id}
                  className={`transition-colors hover:bg-[#1e1e1e]/40 ${
                    !item.isActive ? 'row-inactive' : ''
                  }`}
                >
                  <td className="font-medium text-[#f5f5f5]">{item.name}</td>
                  <td>
                    <span
                      className={
                        item.isActive ? 'text-[#f5f5f5]' : 'text-[#737373]'
                      }
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
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
                    <CrudRowActions
                      itemName={item.name}
                      isActive={item.isActive}
                      onEdit={() => crud.openEditModal(item)}
                      onDeactivate={() => crud.openDeactivateModal(item)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CrudFormDialog
        modalRef={crud.modalRef}
        titleId={crud.titleId}
        title={
          crud.dialogMode === 'create' ? 'Create category' : 'Edit category'
        }
        formKey={`${crud.dialogMode}-${crud.editingItem?.id ?? 'new'}`}
        modalMessage={crud.modalMessage}
        submitting={crud.submitting}
        isCreate={crud.dialogMode === 'create'}
        onClose={crud.closeModal}
        onSubmit={crud.handleSubmit}
      >
        <div>
          <label htmlFor="category-type" className="field-label">
            Category type *
          </label>
          <select
            id="category-type"
            name="type"
            defaultValue={crud.editingItem?.type || 'DOC_TYPE'}
            required
            aria-invalid={Boolean(crud.modalErrors.type) || undefined}
          >
            {Object.entries(CATEGORY_TYPES).map(([code, label]) => (
              <option key={code} value={code}>
                {label} ({code})
              </option>
            ))}
          </select>
          {crud.modalErrors.type && (
            <div className="field-error">{crud.modalErrors.type}</div>
          )}
        </div>

        <div>
          <label htmlFor="category-code" className="field-label">
            Category code *
          </label>
          <input
            id="category-code"
            name="code"
            type="text"
            defaultValue={crud.editingItem?.code || ''}
            required
            maxLength={50}
            placeholder="VD: QD, CV, KHAN..."
            className="font-mono uppercase"
            aria-invalid={Boolean(crud.modalErrors.code) || undefined}
          />
          {crud.modalErrors.code && (
            <div className="field-error">{crud.modalErrors.code}</div>
          )}
        </div>

        <div>
          <label htmlFor="category-name" className="field-label">
            Category name *
          </label>
          <input
            id="category-name"
            name="name"
            type="text"
            defaultValue={crud.editingItem?.name || ''}
            required
            maxLength={255}
            placeholder="e.g. Decision, Correspondence…"
            aria-invalid={Boolean(crud.modalErrors.name) || undefined}
          />
          {crud.modalErrors.name && (
            <div className="field-error">{crud.modalErrors.name}</div>
          )}
        </div>

        <div>
          <label htmlFor="category-symbol" className="field-label">
            Symbol
          </label>
          <input
            id="category-symbol"
            name="symbol"
            type="text"
            defaultValue={crud.editingItem?.symbol || ''}
            maxLength={20}
            placeholder="e.g. DEC, K, M…"
            className="font-mono"
          />
        </div>
      </CrudFormDialog>

      <ConfirmDeactivateDialog
        confirmModalRef={crud.confirmModalRef}
        confirmTitleId={crud.confirmTitleId}
        title="Deactivate category"
        errorMessage={crud.deactivateError}
        submitting={crud.submitting}
        onClose={crud.closeConfirmModal}
        onConfirm={crud.handleConfirmDeactivate}
        description={
          <>
            Are you sure you want to deactivate the category{' '}
            <strong className="text-white font-mono">
              {crud.deactivatingItem?.name}
            </strong>{' '}
            (code:{' '}
            <code className="text-white">{crud.deactivatingItem?.code}</code>)?
            A deactivated category no longer appears in the dropdowns used to
            create new records.
          </>
        }
      />
    </section>
  )
}

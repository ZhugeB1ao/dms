import {
  ConfirmDeactivateDialog,
  CrudFormDialog,
  CrudHeader,
  CrudRowActions,
  CrudToolbar,
} from '../../../shared/components/CrudPageLayout.tsx'
import { useCrudPage } from '../../../shared/hooks/useCrudPage.ts'
import {
  buildDepartmentRows,
  departmentApi,
  getForbiddenParentIds,
  type DepartmentItem,
} from '../api/departmentApi.ts'
import DepartmentSelect from '../components/DepartmentSelect.tsx'

const fetchDepartments = (statusFilter: string, signal: AbortSignal) =>
  statusFilter === 'active'
    ? departmentApi.listActive(signal)
    : departmentApi.listTree(signal)

export default function DepartmentsPage() {
  const crud = useCrudPage<DepartmentItem>({
    fetchList: fetchDepartments,
    createItem: departmentApi.create,
    updateItem: departmentApi.update,
    deactivateItem: departmentApi.deactivate,
    loadErrorMessage: 'Unable to load departments.',
    deactivateErrorMessage: 'Unable to deactivate this department.',
    conflictField: 'code',
    conflictDefaultMessage: 'This department code already exists.',
    preparePayload: (rawValues, editingItem, items) => {
      const forbidden = getForbiddenParentIds(items, editingItem?.id)
      const parentId = rawValues.parentId ? Number(rawValues.parentId) : null
      if (parentId !== null && forbidden.has(parentId)) {
        return {
          errors: {
            parentId:
              'Invalid parent department (it would create a loop or exceed 3 levels).',
          },
        }
      }
      return {
        payload: {
          code: String(rawValues.code || '').trim(),
          name: String(rawValues.name || '').trim(),
          parentId,
        },
      }
    },
  })

  const treeRows = buildDepartmentRows(crud.items)
  const filtered = treeRows.filter((item) => {
    const q = crud.search.trim().toLowerCase()
    if (!q) return true
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.parentName && item.parentName.toLowerCase().includes(q))
    )
  })

  const forbiddenParentIds = getForbiddenParentIds(
    crud.items,
    crud.editingItem?.id,
  )

  return (
    <section className="p-6 sm:p-10">
      <CrudHeader
        title="Departments"
        createLabel="+ Create department"
        onCreate={crud.openCreateModal}
      />

      <CrudToolbar
        search={crud.search}
        onSearchChange={crud.setSearch}
        searchAriaLabel="Search departments"
        statusFilter={crud.statusFilter}
        onStatusFilterChange={crud.setStatusFilter}
        resultCount={filtered.length}
        error={crud.error}
      />

      <div className="overflow-x-auto rounded-xl border border-[#292929]/80 bg-[#121212]/30">
        <table className="data-table" aria-label="Departments table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Status</th>
              <th scope="col">Code</th>
              <th scope="col">Parent</th>
              <th scope="col" className="text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {crud.loading ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-[#8e8e8e]">
                  Loading departments…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-[#8e8e8e]">
                  No departments found.
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
                  <td className="font-medium text-[#f5f5f5]">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${(item.depth - 1) * 24}px` }}
                    >
                      {item.depth > 1 && (
                        <span
                          className="text-[#737373] font-mono select-none"
                          aria-hidden="true"
                        >
                          └─
                        </span>
                      )}
                      <span>{item.name}</span>
                      <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-[#242424] text-[#a3a3a3]">
                        Level {item.depth}
                      </span>
                    </div>
                  </td>
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
                  <td className="text-xs text-[#a3a3a3]">
                    {item.parentName || '—'}
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
          crud.dialogMode === 'create' ? 'Create department' : 'Edit department'
        }
        formKey={`${crud.dialogMode}-${crud.editingItem?.id ?? 'new'}`}
        modalMessage={crud.modalMessage}
        submitting={crud.submitting}
        isCreate={crud.dialogMode === 'create'}
        onClose={crud.closeModal}
        onSubmit={crud.handleSubmit}
      >
        <div>
          <label htmlFor="department-code" className="field-label">
            Department code *
          </label>
          <input
            id="department-code"
            name="code"
            type="text"
            defaultValue={crud.editingItem?.code || ''}
            required
            maxLength={50}
            placeholder="VD: BGD, P_HCTH, TO_VT..."
            className="font-mono uppercase"
            aria-invalid={Boolean(crud.modalErrors.code) || undefined}
          />
          {crud.modalErrors.code && (
            <div className="field-error">{crud.modalErrors.code}</div>
          )}
        </div>

        <div>
          <label htmlFor="department-name" className="field-label">
            Department name *
          </label>
          <input
            id="department-name"
            name="name"
            type="text"
            defaultValue={crud.editingItem?.name || ''}
            required
            maxLength={255}
            placeholder="e.g. Board of Directors, Administration Office…"
            aria-invalid={Boolean(crud.modalErrors.name) || undefined}
          />
          {crud.modalErrors.name && (
            <div className="field-error">{crud.modalErrors.name}</div>
          )}
        </div>

        <div>
          <label htmlFor="department-parent" className="field-label">
            Parent department
          </label>
          <DepartmentSelect
            id="department-parent"
            name="parentId"
            items={crud.items}
            excludeIds={forbiddenParentIds}
            defaultValue={
              crud.editingItem?.parentId
                ? String(crud.editingItem.parentId)
                : ''
            }
            aria-invalid={Boolean(crud.modalErrors.parentId) || undefined}
          />
          {crud.modalErrors.parentId && (
            <div className="field-error">{crud.modalErrors.parentId}</div>
          )}
        </div>
      </CrudFormDialog>

      <ConfirmDeactivateDialog
        confirmModalRef={crud.confirmModalRef}
        confirmTitleId={crud.confirmTitleId}
        title="Deactivate department"
        errorMessage={crud.deactivateError}
        submitting={crud.submitting}
        onClose={crud.closeConfirmModal}
        onConfirm={crud.handleConfirmDeactivate}
        description={
          <>
            Are you sure you want to deactivate the department{' '}
            <strong className="text-white font-mono">
              {crud.deactivatingItem?.name}
            </strong>{' '}
            (code:{' '}
            <code className="text-white">{crud.deactivatingItem?.code}</code>)?
            A deactivated department no longer appears in the dropdowns used to
            create new records.
          </>
        }
      />
    </section>
  )
}

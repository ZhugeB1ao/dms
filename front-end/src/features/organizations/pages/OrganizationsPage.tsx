import {
  ConfirmDeactivateDialog,
  CrudFormDialog,
  CrudHeader,
  CrudRowActions,
  CrudToolbar,
} from '../../../shared/components/CrudPageLayout.tsx'
import { useCrudPage } from '../../../shared/hooks/useCrudPage.ts'
import {
  organizationApi,
  type OrganizationItem,
} from '../api/organizationApi.ts'

const fetchOrganizations = (statusFilter: string, signal: AbortSignal) =>
  statusFilter === 'active'
    ? organizationApi.listActive(signal)
    : organizationApi.list(signal)

export default function OrganizationsPage() {
  const crud = useCrudPage<OrganizationItem>({
    fetchList: fetchOrganizations,
    createItem: organizationApi.create,
    updateItem: organizationApi.update,
    deactivateItem: organizationApi.deactivate,
    loadErrorMessage: 'Unable to load external organizations.',
    deactivateErrorMessage: 'Unable to deactivate this organization.',
    conflictField: 'name',
    conflictDefaultMessage: 'This organization name already exists.',
  })

  const filtered = crud.items.filter((item) => {
    const q = crud.search.trim().toLowerCase()
    if (!q) return true
    return (
      item.name.toLowerCase().includes(q) ||
      (item.email && item.email.toLowerCase().includes(q)) ||
      (item.address && item.address.toLowerCase().includes(q))
    )
  })

  return (
    <section className="p-6 sm:p-10">
      <CrudHeader
        title="Organizations"
        createLabel="+ Create organization"
        onCreate={crud.openCreateModal}
      />

      <CrudToolbar
        search={crud.search}
        onSearchChange={crud.setSearch}
        searchAriaLabel="Search organizations"
        statusFilter={crud.statusFilter}
        onStatusFilterChange={crud.setStatusFilter}
        resultCount={filtered.length}
        error={crud.error}
      />

      <div className="overflow-x-auto rounded-xl border border-[#292929]/80 bg-[#121212]/30">
        <table className="data-table" aria-label="Organizations table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Status</th>
              <th scope="col">Email</th>
              <th scope="col">Address</th>
              <th scope="col" className="text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {crud.loading ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-[#8e8e8e]">
                  Loading organizations…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-[#8e8e8e]">
                  No organizations found.
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
                  <td className="font-mono text-xs text-[#a3a3a3]">
                    {item.email || '—'}
                  </td>
                  <td className="text-xs text-[#a3a3a3]">
                    {item.address || '—'}
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
          crud.dialogMode === 'create'
            ? 'Create organization'
            : 'Edit organization'
        }
        formKey={`${crud.dialogMode}-${crud.editingItem?.id ?? 'new'}`}
        modalMessage={crud.modalMessage}
        submitting={crud.submitting}
        isCreate={crud.dialogMode === 'create'}
        onClose={crud.closeModal}
        onSubmit={crud.handleSubmit}
      >
        <div>
          <label htmlFor="organization-name" className="field-label">
            Organization name *
          </label>
          <input
            id="organization-name"
            name="name"
            type="text"
            defaultValue={crud.editingItem?.name || ''}
            required
            maxLength={255}
            placeholder="e.g. Department of Education and Training…"
            aria-invalid={Boolean(crud.modalErrors.name) || undefined}
          />
          {crud.modalErrors.name && (
            <div className="field-error">{crud.modalErrors.name}</div>
          )}
        </div>

        <div>
          <label htmlFor="organization-email" className="field-label">
            Contact email
          </label>
          <input
            id="organization-email"
            name="email"
            type="email"
            defaultValue={crud.editingItem?.email || ''}
            maxLength={255}
            placeholder="VD: vanthu@donvi.gov.vn"
            aria-invalid={Boolean(crud.modalErrors.email) || undefined}
          />
          {crud.modalErrors.email && (
            <div className="field-error">{crud.modalErrors.email}</div>
          )}
        </div>

        <div>
          <label htmlFor="organization-address" className="field-label">
            Address
          </label>
          <input
            id="organization-address"
            name="address"
            type="text"
            defaultValue={crud.editingItem?.address || ''}
            maxLength={500}
            placeholder="e.g. 8 Nguyen Van Trang, District 1, Ho Chi Minh City"
            aria-invalid={Boolean(crud.modalErrors.address) || undefined}
          />
          {crud.modalErrors.address && (
            <div className="field-error">{crud.modalErrors.address}</div>
          )}
        </div>
      </CrudFormDialog>

      <ConfirmDeactivateDialog
        confirmModalRef={crud.confirmModalRef}
        confirmTitleId={crud.confirmTitleId}
        title="Deactivate external organization"
        errorMessage={crud.deactivateError}
        submitting={crud.submitting}
        onClose={crud.closeConfirmModal}
        onConfirm={crud.handleConfirmDeactivate}
        description={
          <>
            Are you sure you want to deactivate the organization{' '}
            <strong className="text-white font-mono">
              {crud.deactivatingItem?.name}
            </strong>
            ? A deactivated organization no longer appears in the dropdowns used
            to create new records.
          </>
        }
      />
    </section>
  )
}

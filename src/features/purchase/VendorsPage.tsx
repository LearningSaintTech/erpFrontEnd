import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, RefreshCw, Search, X } from 'lucide-react';
import { purchaseApi } from '../../services/operations';
import { AlertBanner } from '../../components/AlertBanner';
import {
  ErpButton, ErpCard, ErpDataTable, ErpInput, ErpPageHeader, ErpStatusBadge,
} from '../../components/erp';
import type { Supplier } from '../../types/api';
import { useAuth } from '../../app/providers/AuthProvider';
import { SuccessBanner } from '../users/SuccessBanner';
import { downloadCsv } from '../../utils/csvExport';

const PAGE_SIZE = 50;
const fieldLabel = 'mb-0.5 block text-[10px] font-medium text-erp-text-muted';

const emptyForm = {
  supplierCode: '',
  name: '',
  contactPerson: '',
  phone: '',
  contactEmail: '',
  gstNumber: '',
  materialsSupplied: '',
  paymentTerms: '',
  leadTimeDays: '7',
};

export function VendorsPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canCreate = permissions.includes('*') || permissions.includes('purchase.create');
  const canApprove = permissions.includes('*') || permissions.includes('purchase.approve');
  const canExport = permissions.includes('*') || permissions.includes('purchase.export');
  const canManage = canCreate && canApprove;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const { data: stats } = useQuery({
    queryKey: ['purchase-stats'],
    queryFn: () => purchaseApi.stats(),
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['vendors-list', page, search],
    queryFn: () => purchaseApi.listSuppliersPage({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
    }),
  });

  const items = (data?.items ?? []) as Supplier[];
  const meta = data?.meta;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['vendors-list'] });
    qc.invalidateQueries({ queryKey: ['suppliers-all'] });
    qc.invalidateQueries({ queryKey: ['purchase-stats'] });
    qc.invalidateQueries({ queryKey: ['purchase-list'] });
  };

  const createVendor = useMutation({
    mutationFn: () => purchaseApi.createSupplier({
      supplierCode: form.supplierCode.trim(),
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim() || undefined,
      phone: form.phone.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      gstNumber: form.gstNumber.trim() || undefined,
      materialsSupplied: form.materialsSupplied.trim() || undefined,
      paymentTerms: form.paymentTerms.trim() || undefined,
      leadTimeDays: Number(form.leadTimeDays) || 7,
    }),
    onSuccess: () => {
      setForm(emptyForm);
      setShowForm(false);
      invalidate();
      showSuccess('Vendor added');
    },
    onError: (e: Error) => setError(e.message),
  });

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
    setError('');
  };

  const exportCsv = () => {
    downloadCsv(
      'vendors.csv',
      ['Vendor ID', 'Name', 'Contact Person', 'Mobile', 'Email', 'GST No.', 'Material Supplied', 'Payment Terms', 'Status'],
      items.map((s) => [
        s.supplierCode,
        s.name,
        s.contactPerson || '',
        s.phone || '',
        s.contactEmail || '',
        s.gstNumber || '',
        s.materialsSupplied || '',
        s.paymentTerms || '',
        s.status || 'ACTIVE',
      ]),
    );
  };

  return (
    <div className="p-4 md:p-6">
      <ErpPageHeader
        title="Vendors"
        subtitle={`Supplier master · ${stats?.suppliers ?? items.length} vendors`}
        actions={(
          <>
            <Link
              to="/purchase"
              className="inline-flex h-8 items-center text-[11px] text-[var(--erp-accent)] hover:underline"
            >
              Purchase →
            </Link>
            <ErpButton
              variant="secondary"
              className="inline-flex h-8 items-center !px-2.5 text-[11px]"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </ErpButton>
            {canExport && (
              <ErpButton
                variant="secondary"
                className="inline-flex h-8 items-center !px-2.5 text-[11px]"
                onClick={exportCsv}
                disabled={!items.length}
              >
                <Download className="mr-1 inline h-3.5 w-3.5" />
                Export
              </ErpButton>
            )}
            {canManage && (
              <ErpButton
                className="inline-flex h-8 items-center !px-2.5 text-[11px]"
                onClick={() => (showForm ? closeForm() : setShowForm(true))}
              >
                {showForm ? (
                  <>
                    <X className="mr-1 inline h-3.5 w-3.5" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 inline h-3.5 w-3.5" />
                    Add vendor
                  </>
                )}
              </ErpButton>
            )}
          </>
        )}
      />

      {error && <AlertBanner message={error} onDismiss={() => setError('')} />}
      {success && <SuccessBanner message={success} />}

      {canManage && showForm && (
        <ErpCard className="mb-3 !p-3">
          <h3 className="mb-2 text-[11px] font-semibold">New vendor</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={fieldLabel}>Vendor ID</label>
              <ErpInput
                className="!py-1.5 text-[11px] font-mono"
                value={form.supplierCode}
                onChange={(e) => setForm({ ...form, supplierCode: e.target.value })}
                placeholder="V0038"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className={fieldLabel}>Name</label>
              <ErpInput
                className="!py-1.5 text-[11px]"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className={fieldLabel}>Contact person</label>
              <ErpInput
                className="!py-1.5 text-[11px]"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              />
            </div>
            <div>
              <label className={fieldLabel}>Mobile</label>
              <ErpInput
                className="!py-1.5 text-[11px] font-mono"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className={fieldLabel}>Email</label>
              <ErpInput
                className="!py-1.5 text-[11px]"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
            </div>
            <div>
              <label className={fieldLabel}>GST No.</label>
              <ErpInput
                className="!py-1.5 text-[11px] font-mono"
                value={form.gstNumber}
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
              />
            </div>
            <div>
              <label className={fieldLabel}>Material supplied</label>
              <ErpInput
                className="!py-1.5 text-[11px]"
                value={form.materialsSupplied}
                onChange={(e) => setForm({ ...form, materialsSupplied: e.target.value })}
              />
            </div>
            <div>
              <label className={fieldLabel}>Payment terms</label>
              <ErpInput
                className="!py-1.5 text-[11px]"
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                placeholder="On Delivery / Net 7 / Advance"
              />
            </div>
            <div className="flex items-end gap-2">
              <ErpButton
                className="flex-1 !py-1.5 text-[11px]"
                disabled={!form.supplierCode.trim() || !form.name.trim() || createVendor.isPending}
                onClick={() => createVendor.mutate()}
              >
                Save
              </ErpButton>
              <ErpButton variant="secondary" className="!py-1.5 text-[11px]" onClick={closeForm}>
                Cancel
              </ErpButton>
            </div>
          </div>
        </ErpCard>
      )}

      <ErpCard className="!p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--erp-border)] p-3">
          <div className="relative min-w-[180px] flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-erp-text-muted" />
            <ErpInput
              className="!py-1.5 pl-7 text-[11px]"
              placeholder="Search vendor ID, name, GST, material…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearch(searchInput);
                  setPage(1);
                }
              }}
            />
          </div>
          <ErpButton
            variant="secondary"
            className="!px-2 !py-1.5 text-[11px]"
            onClick={() => { setSearch(searchInput); setPage(1); }}
          >
            Search
          </ErpButton>
        </div>

        {isLoading ? (
          <p className="p-4 text-[11px] text-erp-text-muted">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <ErpDataTable className="w-full min-w-[1100px] text-[11px]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Vendor ID</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Contact Person</th>
                  <th className="px-3 py-2 text-left">Mobile</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">GST No.</th>
                  <th className="px-3 py-2 text-left">Material Supplied</th>
                  <th className="px-3 py-2 text-left">Payment Terms</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s._id} className="border-t border-[var(--erp-border)]">
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{s.supplierCode}</td>
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2 text-erp-text-muted">{s.contactPerson || '—'}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{s.phone || '—'}</td>
                    <td className="px-3 py-2 text-erp-text-muted">{s.contactEmail || '—'}</td>
                    <td className="px-3 py-2 font-mono text-[10px] whitespace-nowrap">{s.gstNumber || '—'}</td>
                    <td className="px-3 py-2">{s.materialsSupplied || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{s.paymentTerms || '—'}</td>
                    <td className="px-3 py-2"><ErpStatusBadge status={s.status || 'ACTIVE'} /></td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-erp-text-muted">No vendors found</td>
                  </tr>
                )}
              </tbody>
            </ErpDataTable>
          </div>
        )}

        {meta && meta.totalPages > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--erp-border)] px-3 py-2">
            <p className="text-[10px] text-erp-text-muted">{meta.page}/{meta.totalPages} · {meta.total}</p>
            <div className="flex gap-1">
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</ErpButton>
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</ErpButton>
            </div>
          </div>
        )}
      </ErpCard>
    </div>
  );
}

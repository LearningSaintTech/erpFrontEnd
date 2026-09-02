import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, RefreshCw, Search, Users, X } from 'lucide-react';
import { purchaseApi } from '../../services/operations';
import { AlertBanner } from '../../components/AlertBanner';
import {
  ComposeSection, EmptyRow, ErpButton, ErpDataTable, ErpInput, ErpPageHeader, ErpStatusBadge,
  StatTile, TabShell, TabToolbar, TablePager, btnSm, fieldLabel,
} from '../../components/erp';
import type { Supplier } from '../../types/api';
import { useAuth } from '../../app/providers/AuthProvider';
import { SuccessBanner } from '../users/SuccessBanner';
import { downloadCsv } from '../../utils/csvExport';

const PAGE_SIZE = 50;

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

  const runSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const exportCsv = () => {
    downloadCsv(
      'vendors.csv',
      ['Vendor ID', 'Name', 'Contact Person', 'Mobile', 'Email', 'GST No.', 'Material Supplied', 'Payment Terms', 'Lead days', 'Status'],
      items.map((s) => [
        s.supplierCode,
        s.name,
        s.contactPerson || '',
        s.phone || '',
        s.contactEmail || '',
        s.gstNumber || '',
        s.materialsSupplied || '',
        s.paymentTerms || '',
        String(s.leadTimeDays ?? ''),
        s.status || 'ACTIVE',
      ]),
    );
  };

  return (
    <div className="space-y-3">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Vendors"
        subtitle={(
          <>
            Supplier master used on POs and RFQs.
            <Link to="/purchase" className="ml-2 text-[var(--erp-accent)]">Purchase -&gt;</Link>
          </>
        )}
        actions={(
          <>
            <ErpButton variant="secondary" className={btnSm} onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </ErpButton>
            {canExport && (
              <ErpButton variant="secondary" className={btnSm} onClick={exportCsv} disabled={!items.length}>
                <Download className="mr-1 inline h-3.5 w-3.5" />
                Export
              </ErpButton>
            )}
            {canManage && (
              <ErpButton className={btnSm} onClick={() => (showForm ? closeForm() : setShowForm(true))}>
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

      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-[var(--erp-border)] bg-[var(--erp-border)] sm:grid-cols-2">
        <StatTile icon={Users} label="Vendors" value={stats?.suppliers ?? items.length} />
        <StatTile icon={Users} label="On this page" value={items.length} />
      </div>

      <TabShell>
        {canManage && showForm && (
          <ComposeSection title="New vendor" hint="Saved to the supplier master used on POs and RFQs.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={fieldLabel}>Vendor ID</label>
                <ErpInput
                  className="!py-1.5 font-mono text-[12px]"
                  value={form.supplierCode}
                  onChange={(e) => setForm({ ...form, supplierCode: e.target.value })}
                  placeholder="V0038"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel}>Name</label>
                <ErpInput
                  className="!py-1.5 text-[12px]"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className={fieldLabel}>Contact person</label>
                <ErpInput
                  className="!py-1.5 text-[12px]"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                />
              </div>
              <div>
                <label className={fieldLabel}>Mobile</label>
                <ErpInput
                  className="!py-1.5 font-mono text-[12px]"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className={fieldLabel}>Email</label>
                <ErpInput
                  className="!py-1.5 text-[12px]"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                />
              </div>
              <div>
                <label className={fieldLabel}>GST No.</label>
                <ErpInput
                  className="!py-1.5 font-mono text-[12px]"
                  value={form.gstNumber}
                  onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
                />
              </div>
              <div>
                <label className={fieldLabel}>Material supplied</label>
                <ErpInput
                  className="!py-1.5 text-[12px]"
                  value={form.materialsSupplied}
                  onChange={(e) => setForm({ ...form, materialsSupplied: e.target.value })}
                />
              </div>
              <div>
                <label className={fieldLabel}>Payment terms</label>
                <ErpInput
                  className="!py-1.5 text-[12px]"
                  value={form.paymentTerms}
                  onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                  placeholder="On Delivery / Net 7 / Advance"
                />
              </div>
              <div>
                <label className={fieldLabel}>Lead days</label>
                <ErpInput
                  className="!py-1.5 text-[12px]"
                  type="number"
                  min={0}
                  value={form.leadTimeDays}
                  onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2">
                <ErpButton
                  className={btnSm}
                  disabled={!form.supplierCode.trim() || !form.name.trim() || createVendor.isPending}
                  onClick={() => createVendor.mutate()}
                >
                  {createVendor.isPending ? 'Saving...' : 'Save'}
                </ErpButton>
                <ErpButton variant="secondary" className={btnSm} onClick={closeForm}>
                  Cancel
                </ErpButton>
              </div>
            </div>
          </ComposeSection>
        )}

        <TabToolbar title="Vendor master" hint="Search by vendor ID, name, GST, or material.">
          <div className="relative min-w-[200px]">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-erp-text-muted" />
            <ErpInput
              className="!py-1.5 pl-8 text-[12px]"
              placeholder="Search vendor ID, name, GST, material..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            />
          </div>
          <ErpButton variant="secondary" className={btnSm} onClick={runSearch}>Search</ErpButton>
        </TabToolbar>

        {isLoading ? (
          <p className="p-6 text-[13px] text-erp-text-muted">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <ErpDataTable className="w-full min-w-[1100px] text-[12px]">
              <thead>
                <tr>
                  <th>Vendor ID</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>GST</th>
                  <th>Material</th>
                  <th>Payment</th>
                  <th>Lead</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s._id}>
                    <td className="whitespace-nowrap font-mono">{s.supplierCode}</td>
                    <td className="font-medium">{s.name}</td>
                    <td className="text-erp-text-muted">{s.contactPerson || '-'}</td>
                    <td className="whitespace-nowrap font-mono">{s.phone || '-'}</td>
                    <td className="text-erp-text-muted">{s.contactEmail || '-'}</td>
                    <td className="whitespace-nowrap font-mono text-[11px]">{s.gstNumber || '-'}</td>
                    <td>{s.materialsSupplied || '-'}</td>
                    <td className="whitespace-nowrap">{s.paymentTerms || '-'}</td>
                    <td className="text-right">{s.leadTimeDays ?? '-'}</td>
                    <td><ErpStatusBadge status={s.status || 'ACTIVE'} /></td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <EmptyRow colSpan={10}>No vendors found</EmptyRow>
                )}
              </tbody>
            </ErpDataTable>
          </div>
        )}

        {meta && (
          <TablePager
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </TabShell>
    </div>
  );
}

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Factory as FactoryIcon, Plus } from 'lucide-react';
import api from '../../services/api';
import { orgApi } from '../../services/admin';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  Button, Drawer, EmptyRow, ErpDataTable, ErpInput, Field, FilterBar, PageHeader, SearchInput, Section, TableSkeleton,
} from '../../components/erp';
import { QueryState } from '../../components/QueryState';

type Org = { _id: string; code: string; name: string; legalName?: string };
type FactoryRow = { _id: string; code: string; name: string; organizationId: string };

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

const listFactories = (orgId: string) =>
  api.get<{ data: FactoryRow[] }>(`/organizations/${orgId}/factories`, { params: { limit: 100 } }).then(unwrap);

export function AdminPage() {
  const [q, setQ] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [openOrgId, setOpenOrgId] = useState<string | null>(null);
  const { data: orgs = [], isLoading, isError, error, refetch } = useQuery({ queryKey: ['organizations'], queryFn: orgApi.list });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? orgs.filter((o) => o.code.toLowerCase().includes(s) || o.name.toLowerCase().includes(s)) : orgs;
  }, [orgs, q]);
  const openOrg = orgs.find((o) => o._id === openOrgId) ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Organizations"
        description="Companies using this ERP instance and their factories."
        primaryAction={<Button size="sm" icon={<Plus size={16} />} onClick={() => setCreatingOrg(true)}>New organization</Button>}
      />
      <Section flush>
        <FilterBar search={<SearchInput value={q} onChange={setQ} placeholder="Search organizations…" inputSize="sm" />} />
        <QueryState isError={isError} error={error} onRetry={refetch}>
          <ErpDataTable>
            <thead>
              <tr><th>Name</th><th>Code</th></tr>
            </thead>
            <tbody>
              {isLoading ? <TableSkeleton asRows rows={3} columns={2} /> : rows.length === 0 ? (
                <EmptyRow colSpan={2} icon={Building2} title={q ? 'No organizations match' : 'No organizations yet'} />
              ) : rows.map((o) => (
                <tr key={o._id} className="erp-row-clickable" onClick={() => setOpenOrgId(o._id)}>
                  <td className="erp-cell-primary">{o.name}</td>
                  <td className="font-mono text-erp-text-secondary">{o.code}</td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        </QueryState>
      </Section>
      <OrganizationFormDrawer open={creatingOrg} onClose={() => setCreatingOrg(false)} onCreated={(id) => setOpenOrgId(id)} />
      <OrganizationDrawer org={openOrg} onClose={() => setOpenOrgId(null)} />
    </div>
  );
}

function OrganizationFormDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { setCode(''); setName(''); setErrors({}); } }, [open]);

  const create = useMutation({
    mutationFn: () => api.post<{ data: Org }>('/organizations', { code: code.trim().toUpperCase(), name: name.trim() }).then(unwrap),
    meta: { successMessage: 'Organization created', successDescription: 'Add its first factory next.' },
    onSuccess: (org) => {
      qc.invalidateQueries({ queryKey: ['organizations'] });
      onClose();
      onCreated(org._id);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Enter the company name.';
    if (!/^[A-Za-z0-9]{3,10}$/.test(code.trim())) next.code = 'Use 3–10 letters or digits, for example ACME.';
    setErrors(next);
    if (!Object.keys(next).length) create.mutate();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      closeOnOverlayClick={false}
      title="New organization"
      description="A separate company with its own users, roles and factories."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="org-form" loading={create.isPending}>Create organization</Button>
        </>
      )}
    >
      <form id="org-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Organization name" required error={errors.name}>
          <ErpInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Apparel Pvt Ltd" />
        </Field>
        <Field label="Code" required error={errors.code} hint="Short unique code, 3–10 letters or digits.">
          <ErpInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ACME" />
        </Field>
      </form>
    </Drawer>
  );
}

function OrganizationDrawer({ org, onClose }: { org: Org | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { refreshSession } = useAuth();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { setCode(''); setName(''); setErrors({}); }, [org?._id]);

  const { data: factories = [], isLoading } = useQuery({
    queryKey: ['org-factories', org?._id],
    queryFn: () => listFactories(org!._id),
    enabled: !!org,
  });

  const create = useMutation({
    mutationFn: () => api.post<{ data: FactoryRow }>(`/organizations/${org!._id}/factories`, {
      code: code.trim().toUpperCase(), name: name.trim(),
    }).then(unwrap),
    meta: { successMessage: 'Factory added', successDescription: 'Assign people a role there from Users & roles.' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-factories', org?._id] });
      setCode('');
      setName('');
      // The super admin's factory switcher lists every factory — refresh it.
      refreshSession().catch(() => {});
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.factoryName = 'Enter the factory name.';
    if (!/^[A-Za-z0-9]{2,8}$/.test(code.trim())) next.factoryCode = 'Use 2–8 letters or digits, for example F02.';
    setErrors(next);
    if (!Object.keys(next).length) create.mutate();
  };

  return (
    <Drawer
      open={!!org}
      onClose={onClose}
      title={org ? `${org.name}` : ''}
      description={org ? `Organization ${org.code}` : undefined}
    >
      {org && (
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-erp-text-primary">Factories</h3>
            <ErpDataTable>
              <thead><tr><th>Code</th><th>Name</th></tr></thead>
              <tbody>
                {isLoading ? <TableSkeleton asRows rows={2} columns={2} /> : factories.length === 0 ? (
                  <EmptyRow colSpan={2} icon={FactoryIcon} title="No factories yet" />
                ) : factories.map((f) => (
                  <tr key={f._id}>
                    <td className="font-mono">{f.code}</td>
                    <td className="erp-cell-primary">{f.name}</td>
                  </tr>
                ))}
              </tbody>
            </ErpDataTable>
          </section>
          <form onSubmit={submit} className="space-y-3 rounded-lg border border-[var(--erp-border)] p-3" noValidate aria-label="Add factory">
            <h3 className="text-sm font-semibold text-erp-text-primary">Add factory</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Factory code" required error={errors.factoryCode}>
                <ErpInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="F02" />
              </Field>
              <Field label="Factory name" required error={errors.factoryName} className="sm:col-span-2">
                <ErpInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Second Stitching Unit" />
              </Field>
            </div>
            <Button type="submit" size="sm" icon={<Plus size={16} />} loading={create.isPending}>Add factory</Button>
          </form>
        </div>
      )}
    </Drawer>
  );
}

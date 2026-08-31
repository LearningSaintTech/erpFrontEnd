import { Info, Shield, Users } from 'lucide-react';
import { ErpCard } from '../../components/erp';

export function RbacInfoCard({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="mb-3 flex w-full items-center gap-2 rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface-muted)] px-3 py-2 text-left text-[11px] text-erp-text-muted hover:bg-[var(--erp-surface)]"
      >
        <Info size={14} />
        <span>How access works — click to expand</span>
      </button>
    );
  }

  return (
    <ErpCard className="mb-3 !p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-medium">
          <Shield size={14} className="text-[var(--erp-accent)]" />
          Role-based access (RBAC)
        </h3>
        <button type="button" onClick={onToggle} className="text-[10px] text-erp-text-muted hover:text-erp-text-secondary">
          Hide
        </button>
      </div>
      <div className="grid gap-2 text-[10px] leading-snug text-erp-text-muted sm:grid-cols-3">
        <div className="flex gap-2 rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] p-2">
          <Users size={14} className="mt-0.5 shrink-0 text-erp-text-secondary" />
          <div>
            <p className="font-medium text-erp-text-secondary">Users</p>
            <p>People in your organization. Assign one or more roles per factory.</p>
          </div>
        </div>
        <div className="flex gap-2 rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] p-2">
          <Shield size={14} className="mt-0.5 shrink-0 text-erp-text-secondary" />
          <div>
            <p className="font-medium text-erp-text-secondary">Roles</p>
            <p>Named permission bundles (e.g. Designer). System roles are read-only; create custom roles as needed.</p>
          </div>
        </div>
        <div className="flex gap-2 rounded border border-[var(--erp-border)] bg-[var(--erp-surface)] p-2">
          <Info size={14} className="mt-0.5 shrink-0 text-erp-text-secondary" />
          <div>
            <p className="font-medium text-erp-text-secondary">Delegations</p>
            <p>Temporarily lend a subset of your permissions to a colleague at the selected factory.</p>
          </div>
        </div>
      </div>
    </ErpCard>
  );
}

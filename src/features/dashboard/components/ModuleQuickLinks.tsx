import { Link } from 'react-router-dom';
import {
  BarChart3, Boxes, ClipboardCheck, Factory, FileText, Layers, Package, Palette,
  ShoppingCart, Trash2,
} from 'lucide-react';
import { ErpCard } from '../../../components/erp';
import { MODULE_LINKS } from '../dashboardUtils';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Designs: Palette,
  Sampling: ClipboardCheck,
  SKUs: Layers,
  BOMs: FileText,
  Inventory: Package,
  Purchase: ShoppingCart,
  Production: Factory,
  Quality: ClipboardCheck,
  Warehouse: Boxes,
  Waste: Trash2,
  Reports: BarChart3,
  Approvals: ClipboardCheck,
};

function canAccess(permissions: string[], required: string) {
  return permissions.includes('*') || permissions.includes(required);
}

export function ModuleQuickLinks({ permissions }: { permissions: string[] }) {
  const visible = MODULE_LINKS.filter((m) => canAccess(permissions, m.perm));

  return (
    <ErpCard className="p-4">
      <p className="mb-3 text-sm font-semibold">Module navigation</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((m) => {
          const Icon = ICONS[m.name] || Package;
          return (
            <Link
              key={m.path}
              to={m.path}
              className="group flex items-start gap-3 rounded-lg border border-erp-border/50 p-3 transition hover:border-[var(--erp-accent)] hover:bg-[var(--erp-accent-muted)]/20"
            >
              <div className="rounded-lg p-2" style={{ background: 'var(--erp-accent-muted)' }}>
                <Icon className="h-4 w-4 text-[var(--erp-accent)]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold group-hover:text-[var(--erp-accent)]">{m.name}</p>
                <p className="text-[10px] text-erp-text-muted">{m.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </ErpCard>
  );
}

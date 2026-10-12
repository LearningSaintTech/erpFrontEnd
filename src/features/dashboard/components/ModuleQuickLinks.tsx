import { Link } from 'react-router-dom';
import {
  BarChart3, Boxes, ClipboardCheck, Factory, FileText, Inbox, Layers, Package, Palette,
  Scissors, ShieldCheck, ShoppingCart, Trash2, type LucideIcon,
} from 'lucide-react';
import { Section } from '../../../components/erp';
import { MODULE_LINKS } from '../dashboardUtils';

const ICONS: Record<string, LucideIcon> = {
  Designs: Palette,
  Sampling: Scissors,
  SKUs: Layers,
  BOMs: FileText,
  Inventory: Package,
  Purchase: ShoppingCart,
  Production: Factory,
  Quality: ShieldCheck,
  Warehouse: Boxes,
  Waste: Trash2,
  Reports: BarChart3,
  Approvals: Inbox,
};

function canAccess(permissions: string[], required: string) {
  return permissions.includes('*') || permissions.includes(required);
}

export function ModuleQuickLinks({ permissions, title = 'Go to' }: { permissions: string[]; title?: string }) {
  const visible = MODULE_LINKS.filter((m) => canAccess(permissions, m.perm));
  if (visible.length === 0) return null;

  return (
    <Section title={title}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((m) => {
          const Icon = ICONS[m.name] || ClipboardCheck;
          return (
            <Link
              key={m.path}
              to={m.path}
              className="group flex items-center gap-3 rounded-lg border border-[var(--erp-border)] p-3 transition-colors hover:border-[var(--erp-accent)] hover:bg-[var(--erp-surface-muted)]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--erp-accent-subtle)] text-[var(--erp-accent)]" aria-hidden="true">
                <Icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-erp-text-primary group-hover:text-[var(--erp-accent)]">{m.name}</span>
                <span className="block truncate text-xs text-erp-text-muted">{m.desc}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}

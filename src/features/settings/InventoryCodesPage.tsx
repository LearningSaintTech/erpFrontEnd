import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { Button, PageHeader, Tabs } from '../../components/erp';
import { InventoryCodesTab } from './tabs/InventoryCodesTab';
import { SkuFormulaTab } from './tabs/SkuFormulaTab';

const TABS = [
  { id: 'codes', label: 'Master codes' },
  { id: 'formula', label: 'SKU formula' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function InventoryCodesPage() {
  const { permissions } = useAuth();
  const [tab, setTab] = useState<TabId>('codes');
  const [creating, setCreating] = useState(false);

  const canConfigure = permissions.includes('*') || permissions.includes('inventory.configure');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory codes"
        description="Master codes such as category, fit and colour, and the order they appear in SKUs."
        primaryAction={tab === 'codes' && canConfigure ? (
          <Button size="sm" icon={<Plus size={16} />} onClick={() => setCreating(true)}>New code</Button>
        ) : undefined}
      />

      <Tabs tabs={TABS} active={tab} onChange={(id) => setTab(id as TabId)} ariaLabel="Inventory codes" />

      {tab === 'codes' && (
        <InventoryCodesTab canConfigure={canConfigure} createOpen={creating} onCreateOpenChange={setCreating} />
      )}
      {tab === 'formula' && <SkuFormulaTab canConfigure={canConfigure} />}
    </div>
  );
}

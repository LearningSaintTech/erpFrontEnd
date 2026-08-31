import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { ErpPageHeader, ErpTabs } from '../../components/erp';
import { AlertBanner } from '../../components/AlertBanner';
import { SuccessBanner } from '../users/SuccessBanner';
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canConfigure = permissions.includes('*') || permissions.includes('inventory.configure');

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 4000);
  };

  return (
    <div className="inventory-codes-page text-xs leading-snug [&_.erp-page-header]:mb-3 [&_.erp-page-title]:text-base [&_.erp-page-subtitle]:text-[10px]">
      <AlertBanner message={error} onDismiss={() => setError('')} />
      <SuccessBanner message={success} onDismiss={() => setSuccess('')} />

      <ErpPageHeader
        title="Inventory codes & SKU formula"
        subtitle={(
          <>
            Master data for SKU generation — category, fit, colour codes and segment order.
            <Link to="/settings/general" className="ml-2 inline-flex items-center gap-0.5 text-[var(--erp-accent)]">
              <ArrowLeft size={10} /> Back to settings
            </Link>
          </>
        )}
      />

      <ErpTabs tabs={TABS} active={tab} onChange={(id) => setTab(id as TabId)} />

      {tab === 'codes' && (
        <InventoryCodesTab
          canConfigure={canConfigure}
          onError={setError}
          onSuccess={showSuccess}
        />
      )}
      {tab === 'formula' && (
        <SkuFormulaTab
          canConfigure={canConfigure}
          onError={setError}
          onSuccess={showSuccess}
        />
      )}
    </div>
  );
}

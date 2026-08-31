interface ErpTab {
  readonly id: string;
  readonly label: string;
}

interface ErpTabsProps {
  tabs: readonly ErpTab[];
  active: string;
  onChange: (id: string) => void;
}

export function ErpTabs({ tabs, active, onChange }: ErpTabsProps) {
  return (
    <div className="erp-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`erp-tab${active === tab.id ? ' erp-tab-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

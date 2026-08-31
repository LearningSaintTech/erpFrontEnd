import { useAuth } from '../app/providers/AuthProvider';
import { ErpSelect } from './erp';

export function FactorySwitcher() {
  const { factories, factoryId, setFactoryId } = useAuth();
  if (!factories.length) return null;
  return (
    <ErpSelect
      value={factoryId || ''}
      onChange={(e) => setFactoryId(e.target.value)}
    >
      {factories.map((f) => (
        <option key={f._id} value={f._id}>
          {f.code} — {f.name}
        </option>
      ))}
    </ErpSelect>
  );
}

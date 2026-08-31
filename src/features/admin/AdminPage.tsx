import { useQuery } from '@tanstack/react-query';
import { orgApi } from '../../services/admin';

export function AdminPage() {
  const { data: orgs = [] } = useQuery({ queryKey: ['organizations'], queryFn: orgApi.list });

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold">Organizations</h2>
      <div className="erp-card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-transparent">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o._id} className="border-b">
                <td className="px-4 py-3 font-mono text-xs">{o.code}</td>
                <td className="px-4 py-3">{o.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

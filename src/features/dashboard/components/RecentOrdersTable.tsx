import { Link } from 'react-router-dom';
import { ErpCard, ErpDataTable, ErpStatusBadge } from '../../../components/erp';
import type { RecentOrderRow } from '../useDashboardData';

export function RecentOrdersTable({ orders }: { orders: RecentOrderRow[] }) {
  return (
    <ErpCard className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-erp-border px-4 py-3">
        <p className="text-sm font-semibold">Recent activity</p>
        <div className="flex gap-3">
          <Link to="/production" className="text-[10px] text-[var(--erp-accent)] hover:underline">Production</Link>
          <Link to="/purchase" className="text-[10px] text-[var(--erp-accent)] hover:underline">Purchase</Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <ErpDataTable>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Type</th>
              <th>Qty / Value</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-erp-text-muted">No recent orders</td></tr>
            )}
            {orders.map((order) => (
              <tr key={`${order.id}-${order.type}`}>
                <td>
                  <Link to={order.link} className="font-mono text-xs font-medium hover:text-[var(--erp-accent)]">
                    {order.id}
                  </Link>
                </td>
                <td className="text-xs text-erp-text-muted">{order.type}</td>
                <td className="text-xs font-medium">{order.total}</td>
                <td><ErpStatusBadge status={order.status} /></td>
                <td className="text-xs text-erp-text-muted">{order.date}</td>
              </tr>
            ))}
          </tbody>
        </ErpDataTable>
      </div>
    </ErpCard>
  );
}

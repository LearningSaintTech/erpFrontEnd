import { Link, useNavigate } from 'react-router-dom';
import { History } from 'lucide-react';
import { EmptyRow, ErpDataTable, Section, StatusBadge } from '../../../components/erp';
import type { RecentOrderRow } from '../useDashboardData';

export function RecentOrdersTable({ orders, title = 'Recent activity' }: { orders: RecentOrderRow[]; title?: string }) {
  const navigate = useNavigate();
  return (
    <Section
      title={title}
      description="Latest production orders and supplier payments."
      actions={(
        <div className="flex gap-3 text-[13px] font-medium">
          <Link to="/production/orders" className="text-[var(--erp-accent)] hover:underline">Production</Link>
          <Link to="/purchase?tab=po" className="text-[var(--erp-accent)] hover:underline">Payments</Link>
        </div>
      )}
      flush
    >
      <ErpDataTable>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Type</th>
            <th className="erp-num">Qty / value</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <EmptyRow colSpan={5} icon={History} title="No recent orders">
              New production orders and payments will show up here.
            </EmptyRow>
          ) : orders.map((order) => (
            <tr key={`${order.id}-${order.type}`} className="erp-row-clickable" onClick={() => navigate(order.link)}>
              <td className="erp-cell-primary">
                <Link to={order.link} className="font-mono hover:text-[var(--erp-accent)]" onClick={(e) => e.stopPropagation()}>
                  {order.id}
                </Link>
              </td>
              <td className="text-erp-text-secondary">{order.type}</td>
              <td className="erp-num">{order.total}</td>
              <td><StatusBadge status={order.status} /></td>
              <td className="whitespace-nowrap text-erp-text-muted">{order.date}</td>
            </tr>
          ))}
        </tbody>
      </ErpDataTable>
    </Section>
  );
}

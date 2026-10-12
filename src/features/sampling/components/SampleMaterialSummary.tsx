import { useQuery } from '@tanstack/react-query';
import { Badge, EmptyState, ErpDataTable } from '../../../components/erp';
import { inventoryApi } from '../../../services/manufacturing';
import type { Sample } from '../../../types/api';
import { formatCost, materialLabel } from '../sampleUtils';

type Line = NonNullable<Sample['materialRequirements']>[number] & { cost?: number };

function Row({ line: m, showStock }: { line: Line; showStock: boolean }) {
  const matId = typeof m.materialId === 'string'
    ? m.materialId
    : (m.materialId as { _id?: string } | undefined)?._id;
  const { data: avail } = useQuery({
    queryKey: ['material-avail', matId],
    queryFn: () => inventoryApi.availability(matId!),
    enabled: !!matId && showStock,
    staleTime: 30_000,
  });
  const need = m.requiredQty ?? 0;
  const available = avail?.available ?? 0;
  const short = !!avail && need > available && !(m.reservedQty ?? 0);
  // Issuing consumes the reservation — show only what is still held, not "Reserved 2 · Issued 2".
  const stillReserved = Math.max(0, (m.reservedQty ?? 0) - (m.issuedQty ?? 0));
  return (
    <tr>
      <td className="erp-cell-primary">{materialLabel(m.materialId)}</td>
      <td className="erp-num">{need} <span className="text-erp-text-muted">{(m.unit || "").toLowerCase()}</span></td>
      {showStock && (
        <td className="erp-num">
          {avail ? (
            <span className={short ? 'font-medium text-[var(--erp-danger-text)]' : ''}>
              {available}
              {(avail.locations?.length ?? 0) > 0 && <span className="ml-1 text-xs text-erp-text-muted">· {avail.locations!.length} bin{avail.locations!.length > 1 ? 's' : ''}</span>}
            </span>
          ) : '—'}
        </td>
      )}
      <td>
        <span className="flex flex-wrap gap-1">
          {short && <Badge tone="danger">Short</Badge>}
          {stillReserved > 0 && <Badge tone="warning">Reserved {stillReserved}</Badge>}
          {(m.issuedQty ?? 0) > 0 && <Badge tone="success">Issued {m.issuedQty}</Badge>}
          {!short && !(m.reservedQty ?? 0) && !(m.issuedQty ?? 0) && <span className="text-erp-text-muted">—</span>}
        </span>
      </td>
      <td className="erp-num">{m.cost != null && m.cost > 0 ? formatCost(m.cost) : '—'}</td>
    </tr>
  );
}

/** Read-only material lines with live stock availability. */
export function SampleMaterialSummary({ lines, showStock = true }: { lines?: Sample['materialRequirements']; showStock?: boolean }) {
  if (!lines?.length) {
    return <EmptyState compact title="No material lines yet" description="The pattern master adds fabric and trims for this sample." />;
  }
  return (
    <ErpDataTable className="min-w-[560px]">
      <thead>
        <tr>
          <th>Material</th>
          <th className="erp-num">Required</th>
          {showStock && <th className="erp-num">Available</th>}
          <th>Store</th>
          <th className="erp-num">Issued cost</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((m, i) => <Row key={i} line={m as Line} showStock={showStock} />)}
      </tbody>
    </ErpDataTable>
  );
}

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ErpButton, ErpStatusBadge } from '../../../components/erp';
import { patternApi } from '../../../services/manufacturing';
import { useAuth } from '../../../app/providers/AuthProvider';
import { hasPermission } from '../../../utils/permissions';
import { useDesignForm } from '../DesignFormContext';
import { sampleTypeLabel, statusLabel } from '../../sampling/sampleUtils';

export function SamplingTab() {
  const { samples, design, designId } = useDesignForm();
  const { permissions, user } = useAuth();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const canPattern = hasPermission(permissions, 'pattern.read', isSuperAdmin);
  const canSample = hasPermission(permissions, 'sampling.read', isSuperAdmin);
  const released = design?.status === 'RELEASED';

  const { data: patternDev } = useQuery({
    queryKey: ['pattern-development', designId],
    queryFn: () => patternApi.get(designId!),
    enabled: !!designId && released,
    retry: false,
  });

  const patternComplete = patternDev?.status === 'COMPLETED';
  const hasApprovedSample = samples.some((s) => s.status === 'APPROVED');
  const activeSample = samples.find((s) => !['APPROVED', 'REJECTED'].includes(s.status));

  return (
    <div className="space-y-4">
      <p className="text-sm text-erp-text-muted">
        Samples for this design. Pattern development must be <strong>completed</strong> before creating samples.
      </p>

      {released && canPattern && !patternComplete && designId && (
        <Link to={`/pattern?designId=${designId}`} className="text-sm text-[var(--erp-accent)] hover:underline">
          Continue pattern verification →
        </Link>
      )}

      {released && patternComplete && canSample && designId && (
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/samples?designId=${designId}`} className="text-sm text-[var(--erp-accent)] hover:underline">
            {activeSample ? 'Open sample workspace →' : 'Create sample →'}
          </Link>
          {activeSample && (
            <Link to={`/samples?sampleId=${activeSample._id}`}>
              <ErpButton variant="secondary" className="!px-2 !py-1 text-[10px]">
                {activeSample.sampleCode}
              </ErpButton>
            </Link>
          )}
        </div>
      )}

      {hasApprovedSample && (
        <p className="text-xs text-emerald-700">
          Sample approved — proceed to the SKU matrix tab or{' '}
          <Link to="/products/skus" className="font-medium text-[var(--erp-accent)] hover:underline">open SKU workspace</Link>.
        </p>
      )}

      {samples.length === 0 ? (
        <p className="text-sm text-erp-text-muted">No samples yet for this design.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-transparent">
            <tr>
              <th className="px-3 py-2">Sample #</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Comments</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {samples.map((s) => (
              <tr key={s._id} className="border-b">
                <td className="px-3 py-2 font-mono text-xs">{s.sampleCode}</td>
                <td className="px-3 py-2">{sampleTypeLabel(s.sampleType)}</td>
                <td className="px-3 py-2">
                  <ErpStatusBadge status={s.status} label={statusLabel(s.status)} />
                </td>
                <td className="px-3 py-2 text-erp-text-secondary">{s.comments || '—'}</td>
                <td className="px-3 py-2 text-right">
                  <Link to={`/samples?sampleId=${s._id}`} className="text-xs text-[var(--erp-accent)] hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {designId && !released && (
        <p className="text-xs text-amber-700">Release this design to enable pattern development and sampling.</p>
      )}
      {released && !patternComplete && (
        <p className="text-xs text-amber-700">Complete pattern verification before creating samples.</p>
      )}
    </div>
  );
}

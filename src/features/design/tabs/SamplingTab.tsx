import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Scissors } from 'lucide-react';
import {
  Button, EmptyState, ErpDataTable, InfoBanner, Section, StatusBadge,
} from '../../../components/erp';
import { patternApi } from '../../../services/manufacturing';
import { useAuth } from '../../../app/providers/AuthProvider';
import { hasPermission } from '../../../utils/permissions';
import { useDesignForm } from '../DesignFormContext';
import { sampleTypeLabel, statusLabel } from '../../sampling/sampleUtils';

export function SamplingTab() {
  const navigate = useNavigate();
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

  let next: { text: string; action?: { label: string; to: string } } | null = null;
  if (designId && !released) {
    next = { text: 'Pattern and sampling start once this design is released.' };
  } else if (released && !patternComplete) {
    next = {
      text: patternDev ? 'Pattern development is in progress.' : 'Waiting for a pattern master to be assigned.',
      action: canPattern ? { label: 'Open pattern workspace', to: `/pattern?designId=${designId}` } : undefined,
    };
  } else if (patternComplete && !hasApprovedSample) {
    next = {
      text: activeSample ? `Sample ${activeSample.sampleCode} is in progress.` : 'Pattern is complete — a sample can be created.',
      action: canSample
        ? { label: activeSample ? 'Open sample' : 'Create sample', to: activeSample ? `/samples?sampleId=${activeSample._id}` : `/samples?designId=${designId}&from=pattern` }
        : undefined,
    };
  } else if (hasApprovedSample) {
    next = { text: 'Sample approved — generate SKUs and build the BOM.', action: { label: 'Open SKUs', to: '/products/skus' } };
  }

  return (
    <div className="space-y-4">
      {next && (
        <InfoBanner
          inset={false}
          tone={hasApprovedSample ? 'success' : 'info'}
          action={next.action ? (
            <Button size="sm" variant="secondary" iconRight={<ArrowRight size={14} />} onClick={() => navigate(next!.action!.to)}>
              {next.action.label}
            </Button>
          ) : undefined}
        >
          {next.text}
        </InfoBanner>
      )}

      <Section title="Samples" description="Every sample made for this design." flush={samples.length > 0}>
        {samples.length === 0 ? (
          <EmptyState compact icon={Scissors} title="No samples yet" description="Samples appear here once the sampling team creates them." />
        ) : (
          <ErpDataTable>
            <thead>
              <tr>
                <th>Sample</th>
                <th>Type</th>
                <th>Status</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s) => (
                <tr key={s._id} className="erp-row-clickable" onClick={() => navigate(`/samples?sampleId=${s._id}`)}>
                  <td className="erp-cell-primary font-mono">{s.sampleCode}</td>
                  <td>{sampleTypeLabel(s.sampleType)}</td>
                  <td><StatusBadge status={s.status} label={statusLabel(s.status)} /></td>
                  <td className="text-erp-text-secondary">{s.comments || '—'}</td>
                </tr>
              ))}
            </tbody>
          </ErpDataTable>
        )}
      </Section>
    </div>
  );
}

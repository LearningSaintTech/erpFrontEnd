import type { Design, PatternDevelopment, Sample } from '../../types/api';

export type PipelineStepId =
  | 'approval'
  | 'release'
  | 'pattern'
  | 'sampling'
  | 'sku'
  | 'production';

export type PipelineStepState = 'done' | 'current' | 'upcoming' | 'blocked';

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  description: string;
  state: PipelineStepState;
  href?: string;
  actionLabel?: string;
}

function hasApprovedSample(samples: Sample[]) {
  return samples.some((s) => s.status === 'APPROVED');
}

function hasActiveSample(samples: Sample[]) {
  return samples.some((s) => !['APPROVED', 'REJECTED'].includes(s.status));
}

export function buildDesignPipeline(
  design: Design | undefined,
  pattern: PatternDevelopment | null | undefined,
  samples: Sample[],
  designId: string,
  opts: {
    canApprove?: boolean;
    canPattern?: boolean;
    canSample?: boolean;
  } = {},
): PipelineStep[] {
  const status = design?.status ?? 'DRAFT';
  const patternComplete = pattern?.status === 'COMPLETED';
  const sampleApproved = hasApprovedSample(samples);
  const sampleActive = hasActiveSample(samples);
  const released = status === 'RELEASED' || patternComplete || sampleActive || sampleApproved;

  const approvalDone = !['DRAFT', 'REVISION_REQUESTED', 'IN_REVIEW'].includes(status) || released;

  return [
    {
      id: 'approval',
      label: 'Design approval',
      description: status === 'IN_REVIEW'
        ? 'Waiting for admin review'
        : status === 'REVISION_REQUESTED'
          ? 'Revision requested — update and resubmit'
          : status === 'REJECTED'
            ? 'Rejected — clone to start again'
            : approvalDone
              ? 'Approved'
              : 'Submit tech pack for approval',
      state: approvalDone ? 'done' : ['IN_REVIEW', 'REVISION_REQUESTED'].includes(status) ? 'current' : 'upcoming',
    },
    {
      id: 'release',
      label: 'Release version',
      description: released
        ? `Released v${design?.releasedVersion ?? design?.currentVersion ?? 1}`
        : status === 'APPROVED'
          ? 'Release locks the tech pack for pattern development'
          : 'Approve design first, then release',
      state: released
        ? 'done'
        : status === 'APPROVED'
          ? 'current'
          : approvalDone
            ? 'blocked'
            : 'upcoming',
      actionLabel: status === 'APPROVED' && opts.canApprove ? 'Use Approver actions below to release' : undefined,
    },
    {
      id: 'pattern',
      label: 'Pattern development',
      description: !released
        ? 'Available after design is released'
        : patternComplete
          ? 'Pattern verification complete'
          : pattern
            ? `Verify size chart, consumption & BOM (${pattern.status?.replace(/_/g, ' ')})`
            : 'Assign pattern master and verify tech pack',
      state: patternComplete
        ? 'done'
        : released
          ? 'current'
          : 'blocked',
      href: released && opts.canPattern ? `/pattern?designId=${designId}` : undefined,
      actionLabel: released && opts.canPattern ? 'Open pattern workspace' : undefined,
    },
    {
      id: 'sampling',
      label: 'Sampling',
      description: !patternComplete
        ? 'Unlocks when pattern development is completed'
        : sampleApproved
          ? 'Fit sample approved for bulk production'
          : sampleActive
            ? 'Sample workflow in progress'
            : 'Create prototype or fit sample',
      state: sampleApproved
        ? 'done'
        : patternComplete
          ? 'current'
          : 'blocked',
      href: patternComplete && opts.canSample ? `/samples?designId=${designId}&from=pattern` : undefined,
      actionLabel: patternComplete && opts.canSample ? 'Create / manage samples' : undefined,
    },
    {
      id: 'sku',
      label: 'SKU matrix',
      description: sampleApproved
        ? 'Generate SKU codes from the approved sample'
        : 'Requires an approved sample',
      state: sampleApproved ? 'current' : 'blocked',
      href: sampleApproved ? '/products/skus' : undefined,
      actionLabel: sampleApproved ? 'Open SKU matrix' : undefined,
    },
    {
      id: 'production',
      label: 'Production orders',
      description: sampleApproved
        ? 'Create orders after SKUs and active BOM are ready'
        : 'Requires SKUs and active BOM',
      state: sampleApproved ? 'upcoming' : 'blocked',
      href: sampleApproved ? '/production/orders' : undefined,
      actionLabel: sampleApproved ? 'Open production' : undefined,
    },
  ];
}

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserX } from 'lucide-react';
import { Button, EmptyState, Section } from '../../../components/erp';

export function PatternNotAssigned({
  designId,
  onClose,
  canAssign,
}: {
  designId: string;
  onClose: () => void;
  canAssign: boolean;
}) {
  const navigate = useNavigate();
  return (
    <Section>
      <EmptyState
        icon={UserX}
        title="No pattern master assigned yet"
        description={canAssign
          ? 'Assign a pattern master from the queue to start pattern development. Sampling stays locked until it is complete.'
          : 'A design manager needs to assign a pattern master to this design before work can start.'}
        action={(
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" icon={<ArrowLeft size={14} />} onClick={onClose}>Back to queue</Button>
            <Button variant="secondary" onClick={() => navigate(`/designs/${designId}/edit`)}>View design</Button>
          </div>
        )}
      />
    </Section>
  );
}

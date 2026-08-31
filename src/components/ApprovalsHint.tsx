import { Link } from 'react-router-dom';

interface ApprovalsHintProps {
  label?: string;
}

export function ApprovalsHint({
  label = 'Pending approval — use the Approvals inbox',
}: ApprovalsHintProps) {
  return (
    <Link to="/approvals" className="text-sm text-[var(--erp-accent)] hover:underline">
      {label} →
    </Link>
  );
}

import type { ReactNode } from 'react';
import { Section } from '../../../components/erp';

/** A titled card inside the design tech pack; fields flow in a 1- or 2-column grid. */
export function DesignFormSection({
  title,
  hint,
  children,
  columns = 2,
  actions,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  columns?: 1 | 2 | 3;
  actions?: ReactNode;
}) {
  const grid = columns === 3
    ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
    : columns === 2
      ? 'grid gap-4 sm:grid-cols-2'
      : 'space-y-4';
  return (
    <Section title={title} description={hint} actions={actions}>
      <div className={grid}>{children}</div>
    </Section>
  );
}

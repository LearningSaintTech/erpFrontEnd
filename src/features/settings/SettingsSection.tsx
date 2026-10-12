import { useEffect, type ReactNode } from 'react';
import { Button, Field, Section } from '../../components/erp';

/** A settings group: card with a title, one-line description and its fields. */
export function SettingsSection({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Section title={title} description={description} actions={actions}>
      {children}
    </Section>
  );
}

/** Thin wrapper kept for older call sites — prefer <Field>. */
export function FieldLabel({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return <Field label={label} hint={hint} className={className}>{children}</Field>;
}

/**
 * Sticky bar at the bottom of a settings form. Shows "Unsaved changes" with Discard / Save
 * while the form is dirty, and warns before the browser tab is closed.
 */
export function SaveBar({
  dirty, saving, onSave, onDiscard, saveLabel = 'Save changes', disabled,
}: {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
  disabled?: boolean;
}) {
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  if (!dirty && !saving) return null;
  return (
    <div
      className="sticky bottom-0 z-[var(--erp-z-sticky)] -mx-1 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--erp-border)] bg-[var(--erp-surface)] py-3 pl-4 pr-16 shadow-erp-md sm:pr-20"
      role="region"
      aria-label="Unsaved changes"
    >
      <p className="flex items-center gap-2 text-[13px] font-medium text-erp-text-primary">
        <span className="h-2 w-2 rounded-full bg-[var(--erp-warning-solid)]" aria-hidden="true" />
        You have unsaved changes
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onDiscard} disabled={saving}>Discard</Button>
        <Button size="sm" onClick={onSave} loading={saving} disabled={disabled}>{saveLabel}</Button>
      </div>
    </div>
  );
}

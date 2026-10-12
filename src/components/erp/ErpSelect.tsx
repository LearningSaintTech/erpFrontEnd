import { forwardRef, type SelectHTMLAttributes } from 'react';

export interface ErpSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  /** 32px compact control. */
  inputSize?: 'sm' | 'md';
}

export const ErpSelect = forwardRef<HTMLSelectElement, ErpSelectProps>(function ErpSelect(
  { className = '', children, invalid, inputSize = 'md', ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={`erp-select min-w-0${inputSize === 'sm' ? ' erp-input-sm' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </select>
  );
});

/** Alias for new code. */
export const Select = ErpSelect;

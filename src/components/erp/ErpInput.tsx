import { forwardRef, type InputHTMLAttributes } from 'react';

export interface ErpInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Marks the control invalid (red border + aria-invalid). */
  invalid?: boolean;
  /** 32px compact control. */
  inputSize?: 'sm' | 'md';
}

export const ErpInput = forwardRef<HTMLInputElement, ErpInputProps>(function ErpInput(
  { className = '', invalid, inputSize = 'md', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={`erp-input${inputSize === 'sm' ? ' erp-input-sm' : ''} ${className}`.trim()}
      {...props}
    />
  );
});

/** Alias for new code. */
export const Input = ErpInput;

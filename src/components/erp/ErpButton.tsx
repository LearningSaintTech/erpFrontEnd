import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Tooltip } from './Tooltip';

export type ErpButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'danger-solid'
  | 'link'
  /** @deprecated legacy square icon button — prefer <IconButton> */
  | 'icon';

/** lg = 44px touch target for shop-floor tablets. */
export type ErpButtonSize = 'sm' | 'md' | 'lg';

export interface ErpButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ErpButtonVariant;
  size?: ErpButtonSize;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  /** Icon element rendered before the label, e.g. `<Plus size={16} />`. */
  icon?: ReactNode;
  /** Icon element rendered after the label. */
  iconRight?: ReactNode;
  /** Stretch to full width. */
  block?: boolean;
}

const variantClass: Record<ErpButtonVariant, string> = {
  primary: 'erp-btn-primary',
  secondary: 'erp-btn-secondary',
  ghost: 'erp-btn-ghost',
  danger: 'erp-btn-danger',
  'danger-solid': 'erp-btn-danger-solid',
  link: 'erp-btn-link',
  icon: 'erp-icon-btn',
};

export function Spinner({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`erp-spinner ${className}`.trim()}
      style={{ width: size, height: size }}
    />
  );
}

export const ErpButton = forwardRef<HTMLButtonElement, ErpButtonProps>(function ErpButton(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    block,
    className = '',
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const cls = [
    variantClass[variant],
    size === 'sm' && variant !== 'link' ? 'erp-btn-sm' : '',
    size === 'lg' && variant !== 'link' ? 'erp-btn-lg' : '',
    block ? 'erp-btn-block' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size={size === 'sm' ? 12 : 14} /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

/** Alias — new code can import `Button`. */
export const Button = ErpButton;

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required: describes the action for screen readers (also the default tooltip). */
  'aria-label': string;
  /** Tooltip text. Defaults to aria-label; pass `false` to disable. */
  tooltip?: ReactNode | false;
  size?: ErpButtonSize;
  /** Adds a hairline border + white background. */
  outlined?: boolean;
  loading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { tooltip, size = 'md', outlined, loading, className = '', children, disabled, type = 'button', ...props },
  ref,
) {
  const btn = (
    <button
      ref={ref}
      type={type}
      className={[
        'erp-icon-btn',
        size === 'sm' ? 'erp-btn-sm' : '',
        size === 'lg' ? 'erp-btn-lg' : '',
        outlined ? 'erp-icon-btn-outlined' : '',
        className,
      ].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size={14} /> : children}
    </button>
  );
  const tip = tooltip === undefined ? props['aria-label'] : tooltip;
  if (tip === false || tip == null || tip === '') return btn;
  return <Tooltip content={tip}>{btn}</Tooltip>;
});

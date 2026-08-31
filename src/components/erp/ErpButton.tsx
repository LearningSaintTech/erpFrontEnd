import type { ButtonHTMLAttributes } from 'react';

type ErpButtonVariant = 'primary' | 'secondary' | 'danger' | 'icon';

interface ErpButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ErpButtonVariant;
}

const variantClass: Record<ErpButtonVariant, string> = {
  primary: 'erp-btn-primary',
  secondary: 'erp-btn-secondary',
  danger: 'erp-btn-danger',
  icon: 'erp-icon-btn',
};

export function ErpButton({ variant = 'primary', className = '', children, ...props }: ErpButtonProps) {
  return (
    <button type="button" className={`${variantClass[variant]} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

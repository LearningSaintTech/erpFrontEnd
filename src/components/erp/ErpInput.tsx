import type { InputHTMLAttributes } from 'react';

export function ErpInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`erp-input ${className}`.trim()} {...props} />;
}

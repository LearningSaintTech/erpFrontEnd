import {
  cloneElement, forwardRef, isValidElement, useId, useRef,
  type InputHTMLAttributes, type ReactElement, type ReactNode, type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, Search, X } from 'lucide-react';

export interface FieldProps {
  label?: ReactNode;
  /** Shows a red asterisk; does not validate by itself. */
  required?: boolean;
  /** Helper text under the control. Hidden while an error is shown. */
  hint?: ReactNode;
  /** Error message; also marks the child control aria-invalid. */
  error?: ReactNode;
  /** id of the control. If omitted, one is generated and injected into the single child element. */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

type ControlProps = {
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
};

/**
 * Label + control + hint/error. Wires id, aria-invalid, aria-describedby automatically
 * when the child is a single element (ErpInput, ErpSelect, Textarea, ErpSearchSelect…).
 *
 *   <Field label="Vendor" required error={errors.vendor}>
 *     <ErpSelect value={v} onChange={…}>…</ErpSelect>
 *   </Field>
 */
export function Field({ label, required, hint, error, htmlFor, className = '', children }: FieldProps) {
  const autoId = useId();
  // Inject a11y props into a single control: components (ErpInput, ErpSelect…) or input/select/textarea.
  // Plain wrappers (<div>…</div>) are left alone — pass `htmlFor` and set ids yourself.
  const child = isValidElement(children)
    && (typeof children.type !== 'string' || ['input', 'select', 'textarea'].includes(children.type))
    ? (children as ReactElement<ControlProps>)
    : null;
  const id = htmlFor || child?.props.id || `f${autoId}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : hint ? hintId : '', child?.props['aria-describedby'] || '']
    .filter(Boolean).join(' ') || undefined;

  const control = child
    ? cloneElement(child, {
      id,
      'aria-invalid': error ? true : child.props['aria-invalid'],
      'aria-describedby': describedBy,
      'aria-required': required || child.props['aria-required'],
    })
    : children;

  return (
    <div className={`erp-field ${className}`.trim()}>
      {label != null && (
        <label htmlFor={id} className="erp-field-label">
          {label}
          {required && <span className="erp-field-required" aria-hidden="true">*</span>}
        </label>
      )}
      {control}
      {error ? (
        <p id={errorId} className="erp-field-error" role="alert">
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="erp-field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = '', invalid, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
      className={`erp-textarea ${className}`.trim()}
      {...props}
    />
  );
});

/** Alias matching the Erp* naming. */
export const ErpTextarea = Textarea;

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  /** Called when the clear (×) button is pressed. Defaults to onChange(''). */
  onClear?: () => void;
  inputSize?: 'sm' | 'md';
  /** Wrapper class (width etc.). */
  wrapperClassName?: string;
}

/** Text input with a search icon and a clear button. `onChange` receives the string value. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    value, onChange, onClear, inputSize = 'md', wrapperClassName = '', className = '',
    placeholder = 'Search…', onKeyDown, 'aria-label': ariaLabel, ...props
  },
  ref,
) {
  const innerRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className={`erp-search-input ${wrapperClassName}`.trim()}>
      <Search size={16} className="erp-search-icon" aria-hidden="true" />
      <input
        ref={(el) => {
          innerRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel || (typeof placeholder === 'string' ? placeholder.replace(/…$/, '') : 'Search')}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation();
            if (onClear) onClear(); else onChange('');
          }
          onKeyDown?.(e);
        }}
        className={`erp-input${inputSize === 'sm' ? ' erp-input-sm' : ''} [&::-webkit-search-cancel-button]:hidden ${className}`.trim()}
        {...props}
      />
      {value && (
        <button
          type="button"
          className="erp-search-clear"
          aria-label="Clear search"
          onClick={() => {
            if (onClear) onClear(); else onChange('');
            innerRef.current?.focus();
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
});

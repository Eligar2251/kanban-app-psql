import React, { memo, forwardRef } from 'react';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

const Input = memo(
  forwardRef<HTMLInputElement, InputProps>(function Input(
    { label, error, hint, icon, className = '', id, ...props },
    ref
  ) {
    const inputId = id || `input-${Math.random().toString(36).slice(2)}`;

    return (
      <div className={`input-wrapper ${className}`}>
        {label && (
          <label className="input-label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <div className={`input-field-wrapper ${icon ? 'input-field-wrapper--icon' : ''}`}>
          {icon && <span className="input-icon">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={`input-field ${error ? 'input-field--error' : ''}`}
            {...props}
          />
        </div>
        {error && <span className="input-error">{error}</span>}
        {hint && !error && <span className="input-hint">{hint}</span>}
      </div>
    );
  })
);

export default Input;
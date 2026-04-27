import React, { memo, forwardRef } from 'react';
import './Textarea.css';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = memo(
  forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    { label, error, hint, className = '', id, ...props },
    ref
  ) {
    const inputId = id || `textarea-${Math.random().toString(36).slice(2)}`;

    return (
      <div className={`textarea-wrapper ${className}`}>
        {label && (
          <label className="textarea-label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`textarea-field ${error ? 'textarea-field--error' : ''}`}
          {...props}
        />
        {error && <span className="textarea-error">{error}</span>}
        {hint && !error && <span className="textarea-hint">{hint}</span>}
      </div>
    );
  })
);

export default Textarea;
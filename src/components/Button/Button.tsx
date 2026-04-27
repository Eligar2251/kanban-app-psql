import React, { memo } from 'react';
import './Button.css';

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'ghost-danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = memo(function Button({
  variant = 'ghost',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? 'btn--full' : '',
    loading ? 'btn--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="btn-spinner" />
      ) : (
        <>
          {icon && <span className="btn-icon btn-icon--left">{icon}</span>}
          {children && <span className="btn-label">{children}</span>}
          {iconRight && <span className="btn-icon btn-icon--right">{iconRight}</span>}
        </>
      )}
    </button>
  );
});

export default Button;
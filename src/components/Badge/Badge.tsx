import React, { memo } from 'react';
import './Badge.css';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  variant?: 'solid' | 'outline';
}

const Badge = memo(function Badge({
  children,
  color = 'var(--color-accent)',
  variant = 'outline',
}: BadgeProps) {
  return (
    <span
      className={`badge badge--${variant}`}
      style={
        {
          '--badge-color': color,
        } as React.CSSProperties
      }
    >
      {children}
    </span>
  );
});

export default Badge;
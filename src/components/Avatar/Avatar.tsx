import React, { memo, useMemo } from 'react';
import './Avatar.css';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  userId?: string;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

const AVATAR_COLORS = [
  '#C8FF00', '#00E676', '#FF9500', '#FF3B3B',
  '#00B4D8', '#7B61FF', '#FF6B6B', '#4ECDC4',
];

const Avatar = memo(function Avatar({ name, size = 'md', userId }: AvatarProps) {
  const { initials, color } = useMemo(() => {
    const parts = name.trim().split(/\s+/);
    const initials =
      parts.length >= 2
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : (parts[0]?.[0] ?? '?').toUpperCase();

    const seed = userId || name;
    const colorIndex = hashString(seed) % AVATAR_COLORS.length;
    const color = AVATAR_COLORS[colorIndex];

    return { initials, color };
  }, [name, userId]);

  return (
    <div
      className={`avatar avatar--${size}`}
      style={{ '--avatar-color': color } as React.CSSProperties}
      title={name}
    >
      <span className="avatar-initials">{initials}</span>
    </div>
  );
});

export default Avatar;
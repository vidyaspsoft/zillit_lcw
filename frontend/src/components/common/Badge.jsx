import React from 'react';
import { Tag, Badge as AntBadge } from 'antd';

/**
 * Badge -- a small label or dot indicator, typically used for counts on buttons/cards.
 *
 * @param {Object} props
 * @param {number} [props.count] - Numeric count to display (capped at 99+)
 * @param {'primary'|'secondary'|'light'} [props.variant='primary'] - Color variant
 * @param {'small'|'medium'} [props.size='small'] - Size variant
 * @param {boolean} [props.dot=false] - If true, renders as a colored dot without a number
 * @param {string} [props.label] - Override text instead of count
 */
const Badge = ({ count, variant = 'primary', size = 'small', dot = false, label }) => {
  const colorMap = {
    primary: 'blue',
    secondary: 'default',
    light: 'cyan',
  };

  // Dot mode -- just a colored dot (no number)
  if (dot) {
    return <AntBadge status={variant === 'danger' ? 'error' : 'processing'} />;
  }

  if (!count && count !== 0 && !label) return null;

  const displayText = label || (count > 99 ? '99+' : count);

  return (
    <Tag
      color={colorMap[variant] || 'blue'}
      className={`ml-1 ${size === 'small' ? 'text-xs px-1.5 py-0 leading-tight' : 'text-sm px-2 py-0.5'}`}
    >
      {displayText}
    </Tag>
  );
};

export default Badge;

import React from 'react';
import { FaPlus } from 'react-icons/fa';

import IconActionButton from './IconActionButton';

export default function PlusActionButton({
  title,
  onClick,
  size = '1.6rem',
  borderColor = '#000',
  color = '#000',
  backgroundColor = '#fff',
  className = '',
  style = {},
  ...props
}) {
  return (
    <IconActionButton
      onClick={onClick}
      title={title}
      size={size}
      borderColor={borderColor}
      color={color}
      backgroundColor={backgroundColor}
      className={className}
      style={{
        width: size,
        height: size,
        ...style,
      }}
      {...props}
    >
      <FaPlus />
    </IconActionButton>
  );
}

import React from 'react';
import { FaSearch } from 'react-icons/fa';

import IconActionButton from './IconActionButton';

export default function SearchActionButton({
  title = 'Search',
  size = '1.9rem',
  borderColor = '#cfcfcf',
  color = '#5e5e5e',
  backgroundColor = '#fff',
  className = '',
  style = {},
  ...props
}) {
  return (
    <IconActionButton
      title={title}
      size={size}
      borderColor={borderColor}
      color={color}
      backgroundColor={backgroundColor}
      className={className}
      style={style}
      {...props}
    >
      <FaSearch />
    </IconActionButton>
  );
}

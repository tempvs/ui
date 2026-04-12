import React from 'react';
import { FaSearch } from 'react-icons/fa';

import IconActionButton, { IconActionButtonProps } from './IconActionButton';

type SearchIconProps = {
  className?: string;
};

type SearchActionButtonProps = Omit<IconActionButtonProps, 'children'>;

const SearchIcon = FaSearch as React.ComponentType<SearchIconProps>;

export default function SearchActionButton({
  title = 'Search',
  size = '1.9rem',
  borderColor = '#cfcfcf',
  color = '#5e5e5e',
  backgroundColor = '#fff',
  className = '',
  style = {},
  ...props
}: SearchActionButtonProps) {
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
      <SearchIcon />
    </IconActionButton>
  );
}

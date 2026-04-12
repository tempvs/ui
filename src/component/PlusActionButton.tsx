import React from 'react';
import { FaPlus } from 'react-icons/fa';

import IconActionButton, { IconActionButtonProps } from './IconActionButton';

type PlusIconProps = {
  className?: string;
};

type PlusActionButtonProps = Omit<IconActionButtonProps, 'children'>;

const PlusIcon = FaPlus as React.ComponentType<PlusIconProps>;

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
}: PlusActionButtonProps) {
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
      <PlusIcon />
    </IconActionButton>
  );
}

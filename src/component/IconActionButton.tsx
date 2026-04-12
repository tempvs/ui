import React from 'react';
import { Button, ButtonProps } from 'react-bootstrap';

export type IconActionButtonProps = Omit<ButtonProps, 'size' | 'title' | 'onClick'> & {
  children?: React.ReactNode;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  stopPropagation?: boolean;
  size?: string;
  fontSize?: string;
  borderColor?: string;
  color?: string;
  backgroundColor?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function IconActionButton({
  children,
  title,
  onClick,
  stopPropagation = true,
  variant = 'light',
  size = '1.75rem',
  fontSize = '0.8rem',
  borderColor = '#ddd',
  color = '#777',
  backgroundColor = 'rgba(255, 255, 255, 0.92)',
  className = '',
  style = {},
  ...props
}: IconActionButtonProps) {
  const handleClick: React.MouseEventHandler<HTMLElement> = event => {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }
    onClick?.(event);
  };

  const handleMouseDown: React.MouseEventHandler<HTMLElement> = event => {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      className={`p-0 d-inline-flex align-items-center justify-content-center text-decoration-none ${className}`.trim()}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      title={title}
      aria-label={title}
      style={{
        width: size,
        height: size,
        border: `1px solid ${borderColor}`,
        color,
        backgroundColor,
        lineHeight: 1,
        fontSize,
        ...style,
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

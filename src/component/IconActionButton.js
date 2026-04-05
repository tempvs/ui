import React from 'react';
import { Button } from 'react-bootstrap';

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
}) {
  const handleClick = event => {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }
    onClick?.(event);
  };

  const handleMouseDown = event => {
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

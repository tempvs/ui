import React from 'react';
import { Popover, PopoverProps } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';

type HoverPopoverProps = Omit<PopoverProps, 'default'> & {
  text?: string;
  default?: React.ReactNode;
  style?: React.CSSProperties;
};

export default function HoverPopover({
  text,
  default: defaultMessage,
  style,
  ...rest
}: HoverPopoverProps) {
  return (
    <Popover className="popover" {...rest} style={{ padding: '7px', ...style }}>
      {text ? (
        <FormattedMessage id={text} defaultMessage={String(defaultMessage || '')} />
      ) : (
        defaultMessage
      )}
    </Popover>
  );
}

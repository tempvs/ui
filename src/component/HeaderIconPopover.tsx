import React from 'react';
import { FormattedMessage } from 'react-intl';

type HeaderIconPopoverProps = {
  text: string;
  defaultMessage: string;
  children: React.ReactElement;
};

export default function HeaderIconPopover({
  text,
  defaultMessage,
  children,
}: HeaderIconPopoverProps) {
  return (
    <span className="header-icon-popover-anchor">
      {children}
      <span className="tempvs-header-popover" role="tooltip">
        <FormattedMessage id={text} defaultMessage={defaultMessage} />
      </span>
    </span>
  );
}

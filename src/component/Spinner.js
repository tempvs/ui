import React from 'react';
import { FormattedMessage } from 'react-intl';

export default function Spinner({ size = '50px' }) {
  const isSmall = size === 'sm';
  const resolvedSize = isSmall ? '14px' : size;
  const src = `${process.env.PUBLIC_URL}/${isSmall ? 'spinner-sm.gif' : 'spinner.gif'}`;

  return (
    <FormattedMessage id="loading" defaultMessage="Loading">
      {label => (
        <div className="d-inline-flex align-items-center justify-content-center" aria-label={label} title={label}>
          <img
            src={src}
            alt=""
            aria-hidden="true"
            style={{
              width: resolvedSize,
              height: resolvedSize,
              maxWidth: 'none',
            }}
          />
        </div>
      )}
    </FormattedMessage>
  );
}

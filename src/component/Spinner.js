import React from 'react';
import { FormattedMessage } from 'react-intl';

export default function Spinner({ size = '2.5rem' }) {
  return (
    <FormattedMessage id="loading" defaultMessage="Loading">
      {label => (
        <div className="d-inline-flex align-items-center justify-content-center" aria-label={label} title={label}>
          <span
            role="img"
            aria-hidden="true"
            style={{
              display: 'inline-block',
              fontSize: size,
              lineHeight: 1,
              animation: 'tempvs-hourglass-flip 1.4s ease-in-out infinite',
              transformOrigin: '50% 50%',
            }}
          >
            ⏳
          </span>
          <style>
            {`
              @keyframes tempvs-hourglass-flip {
                0% { transform: rotate(0deg); }
                45% { transform: rotate(0deg); }
                55% { transform: rotate(180deg); }
                100% { transform: rotate(180deg); }
              }
            `}
          </style>
        </div>
      )}
    </FormattedMessage>
  );
}

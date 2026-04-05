import React from 'react';

import LibraryPeriodBreadcrumb from './LibraryPeriodBreadcrumb';

export default function LibrarySectionHeader({ title, subtitle, period, variant = 'period', middleContent = null, rightContent = null }) {
  const resolvedRightContent = rightContent || <LibraryPeriodBreadcrumb period={period} variant={variant} />;

  return (
    <>
      <div
        className="p-3 rounded border"
        style={{
          backgroundColor: '#f3efe4',
          borderColor: '#d9ccb0',
        }}
      >
        <div
          className="align-items-start gap-3"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
          }}
        >
          <div className="d-flex justify-content-start" style={{ minWidth: 0 }}>
            <div className="text-uppercase small fw-bold mb-1">
              {title}
            </div>
          </div>
          <div className="d-flex justify-content-center" style={{ minWidth: 0 }}>
            {middleContent}
          </div>
          <div className="d-flex justify-content-end">
            {resolvedRightContent}
          </div>
        </div>
      </div>
      {subtitle && (
        <p className="text-muted mb-4 mt-2">
          {subtitle}
        </p>
      )}
    </>
  );
}

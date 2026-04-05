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
        <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
          <div className="me-auto" style={{ minWidth: '8rem' }}>
            <div className="text-uppercase small fw-bold mb-1">
              {title}
            </div>
          </div>
          {middleContent && (
            <div className="flex-grow-1 d-flex justify-content-center" style={{ minWidth: '16rem', maxWidth: '32rem' }}>
              {middleContent}
            </div>
          )}
          {resolvedRightContent}
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

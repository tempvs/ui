import React from 'react';

import InlineSaveStatus from './InlineSaveStatus';

export default function EditableFieldRow({
  label,
  editable,
  control,
  readOnlyValue,
  status = null,
  action = null,
  actionPlacement = 'inline',
  labelWidth = '7rem',
  fieldMaxWidth = '16rem',
  savingTitle = 'Saving',
  errorTitle = 'Save failed',
  className = 'mb-2',
}) {
  return (
    <div className={`d-flex align-items-center gap-3 ${className}`.trim()}>
      <div className="text-start small fw-semibold" style={{ width: labelWidth }}>
        {label}
      </div>
      <div style={{ width: '100%', maxWidth: fieldMaxWidth }}>
        {editable ? (
          actionPlacement === 'stacked' ? (
            <div>
              {control}
              {(status || action) && (
                <div className="d-flex align-items-center gap-2 mt-2">
                  {status && <InlineSaveStatus status={status} savingTitle={savingTitle} errorTitle={errorTitle} />}
                  {!status && action}
                </div>
              )}
            </div>
          ) : (
            <div className="input-group input-group-sm">
              {control}
              {(status || action) && (
                <span className="input-group-text">
                  {status && <InlineSaveStatus status={status} savingTitle={savingTitle} errorTitle={errorTitle} />}
                  {!status && action}
                </span>
              )}
            </div>
          )
        ) : (
          <div className="small text-start px-1 py-1">{readOnlyValue}</div>
        )}
      </div>
    </div>
  );
}

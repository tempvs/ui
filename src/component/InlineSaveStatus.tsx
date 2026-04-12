import React from 'react';
import { FaHourglassHalf, FaTimes } from 'react-icons/fa';

type InlineSaveStatusValue = 'saving' | 'saved' | 'error';
type StatusIconProps = {
  className?: string;
  title?: string;
};

type InlineSaveStatusProps = {
  status?: InlineSaveStatusValue | string | null;
  savingTitle?: string;
  errorTitle?: string;
};

const SavingIcon = FaHourglassHalf as React.ComponentType<StatusIconProps>;
const ErrorIcon = FaTimes as React.ComponentType<StatusIconProps>;

export default function InlineSaveStatus({
  status,
  savingTitle = 'Saving',
  errorTitle = 'Save failed',
}: InlineSaveStatusProps) {
  if (!status || !['saving', 'saved', 'error'].includes(status)) {
    return null;
  }

  return (
    <>
      {status === 'saving' && <SavingIcon className="text-muted" title={savingTitle} />}
      {status === 'saved' && <span className="text-success">&#10003;</span>}
      {status === 'error' && <ErrorIcon className="text-danger" title={errorTitle} />}
    </>
  );
}

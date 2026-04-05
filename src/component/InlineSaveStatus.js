import React from 'react';
import { FaHourglassHalf, FaTimes } from 'react-icons/fa';

export default function InlineSaveStatus({ status, savingTitle = 'Saving', errorTitle = 'Save failed' }) {
  if (!status || !['saving', 'saved', 'error'].includes(status)) {
    return null;
  }

  return (
    <>
      {status === 'saving' && <FaHourglassHalf className="text-muted" title={savingTitle} />}
      {status === 'saved' && <span className="text-success">&#10003;</span>}
      {status === 'error' && <FaTimes className="text-danger" title={errorTitle} />}
    </>
  );
}

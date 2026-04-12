import React, { useRef } from 'react';
import { Form, OverlayTrigger } from 'react-bootstrap';

import ImageDescriptionBlock from './ImageDescriptionBlock';
import HoverPopover from './HoverPopover';
import InlineSaveStatus from './InlineSaveStatus';
import useIsTruncated from './useIsTruncated';
import { SaveStatus } from './EditableFieldRow';

type EditableImageDescriptionProps = {
  editable: boolean;
  value?: string | null;
  status?: SaveStatus;
  placeholder?: string;
  emptyText?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  className?: string;
  bordered?: boolean;
  savingTitle?: string;
  errorTitle?: string;
};

export default function EditableImageDescription({
  editable,
  value,
  status = null,
  placeholder = 'Add a description',
  emptyText = '',
  onChange,
  onBlur,
  className = '',
  bordered = true,
  savingTitle = 'Saving',
  errorTitle = 'Save failed',
}: EditableImageDescriptionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayText = value || placeholder;
  const isTruncated = useIsTruncated(inputRef, overlayText);

  if (!editable) {
    return <ImageDescriptionBlock description={value} emptyText={emptyText} bordered={bordered} className={className} />;
  }

  const control = (
    <Form.Control
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      value={value || ''}
      onChange={onChange}
      onBlur={onBlur}
      className="border-0 px-4 bg-transparent text-center"
      size="sm"
      style={{
        width: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    />
  );

  return (
    <div className={`${bordered ? 'p-2 border-top ' : ''}${className}`.trim()}>
      <div className="position-relative d-flex align-items-center justify-content-center">
        {isTruncated ? (
          <OverlayTrigger
            trigger={['hover', 'focus']}
            placement="bottom"
            overlay={<HoverPopover text="" default={overlayText} style={{ maxWidth: '20rem' }} />}
          >
            {control}
          </OverlayTrigger>
        ) : control}
        {status && (
          <div
            className="position-absolute end-0 d-flex align-items-center pe-1"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            <InlineSaveStatus status={status} savingTitle={savingTitle} errorTitle={errorTitle} />
          </div>
        )}
      </div>
    </div>
  );
}

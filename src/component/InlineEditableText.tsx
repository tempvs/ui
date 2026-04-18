import React, { useEffect, useRef, useState } from 'react';
import { Form, OverlayTrigger } from 'react-bootstrap';
import { FaPen } from 'react-icons/fa';

import HoverPopover from './HoverPopover';
import InlineSaveStatus from './InlineSaveStatus';
import useIsTruncated from './useIsTruncated';
import { SaveStatus } from './EditableFieldRow';

type InlineEditableTextProps = {
  editable: boolean;
  value?: string | number | string[];
  readOnlyValue?: React.ReactNode;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onValueChange?: (value: string) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement | HTMLDivElement>) => void;
  status?: SaveStatus;
  placeholder?: string;
  className?: string;
  textClassName?: string;
  placeholderDisplay?: boolean;
  popoverValue?: React.ReactNode;
  truncateSingleLine?: boolean;
  multiline?: boolean;
  multilineRows?: number;
  savingTitle?: string;
  errorTitle?: string;
};

const PenIcon = FaPen as React.ComponentType;

export default function InlineEditableText({
  editable,
  value,
  readOnlyValue,
  onChange,
  onValueChange,
  onBlur,
  status = null,
  placeholder,
  className = '',
  textClassName = '',
  placeholderDisplay = false,
  popoverValue,
  truncateSingleLine = false,
  multiline = false,
  multilineRows = 3,
  savingTitle = 'Saving',
  errorTitle = 'Save failed',
}: InlineEditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [blurredAfterEdit, setBlurredAfterEdit] = useState(false);
  const controlRef = useRef<HTMLElement | null>(null);
  const readOnlyRef = useRef<HTMLDivElement | null>(null);
  const readOnlyDisplayValue = typeof readOnlyValue === 'string' || typeof readOnlyValue === 'number'
    ? String(readOnlyValue)
    : '';
  const controlValue = editing ? value : (value || readOnlyDisplayValue);
  const isTruncated = useIsTruncated(controlRef, controlValue);
  const isReadOnlyTruncated = useIsTruncated(readOnlyRef, readOnlyValue);
  const controlClassName = `inline-editable-input ${multiline ? 'inline-editable-multiline' : ''} ${truncateSingleLine && !editing ? 'inline-editable-truncate' : ''} ${textClassName} ${!editing && placeholderDisplay ? 'description-placeholder' : ''}`.trim();
  const shouldShowLocalPopover = Boolean(popoverValue) && !editing && (
    (multiline && isTruncated)
    || (truncateSingleLine && isTruncated)
  );
  const shouldShowReadOnlyMultilinePopover = multiline && Boolean(popoverValue) && isReadOnlyTruncated;
  const popoverConfig = {
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [18, 8],
        },
      },
    ],
  };

  useEffect(() => {
    if (editing) {
      controlRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (!multiline) {
      return;
    }
    const control = controlRef.current;
    if (!control || document.activeElement === control) {
      return;
    }
    control.textContent = String(controlValue ?? '');
  }, [controlValue, multiline]);

  useEffect(() => {
    if (!editing || !blurredAfterEdit) {
      return undefined;
    }

    if (!status) {
      setEditing(false);
      return undefined;
    }

    if (status === 'saved' || status === 'error') {
      const timerId = window.setTimeout(() => {
        setEditing(false);
      }, 900);
      return () => window.clearTimeout(timerId);
    }

    return undefined;
  }, [blurredAfterEdit, editing, status]);

  const handleInputBlur: React.FocusEventHandler<HTMLInputElement> = event => {
    onBlur?.(event);
    setBlurredAfterEdit(true);
  };

  const handleCustomBlur: React.FocusEventHandler<HTMLDivElement> = event => {
    onBlur?.(event);
    setBlurredAfterEdit(true);
  };

  const handleCustomInput: React.FormEventHandler<HTMLDivElement> = event => {
    onValueChange?.(event.currentTarget.textContent || '');
  };

  if (!editable) {
    const content = (
      <div
        ref={readOnlyRef}
        className={`${textClassName} ${multiline ? 'inline-editable-multiline inline-editable-readonly-multiline' : ''} ${truncateSingleLine ? 'inline-editable-truncate' : ''} ${placeholderDisplay ? 'description-placeholder' : ''} text-start`.trim()}
      >
        {readOnlyValue}
      </div>
    );

    if (shouldShowReadOnlyMultilinePopover || (truncateSingleLine && popoverValue && isReadOnlyTruncated)) {
      return (
        <span className="inline-editable-popover-anchor">
          {content}
          <span className="inline-editable-description-popover" role="tooltip">
            {popoverValue}
          </span>
        </span>
      );
    }

    return !multiline && popoverValue && isReadOnlyTruncated ? (
      <OverlayTrigger
        trigger={['hover', 'focus']}
        placement="top"
        popperConfig={popoverConfig}
        overlay={<HoverPopover text="" default={popoverValue} style={{ maxWidth: '24rem' }} />}
      >
        {content}
      </OverlayTrigger>
    ) : content;
  }

  const control = (
    <div
      className={`inline-editable-control ${editing ? 'inline-editable-active' : 'inline-editable-readonly'}`}
      onClick={() => {
        if (!editing) {
          setBlurredAfterEdit(false);
          setEditing(true);
        }
      }}
    >
      {multiline ? (
        shouldShowLocalPopover ? (
          <span className="inline-editable-popover-anchor">
            <div
              ref={controlRef as React.RefObject<HTMLDivElement>}
              role="textbox"
              aria-multiline={multiline}
              contentEditable={false}
              suppressContentEditableWarning
              tabIndex={0}
              className={`inline-editable-custom-field ${controlClassName}`.trim()}
              data-placeholder={placeholder}
              onInput={handleCustomInput}
              onBlur={handleCustomBlur}
            >
              {String(controlValue ?? '')}
            </div>
            <span className="inline-editable-description-popover" role="tooltip">
              {popoverValue}
            </span>
          </span>
        ) : (
        <div
          ref={controlRef as React.RefObject<HTMLDivElement>}
          role="textbox"
          aria-multiline="true"
          contentEditable={editing}
          suppressContentEditableWarning
          tabIndex={0}
          className={`inline-editable-custom-field ${controlClassName}`.trim()}
          data-placeholder={placeholder}
          onInput={handleCustomInput}
          onBlur={handleCustomBlur}
        >
          {String(controlValue ?? '')}
        </div>
        )
      ) : truncateSingleLine && !editing ? (
        <span className="inline-editable-popover-anchor">
          <Form.Control
            ref={controlRef as React.RefObject<HTMLInputElement>}
            type="text"
            readOnly
            className={controlClassName}
            value={controlValue ?? ''}
            onChange={onChange}
            onBlur={handleInputBlur}
            placeholder={placeholder}
          />
          {popoverValue && isTruncated && (
            <span className="inline-editable-description-popover" role="tooltip">
              {popoverValue}
            </span>
          )}
        </span>
      ) : (
        <Form.Control
          ref={controlRef as React.RefObject<HTMLInputElement>}
          type="text"
          readOnly={!editing}
          className={controlClassName}
          value={controlValue ?? ''}
          onChange={onChange}
          onBlur={handleInputBlur}
          placeholder={placeholder}
        />
      )}
      {!editing && (
        <span className="inline-editable-glyph" aria-hidden="true">
          <PenIcon />
        </span>
      )}
      {status && (
        <span className="inline-editable-status">
          <InlineSaveStatus status={status} savingTitle={savingTitle} errorTitle={errorTitle} />
        </span>
      )}
    </div>
  );

  return (
    <div className={`inline-editable-text ${className}`.trim()}>
      {!editing && !multiline && !truncateSingleLine && popoverValue && isTruncated ? (
        <OverlayTrigger
          trigger={['hover', 'focus']}
          placement="top"
          popperConfig={popoverConfig}
          overlay={<HoverPopover text="" default={popoverValue} style={{ maxWidth: '24rem' }} />}
        >
          {control}
        </OverlayTrigger>
      ) : control}
    </div>
  );
}

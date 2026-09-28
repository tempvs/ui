import React from 'react';
import { Button, ButtonProps, Modal } from 'react-bootstrap';

type ConfirmationModalProps = {
  show: boolean;
  title: React.ReactNode;
  message: React.ReactNode;
  onHide: () => void;
  onConfirm: () => void;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  confirmVariant?: ButtonProps['variant'];
  busy?: boolean;
  dialogClassName?: string;
  contentClassName?: string;
};

/** Shared confirmation dialog for destructive or otherwise consequential actions. */
export default function ConfirmationModal({
  show,
  title,
  message,
  onHide,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  busy = false,
  dialogClassName,
  contentClassName,
}: ConfirmationModalProps) {
  const close = () => {
    if (!busy) onHide();
  };

  return (
    <Modal show={show} onHide={close} centered dialogClassName={dialogClassName} contentClassName={contentClassName}>
      <Modal.Header closeButton={!busy}>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" disabled={busy} onClick={close}>
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant} disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

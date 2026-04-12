import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { FaTrashAlt } from 'react-icons/fa';

import IconActionButton, { IconActionButtonProps } from './IconActionButton';

type ConfirmingTrashButtonProps = Omit<IconActionButtonProps, 'children' | 'title' | 'onClick'> & {
  title?: string;
  confirmTitle?: React.ReactNode;
  confirmMessage?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  onConfirm?: () => void;
};

const TrashIcon = FaTrashAlt as React.ComponentType;

export default function ConfirmingTrashButton({
  title = 'Delete',
  confirmTitle = 'Delete image',
  confirmMessage = 'Delete this image?',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  ...props
}: ConfirmingTrashButtonProps) {
  const [show, setShow] = useState(false);

  const openModal = () => setShow(true);
  const closeModal = () => setShow(false);
  const handleConfirm = () => {
    onConfirm?.();
    closeModal();
  };

  return (
    <>
      <IconActionButton
        title={title}
        onClick={openModal}
        {...props}
      >
        <TrashIcon />
      </IconActionButton>

      <Modal show={show} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>{confirmTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{confirmMessage}</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeModal}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

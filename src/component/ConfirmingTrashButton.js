import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { FaTrashAlt } from 'react-icons/fa';

import IconActionButton from './IconActionButton';

export default function ConfirmingTrashButton({
  title = 'Delete',
  confirmTitle = 'Delete image',
  confirmMessage = 'Delete this image?',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  ...props
}) {
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
        <FaTrashAlt />
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

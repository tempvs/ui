import React, { useState } from 'react';
import { FaTrashAlt } from 'react-icons/fa';

import ConfirmationModal from './ConfirmationModal';
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

      <ConfirmationModal
        show={show}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onHide={closeModal}
        onConfirm={handleConfirm}
      />
    </>
  );
}

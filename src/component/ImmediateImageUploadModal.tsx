import React, { useId } from "react";
import { Form, Modal } from "react-bootstrap";

type ImmediateImageUploadModalProps = {
  show: boolean;
  title: React.ReactNode;
  fileLabel: React.ReactNode;
  onHide: () => void;
  onFileChange: React.ChangeEventHandler<HTMLInputElement>;
  uploading?: boolean;
  uploadingText?: React.ReactNode;
  accept?: string;
};

/** A shared image picker that uploads as soon as a file is selected. */
export default function ImmediateImageUploadModal({
  show,
  title,
  fileLabel,
  onHide,
  onFileChange,
  uploading = false,
  uploadingText = "Uploading...",
  accept = "image/jpeg,image/png,image/gif",
}: ImmediateImageUploadModalProps) {
  const inputId = useId();

  return (
    <Modal
      show={show}
      onHide={() => {
        if (!uploading) onHide();
      }}
      centered
    >
      <Modal.Header closeButton={!uploading}>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group>
          <Form.Label htmlFor={inputId}>{fileLabel}</Form.Label>
          <Form.Control
            id={inputId}
            type="file"
            accept={accept}
            disabled={uploading}
            onChange={onFileChange}
          />
        </Form.Group>
        {uploading && <div className="small text-muted mt-3">{uploadingText}</div>}
      </Modal.Body>
    </Modal>
  );
}

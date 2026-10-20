import React, { useEffect, useRef, useState } from "react";
import { Button, Form } from "react-bootstrap";

import StackedImageGallery from "./StackedImageGallery";

type MultiImageFilePickerProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
  maxFiles?: number;
};

/**
 * Creation-form counterpart to the staged-image cards on source proposals.
 * It uses browser object URLs only: no file is uploaded until the containing
 * form is submitted.
 */
export default function MultiImageFilePicker({
  files,
  onFilesChange,
  disabled = false,
  label = "Pictures",
  maxFiles = 50,
}: MultiImageFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, maxFiles - files.length);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    if (typeof URL === "undefined" || !URL.createObjectURL) {
      setPreviewUrls([]);
      return undefined;
    }

    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const addFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;
    onFilesChange([...files, ...selected].slice(0, maxFiles));
  };

  const removeFile = (index: number) => {
    onFilesChange(
      files.filter((_, candidateIndex) => candidateIndex !== index),
    );
  };

  return (
    <Form.Group className="mt-3 mb-0">
      <Form.Label>{label}</Form.Label>
      <Form.Text className="d-block text-muted mb-2">
        Choose one or more pictures. They stay only in this browser until you
        create the item or source.
      </Form.Text>
      <Form.Control
        ref={inputRef}
        className="d-none"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        disabled={disabled || remaining === 0}
        aria-label={`${label}: choose one or more images`}
        onChange={addFiles}
      />
      {files.length > 0 && (
        <>
          <div className="small text-muted mb-2">
            {files.length} {files.length === 1 ? "picture" : "pictures"}{" "}
            selected
            {remaining > 0 ? ` — you can add ${remaining} more.` : "."}
          </div>
          <div className="row g-3 mb-3">
            {files.map((image, index) => (
              <div
                className="col-md-6"
                key={`${image.name}-${image.lastModified}-${index}`}
              >
                <div className="source-edit-image-card border border-success rounded p-2 h-100 bg-success-subtle">
                  <div className="small text-success fw-semibold mb-1">
                    New image
                  </div>
                  <StackedImageGallery
                    mode="single"
                    title={image.name}
                    images={[
                      {
                        id: `${image.name}-${image.lastModified}-${index}`,
                        url: previewUrls[index],
                        thumbnailUrl: previewUrls[index],
                        fileName: image.name,
                      },
                    ]}
                    editable
                    editableDescription={false}
                    showComments={false}
                    onDeleteImage={() => removeFile(index)}
                    deleteTitle="Remove image"
                    deleteConfirmTitle="Remove image"
                    deleteConfirmMessage="Remove this picture from the creation form?"
                    deleteLabel="Remove"
                    previewStyle={{
                      height: "9rem",
                      objectFit: "contain",
                      backgroundColor: "#f8faf8",
                    }}
                  />
                  <div className="small fw-semibold text-truncate mt-2">
                    {image.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline-dark"
        disabled={disabled || remaining === 0}
        onClick={() => inputRef.current?.click()}
      >
        {files.length ? "Add more pictures" : "Add pictures"}
      </Button>
    </Form.Group>
  );
}

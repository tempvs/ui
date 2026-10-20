import React, { useEffect, useState } from "react";
import { Button, Form } from "react-bootstrap";

type MultiImageFilePickerProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
  maxFiles?: number;
};

/**
 * A creation-form image picker. Selecting files again appends them instead of
 * replacing the existing selection, which makes multi-image uploads explicit
 * without requiring a separate staging screen.
 */
export default function MultiImageFilePicker({
  files,
  onFilesChange,
  disabled = false,
  label = "Pictures",
  maxFiles = 50,
}: MultiImageFilePickerProps) {
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

  return (
    <Form.Group className="mt-3 mb-0">
      <Form.Label>{label}</Form.Label>
      <Form.Text className="d-block text-muted mb-2">
        Choose one or more pictures. Select more files again to add them.
      </Form.Text>
      <Form.Control
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        disabled={disabled || remaining === 0}
        aria-label={`${label}: choose one or more images`}
        onChange={(event) => {
          const input = event.target as HTMLInputElement;
          const selected = Array.from(input.files || []);
          input.value = "";
          if (!selected.length) return;
          onFilesChange([...files, ...selected].slice(0, maxFiles));
        }}
      />
      {files.length > 0 && (
        <>
          <Form.Text className="d-block text-muted mt-2">
            {files.length} {files.length === 1 ? "picture" : "pictures"}{" "}
            selected{remaining > 0 ? ` — you can add ${remaining} more.` : "."}
          </Form.Text>
          <ul className="list-unstyled small text-muted mt-2 mb-0">
            {files.map((image, index) => (
              <li
                key={`${image.name}-${image.lastModified}-${index}`}
                className="d-flex align-items-center justify-content-between gap-2 py-1"
              >
                <div className="d-flex align-items-center gap-2 overflow-hidden">
                  {previewUrls[index] && (
                    <img
                      src={previewUrls[index]}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded border object-fit-cover flex-shrink-0"
                    />
                  )}
                  <span className="text-truncate">{image.name}</span>
                </div>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="p-0 text-danger"
                  disabled={disabled}
                  onClick={() =>
                    onFilesChange(
                      files.filter(
                        (_, candidateIndex) => candidateIndex !== index,
                      ),
                    )
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Form.Group>
  );
}

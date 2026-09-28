import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import ImmediateImageUploadModal from "./ImmediateImageUploadModal";

test("uploads immediately after a file is selected without rendering action buttons", () => {
  const onFileChange = jest.fn();
  render(
    <ImmediateImageUploadModal
      show
      title="Upload image"
      fileLabel="Image file"
      onHide={jest.fn()}
      onFileChange={onFileChange}
    />,
  );

  const file = new File(["image"], "source.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Image file"), {
    target: { files: [file] },
  });

  expect(onFileChange).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
});

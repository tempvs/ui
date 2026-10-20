import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import SourceChangeLogDiffModal from "./SourceChangeLogDiffModal";

test("shows added source-image thumbnails and opens them in the shared viewer", () => {
  render(
    <SourceChangeLogDiffModal
      entry={{
        id: "change-1",
        sourceId: "source-1",
        action: "CHANGESET_APPLIED",
        actorId: "user-1",
        addedImageIds: ["image-1"],
        changes: {},
        createdAt: "2026-10-20T00:00:00.000Z",
      }}
      imagesById={{
        "image-1": {
          id: "image-1",
          url: "https://example.test/added.jpg",
          fileName: "Added image",
        },
      }}
      onHide={() => undefined}
    />,
  );

  expect(screen.getByText("Added images")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Added image" }));
  expect(screen.getAllByText("Added image")).not.toHaveLength(0);
  expect(document.querySelector(".carousel")).not.toBeInTheDocument();
});

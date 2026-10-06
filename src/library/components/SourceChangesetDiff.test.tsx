import React from "react";
import { render, screen } from "@testing-library/react";

import SourceChangesetDiff from "./SourceChangesetDiff";

const source = {
  name: "Source",
  description: "Published description",
  period: "ANCIENT",
  classification: "PRIMARY",
  type: "TEXT",
  from: null,
  to: null,
} as const;

test("identifies every image operation with the affected thumbnails", () => {
  render(
    <SourceChangesetDiff
      base={source}
      proposed={source}
      imageOperations={[
        {
          kind: "REPLACE",
          imageId: "published-1",
          stagedImageId: "staged-1",
          description: "Replacement description",
        },
        {
          kind: "UPDATE_DESCRIPTION",
          imageId: "published-2",
          description: "Updated caption",
        },
        { kind: "ADD", stagedImageId: "staged-2", description: "New image" },
        { kind: "REMOVE", imageId: "published-3" },
      ]}
      imagePreviews={{
        published: [
          {
            id: "published-1",
            thumbnailUrl: "https://example.test/current.jpg",
            fileName: "current.jpg",
            description: "Current source photo",
          },
          {
            id: "published-2",
            thumbnailUrl: "https://example.test/caption.jpg",
            fileName: "caption.jpg",
            description: "Old caption",
          },
          {
            id: "published-3",
            thumbnailUrl: "https://example.test/remove.jpg",
            fileName: "remove.jpg",
            description: "Removed photo",
          },
        ],
        staged: [
          {
            id: "staged-1",
            thumbnailUrl: "blob:replacement",
            fileName: "replacement.jpg",
            description: "Replacement description",
          },
          {
            id: "staged-2",
            thumbnailUrl: "blob:new",
            fileName: "new.jpg",
            description: "New image",
          },
        ],
      }}
    />,
  );

  expect(screen.getByText("Replace image")).toBeInTheDocument();
  expect(screen.getByText("Change image description")).toBeInTheDocument();
  expect(screen.getByText("Add image")).toBeInTheDocument();
  expect(screen.getByText("Remove image")).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "Current image: Current source photo" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "Replacement: Replacement description" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "New image: New image" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", { name: "Removed image: Removed photo" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Old caption")).toBeInTheDocument();
  expect(screen.getByText("Updated caption")).toBeInTheDocument();
});

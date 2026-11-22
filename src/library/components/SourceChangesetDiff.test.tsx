import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import SourceChangesetDiff, {
  summarizeSourceChangeset,
} from "./SourceChangesetDiff";
import type { SourceChangesetSnapshot } from "../libraryApi";

const source = (
  overrides: Partial<SourceChangesetSnapshot> = {},
): SourceChangesetSnapshot => ({
  name: "Test source",
  description: null,
  period: "ROMAN",
  type: "OBJECT",
  from: null,
  to: null,
  discoveredAtPlaceId: null,
  discoveredAtPlaceName: null,
  heldAtPlaceId: null,
  heldAtPlaceName: null,
  ...overrides,
});

test("summarizes and renders location changes in a source proposal", () => {
  const base = source();
  const proposed = source({
    discoveredAtPlaceId: "seed:pleiades:118929",
    discoveredAtPlaceName: "Castra Regina",
  });
  expect(summarizeSourceChangeset(base, proposed)).toContain("Discovered at");
  render(<SourceChangesetDiff base={base} proposed={proposed} />);
  expect(screen.getByText("Discovered at")).toBeInTheDocument();
  expect(screen.getByText("Castra Regina")).toBeInTheDocument();
});

test("renders an initial source submission as additions", () => {
  const proposed = source({
    name: "New source",
    description: "Submitted for review",
  });
  expect(summarizeSourceChangeset(source(), proposed, [], "CREATE")).toEqual([
    "New source",
  ]);
  render(
    <SourceChangesetDiff base={source()} proposed={proposed} kind="CREATE" />,
  );
  expect(
    screen.getByText(/New source proposed for review/),
  ).toBeInTheDocument();
  expect(screen.getByText("New source")).toBeInTheDocument();
});

test("opens a staged source image in the shared image viewer", () => {
  render(
    <SourceChangesetDiff
      base={source()}
      proposed={source()}
      imageOperations={[
        { kind: "ADD", stagedImageId: "staged-image", description: null },
      ]}
      imagePreviews={{
        staged: [
          {
            id: "staged-image",
            url: "https://example.test/proposed-image.jpg",
            fileName: "Proposed image",
          },
        ],
      }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Proposed image" }));

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getAllByText("New image")).not.toHaveLength(0);
  expect(document.querySelector(".carousel")).not.toBeInTheDocument();
});

test.each([false, true])(
  "shows added image previews for a new source (compact: %s)",
  (compact) => {
    const operations = [
      { kind: "ADD" as const, stagedImageId: "new-image", description: null },
    ];
    expect(
      summarizeSourceChangeset(source(), source(), operations, "CREATE"),
    ).toEqual(["New source", "Images: 1 added"]);
    render(
      <SourceChangesetDiff
        base={source()}
        proposed={source()}
        kind="CREATE"
        compact={compact}
        imageOperations={operations}
        imagePreviews={{
          staged: [
            {
              id: "new-image",
              thumbnailUrl: "/new.jpg",
              fileName: "New photo",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Add image")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "New photo" })).toHaveAttribute(
      "src",
      "/new.jpg",
    );
    fireEvent.click(screen.getByRole("button", { name: "New photo" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  },
);

test("shows removed images and both sides of image replacements", () => {
  render(
    <SourceChangesetDiff
      base={source()}
      proposed={source()}
      imageOperations={[
        { kind: "REMOVE", imageId: "removed" },
        {
          kind: "REPLACE",
          imageId: "old",
          stagedImageId: "replacement",
          description: null,
        },
      ]}
      imagePreviews={{
        published: [
          {
            id: "removed",
            thumbnailUrl: "/removed.jpg",
            fileName: "Removed photo",
          },
          { id: "old", thumbnailUrl: "/old.jpg", fileName: "Old photo" },
        ],
        staged: [
          {
            id: "replacement",
            thumbnailUrl: "/replacement.jpg",
            fileName: "Replacement photo",
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("Removed image")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Removed photo" })).toHaveAttribute(
    "src",
    "/removed.jpg",
  );
  expect(screen.getByRole("img", { name: "Old photo" })).toHaveAttribute(
    "src",
    "/old.jpg",
  );
  expect(
    screen.getByRole("img", { name: "Replacement photo" }),
  ).toHaveAttribute("src", "/replacement.jpg");
});

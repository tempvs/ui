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

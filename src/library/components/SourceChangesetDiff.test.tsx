import React from "react";
import { render, screen } from "@testing-library/react";

import SourceChangesetDiff, { summarizeSourceChangeset } from "./SourceChangesetDiff";
import type { SourceChangesetSnapshot } from "../libraryApi";

const source = (
  overrides: Partial<SourceChangesetSnapshot> = {},
): SourceChangesetSnapshot => ({
  name: "Test source",
  description: null,
  period: "ROMAN",
  classification: "ARCHAEOLOGICAL",
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

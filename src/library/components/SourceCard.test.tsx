import React from "react";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";

jest.mock("../../component/PlaceNamePopover", () => ({
  __esModule: true,
  default: ({ displayName }: { displayName: string }) => (
    <button>{displayName}</button>
  ),
}));

import SourceCard from "./SourceCard";

test("prefers a discovery place over a holding place on a source tile", () => {
  render(
    <IntlProvider locale="en" messages={{}}>
      <MemoryRouter>
        <SourceCard
          source={{
            id: "source-1",
            name: "Roman find",
            type: "OBJECT",
            period: "ROMAN",
            discoveredAtPlaceId: "seed:regensburg",
            discoveredAtPlaceName: "Castra Regina",
            heldAtPlaceId: "seed:rome",
            heldAtPlaceName: "Roma",
          }}
        />
      </MemoryRouter>
    </IntlProvider>,
  );

  expect(screen.getByText("Discovered at:")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Castra Regina" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Held at:")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Roma" }),
  ).not.toBeInTheDocument();
});

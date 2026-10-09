import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

jest.mock("../map/MapCanvas", () => ({
  __esModule: true,
  default: ({ places }: { places: Array<{ matchedName?: string }> }) => (
    <div data-testid="place-preview-map">{places[0]?.matchedName}</div>
  ),
}));

import PlacePickerField from "./PlacePickerField";

test("opens the selected place with its map preview and historical names", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({
        id: "seed:pleiades:118929",
        canonicalName: "Regensburg",
        names: [
          { value: "Regensburg", preferred: true },
          {
            value: "Castra Regina",
            preferred: false,
            validFrom: 179,
            validTo: 500,
          },
        ],
        latitude: 49.0198,
        longitude: 12.0985,
        featureType: "HISTORIC_SETTLEMENT",
      }),
  } as Response);

  render(
    <MemoryRouter>
      <PlacePickerField
        label="Location"
        editable
        value={{ id: "seed:pleiades:118929", canonicalName: "Castra Regina" }}
        onChange={jest.fn()}
      />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Castra Regina" }));

  await waitFor(() =>
    expect(screen.getAllByTestId("place-preview-map")[0]).toHaveTextContent(
      "Castra Regina",
    ),
  );
  expect(screen.getByText("Regensburg (canonical)")).toBeInTheDocument();
  expect(screen.getByText(/Castra Regina.*179.*500/)).toBeInTheDocument();
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/map/places/seed%3Apleiades%3A118929",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ),
  );
  fetchMock.mockRestore();
});

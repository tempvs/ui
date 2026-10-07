import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import PlacePickerField from "./PlacePickerField";

test("searches approved places and returns a selected canonical place", async () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({
        items: [
          {
            id: "seed:pleiades:423025",
            canonicalName: "Rome",
            latitude: 41.8933,
            longitude: 12.4829,
            featureType: "SETTLEMENT",
          },
        ],
      }),
  } as Response);
  render(<PlacePickerField label="Location" editable onChange={onChange} />);

  fireEvent.click(screen.getByRole("button", { name: "Choose a place" }));
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search approved places" }),
    { target: { value: "Rome" } },
  );
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/map/places/search?q=Rome&limit=20",
      expect.anything(),
    ),
  );
  fireEvent.click(await screen.findByRole("button", { name: /Rome/ }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "seed:pleiades:423025",
      canonicalName: "Rome",
    }),
  );
  jest.useRealTimers();
  fetchMock.mockRestore();
});

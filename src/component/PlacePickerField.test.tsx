import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import PlacePickerField from "./PlacePickerField";
import { nearbyMapPlaces } from "../map/mapApi";

jest.mock("../map/MapCanvas", () => ({
  __esModule: true,
  default: ({
    onCoordinatePick,
  }: {
    onCoordinatePick?: (coordinate: {
      latitude: number;
      longitude: number;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onCoordinatePick?.({ latitude: 41.9, longitude: 12.5 })}
    >
      Pick Rome coordinates
    </button>
  ),
}));

jest.mock("../map/mapApi", () => ({
  searchMapPlaces: jest.fn(),
  nearbyMapPlaces: jest.fn(),
  proposeMapPlace: jest.fn(),
  findLikelyDuplicateMapPlaces: jest.fn(),
}));

const mockNearbyMapPlaces = jest.mocked(nearbyMapPlaces);

test("offers nearby approved places after a point is picked on the map", async () => {
  mockNearbyMapPlaces.mockResolvedValue([
    {
      id: "seed:rome",
      canonicalName: "Rome",
      latitude: 41.9,
      longitude: 12.5,
      featureType: "SETTLEMENT",
    },
  ]);

  render(
    <PlacePickerField
      label="Location"
      editable
      onChange={jest.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Choose a place" }));
  fireEvent.click(screen.getByRole("button", { name: "Pick Rome coordinates" }));

  await waitFor(() => {
    expect(mockNearbyMapPlaces).toHaveBeenCalledWith(
      41.9,
      12.5,
      25,
      expect.any(AbortSignal),
    );
  });
  expect(
    await screen.findByRole("button", { name: /Rome SETTLEMENT/i }),
  ).toBeInTheDocument();
});

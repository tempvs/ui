import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { getViewer } from "../auth/viewerApi";
import MapPage from "./MapPage";
import {
  listMyMapPlaceProposals,
  nearbyMapEntities,
  nearbyMapPlaces,
  searchMapPlaces,
} from "./mapApi";

jest.mock("../auth/viewerApi", () => ({
  getViewer: jest.fn(),
}));

jest.mock("./MapCanvas", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({
      places,
      selectedPlaceId,
    }: {
      places: Array<{
        id: string;
        matchedName?: string;
        canonicalName: string;
      }>;
      selectedPlaceId?: string | null;
    }) =>
      React.createElement(
        "div",
        {
          "data-testid": "map-canvas",
          "data-selected-place": selectedPlaceId || "",
        },
        places.map((place) =>
          React.createElement(
            "span",
            { key: place.id },
            place.matchedName || place.canonicalName,
          ),
        ),
      ),
    entityKey: (entity: {
      entityType: string;
      entityId: string;
      locationRole: string;
    }) => `${entity.entityType}:${entity.entityId}:${entity.locationRole}`,
  };
});

jest.mock("./mapApi", () => ({
  searchMapPlaces: jest.fn(),
  nearbyMapPlaces: jest.fn(),
  nearbyMapEntities: jest.fn(),
  getMapPlace: jest.fn(),
  listMyMapPlaceProposals: jest.fn().mockResolvedValue([]),
}));

const mockSearchMapPlaces = jest.mocked(searchMapPlaces);
const mockNearbyMapPlaces = jest.mocked(nearbyMapPlaces);
const mockNearbyMapEntities = jest.mocked(nearbyMapEntities);
const mockListMyMapPlaceProposals = jest.mocked(listMyMapPlaceProposals);
const mockGetViewer = jest.mocked(getViewer);

test("searches places while typing and labels the selected marker with the matched historical name", async () => {
  jest.useFakeTimers();
  mockGetViewer.mockResolvedValue(null);
  mockSearchMapPlaces.mockResolvedValue([
    {
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
    },
  ]);
  mockNearbyMapPlaces.mockResolvedValue([]);
  mockNearbyMapEntities.mockResolvedValue([]);

  render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText("Place"), {
    target: { value: "Castra" },
  });
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  await waitFor(() =>
    expect(mockSearchMapPlaces).toHaveBeenCalledWith(
      "Castra",
      expect.anything(),
    ),
  );

  await act(async () => {
    fireEvent.click(
      await screen.findByRole("option", { name: /Castra Regina.*Regensburg/ }),
    );
    await Promise.resolve();
  });
  await waitFor(() => {
    expect(mockNearbyMapPlaces).toHaveBeenCalledWith(49.0198, 12.0985, 25);
    expect(screen.getByTestId("map-canvas")).toHaveAttribute(
      "data-selected-place",
      "seed:pleiades:118929",
    );
    expect(screen.getByTestId("map-canvas")).toHaveTextContent("Castra Regina");
  });

  jest.useRealTimers();
});

test("restores source and event discovery facets from a map URL", async () => {
  mockGetViewer.mockResolvedValue(null);
  mockNearbyMapPlaces.mockResolvedValue([]);
  mockNearbyMapEntities.mockResolvedValue([]);

  render(
    <MemoryRouter
      initialEntries={[
        "/map?lat=41.9&lng=12.5&radiusKm=25&sourcePeriod=ANTIQUITY&sourceClassification=WEAPON&sourceType=ARCHAEOLOGICAL&sourceFrom=-27&sourceTo=476&eventPeriod=ANTIQUITY&eventFrom=-27&eventTo=476",
      ]}
    >
      <MapPage />
    </MemoryRouter>,
  );

  await waitFor(() =>
    expect(mockNearbyMapEntities).toHaveBeenCalledWith(
      41.9,
      12.5,
      25,
      ["PROFILE", "CLUB", "EVENT", "SOURCE"],
      "",
      undefined,
      ["DISCOVERED_AT"],
      {
        period: "ANTIQUITY",
        classifications: ["WEAPON"],
        types: ["ARCHAEOLOGICAL"],
        from: -27,
        to: 476,
      },
      {
        period: "ANTIQUITY",
        from: -27,
        to: 476,
      },
    ),
  );
});

test("lets a geography reviewer reach the proposal queue", async () => {
  mockGetViewer.mockResolvedValue({
    userId: "reviewer-1",
    roles: ["MAP_REVIEWER"],
  });
  mockNearbyMapPlaces.mockResolvedValue([]);
  mockNearbyMapEntities.mockResolvedValue([]);
  mockListMyMapPlaceProposals.mockResolvedValue([]);

  render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  );

  expect(
    await screen.findByRole("button", { name: "Review proposals" }),
  ).toBeInTheDocument();
});

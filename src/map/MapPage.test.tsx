import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import { getViewer } from "../auth/viewerApi";
import MapPage from "./MapPage";
import {
  getMapPlace,
  listMyMapPlaceProposals,
  nearbyMapPlaces,
  searchMapPlaces,
  nearbyMapEntitiesPage,
} from "./mapApi";
import { loadOwnedMapContent, loadSharedMapScope } from "./ownedMapContent";

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
      focus,
      initialFitPoints,
    }: {
      places: Array<{
        id: string;
        matchedName?: string;
        canonicalName: string;
      }>;
      selectedPlaceId?: string | null;
      focus?: { latitude: number; longitude: number } | null;
      initialFitPoints?: Array<{ key: string }>;
    }) =>
      React.createElement(
        "div",
        {
          "data-testid": "map-canvas",
          "data-selected-place": selectedPlaceId || "",
          "data-focus": focus ? `${focus.latitude},${focus.longitude}` : "",
          "data-fit-count": initialFitPoints?.length || 0,
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
  nearbyMapEntitiesPage: jest.fn(),
  getMapPlace: jest.fn(),
  listMyMapPlaceProposals: jest.fn().mockResolvedValue([]),
}));

jest.mock("./ownedMapContent", () => ({
  loadSharedMapScope: jest.fn().mockResolvedValue({
    markers: [],
    connections: [],
  }),
  loadOwnedMapContent: jest.fn().mockResolvedValue({
    markers: [],
    connections: [],
  }),
}));

const mockSearchMapPlaces = jest.mocked(searchMapPlaces);
const mockNearbyMapPlaces = jest.mocked(nearbyMapPlaces);
const mockNearbyMapEntitiesPage = jest.mocked(nearbyMapEntitiesPage);
const mockListMyMapPlaceProposals = jest.mocked(listMyMapPlaceProposals);
const mockGetViewer = jest.mocked(getViewer);
const mockGetMapPlace = jest.mocked(getMapPlace);
const mockLoadSharedMapScope = jest.mocked(loadSharedMapScope);
const mockLoadOwnedMapContent = jest.mocked(loadOwnedMapContent);

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="map-location">{location.search}</output>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetViewer.mockResolvedValue(null);
  mockGetMapPlace.mockResolvedValue({
    id: "seed:rome",
    canonicalName: "Rome",
    latitude: 41.9,
    longitude: 12.5,
    featureType: "SETTLEMENT",
  });
  mockNearbyMapPlaces.mockResolvedValue([]);
  mockNearbyMapEntitiesPage.mockResolvedValue({ items: [] });
  mockListMyMapPlaceProposals.mockResolvedValue([]);
  mockLoadSharedMapScope.mockResolvedValue({ markers: [], connections: [] });
  mockLoadOwnedMapContent.mockResolvedValue({ markers: [], connections: [] });
});

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
  mockNearbyMapEntitiesPage.mockResolvedValue({ items: [] });

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

test("restores source, event, and profile discovery facets from a map URL", async () => {
  mockGetViewer.mockResolvedValue(null);
  mockNearbyMapPlaces.mockResolvedValue([]);
  mockNearbyMapEntitiesPage.mockResolvedValue({ items: [] });

  render(
    <MemoryRouter
      initialEntries={[
        "/map?lat=41.9&lng=12.5&radiusKm=25&types=PROFILE,EVENT&sourcePeriod=ANTIQUITY&sourceClassification=WEAPON&sourceType=ARCHAEOLOGICAL&sourceFrom=-27&sourceTo=476&eventPeriod=ANTIQUITY&eventFrom=-27&eventTo=476&profilePeriod=ANTIQUITY&profileFrom=-27&profileTo=476",
      ]}
    >
      <MapPage />
    </MemoryRouter>,
  );

  await waitFor(() =>
    expect(mockNearbyMapEntitiesPage).toHaveBeenCalledWith(
      41.9,
      12.5,
      25,
      ["PROFILE", "EVENT"],
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
      undefined,
      undefined,
      { period: "ANTIQUITY", from: -27, to: 476 },
    ),
  );
});

test("loads the next bounded page of nearby compact markers", async () => {
  mockNearbyMapEntitiesPage
    .mockResolvedValueOnce({
      items: [
        {
          entityType: "PROFILE",
          entityId: "profile-1",
          locationRole: "CURRENT_RESIDENCE",
          label: "First profile",
          placeId: "seed:rome",
          placeName: "Rome",
          latitude: 41.9,
          longitude: 12.5,
        },
      ],
      nextCursor: "opaque-next-page",
    })
    .mockResolvedValueOnce({
      items: [
        {
          entityType: "PROFILE",
          entityId: "profile-2",
          locationRole: "CURRENT_RESIDENCE",
          label: "Second profile",
          placeId: "seed:rome",
          placeName: "Rome",
          latitude: 41.91,
          longitude: 12.51,
        },
      ],
    });
  render(
    <MemoryRouter
      initialEntries={["/map?lat=41.9&lng=12.5&radiusKm=25&types=PROFILE"]}
    >
      <MapPage />
    </MemoryRouter>,
  );

  expect(await screen.findByText("First profile")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));

  expect(await screen.findByText("Second profile")).toBeInTheDocument();
  expect(mockNearbyMapEntitiesPage).toHaveBeenLastCalledWith(
    41.9,
    12.5,
    25,
    ["PROFILE"],
    "",
    undefined,
    ["DISCOVERED_AT"],
    {},
    {},
    undefined,
    "opaque-next-page",
    {},
  );
});

test("lets a geography reviewer reach map administration", async () => {
  mockGetViewer.mockResolvedValue({
    userId: "reviewer-1",
    roles: ["MAP_REVIEWER"],
  });
  mockNearbyMapPlaces.mockResolvedValue([]);
  mockNearbyMapEntitiesPage.mockResolvedValue({ items: [] });
  mockListMyMapPlaceProposals.mockResolvedValue([]);

  render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  );

  expect(
    await screen.findByRole("link", { name: "Map administration" }),
  ).toHaveAttribute("href", "/map/admin");
});

test("retains a shared public graph while hydrating a copied map URL", async () => {
  render(
    <MemoryRouter
      initialEntries={[
        "/map?placeId=seed%3Arome&q=Roma&lat=41.9&lng=12.5&radiusKm=25&scope=PROFILE&scopeId=profile-1",
      ]}
    >
      <MapPage />
      <LocationProbe />
    </MemoryRouter>,
  );

  await waitFor(() =>
    expect(mockLoadSharedMapScope).toHaveBeenCalledWith({
      type: "PROFILE",
      id: "profile-1",
    }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("map-location")).toHaveTextContent(
      "scope=PROFILE&scopeId=profile-1",
    ),
  );
  expect(mockLoadOwnedMapContent).not.toHaveBeenCalled();
});

test("hydrates a copied personal map from the original user scope", async () => {
  render(
    <MemoryRouter initialEntries={["/map?scope=USER&scopeId=owner-1"]}>
      <MapPage />
    </MemoryRouter>,
  );

  await waitFor(() =>
    expect(mockLoadSharedMapScope).toHaveBeenCalledWith({
      type: "USER",
      id: "owner-1",
    }),
  );
  expect(mockLoadOwnedMapContent).not.toHaveBeenCalled();
});

test("frames every related marker after a shared graph has loaded", async () => {
  mockLoadSharedMapScope.mockResolvedValue({
    markers: [
      { key: "PROFILE:first", latitude: 41.9, longitude: 12.5 },
      { key: "SOURCE:second", latitude: 50.1, longitude: 8.6 },
    ],
    connections: [],
  } as never);

  render(
    <MemoryRouter
      initialEntries={[
        "/map?lat=41.9&lng=12.5&radiusKm=25&scope=USER&scopeId=owner-1",
      ]}
    >
      <MapPage />
    </MemoryRouter>,
  );

  await waitFor(() =>
    expect(screen.getByTestId("map-canvas")).toHaveAttribute(
      "data-fit-count",
      "2",
    ),
  );
  expect(screen.getByTestId("map-canvas")).toHaveAttribute("data-focus", "");
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import MapCanvas from "./MapCanvas";
import { getMapPlacesByReference } from "./mapApi";

const mockRemoveMap = jest.fn();
const mockInitializeMap = jest.fn();
const mockAddSource = jest.fn();
const mockAddControl = jest.fn();
let mockEvents: Record<string, (...args: any[]) => void> = {};

const mockMarkers: Array<{
  element: HTMLElement;
  remove: jest.Mock;
  setLngLat: jest.Mock;
  setOffset: jest.Mock;
  addTo: jest.Mock;
}> = [];
jest.mock("./mapApi", () => ({
  getMapPlacesByReference: jest.fn(),
  mapPlaceReference: () => "alexandria",
}));
jest.mock("./mapLibre", () => ({
  maplibregl: {
    Map: function () {
      mockInitializeMap();
      return {
        dragRotate: { disable: jest.fn() },
        touchZoomRotate: { disableRotation: jest.fn() },
        touchPitch: { disable: jest.fn() },
        addControl: mockAddControl,
        on: jest.fn((event, callback) => {
          if (typeof callback === "function") mockEvents[event] = callback;
        }),
        once: jest.fn(),
        off: jest.fn(),
        addSource: mockAddSource,
        addLayer: jest.fn(),
        getSource: jest.fn(),
        setFilter: jest.fn(),
        setLayoutProperty: jest.fn(),
        resize: jest.fn(),
        remove: () => mockRemoveMap(),
      };
    },
    Marker: function (options: { element: HTMLElement }) {
      const marker = {
        element: options.element,
        remove: jest.fn(),
        setLngLat: jest.fn(),
        setOffset: jest.fn(),
        addTo: jest.fn(),
      };
      marker.setLngLat.mockReturnValue(marker);
      marker.setOffset.mockReturnValue(marker);
      marker.addTo.mockReturnValue(marker);
      mockMarkers.push(marker);
      return marker;
    },
    NavigationControl: jest.fn(),
    AttributionControl: jest.fn(),
  },
}));

beforeEach(() => {
  mockEvents = {};
  mockMarkers.length = 0;
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ type: "FeatureCollection", features: [] }),
  } as Response);
  jest.mocked(getMapPlacesByReference).mockResolvedValue(new Map());
});

test("resolves place links once even with omitted marker props and parent rerenders", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ type: "FeatureCollection", features: [] }),
  } as Response);
  jest.mocked(getMapPlacesByReference).mockResolvedValue(new Map());
  const props = {
    places: [],
    entities: [],
    ownedMarkers: [{ key: "club", placeId: "alexandria" }] as never,
    showModernBorders: false,
    onEntitySelect: jest.fn(),
    onMapError: jest.fn(),
  };
  const view = render(<MapCanvas {...props} />);
  // Drain several turns: previously each resolved lookup scheduled another.
  for (let turn = 0; turn < 5; turn += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  expect(getMapPlacesByReference).toHaveBeenCalledTimes(1);
  view.rerender(
    <MapCanvas
      {...props}
      entities={[]}
      ownedMarkers={[...props.ownedMarkers]}
    />,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(getMapPlacesByReference).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(mockRemoveMap).toHaveBeenCalledTimes(1);
});

test("releases the map on each close and creates a usable new mount", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ type: "FeatureCollection", features: [] }),
  } as Response);
  for (let opening = 0; opening < 3; opening += 1) {
    const view = render(
      <MapCanvas
        places={[]}
        entities={[]}
        showModernBorders={false}
        onEntitySelect={jest.fn()}
        onMapError={jest.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    view.unmount();
    expect(mockRemoveMap).toHaveBeenCalledTimes(opening + 1);
  }
});

const emptyMapProps = {
  places: [],
  entities: [],
  showModernBorders: false,
  onEntitySelect: jest.fn(),
  onMapError: jest.fn(),
};

test("a WebGL initialization failure preserves the page and retries a fresh map", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockInitializeMap.mockImplementationOnce(() => {
    throw new Error("Failed to initialize WebGL");
  });
  const view = render(
    <>
      <h1>Discover places</h1>
      <MapCanvas {...emptyMapProps} />
    </>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(
    screen.getByRole("heading", { name: "Discover places" }),
  ).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("could not be displayed");
  expect(view.container.querySelector(".maplibregl-canvas")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Interactive world map")).toBeVisible();
  expect(mockInitializeMap).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(mockRemoveMap).toHaveBeenCalledTimes(1);
  log.mockRestore();
});

test("context loss supports automatic recovery and manual retry releases the old map", async () => {
  const view = render(<MapCanvas {...emptyMapProps} />);
  await act(async () => {
    await Promise.resolve();
  });
  act(() => mockEvents.webglcontextlost());
  expect(screen.getByRole("status")).toHaveTextContent("Waiting for recovery");
  act(() => mockEvents.webglcontextrestored());
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  act(() => mockEvents.webglcontextlost());
  fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockRemoveMap).toHaveBeenCalledTimes(1);
  expect(mockInitializeMap).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  view.unmount();
  expect(mockRemoveMap).toHaveBeenCalledTimes(2);
});

test("an asynchronous layer initialization failure is contained and releases the map", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockAddSource.mockImplementationOnce(() => {
    throw new Error("Style is not done loading");
  });
  render(
    <>
      <h1>Discover places</h1>
      <MapCanvas {...emptyMapProps} />
    </>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  act(() => mockEvents.load());
  expect(
    screen.getByRole("heading", { name: "Discover places" }),
  ).toBeVisible();
  expect(screen.getByRole("alert")).toBeVisible();
  expect(mockRemoveMap).toHaveBeenCalledTimes(1);
  log.mockRestore();
});

test("setup failures release a constructed map before showing the fallback", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockAddControl.mockImplementationOnce(() => {
    throw new Error("Control setup failed");
  });
  render(<MapCanvas {...emptyMapProps} />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByRole("alert")).toBeVisible();
  expect(mockRemoveMap).toHaveBeenCalledTimes(1);
  log.mockRestore();
});

test("reuses unchanged thumbnail markers and disposes only changed/removed instances", async () => {
  const a = {
    key: "a",
    entityType: "CLUB" as const,
    entityId: "club-a",
    locationRole: "CLUB_ASSOCIATION" as const,
    label: "A",
    placeId: "rome",
    placeName: "Rome",
    latitude: 41.9,
    longitude: 12.5,
  };
  const b = {
    ...a,
    key: "b",
    entityId: "club-b",
    placeId: "paris",
    label: "B",
  };
  const select = jest.fn();
  const view = render(
    <MapCanvas
      {...emptyMapProps}
      thumbnailMarkers={[a, b]}
      onThumbnailMarkerSelect={select}
    />,
  );
  await act(async () => {
    await Promise.resolve();
  });
  act(() => mockEvents.load());
  expect(mockMarkers).toHaveLength(2);
  const originalA = mockMarkers[0];
  const originalB = mockMarkers[1];
  view.rerender(
    <MapCanvas
      {...emptyMapProps}
      thumbnailMarkers={[{ ...a }, { ...b }]}
      onThumbnailMarkerSelect={select}
    />,
  );
  expect(mockMarkers).toHaveLength(2);
  expect(originalA.remove).not.toHaveBeenCalled();
  const changed = { ...b, label: "Updated B", latitude: 48.8 };
  view.rerender(
    <MapCanvas
      {...emptyMapProps}
      thumbnailMarkers={[a, changed]}
      onThumbnailMarkerSelect={select}
    />,
  );
  expect(mockMarkers).toHaveLength(3);
  expect(originalB.remove).toHaveBeenCalledTimes(1);
  fireEvent.click(mockMarkers[2].element);
  expect(select).toHaveBeenLastCalledWith(changed);
  view.rerender(<MapCanvas {...emptyMapProps} thumbnailMarkers={[a]} />);
  expect(mockMarkers[2].remove).toHaveBeenCalledTimes(1);
  expect(originalA.remove).not.toHaveBeenCalled();
  view.unmount();
  expect(originalA.remove).toHaveBeenCalledTimes(1);
  expect(originalB.remove).toHaveBeenCalledTimes(1);
  expect(mockMarkers[2].remove).toHaveBeenCalledTimes(1);
});

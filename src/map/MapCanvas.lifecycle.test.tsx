import { act, render } from "@testing-library/react";
import MapCanvas from "./MapCanvas";
import { getMapPlacesByReference } from "./mapApi";

const mockRemoveMap = jest.fn();

jest.mock("./mapApi", () => ({
  getMapPlacesByReference: jest.fn(),
  mapPlaceReference: () => "alexandria",
}));
jest.mock("maplibre-gl", () => ({
  __esModule: true,
  default: {
    Map: function () { return ({
      dragRotate: { disable: jest.fn() },
      touchZoomRotate: { disableRotation: jest.fn() },
      touchPitch: { disable: jest.fn() },
      addControl: jest.fn(),
      on: jest.fn(),
      resize: jest.fn(),
      remove: () => mockRemoveMap(),
    }); },
    NavigationControl: jest.fn(),
    AttributionControl: jest.fn(),
  },
}));

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
    await act(async () => { await Promise.resolve(); });
  }
  expect(getMapPlacesByReference).toHaveBeenCalledTimes(1);
  view.rerender(<MapCanvas {...props} entities={[]} ownedMarkers={[...props.ownedMarkers]} />);
  await act(async () => { await Promise.resolve(); });
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
    const view = render(<MapCanvas
      places={[]} entities={[]} showModernBorders={false}
      onEntitySelect={jest.fn()} onMapError={jest.fn()}
    />);
    await act(async () => { await Promise.resolve(); });
    view.unmount();
    expect(mockRemoveMap).toHaveBeenCalledTimes(opening + 1);
  }
});

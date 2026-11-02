import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import MapReferenceAttachment, {
  embeddedMapFitPoints,
  publicMapReferenceFromUrl,
} from "./MapReferenceAttachment";
import { loadSharedMapScope } from "./ownedMapContent";

jest.mock("./LazyMapCanvas", () => () => <div data-testid="map-preview" />);
jest.mock("./StaticMapPreview", () => () => <div data-testid="static-preview" />);
jest.mock("./ownedMapContent", () => ({ loadSharedMapScope: jest.fn() }));

beforeEach(() => {
  jest.mocked(loadSharedMapScope).mockResolvedValue({ markers: [], connections: [] });
});

test.each(["SOURCE", "CLUB", "EVENT"] as const)(
  "keeps the original %s graph on a profile wall and in its opened modal",
  async (type) => {
    const scope = { type, id: `${type.toLowerCase()}-1` };
    render(<MemoryRouter><MapReferenceAttachment
      reference={{ latitude: 41.9, longitude: 12.5, radiusKm: 25,
        entityTypes: [type], scope }}
      relationshipScope={{ type: "PROFILE", id: "destination-profile" }}
    /></MemoryRouter>);
    await waitFor(() => expect(loadSharedMapScope).toHaveBeenCalledWith(scope));
    fireEvent.click(screen.getByRole("button", { name: "Open shared map: Shared map" }));
    await screen.findByRole("dialog");
    await waitFor(() => expect(loadSharedMapScope).toHaveBeenCalledTimes(2));
    expect(jest.mocked(loadSharedMapScope).mock.calls).toEqual([[scope], [scope]]);
  },
);

test("renders a bounded public map reference and opens its public map URL", () => {
  render(
    <MemoryRouter>
      <MapReferenceAttachment
        reference={{
          placeId: "seed:rome",
          placeName: "Roma",
          latitude: 41.9,
          longitude: 12.5,
          radiusKm: 25,
          entityTypes: ["PROFILE", "SOURCE"],
        }}
      />
    </MemoryRouter>,
  );

  expect(screen.getByTestId("map-preview-frame")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open in Map" })).toBeInTheDocument();
});

test("opens the full map on the first link tap", () => {
  function Pathname() {
    return <output data-testid="pathname">{useLocation().pathname}</output>;
  }

  render(
    <MemoryRouter initialEntries={["/profile/alex"]}>
      <MapReferenceAttachment
        reference={{
          latitude: 41.9,
          longitude: 12.5,
          radiusKm: 25,
          entityTypes: ["PROFILE"],
        }}
      />
      <Pathname />
    </MemoryRouter>,
  );

  fireEvent.pointerUp(screen.getByRole("button", { name: "Open in Map" }));
  expect(screen.getByTestId("pathname")).toHaveTextContent("/map");
});

test("renders a real-map preview frame in feed cards", () => {
  const originalMatchMedia = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn().mockReturnValue({ matches: true }),
  });

  render(
    <MemoryRouter>
      <MapReferenceAttachment
        reference={{
          latitude: 41.9,
          longitude: 12.5,
          radiusKm: 25,
          entityTypes: ["PROFILE"],
        }}
      />
    </MemoryRouter>,
  );

  expect(screen.getByTestId("map-preview-frame")).toBeInTheDocument();

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});

test("closes the map modal instead of reopening through the card click handler", async () => {
  render(
    <MemoryRouter>
      <MapReferenceAttachment
        reference={{
          placeName: "Roma",
          latitude: 41.9,
          longitude: 12.5,
          radiusKm: 25,
          entityTypes: ["PROFILE"],
        }}
      />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Open shared map: Roma" }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("preserves an approved relationship-map scope", () => {
  expect(
    publicMapReferenceFromUrl(
      "/map?lat=41.9&lng=12.5&radiusKm=25&scope=PROFILE&scopeId=private",
    ),
  ).toMatchObject({ scope: { type: "PROFILE", id: "private" } });
});

test("restores a profile relationship scope for legacy embedded maps", () => {
  render(
    <MemoryRouter>
      <MapReferenceAttachment
        reference={{
          latitude: 41.9,
          longitude: 12.5,
          radiusKm: 25,
          entityTypes: ["PROFILE", "SOURCE"],
        }}
        relationshipScope={{ type: "PROFILE", id: "profile-1" }}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole("button", { name: "Open in Map" })).toBeInTheDocument();
});

test("frames every nearby entity in an embedded public map", () => {
  const reference = {
    latitude: 41.9,
    longitude: 12.5,
    radiusKm: 200,
    entityTypes: ["PROFILE" as const, "SOURCE" as const],
  };

  expect(
    embeddedMapFitPoints(reference, { markers: [], connections: [] }, [
      {
        entityType: "PROFILE",
        entityId: "profile-1",
        locationRole: "CURRENT_RESIDENCE",
        label: "Rome profile",
        placeId: "rome",
        placeName: "Rome",
        latitude: 41.9,
        longitude: 12.5,
      },
      {
        entityType: "SOURCE",
        entityId: "source-1",
        locationRole: "HELD_AT",
        label: "Distant source",
        placeId: "london",
        placeName: "London",
        latitude: 51.5,
        longitude: -0.1,
      },
    ]),
  ).toEqual([
    expect.objectContaining({ latitude: 41.9, longitude: 12.5 }),
    expect.objectContaining({ latitude: 51.5, longitude: -0.1 }),
  ]);
});

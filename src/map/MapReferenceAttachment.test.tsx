import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import MapReferenceAttachment, {
  embeddedMapFitPoints,
  publicMapReferenceFromUrl,
} from "./MapReferenceAttachment";

jest.mock("./MapCanvas", () => () => <div data-testid="map-preview" />);

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

  expect(screen.getByTestId("map-preview")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open in Map" })).toHaveAttribute(
    "href",
    "/map?lat=41.9&lng=12.5&radiusKm=25&types=PROFILE%2CSOURCE&placeId=seed%3Arome&q=Roma",
  );
});

test("preserves an approved relationship-map scope", () => {
  expect(
    publicMapReferenceFromUrl(
      "/map?lat=41.9&lng=12.5&radiusKm=25&scope=PROFILE&scopeId=private",
    ),
  ).toMatchObject({ scope: { type: "PROFILE", id: "private" } });
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

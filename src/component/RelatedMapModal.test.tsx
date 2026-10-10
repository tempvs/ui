import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

jest.mock("../map/MapCanvas", () => ({
  __esModule: true,
  default: ({
    thumbnailMarkers,
  }: {
    thumbnailMarkers: Array<{ label: string; thumbnailUrl?: string }>;
  }) => (
    <div data-testid="related-map-canvas">
      {thumbnailMarkers.map((marker) => (
        <span key={marker.label}>
          {marker.label}:{marker.thumbnailUrl || "hourglass"}
        </span>
      ))}
    </div>
  ),
}));

import RelatedMapModal from "./RelatedMapModal";

test("renders bounded nearby entities with their batched thumbnails", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/api/map/places/seed%3Arome")) {
      return Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: "seed:rome",
            canonicalName: "Rome, Italy",
            latitude: 41.8933,
            longitude: 12.4829,
            featureType: "SETTLEMENT",
          }),
      } as Response);
    }
    if (url.includes("/api/map/entities?")) {
      return Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            items: [
              {
                entityType: "PROFILE",
                entityId: "profile-1",
                locationRole: "CURRENT_RESIDENCE",
                label: "A profile",
                placeId: "seed:rome",
                placeName: "Rome, Italy",
                latitude: 41.8933,
                longitude: 12.4829,
              },
            ],
          }),
      } as Response);
    }
    if (url === "/api/images/lookup") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          content: [
            {
              resourceType: "profile",
              resourceId: "profile-1",
              image: { thumbnailUrl: "https://images.test/profile.jpg" },
            },
          ],
        }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  render(
    <MemoryRouter>
      <RelatedMapModal placeId="seed:rome" displayName="Roma" />
    </MemoryRouter>,
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Open related map for Roma" }),
  );

  await waitFor(() =>
    expect(screen.getByTestId("related-map-canvas")).toHaveTextContent(
      "A profile:https://images.test/profile.jpg",
    ),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("radiusKm=25"),
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );

  fireEvent.change(screen.getByLabelText("Related-map radius"), {
    target: { value: "100" },
  });
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("radiusKm=100"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ),
  );
  fetchMock.mockRestore();
});

test("opens the full map with the compact map's selected public layers", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/api/map/places/seed%3Arome")) {
      return Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: "seed:rome",
            canonicalName: "Rome, Italy",
            latitude: 41.8933,
            longitude: 12.4829,
            featureType: "SETTLEMENT",
          }),
      } as Response);
    }
    if (url.includes("/api/map/entities?")) {
      return Promise.resolve({ ok: true, text: async () => JSON.stringify({ items: [] }) } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });

  function SearchLocation() {
    return <output data-testid="map-location">{useLocation().search}</output>;
  }

  render(
    <MemoryRouter>
      <RelatedMapModal placeId="seed:rome" displayName="Roma" />
      <SearchLocation />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Open related map for Roma" }));
  await screen.findByRole("button", { name: "Open in Map" });
  fireEvent.click(screen.getByLabelText("Profile"));
  fireEvent.click(screen.getByLabelText("Club"));
  fireEvent.click(screen.getByLabelText("Source"));
  fireEvent.click(screen.getByRole("button", { name: "Open in Map" }));

  expect(screen.getByTestId("map-location")).toHaveTextContent(
    "placeId=seed%3Arome",
  );
  expect(screen.getByTestId("map-location")).toHaveTextContent("types=EVENT");
  expect(screen.getByTestId("map-location")).toHaveTextContent("sourceRoles=all");
  fetchMock.mockRestore();
});

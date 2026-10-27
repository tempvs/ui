import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MapSnapshotPicker from "./MapSnapshotPicker";
import { listMyMapSnapshots } from "./mapApi";

jest.mock("./mapApi", () => ({ listMyMapSnapshots: jest.fn() }));

test("loads a saved map and returns its bounded public reference", async () => {
  const reference = { placeName: "Rome", latitude: 41.9, longitude: 12.5, radiusKm: 25, entityTypes: ["PROFILE"] as Array<"PROFILE"> };
  jest.mocked(listMyMapSnapshots).mockResolvedValue([{ id: "map-1", title: "Rome", reference, createdAt: "2026-01-01", updatedAt: "2026-01-01" }]);
  const select = jest.fn();
  render(<MapSnapshotPicker onSelect={select} />);
  fireEvent.click(screen.getByRole("button", { name: "Attach saved map" }));
  await screen.findByRole("button", { name: /Rome/ });
  fireEvent.click(screen.getByRole("button", { name: /Rome/ }));
  await waitFor(() => expect(select).toHaveBeenCalledWith(reference));
});

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SavedMapsPage from "./SavedMapsPage";
import { deleteMapSnapshot, listMyMapSnapshots, renameMapSnapshot } from "./mapApi";

jest.mock("./mapApi", () => ({ listMyMapSnapshots: jest.fn(), renameMapSnapshot: jest.fn(), deleteMapSnapshot: jest.fn() }));

const item = { id: "map-1", profileId: "profile-1", title: "Rome", reference: { placeName: "Rome", latitude: 41.9, longitude: 12.5, radiusKm: 25, entityTypes: ["PROFILE"] as Array<"PROFILE"> }, createdAt: "2026-01-01", updatedAt: "2026-01-01" };

beforeEach(() => {
  jest.mocked(listMyMapSnapshots).mockResolvedValue([item]);
  jest.mocked(renameMapSnapshot).mockResolvedValue({ ...item, title: "Updated Rome" });
  jest.mocked(deleteMapSnapshot).mockResolvedValue();
});

test("manages saved maps by profile", async () => {
  render(<MemoryRouter><SavedMapsPage /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Rome" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Rename Rome" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Saved map title" }), { target: { value: "Updated Rome" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(renameMapSnapshot).toHaveBeenCalledWith("map-1", "Updated Rome"));
  fireEvent.change(screen.getByLabelText("Profile"), { target: { value: "none" } });
  expect(screen.queryByText("Updated Rome")).not.toBeInTheDocument();
});

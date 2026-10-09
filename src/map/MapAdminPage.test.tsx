import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("../component/PageLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

jest.mock("../auth/viewerApi", () => ({
  getViewer: jest.fn(),
}));

jest.mock("./mapApi", () => ({
  approveMapPlace: jest.fn(),
  findLikelyDuplicateMapPlaces: jest.fn().mockResolvedValue([]),
  listPendingMapPlaces: jest.fn(),
  mergeMapPlace: jest.fn(),
  rejectMapPlace: jest.fn(),
}));

import { getViewer } from "../auth/viewerApi";
import {
  approveMapPlace,
  findLikelyDuplicateMapPlaces,
  listPendingMapPlaces,
} from "./mapApi";
import MapAdminPage from "./MapAdminPage";

const getViewerMock = getViewer as jest.MockedFunction<typeof getViewer>;
const listPendingMock = listPendingMapPlaces as jest.MockedFunction<
  typeof listPendingMapPlaces
>;
const approveMock = approveMapPlace as jest.MockedFunction<
  typeof approveMapPlace
>;
const findLikelyDuplicatesMock =
  findLikelyDuplicateMapPlaces as jest.MockedFunction<
    typeof findLikelyDuplicateMapPlaces
  >;

const proposal = {
  id: "tempvs:proposal-1",
  canonicalName: "Augusta Raurica",
  latitude: 47.533,
  longitude: 7.72,
  featureType: "HISTORIC_SETTLEMENT",
  createdByUserId: "author-1",
  createdAt: "2026-10-08T12:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  listPendingMock.mockResolvedValue({ items: [proposal] });
  findLikelyDuplicatesMock.mockResolvedValue([]);
});

test("lets a map reviewer inspect but not decide proposals", async () => {
  getViewerMock.mockResolvedValue({
    userId: "reviewer-1",
    roles: ["MAP_REVIEWER"],
  });
  render(<MapAdminPage />);

  expect(await screen.findByText("Augusta Raurica")).toBeInTheDocument();
  expect(screen.getByText(/Submitted by author-1/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
});

test("lets a map editor approve a proposal", async () => {
  getViewerMock.mockResolvedValue({
    userId: "editor-1",
    roles: ["MAP_EDITOR"],
  });
  approveMock.mockResolvedValue();
  render(<MapAdminPage />);

  fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
  await waitFor(() =>
    expect(approveMock).toHaveBeenCalledWith("tempvs:proposal-1", undefined),
  );
  expect(screen.queryByText("Augusta Raurica")).toBeNull();
});

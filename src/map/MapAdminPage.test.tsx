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
  commentOnMapPlaceProposal: jest.fn(),
  findLikelyDuplicateMapPlaces: jest.fn().mockResolvedValue([]),
  listMapPlaceProposalActivity: jest.fn(),
  listPendingMapPlaces: jest.fn(),
  mergeMapPlace: jest.fn(),
  rejectMapPlace: jest.fn(),
  requestMapPlaceChanges: jest.fn(),
}));

jest.mock("./MapCanvas", () => ({
  __esModule: true,
  default: () => <div data-testid="proposal-map-preview" />,
}));

import { getViewer } from "../auth/viewerApi";
import {
  approveMapPlace,
  commentOnMapPlaceProposal,
  findLikelyDuplicateMapPlaces,
  listMapPlaceProposalActivity,
  listPendingMapPlaces,
  requestMapPlaceChanges,
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
const requestChangesMock = requestMapPlaceChanges as jest.MockedFunction<
  typeof requestMapPlaceChanges
>;
const commentOnProposalMock = commentOnMapPlaceProposal as jest.MockedFunction<
  typeof commentOnMapPlaceProposal
>;
const listActivityMock = listMapPlaceProposalActivity as jest.MockedFunction<
  typeof listMapPlaceProposalActivity
>;

const proposal = {
  id: "tempvs:proposal-1",
  status: "PENDING" as const,
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
  listActivityMock.mockResolvedValue([]);
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
  await waitFor(() => expect(screen.queryByText("Augusta Raurica")).toBeNull());
});

test("filters loaded proposals and opens a private point preview", async () => {
  getViewerMock.mockResolvedValue({
    userId: "reviewer-1",
    roles: ["MAP_REVIEWER"],
  });
  listPendingMock.mockResolvedValue({
    items: [
      proposal,
      {
        ...proposal,
        id: "tempvs:proposal-2",
        canonicalName: "Londinium",
        featureType: "SETTLEMENT",
      },
    ],
  });
  render(<MapAdminPage />);

  expect(await screen.findByText("Londinium")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: /filter loaded/i }), {
    target: { value: "augusta" },
  });
  expect(screen.getByText("Augusta Raurica")).toBeInTheDocument();
  expect(screen.queryByText("Londinium")).toBeNull();

  fireEvent.click(screen.getByText(/review submitted details and point/i));
  expect(await screen.findByTestId("proposal-map-preview")).toBeInTheDocument();
  expect(screen.getByText("47.533000, 7.720000")).toBeInTheDocument();
});

test("lets a map editor request changes and removes the proposal from review", async () => {
  getViewerMock.mockResolvedValue({
    userId: "editor-1",
    roles: ["MAP_EDITOR"],
  });
  requestChangesMock.mockResolvedValue();
  render(<MapAdminPage />);

  fireEvent.click(
    await screen.findByRole("button", { name: "Request changes" }),
  );
  await waitFor(() =>
    expect(requestChangesMock).toHaveBeenCalledWith(
      "tempvs:proposal-1",
      undefined,
    ),
  );
  await waitFor(() => expect(screen.queryByText("Augusta Raurica")).toBeNull());
});

test("records a private reviewer comment in the proposal discussion", async () => {
  getViewerMock.mockResolvedValue({
    userId: "editor-1",
    roles: ["MAP_EDITOR"],
  });
  commentOnProposalMock.mockResolvedValue({
    id: "activity-1",
    placeId: "tempvs:proposal-1",
    kind: "COMMENTED",
    actorUserId: "editor-1",
    occurredAt: "2026-10-09T12:00:00.000Z",
    note: "Please add a citation.",
  });
  render(<MapAdminPage />);
  fireEvent.click(
    await screen.findByText(/review submitted details and point/i),
  );
  const input = await screen.findByRole("textbox", {
    name: "Comment on Augusta Raurica",
  });
  fireEvent.change(input, { target: { value: "Please add a citation." } });
  fireEvent.click(screen.getByRole("button", { name: "Comment" }));
  await waitFor(() =>
    expect(commentOnProposalMock).toHaveBeenCalledWith(
      "tempvs:proposal-1",
      "Please add a citation.",
    ),
  );
  expect(await screen.findByText("Please add a citation.")).toBeInTheDocument();
});

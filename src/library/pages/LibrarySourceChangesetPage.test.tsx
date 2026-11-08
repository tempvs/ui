import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LibrarySourceChangesetPage from "./LibrarySourceChangesetPage";

jest.mock(
  "../../component/PageLayout",
  () =>
    ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
);
jest.mock("../../comment/CommentThread", () => () => null);
jest.mock("../libraryApi", () => ({
  getLibraryViewer: jest.fn(),
  getSourceChangeset: jest.fn(),
  getSourceImages: jest.fn(),
  getSourceChangesetImages: jest.fn(),
  approveSourceChangeset: jest.fn(),
  publishSourceChangeset: jest.fn(),
  rejectSourceChangeset: jest.fn(),
  withdrawSourceChangeset: jest.fn(),
  projectApprovedSourceImages: jest.fn().mockReturnValue([]),
}));

const api = jest.requireMock("../libraryApi");
const source = {
  id: "source-1",
  name: "Original source",
  period: "MODERN",
  type: "WRITTEN",
  description: null,
};
const proposal = {
  id: "proposal-1",
  sourceId: source.id,
  proposerId: "author",
  kind: "UPDATE",
  status: "PENDING",
  base: { ...source, from: null, to: null },
  proposed: { ...source, name: "Updated source", from: null, to: null },
  imageOperations: [],
  version: 1,
  revision: 1,
  createdAt: "2026-11-08T12:00:00Z",
};
const approved = {
  ...proposal,
  version: 2,
  status: "APPROVED",
  approvals: [
    { userId: "reviewer", revision: 1, approvedAt: "2026-11-08T12:30:00Z" },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  api.getLibraryViewer.mockResolvedValue({
    userId: "reviewer",
    roles: ["LIBRARY_SCRIBE"],
  });
  api.getSourceChangeset.mockResolvedValue({
    ok: true,
    data: { source, changeset: proposal },
  });
  api.getSourceImages.mockResolvedValue({ ok: true, data: [] });
  api.getSourceChangesetImages.mockResolvedValue({ ok: true, data: [] });
});

function mount() {
  render(
    <IntlProvider locale="en">
      <MemoryRouter
        initialEntries={["/library/source/source-1/changesets/proposal-1"]}
      >
        <Routes>
          <Route
            path="/library/source/:sourceId/changesets/:changesetId"
            element={<LibrarySourceChangesetPage />}
          />
          <Route
            path="/library/source/:sourceId"
            element={<div>Published source page</div>}
          />
        </Routes>
      </MemoryRouter>
    </IntlProvider>,
  );
}

test("approval stays on the proposal and does not publish or navigate to the public source", async () => {
  api.approveSourceChangeset.mockImplementation(async () => {
    api.getSourceChangeset.mockResolvedValue({
      ok: true,
      data: { source, changeset: approved },
    });
    return { ok: true, data: { source, changeset: approved } };
  });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
  await screen.findByText("Approved — ready to publish", { selector: "span" });
  expect(api.publishSourceChangeset).not.toHaveBeenCalled();
  expect(screen.queryByText("Published source page")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Publish" }),
  ).not.toBeInTheDocument();
});

test("the author can publish the approved revision", async () => {
  api.getLibraryViewer.mockResolvedValue({
    userId: "author",
    roles: ["LIBRARY_SCRIBE"],
  });
  api.getSourceChangeset.mockResolvedValue({
    ok: true,
    data: { source, changeset: approved },
  });
  api.publishSourceChangeset.mockResolvedValue({
    ok: true,
    data: { source, changeset: { ...approved, status: "APPLIED" } },
  });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
  await screen.findByText("Published source page");
  expect(api.publishSourceChangeset).toHaveBeenCalledWith(
    "source-1",
    "proposal-1",
    2,
    undefined,
  );
});

test("admin publication on behalf requires an explanation", async () => {
  api.getLibraryViewer.mockResolvedValue({
    userId: "admin",
    roles: ["LIBRARY_ADMIN"],
  });
  api.getSourceChangeset.mockResolvedValue({
    ok: true,
    data: { source, changeset: approved },
  });
  api.publishSourceChangeset.mockResolvedValue({ ok: false });
  mount();
  const publish = await screen.findByRole("button", {
    name: "Publish on author's behalf",
  });
  expect(publish).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Reason for publishing on behalf"), {
    target: { value: "Author requested publication" },
  });
  fireEvent.click(publish);
  await waitFor(() =>
    expect(api.publishSourceChangeset).toHaveBeenCalledWith(
      "source-1",
      "proposal-1",
      2,
      "Author requested publication",
    ),
  );
});

test("an editor who amended the proposal cannot approve it", async () => {
  api.getSourceChangeset.mockResolvedValue({
    ok: true,
    data: {
      source,
      changeset: {
        ...proposal,
        amendments: [
          { userId: "reviewer", revision: 1, amendedAt: proposal.createdAt },
        ],
      },
    },
  });
  mount();
  await screen.findByText("Proposed by author");
  expect(
    screen.queryByRole("button", { name: "Approve" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Amend proposal/ })).toHaveAttribute(
    "href",
    "/library/source/source-1/edit?changeset=proposal-1",
  );
});

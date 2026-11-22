import React from "react";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LibraryPeriodPage from "./LibraryPeriodPage";

jest.mock("../../component/PlacePickerField", () => () => null);
jest.mock("../libraryApi", () => ({
  findSources: jest.fn(),
  getLibraryViewer: jest.fn(),
  getPendingSourceChangesets: jest.fn(),
}));

const api = jest.requireMock("../libraryApi");

beforeEach(() => {
  api.findSources.mockResolvedValue({ ok: true, data: [] });
  api.getLibraryViewer.mockResolvedValue({
    userId: "editor",
    roles: ["LIBRARY_SCRIBE"],
  });
});

function mount() {
  render(
    <IntlProvider locale="en">
      <MemoryRouter initialEntries={["/library/period/modern"]}>
        <Routes>
          <Route
            path="/library/period/:period"
            element={<LibraryPeriodPage />}
          />
        </Routes>
      </MemoryRouter>
    </IntlProvider>,
  );
}

test("counts the review queue even when no sources have been published", async () => {
  api.getPendingSourceChangesets.mockResolvedValue({
    ok: true,
    data: {
      content: [
        { changeset: { kind: "CREATE", status: "PENDING" } },
        { changeset: { kind: "UPDATE", status: "PENDING" } },
        { changeset: { kind: "DELETE", status: "APPROVED" } },
      ],
    },
  });
  mount();
  expect(
    await screen.findByRole("link", { name: "Pending proposals (3)" }),
  ).toHaveAttribute("href", "/library/period/modern/proposals");
  expect(api.getPendingSourceChangesets).toHaveBeenCalledWith({
    period: "MODERN",
    limit: 40,
    nextToken: undefined,
  });
  expect(api.findSources).toHaveBeenCalledTimes(1);
});

test("counts all queue pages, including pages emptied by the period filter", async () => {
  api.getPendingSourceChangesets
    .mockResolvedValueOnce({
      ok: true,
      data: { content: [{}, {}], nextToken: "page-2" },
    })
    .mockResolvedValueOnce({
      ok: true,
      data: { content: [], nextToken: "page-3" },
    })
    .mockResolvedValueOnce({
      ok: true,
      data: { content: [{}], nextToken: null },
    });
  mount();
  expect(
    await screen.findByRole("link", { name: "Pending proposals (3)" }),
  ).toBeInTheDocument();
  expect(api.getPendingSourceChangesets).toHaveBeenNthCalledWith(3, {
    period: "MODERN",
    limit: 40,
    nextToken: "page-3",
  });
});

test("shows zero only after the queue has loaded successfully", async () => {
  api.getPendingSourceChangesets.mockResolvedValue({
    ok: true,
    data: { content: [] },
  });
  mount();
  expect(
    await screen.findByRole("link", { name: "Pending proposals (0)" }),
  ).toBeInTheDocument();
});

test("does not report zero when loading the queue fails", async () => {
  api.getPendingSourceChangesets.mockResolvedValue({ ok: false, status: 503 });
  mount();
  expect(
    await screen.findByRole("link", { name: "Pending proposals" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Pending proposals (0)" }),
  ).not.toBeInTheDocument();
});

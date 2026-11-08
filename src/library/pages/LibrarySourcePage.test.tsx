import React from "react";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LibrarySourcePage from "./LibrarySourcePage";

jest.mock(
  "../../component/PageLayout",
  () =>
    ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
);
jest.mock("../libraryApi", () => ({
  getSource: jest.fn(),
  getLibraryViewer: jest.fn(),
  getSourceChangesets: jest.fn(),
}));

const api = jest.requireMock("../libraryApi");
beforeEach(() => {
  jest.resetAllMocks();
  api.getSource.mockResolvedValue({ ok: false, status: 404 });
  api.getLibraryViewer.mockResolvedValue({
    userId: "scribe",
    roles: ["LIBRARY_SCRIBE"],
  });
  api.getSourceChangesets.mockResolvedValue({
    ok: true,
    data: {
      content: [{ id: "proposal-1", kind: "CREATE", status: "PENDING" }],
    },
  });
});

function mount() {
  render(
    <IntlProvider locale="en">
      <MemoryRouter initialEntries={["/library/source/new-source"]}>
        <Routes>
          <Route
            path="/library/source/:sourceId"
            element={<LibrarySourcePage />}
          />
          <Route
            path="/library/source/:sourceId/changesets/:changesetId"
            element={<div>Private proposal</div>}
          />
        </Routes>
      </MemoryRouter>
    </IntlProvider>,
  );
}

test.each(["PENDING", "APPROVED"])(
  "a source URL redirects an editor to its %s creation proposal",
  async (status) => {
    api.getSourceChangesets.mockResolvedValue({
      ok: true,
      data: { content: [{ id: "proposal-1", kind: "CREATE", status }] },
    });
    mount();
    expect(await screen.findByText("Private proposal")).toBeInTheDocument();
  },
);

test("public viewers cannot discover private proposals through a missing source URL", async () => {
  api.getLibraryViewer.mockResolvedValue(null);
  mount();
  await screen.findByText("Unable to load the source.");
  expect(api.getSourceChangesets).not.toHaveBeenCalled();
});

test("a transient source failure is not mistaken for an unpublished source", async () => {
  api.getSource.mockResolvedValue({ ok: false, status: 503 });
  mount();
  await screen.findByText("Unable to load the source.");
  expect(api.getSourceChangesets).not.toHaveBeenCalled();
});

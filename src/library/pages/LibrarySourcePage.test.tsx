import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
  getSourceImages: jest.fn(),
  getSourceProfiles: jest.fn(),
  getSourceChangeLog: jest.fn(),
}));
jest.mock("../../post/PostPanel", () => () => null);
jest.mock("../../component/PlacePickerField", () => () => null);
jest.mock("../../profile/profileApi", () => ({ getUserProfilesByUserIds: async () => [] }));
jest.mock("../../image/imageApi", () => ({ getImageThumbnails: async () => [] }));

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
  api.getSourceImages.mockResolvedValue({ ok: true, data: [] });
  api.getSourceProfiles.mockResolvedValue({ ok: true, data: [] });
  api.getSourceChangeLog.mockResolvedValue({ ok: true, data: [] });
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
            path="/library/source/:sourceId/edit"
            element={<div>Edit photo proposal</div>}
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

test("an editor can add the first source album photo through the shared gallery and proposal flow", async () => {
  api.getSource.mockResolvedValue({ ok: true, data: {
    id: "new-source", name: "Source without photos", type: "WRITTEN", period: "MODERN", version: 1,
  } });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Add image" }));
  expect(await screen.findByText("Edit photo proposal")).toBeInTheDocument();
});

test("source album upload is unavailable to public viewers", async () => {
  api.getSource.mockResolvedValue({ ok: true, data: {
    id: "new-source", name: "Source without photos", type: "WRITTEN", period: "MODERN", version: 1,
  } });
  api.getLibraryViewer.mockResolvedValue(null);
  mount();
  await screen.findByRole("img", { name: "No photos in this album yet." });
  expect(screen.queryByRole("button", { name: "Add image" })).not.toBeInTheDocument();
});

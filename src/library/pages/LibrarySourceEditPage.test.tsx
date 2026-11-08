import React from "react";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LibrarySourceEditPage from "./LibrarySourceEditPage";

jest.mock(
  "../../component/PageLayout",
  () =>
    ({
      children,
      header,
    }: {
      children: React.ReactNode;
      header?: { title?: React.ReactNode };
    }) => (
      <main>
        {header?.title}
        {children}
      </main>
    ),
);
jest.mock("../../component/StackedImageGallery", () => () => null);
jest.mock("../../component/PlacePickerField", () => () => null);
jest.mock("../libraryApi", () => ({
  getSource: jest.fn(),
  getLibraryViewer: jest.fn(),
  getSourceChangesets: jest.fn(),
  getSourceImages: jest.fn(),
}));

const api = jest.requireMock("../libraryApi");

test.each(["PENDING", "APPROVED"])(
  "editing another contributor's %s creation proposal keeps its breadcrumb in the private proposal",
  async (status) => {
    api.getLibraryViewer.mockResolvedValue({
      userId: "reviewer",
      roles: ["LIBRARY_SCRIBE"],
    });
    api.getSource.mockResolvedValue({ ok: false, status: 404 });
    api.getSourceImages.mockResolvedValue({ ok: true, data: [] });
    api.getSourceChangesets.mockResolvedValue({
      ok: true,
      data: {
        content: [
          {
            id: "proposal-1",
            sourceId: "source-1",
            proposerId: "author",
            kind: "CREATE",
            status,
            baseVersion: 1,
            version: 2,
            proposed: {
              name: "Unpublished source",
              type: "WRITTEN",
              period: "MODERN",
              description: null,
              from: null,
              to: null,
            },
            imageOperations: [],
          },
        ],
      },
    });
    render(
      <IntlProvider locale="en">
        <MemoryRouter
          initialEntries={[
            "/library/source/source-1/edit?changeset=proposal-1",
          ]}
        >
          <Routes>
            <Route
              path="/library/source/:sourceId/edit"
              element={<LibrarySourceEditPage />}
            />
          </Routes>
        </MemoryRouter>
      </IntlProvider>,
    );
    expect(
      await screen.findByRole("link", { name: "Unpublished source" }),
    ).toHaveAttribute("href", "/library/source/source-1/changesets/proposal-1");
    expect(screen.getByRole("link", { name: "Proposal" })).toHaveAttribute(
      "href",
      "/library/source/source-1/changesets/proposal-1",
    );
    expect(screen.getByText("Edit proposal")).toBeInTheDocument();
    expect(
      screen.getByText(/You are editing an existing proposal/),
    ).toBeInTheDocument();
  },
);

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import SearchDialog from "./SearchDialog";
import { searchProfiles, getProfileAvatar } from "../profile/profileApi";
import { findSources, getSourceImages } from "../library/libraryApi";
import messages from "../translations/en.json";

jest.mock("../profile/profileApi", () => ({
  searchProfiles: jest.fn(),
  getProfileAvatar: jest.fn(),
}));
jest.mock("../library/libraryApi", () => ({
  findSources: jest.fn(),
  getSourceImages: jest.fn(),
}));
jest.mock("../club/clubApi", () => ({ listClubs: jest.fn() }));
jest.mock("../event/eventApi", () => ({ listEvents: jest.fn() }));

function response(content: unknown[]): Response {
  return { ok: true, status: 200, json: async () => ({ content }) } as Response;
}

function lookupResponse(options?: RequestInit) {
  const { resources } = JSON.parse(String(options?.body));
  return response(
    resources.map((resource: any) => ({
      ...resource,
      image: {
        id: resource.preferredImageId || `first-${resource.resourceId}`,
        thumbnailUrl: `https://images.test/${resource.resourceId}.jpg`,
      },
    })),
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let mockLoadMore: IntersectionObserverCallback | undefined;

function openSearch() {
  render(
    <IntlProvider locale="en" messages={messages}>
      <MemoryRouter>
        <SearchDialog />
      </MemoryRouter>
    </IntlProvider>,
  );
  const input = screen.getByRole("searchbox", {
    name: "Search profiles, clubs, events, and sources",
  });
  fireEvent.change(input, { target: { value: "rome" } });
  return input;
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => ({ matches: false }),
  });
  Object.defineProperty(global, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: class {
      constructor(callback: IntersectionObserverCallback) {
        mockLoadMore = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadMore = undefined;
  window.localStorage.clear();
  jest.mocked(searchProfiles).mockResolvedValue([]);
  jest.mocked(findSources).mockResolvedValue({ ok: true, data: [] } as any);
});
afterEach(() => jest.restoreAllMocks());

test("loads twenty profile avatars in one metadata request", async () => {
  jest.mocked(searchProfiles).mockResolvedValue(
    Array.from({ length: 20 }, (_, id) => ({
      id: `batch-profile-${id}`,
      firstName: `Profile ${id}`,
      type: "USER",
    })),
  );
  const fetchMock = jest
    .spyOn(global, "fetch")
    .mockImplementation(async (_url, options) => lookupResponse(options));
  openSearch();
  await screen.findByRole("link", { name: "Profile 0" });
  await waitFor(() =>
    expect(document.querySelectorAll("img.search-profile-image")).toHaveLength(
      20,
    ),
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/images/lookup");
  expect(
    JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).resources,
  ).toHaveLength(20);
  expect(getProfileAvatar).not.toHaveBeenCalled();
});

test("renders profile results before thumbnail metadata finishes", async () => {
  const images = deferred<Response>();
  jest
    .mocked(searchProfiles)
    .mockResolvedValue([
      { id: "pending-profile", firstName: "Pending photos", type: "USER" },
    ]);
  jest.spyOn(global, "fetch").mockReturnValue(images.promise);
  openSearch();
  expect(
    await screen.findByRole("link", { name: "Pending photos" }),
  ).toBeVisible();
  expect(document.querySelectorAll("img.search-profile-image")).toHaveLength(0);
  await act(async () => images.resolve(response([])));
});

test("batches source covers without downloading per-source image collections", async () => {
  const preferredImageId = "018f0000-0000-7000-8000-000000000002";
  jest.mocked(findSources).mockResolvedValue({
    ok: true,
    data: [
      {
        id: "cover-source",
        name: "Covered source",
        coverImageId: preferredImageId,
      },
      { id: "default-source", name: "Default source" },
    ],
  } as any);
  const fetchMock = jest
    .spyOn(global, "fetch")
    .mockImplementation(async (_url, options) => lookupResponse(options));
  openSearch();
  fireEvent.click(screen.getByText("Sources"));
  await screen.findByText("Covered source", { selector: ".card-title a" });
  expect(
    await screen.findByRole("img", { name: "Covered source" }),
  ).toHaveAttribute("src", "https://images.test/cover-source.jpg");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
    resources: [
      { resourceType: "source", resourceId: "cover-source", preferredImageId },
      { resourceType: "source", resourceId: "default-source" },
    ],
  });
  expect(getSourceImages).not.toHaveBeenCalled();
});

test("a late image batch cannot replace the next search's thumbnails", async () => {
  const oldImages = deferred<Response>();
  jest
    .mocked(searchProfiles)
    .mockResolvedValueOnce([
      { id: "stale-image-profile", firstName: "Old profile", type: "USER" },
    ])
    .mockResolvedValueOnce([
      { id: "fresh-image-profile", firstName: "New profile", type: "USER" },
    ]);
  const fetchMock = jest
    .spyOn(global, "fetch")
    .mockReturnValueOnce(oldImages.promise)
    .mockImplementation(async (_url, options) => lookupResponse(options));
  const input = openSearch();
  await screen.findByRole("link", { name: "Old profile" });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  fireEvent.change(input, { target: { value: "athens" } });
  await screen.findByRole("link", { name: "New profile" });
  await waitFor(() =>
    expect(document.querySelector("img.search-profile-image")).toHaveAttribute(
      "src",
      "https://images.test/fresh-image-profile.jpg",
    ),
  );
  await act(async () =>
    oldImages.resolve(
      response([
        {
          resourceType: "profile",
          resourceId: "fresh-image-profile",
          image: { thumbnailUrl: "wrong.jpg" },
        },
      ]),
    ),
  );
  expect(document.querySelector("img.search-profile-image")).toHaveAttribute(
    "src",
    "https://images.test/fresh-image-profile.jpg",
  );
});

test("a failed thumbnail batch leaves source results usable", async () => {
  jest.mocked(findSources).mockResolvedValue({
    ok: true,
    data: [{ id: "failed-source-image", name: "Readable source" }],
  } as any);
  const fetchMock = jest
    .spyOn(global, "fetch")
    .mockRejectedValue(new Error("Images unavailable"));
  openSearch();
  fireEvent.click(screen.getByText("Sources"));
  expect(
    await screen.findByRole("link", { name: "Readable source" }),
  ).toBeVisible();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(screen.queryByText("Images unavailable")).not.toBeInTheDocument();
});

test("late first-page thumbnails do not erase images from an appended page", async () => {
  const firstImages = deferred<Response>();
  const profiles = Array.from({ length: 20 }, (_, id) => ({
    id: `paged-preview-${id}`,
    firstName: `Paged ${id}`,
    type: "USER",
  }));
  jest
    .mocked(searchProfiles)
    .mockResolvedValueOnce(profiles)
    .mockResolvedValueOnce([
      {
        id: "paged-preview-last",
        firstName: "Last page profile",
        type: "USER",
      },
    ]);
  jest
    .spyOn(global, "fetch")
    .mockReturnValueOnce(firstImages.promise)
    .mockImplementation(async (_url, options) => lookupResponse(options));
  openSearch();
  await screen.findByRole("link", { name: "Paged 0" });
  await waitFor(() => expect(mockLoadMore).toBeDefined());
  await act(async () =>
    mockLoadMore!(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
  await screen.findByRole("link", { name: "Last page profile" });
  await waitFor(() =>
    expect(document.querySelectorAll("img.search-profile-image")).toHaveLength(
      1,
    ),
  );
  await act(async () =>
    firstImages.resolve(
      response(
        profiles.map((profile) => ({
          resourceType: "profile",
          resourceId: profile.id,
          image: { thumbnailUrl: `https://images.test/${profile.id}.jpg` },
        })),
      ),
    ),
  );
  expect(document.querySelectorAll("img.search-profile-image")).toHaveLength(
    21,
  );
});

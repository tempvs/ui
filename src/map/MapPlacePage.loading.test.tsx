import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MapPlacePage from "./MapPlacePage";
import * as api from "./mapApi";
jest.mock("../component/PageLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock("../auth/viewerApi", () => ({ getViewer: async () => null }));
jest.mock("../image/imageApi", () => ({ getImageThumbnails: async () => [] }));
jest.mock("./MapCanvas", () => ({
  __esModule: true,
  default: () => null,
  entityKey: (item: api.MapEntityLocation) => item.entityId,
}));
jest.mock("./mapApi", () => ({
  ...jest.requireActual("./mapApi"),
  getMapPlace: jest.fn(),
  listMapPlaceChildren: jest.fn(),
  listMapPlaceEntities: jest.fn(),
  listMapPlaceHistory: jest.fn(),
  getMapPlaceEntityCounts: jest.fn(),
}));
afterEach(() => jest.restoreAllMocks());
test("renders content while counts load and retains those counts during pagination", async () => {
  let resolveCounts!: (counts: { CLUB: number }) => void;
  jest.mocked(api.getMapPlaceEntityCounts).mockReturnValue(
    new Promise((resolve) => {
      resolveCounts = resolve;
    }),
  );
  jest.mocked(api.getMapPlace).mockResolvedValue({
    id: "rome",
    canonicalName: "Rome",
    latitude: 41.9,
    longitude: 12.5,
    featureType: "SETTLEMENT",
  });
  jest.mocked(api.listMapPlaceChildren).mockResolvedValue({ items: [] });
  jest.mocked(api.listMapPlaceHistory).mockResolvedValue({ items: [] });
  const item: api.MapEntityLocation = {
    entityType: "CLUB",
    entityId: "club-1",
    locationRole: "CLUB_ASSOCIATION",
    label: "Visible club",
    placeId: "rome",
    placeName: "Rome",
    latitude: 41.9,
    longitude: 12.5,
  };
  jest
    .mocked(api.listMapPlaceEntities)
    .mockResolvedValueOnce({ items: [item], nextCursor: "next" })
    .mockResolvedValueOnce({
      items: [{ ...item, entityId: "club-2", label: "Older club" }],
    });
  render(
    <MemoryRouter>
      <MapPlacePage id="rome" />
    </MemoryRouter>,
  );
  expect(
    await screen.findByRole("link", { name: "Visible club" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "All (�)" })).toBeVisible();
  expect(jest.mocked(api.listMapPlaceEntities).mock.calls[0][5]).toBe(false);
  await act(async () => resolveCounts({ CLUB: 12 }));
  expect(screen.getByRole("button", { name: "All (12)" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  expect(await screen.findByRole("link", { name: "Older club" })).toBeVisible();
  expect(screen.getByRole("button", { name: "All (12)" })).toBeVisible();
  expect(api.getMapPlaceEntityCounts).toHaveBeenCalledTimes(1);
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import WallPage from "./WallPage";
import { getWall, getWallThumbnails } from "./wallApi";

let mockProfileValue = "first";
jest.mock("../component/PageLayout", () => ({
  __esModule: true,
  default: ({ children }: any) => children,
}));
jest.mock("./ActivityCard", () => ({
  __esModule: true,
  default: ({ activity, thumbnail }: any) => (
    <article>
      {activity.title}
      <span>{thumbnail?.url}</span>
    </article>
  ),
}));
jest.mock("../profile/currentProfile", () => ({
  useCurrentProfileValue: () => mockProfileValue,
  resolveCurrentOwnedProfileId: () => mockProfileValue,
}));
jest.mock("../profile/profileApi", () => ({
  getUserProfileByUserId: async () => ({ id: "first" }),
  fetchClubProfiles: (_id: string, handlers: any) => handlers.onSuccess([]),
}));
jest.mock("./wallApi", () => ({
  getWall: jest.fn(),
  getWallThumbnails: jest.fn(),
  dismissWallItem: jest.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function page(id: string, nextToken?: string) {
  return {
    content: [{ id, title: id, targetType: "PROFILE", targetId: id }],
    nextToken,
    hasMore: Boolean(nextToken),
  } as any;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProfileValue = "first";
  jest.mocked(getWallThumbnails).mockResolvedValue([]);
});

test("shows and paginates activities while thumbnail metadata is pending", async () => {
  const images = deferred<any[]>();
  jest.mocked(getWallThumbnails).mockReturnValue(images.promise);
  jest
    .mocked(getWall)
    .mockResolvedValueOnce(page("First update", "next"))
    .mockResolvedValueOnce(page("Older update"));
  render(<WallPage userId="user" />);
  expect(await screen.findByText("First update")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  expect(await screen.findByText("Older update")).toBeVisible();
  expect(screen.getByText("First update")).toBeVisible();
  await act(async () => images.resolve([]));
});

test("aborts an old feed and ignores its late response after a profile switch", async () => {
  const old = deferred<any>();
  jest
    .mocked(getWall)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(page("New profile update"));
  const view = render(<WallPage userId="user" />);
  await waitFor(() => expect(getWall).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(getWall).mock.calls[0][3]!;
  mockProfileValue = "second";
  view.rerender(<WallPage userId="user" />);
  expect(await screen.findByText("New profile update")).toBeVisible();
  expect(signal.aborted).toBe(true);
  await act(async () => old.resolve(page("Obsolete update")));
  expect(screen.queryByText("Obsolete update")).not.toBeInTheDocument();
});

test("late thumbnails cannot leak into a different profile's wall", async () => {
  const images = deferred<any[]>();
  jest
    .mocked(getWallThumbnails)
    .mockReturnValueOnce(images.promise)
    .mockResolvedValueOnce([]);
  jest
    .mocked(getWall)
    .mockResolvedValueOnce(page("First update"))
    .mockResolvedValueOnce(page("New update"));
  const view = render(<WallPage userId="user" />);
  await screen.findByText("First update");
  mockProfileValue = "second";
  view.rerender(<WallPage userId="user" />);
  await screen.findByText("New update");
  await act(async () =>
    images.resolve([
      {
        resourceType: "profile",
        resourceId: "New update",
        image: { url: "wrong-image" },
      },
    ]),
  );
  expect(screen.queryByText("wrong-image")).not.toBeInTheDocument();
});

test("uses server discovery and follows empty checkpoints without claiming an empty wall", async () => {
  jest.mocked(getWall).mockResolvedValueOnce({ content: [], hasMore: true, nextToken: "s1.first" })
    .mockResolvedValueOnce({ content: [], hasMore: true, nextToken: "s1.second" })
    .mockResolvedValueOnce(page("Beyond sixty targets"));
  render(<WallPage userId="user" />);
  expect(await screen.findByText("Beyond sixty targets")).toBeVisible();
  expect(getWall).toHaveBeenNthCalledWith(2, "first", undefined, "s1.first", expect.any(AbortSignal));
});

test("retains continuation after bounded automatic discovery reads", async () => {
  jest.mocked(getWall).mockResolvedValue({ content: [], hasMore: true, nextToken: "s1.progress" });
  render(<WallPage userId="user" />);
  expect(await screen.findByText("Still checking for updates")).toBeVisible();
  expect(getWall).toHaveBeenCalledTimes(4);
  expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled();
});

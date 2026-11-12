import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LibraryJourney, {
  LibraryHint,
  LibraryJourneyProvider,
  librarySteps,
  useLibraryJourneyViewer,
} from "./LibraryJourney";
import { getLibraryViewer, type LibraryViewer } from "../libraryApi";
import {
  libraryLearningSnapshot,
  updateLibraryLearning,
} from "./libraryLearning";

jest.mock("../libraryApi", () => ({ getLibraryViewer: jest.fn() }));
let sequence = 0;
let userId = "";
beforeEach(() => {
  userId = `journey-${++sequence}`;
  sessionStorage.clear();
  (getLibraryViewer as jest.Mock).mockResolvedValue({
    userId,
    roles: ["LIBRARY_SCRIBE"],
  });
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        learned: [],
        dismissedHints: [],
        hiddenAudiences: [],
      }),
    });
});
afterEach(cleanup);
const progressReads = () => (fetch as jest.Mock).mock.calls.filter(([, options]) => !options?.method || options.method === "GET").length;
function mount(path = "/", compact = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LibraryJourneyProvider>
        <LibraryJourney compact={compact} />
        <LibraryHint topic="proposal" priority={5} message="Create a proposal">
          <button>+</button>
        </LibraryHint>
        <LibraryHint topic="review" priority={10} message="Review a proposal">
          <button>Approve</button>
        </LibraryHint>
      </LibraryJourneyProvider>
    </MemoryRouter>,
  );
}

test.each([
  [[], 3, false, false],
  [["LIBRARY_SCRIBE"], 8, false, false],
  [["LIBRARY_ARCHIVARIUS"], 9, true, false],
  [["LIBRARY_ADMIN"], 10, true, true],
  [["TEMPVS_ADMIN"], 10, true, true],
])(
  "roles %j get only the relevant learning steps",
  (roles, count, members, overrides) => {
    const steps = librarySteps({ userId: "member", roles: roles as string[] });
    expect(steps).toHaveLength(count as number);
    expect(steps.some((step) => step.id === "members")).toBe(members);
    expect(steps.some((step) => step.id === "overrides")).toBe(overrides);
  },
);

test("only one hint shows, and dismissing it immediately stops its target blinking", async () => {
  mount();
  await screen.findByText("Create a proposal");
  expect(screen.queryByText("Review a proposal")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "+" }).closest(".coachmark-anchor"),
  ).toHaveClass("coachmark-anchor--visible");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss hint" }));
  await screen.findByText("Review a proposal");
  expect(
    screen.getByRole("button", { name: "+" }).closest(".coachmark-anchor"),
  ).not.toHaveClass("coachmark-anchor--visible");
  expect(libraryLearningSnapshot(userId).progress.dismissedHints).toContain(
    "proposal",
  );
  expect(libraryLearningSnapshot(userId).progress.learned).not.toContain(
    "proposal",
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
});

test("server completion suppresses tooltips before any hint can flash", async () => {
  let finish!: (value: unknown) => void;
  (fetch as jest.Mock).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  mount();
  expect(screen.queryByText("Create a proposal")).not.toBeInTheDocument();
  await act(async () =>
    finish({
      ok: true,
      json: async () => ({
        learned: ["proposal", "review"],
        dismissedHints: [],
        hiddenAudiences: [],
      }),
    }),
  );
  await screen.findByText("2 of 8 topics learned");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  expect(screen.queryByText("Create a proposal")).not.toBeInTheDocument();
  expect(screen.queryByText("Review a proposal")).not.toBeInTheDocument();
});

test("hiding the guide suppresses every hint; help can be reopened", async () => {
  mount();
  await screen.findByText("Create a proposal");
  fireEvent.click(screen.getByRole("button", { name: "Hide guide and hints" }));
  expect(screen.queryByText("Create a proposal")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Review independently" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Library guide" }));
  await screen.findByRole("heading", { name: "Review independently" });
});

test("experienced members can mark a topic known without performing an action", async () => {
  mount();
  await screen.findByText("Create a proposal");
  const proposalStep = screen
    .getByRole("heading", { name: "Propose or amend a source" })
    .closest("section")!;
  fireEvent.click(proposalStep.querySelector("button")!);
  await waitFor(() =>
    expect(screen.queryByText("Create a proposal")).not.toBeInTheDocument(),
  );
  expect(libraryLearningSnapshot(userId).progress.learned).toContain(
    "proposal",
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "13");
  expect(screen.getByText("Check proposal status").closest("section")?.querySelector("button")).toHaveFocus();
});

function RefreshViewer({ viewer }: { viewer: LibraryViewer }) {
  useLibraryJourneyViewer(viewer);
  return null;
}
test("promotion introduces new role steps without erasing reader progress", async () => {
  (getLibraryViewer as jest.Mock).mockResolvedValue({ userId, roles: [] });
  const reader = { userId, roles: [] };
  const layout = (viewer: LibraryViewer) => (
    <MemoryRouter>
      <LibraryJourneyProvider>
        <LibraryJourney />
        <RefreshViewer viewer={viewer} />
      </LibraryJourneyProvider>
    </MemoryRouter>
  );
  const view = render(layout(reader));
  await screen.findByText("0 of 3 topics learned");
  act(() =>
    updateLibraryLearning(userId, {
      learned: ["browse", "source", "workflow"],
      audience: "reader",
      hidden: true,
    }),
  );
  view.rerender(layout({ userId, roles: ["LIBRARY_SCRIBE"] }));
  await screen.findByRole("heading", { name: "Propose or amend a source" });
  expect(screen.getByText("3 of 8 topics learned")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "38");
  expect(screen.getByText("You have 5 new contributor topics. Your previous progress is saved.")).toBeInTheDocument();
});

test.each([
  [[], ["browse", "browse", "proposal", "unknown"], 33, "1 of 3 topics learned"],
  [["LIBRARY_SCRIBE"], ["browse", "source", "workflow", "proposal", "status"], 63, "5 of 8 topics learned"],
  [["LIBRARY_ARCHIVARIUS"], ["browse", "source", "workflow", "proposal", "status", "review", "tasks", "publish"], 89, "8 of 9 topics learned"],
  [["LIBRARY_ADMIN"], ["browse", "source", "workflow", "proposal", "status", "review", "tasks", "publish", "members"], 90, "9 of 10 topics learned"],
])("applicable topics determine progress for %j", async (roles, learned, percentage, count) => {
  (getLibraryViewer as jest.Mock).mockResolvedValue({ userId, roles });
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ learned }) });
  mount();
  await screen.findByText(count as string);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(percentage));
  expect(progressReads()).toBe(1);
});

test("compact guides keep their percentage without expanding and known rows retain their numbers", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ learned: ["browse", "workflow"] }) });
  mount("/library/period/ancient", true);
  await screen.findByText("2 of 8 topics learned");
  expect(screen.queryByRole("heading", { name: "Read and use a source" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Library guide" }));
  const remaining = screen.getByRole("list", { name: "Library topics to learn" });
  expect(within(remaining).getAllByRole("listitem").map((row) => row.getAttribute("value"))).toEqual(["2", "4", "5", "6", "7", "8"]);
  fireEvent.click(screen.getByRole("button", { name: "Hide guide and hints" }));
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
});

test("an unlearned browse topic still links back from other Library pages", async () => {
  mount("/library/period/ancient", true);
  await screen.findByText("0 of 8 topics learned");
  fireEvent.click(screen.getByRole("button", { name: "Open Library guide" }));
  expect(screen.getByRole("link", { name: "Browse periods" })).toHaveAttribute("href", "/library");
});

test("downgrading and regaining a role retains learned topics without another progress read", async () => {
  const reader = { userId, roles: [] };
  (getLibraryViewer as jest.Mock).mockResolvedValue(reader);
  const layout = (viewer: LibraryViewer) => <MemoryRouter><LibraryJourneyProvider><LibraryJourney /><RefreshViewer viewer={viewer} /></LibraryJourneyProvider></MemoryRouter>;
  const view = render(layout(reader));
  await screen.findByText("0 of 3 topics learned");
  act(() => updateLibraryLearning(userId, { learned: ["browse", "source", "workflow", "proposal"] }));
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  view.rerender(layout({ userId, roles: ["LIBRARY_SCRIBE"] }));
  await screen.findByText("4 of 8 topics learned");
  view.rerender(layout(reader));
  await screen.findByText("3 of 3 topics learned");
  view.rerender(layout({ userId, roles: ["LIBRARY_SCRIBE"] }));
  await screen.findByText("4 of 8 topics learned");
  expect(progressReads()).toBe(1);
});

test("account changes load the new account's progress without carrying learning across", async () => {
  const reader = { userId, roles: [] };
  (getLibraryViewer as jest.Mock).mockResolvedValue(reader);
  const layout = (viewer: LibraryViewer) => <MemoryRouter><LibraryJourneyProvider><LibraryJourney /><RefreshViewer viewer={viewer} /></LibraryJourneyProvider></MemoryRouter>;
  const view = render(layout(reader));
  await screen.findByText("0 of 3 topics learned");
  act(() => updateLibraryLearning(userId, { learned: ["browse", "source", "workflow"] }));
  view.rerender(layout({ userId: `${userId}-other`, roles: [] }));
  await screen.findByText("0 of 3 topics learned");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  expect(progressReads()).toBe(2);
});

test.each(["/library", "/library/"])("the browse action is hidden only on the landing page %s", async (path) => {
  mount(path);
  await screen.findByRole("heading", { name: "Find a source" });
  expect(screen.queryByRole("link", { name: "Browse periods" })).not.toBeInTheDocument();
});

test("complete guides stay quiet and can be reopened for reference", async () => {
  const learned = librarySteps({ userId, roles: ["LIBRARY_SCRIBE"] }).map((step) => step.id);
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ learned }) });
  mount();
  await screen.findByText("100% complete");
  expect(screen.getByText(/Library guide complete/)).toBeInTheDocument();
  expect(screen.queryByText("Create a proposal")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open Library guide" }));
  expect(screen.getByText("Learned topics (8)")).toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Library topics to learn" })).toBeEmptyDOMElement();
});

test("unavailable progress shows no percentage or hints", async () => {
  (fetch as jest.Mock).mockRejectedValue(new Error("offline"));
  mount();
  await screen.findByText("Library guide progress is unavailable.");
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.queryByText("0% complete")).not.toBeInTheDocument();
  expect(screen.queryByText("Create a proposal")).not.toBeInTheDocument();
});

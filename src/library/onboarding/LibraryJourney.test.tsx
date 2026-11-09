import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
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
function mount() {
  return render(
    <MemoryRouter>
      <LibraryJourneyProvider>
        <LibraryJourney />
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
});

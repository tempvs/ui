import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LibrarySourceChangesetPage from "./LibrarySourceChangesetPage";

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
jest.mock("../../comment/CommentThread", () => () => null);
jest.mock("../../profile/profileApi", () => ({
  getUserProfilesByUserIds: jest.fn(),
}));
jest.mock("../libraryApi", () => ({
  getLibraryViewer: jest.fn(),
  getSourceChangeset: jest.fn(),
  getSourceImages: jest.fn(),
  getSourceChangesetImages: jest.fn(),
  approveSourceChangeset: jest.fn(),
  overrideApproveSourceChangeset: jest.fn(),
  publishSourceChangeset: jest.fn(),
  rejectSourceChangeset: jest.fn(),
  withdrawSourceChangeset: jest.fn(),
  addSourceProposalTask: jest.fn(),
  updateSourceProposalTask: jest.fn(),
  projectApprovedSourceImages: jest.fn().mockReturnValue([]),
}));

const api = jest.requireMock("../libraryApi");
const profileApi = jest.requireMock("../../profile/profileApi");
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
  profileApi.getUserProfilesByUserIds.mockImplementation(
    async (ids: string[]) =>
      ids.map((id) => ({
        id: `profile-${id}`,
        userId: id,
        firstName: `Name ${id}`,
        alias: `alias-${id}`,
      })),
  );
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

test.each(["LIBRARY_ADMIN", "TEMPVS_ADMIN"])(
  "%s gets a yellow publication override requiring an explanation",
  async (role) => {
    api.getLibraryViewer.mockResolvedValue({
      userId: "admin",
      roles: [role],
    });
    api.getSourceChangeset.mockResolvedValue({
      ok: true,
      data: { source, changeset: approved },
    });
    api.publishSourceChangeset.mockResolvedValue({ ok: false });
    mount();
    const publish = await screen.findByRole("button", {
      name: "Admin override: publish on author's behalf",
    });
    expect(publish).toBeDisabled();
    expect(publish).toHaveClass("btn-warning");
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
  },
);

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
  await screen.findByRole("link", { name: "Name author" });
  expect(
    screen.queryByRole("button", { name: "Approve" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Amend proposal/ })).toHaveAttribute(
    "href",
    "/library/source/source-1/edit?changeset=proposal-1",
  );
});

test("shows clickable profile names for proposal authors, contributors, approvers and publishers", async () => {
  const authorId = "84c8b468-80b1-7052-a33f-b8e41fe2c3b1";
  const people = [
    {
      id: "author-profile",
      userId: authorId,
      firstName: "Anton",
      lastName: "Hlinisty",
      alias: "anton",
    },
    { id: "contributor-profile", userId: "contributor", nickName: "Scribe" },
    {
      id: "reviewer-profile",
      userId: "reviewer",
      firstName: "Julia",
      alias: "julia",
    },
    {
      id: "publisher-profile",
      userId: "publisher",
      nickName: "Archivarius",
      alias: "archivarius",
    },
  ];
  profileApi.getUserProfilesByUserIds.mockResolvedValue(people);
  api.getSourceChangeset.mockResolvedValue({
    ok: true,
    data: {
      source,
      changeset: {
        ...approved,
        proposerId: authorId,
        status: "APPLIED",
        publishedBy: "publisher",
        publishedAt: proposal.createdAt,
        amendments: [
          { userId: "contributor", revision: 1, amendedAt: proposal.createdAt },
        ],
      },
    },
  });
  mount();
  const names = ["Anton Hlinisty", "Scribe", "Julia", "Archivarius"];
  for (let index = 0; index < names.length; index += 1) {
    const person = people[index];
    expect(
      await screen.findByRole("link", { name: names[index] }),
    ).toHaveAttribute("href", `/profile/${person.alias || person.id}`);
  }
  expect(document.body).not.toHaveTextContent(authorId);
  expect(profileApi.getUserProfilesByUserIds).toHaveBeenCalledWith([
    authorId,
    "reviewer",
    "contributor",
    "publisher",
  ]);
});

test("profile lookup failure keeps the proposal usable and never displays raw user IDs", async () => {
  profileApi.getUserProfilesByUserIds.mockRejectedValue(
    new Error("unavailable"),
  );
  mount();
  expect(
    await screen.findByRole("link", { name: "User profile" }),
  ).toHaveAttribute("href", "/profile/user/author");
  expect(screen.queryByText("Proposed by author")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
});

test("an unpublished source breadcrumb stays on the proposal and offers proposal editing", async () => {
  api.getSourceChangeset.mockResolvedValue({
    ok: true,
    data: { source, changeset: { ...proposal, kind: "CREATE" } },
  });
  mount();
  const nameLink = await screen.findByRole("link", { name: "Original source" });
  expect(nameLink).toHaveAttribute(
    "href",
    "/library/source/source-1/changesets/proposal-1",
  );
  expect(screen.getByRole("link", { name: "Edit proposal" })).toHaveAttribute(
    "href",
    "/library/source/source-1/edit?changeset=proposal-1",
  );
  fireEvent.click(nameLink);
  expect(screen.queryByText("Published source page")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add task" })).toBeInTheDocument();
});

test("reviewers can add a blocking action item and resolve it before approving", async () => {
  const task = {
    id: "task-1",
    text: "Provide evidence for the date",
    blocking: true,
    status: "OPEN",
    createdBy: "reviewer",
    createdAt: proposal.createdAt,
  };
  api.addSourceProposalTask.mockImplementation(async () => {
    api.getSourceChangeset.mockResolvedValue({
      ok: true,
      data: { source, changeset: { ...proposal, version: 2, tasks: [task] } },
    });
    return { ok: true };
  });
  api.updateSourceProposalTask.mockImplementation(async () => {
    api.getSourceChangeset.mockResolvedValue({
      ok: true,
      data: {
        source,
        changeset: {
          ...proposal,
          version: 3,
          tasks: [{ ...task, status: "RESOLVED", resolvedBy: "reviewer" }],
        },
      },
    });
    return { ok: true };
  });
  mount();
  fireEvent.change(await screen.findByLabelText("New action item"), {
    target: { value: task.text },
  });
  expect(
    screen.getByLabelText("Block approval and publication until resolved"),
  ).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Add task" }));
  await screen.findByText(task.text);
  expect(api.addSourceProposalTask).toHaveBeenCalledWith(
    "source-1",
    "proposal-1",
    1,
    task.text,
    true,
  );
  expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  expect(screen.getByText(/Blocked until 1 action item/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Resolve task" }));
  await screen.findByText("Resolved");
  expect(api.updateSourceProposalTask).toHaveBeenCalledWith(
    "source-1",
    "proposal-1",
    "task-1",
    2,
    "RESOLVED",
  );
  expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
});

test("authors cannot resolve another reviewer's blocking task or publish around it", async () => {
  api.getLibraryViewer.mockResolvedValue({
    userId: "author",
    roles: ["LIBRARY_SCRIBE"],
  });
  api.getSourceChangeset.mockResolvedValue({
    ok: true,
    data: {
      source,
      changeset: {
        ...approved,
        tasks: [
          {
            id: "task-1",
            text: "Reviewer must verify this date",
            blocking: true,
            status: "OPEN",
            createdBy: "reviewer",
            createdAt: proposal.createdAt,
          },
        ],
      },
    },
  });
  mount();
  expect(await screen.findByRole("button", { name: "Publish" })).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Resolve task" }),
  ).not.toBeInTheDocument();
});

test("an admin author gets a yellow, reason-required proposal approval override without publishing", async () => {
  api.getLibraryViewer.mockResolvedValue({
    userId: "author",
    roles: ["TEMPVS_ADMIN"],
  });
  api.overrideApproveSourceChangeset.mockImplementation(async () => {
    api.getSourceChangeset.mockResolvedValue({
      ok: true,
      data: {
        source,
        changeset: {
          ...approved,
          approvals: [
            {
              userId: "author",
              revision: 1,
              adminOverride: true,
              approvedAt: proposal.createdAt,
              comment: "Reviewed as administrator",
            },
          ],
        },
      },
    });
    return { ok: true };
  });
  mount();
  const override = await screen.findByRole("button", {
    name: "Admin override: approve proposal",
  });
  expect(override).toHaveClass("btn-warning");
  expect(
    screen.queryByRole("button", { name: "Approve" }),
  ).not.toBeInTheDocument();
  fireEvent.click(override);
  expect(
    screen.getByRole("button", { name: "Confirm admin override" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Reason for admin override"), {
    target: { value: "Reviewed as administrator" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm admin override" }),
  );
  await screen.findByRole("button", { name: "Publish" });
  expect(api.overrideApproveSourceChangeset).toHaveBeenCalledWith(
    "source-1",
    "proposal-1",
    1,
    "Reviewed as administrator",
  );
  expect(api.publishSourceChangeset).not.toHaveBeenCalled();
  expect(screen.getByText(/Approved by admin override by/)).toBeInTheDocument();
});

test("an admin resolving another reviewer's task uses the yellow override action and records a reason", async () => {
  const task = {
    id: "task-1",
    text: "Verify reference",
    blocking: true,
    status: "OPEN",
    createdBy: "reviewer",
    createdAt: proposal.createdAt,
  };
  api.getLibraryViewer.mockResolvedValue({
    userId: "author",
    roles: ["LIBRARY_ADMIN"],
  });
  api.getSourceChangeset.mockResolvedValue({
    ok: true,
    data: { source, changeset: { ...proposal, tasks: [task] } },
  });
  api.updateSourceProposalTask.mockImplementation(async () => {
    api.getSourceChangeset.mockResolvedValue({
      ok: true,
      data: {
        source,
        changeset: {
          ...proposal,
          version: 2,
          tasks: [
            {
              ...task,
              status: "RESOLVED",
              resolvedBy: "author",
              resolutionOverrideReason: "I verified the source",
            },
          ],
        },
      },
    });
    return { ok: true };
  });
  mount();
  const override = await screen.findByRole("button", {
    name: "Admin override: resolve task",
  });
  expect(override).toHaveClass("btn-warning");
  expect(
    screen.queryByRole("button", { name: "Resolve task" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Admin override: approve proposal" }),
  ).toBeDisabled();
  fireEvent.click(override);
  expect(
    screen.getByRole("button", { name: "Confirm admin override" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Reason for admin override"), {
    target: { value: "I verified the source" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm admin override" }),
  );
  await screen.findByText(/Admin override: I verified the source/);
  expect(api.updateSourceProposalTask).toHaveBeenCalledWith(
    "source-1",
    "proposal-1",
    "task-1",
    1,
    "RESOLVED",
    true,
    "I verified the source",
  );
  expect(
    screen.getByRole("button", { name: "Admin override: approve proposal" }),
  ).toBeEnabled();
});

test("admins use the regular resolve action for tasks they created themselves", async () => {
  api.getLibraryViewer.mockResolvedValue({
    userId: "reviewer",
    roles: ["LIBRARY_ADMIN"],
  });
  api.getSourceChangeset.mockResolvedValue({
    ok: true,
    data: {
      source,
      changeset: {
        ...proposal,
        tasks: [
          {
            id: "task-1",
            text: "Check date",
            blocking: true,
            status: "OPEN",
            createdBy: "reviewer",
            createdAt: proposal.createdAt,
          },
        ],
      },
    },
  });
  mount();
  expect(
    await screen.findByRole("button", { name: "Resolve task" }),
  ).toHaveClass("btn-outline-dark");
  expect(
    screen.queryByRole("button", { name: "Admin override: resolve task" }),
  ).not.toBeInTheDocument();
});

test.each(["LIBRARY_SCRIBE", "LIBRARY_ARCHIVARIUS"])(
  "%s cannot see task or publication overrides",
  async (role) => {
    api.getLibraryViewer.mockResolvedValue({
      userId: "other-member",
      roles: [role],
    });
    api.getSourceChangeset.mockResolvedValue({
      ok: true,
      data: {
        source,
        changeset: {
          ...approved,
          tasks: [
            {
              id: "task-1",
              text: "Check evidence",
              blocking: false,
              status: "OPEN",
              createdBy: "reviewer",
              createdAt: proposal.createdAt,
            },
          ],
        },
      },
    });
    mount();
    await screen.findByText("Check evidence");
    expect(
      screen.queryByRole("button", { name: /Admin override/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resolve task" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish" }),
    ).not.toBeInTheDocument();
  },
);

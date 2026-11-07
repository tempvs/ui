import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { MessageFormatter, Stash, StashItem } from "../profileTypes";
import { getGroupItemsPage, getProfileStash } from "../stashApi";
import ProfileItemsPanel from "./ProfileItemsPanel";

jest.mock("../stashApi", () => ({ getGroupItemsPage: jest.fn(), getProfileStash: jest.fn() }));
jest.mock("../../image/RefreshingImage", () => () => <img alt="" />);

const stashRead = getProfileStash as jest.MockedFunction<typeof getProfileStash>;
const itemRead = getGroupItemsPage as jest.MockedFunction<typeof getGroupItemsPage>;
const t: MessageFormatter = (_id, message, values) =>
  message.replace(/\{(\w+)\}/g, (_match, key) => String(values?.[key] ?? key));

function item(id: string, name: string): StashItem {
  return { id, name, itemGroup: { id: "collection" } };
}

function panel(editable = true, profileId = "club-profile", alias: string | null = "roman") {
  return <MemoryRouter><ProfileItemsPanel profileId={profileId} alias={alias} editable={editable} t={t} /></MemoryRouter>;
}

beforeEach(() => {
  jest.resetAllMocks();
  window.sessionStorage.clear();
});

test("paginates items across collections and filters beyond the current page", async () => {
  stashRead.mockResolvedValue({ groups: [{ id: "armor", name: "Armor" }, { id: "tools", name: "Tools" }] });
  itemRead.mockImplementation(async (groupId, token) => groupId === "armor"
    ? token ? { content: [item("helmet-9", "Helmet 9")] }
      : { content: Array.from({ length: 9 }, (_, index) => item(`helmet-${index}`, `Helmet ${index}`)), nextToken: "armor-2" }
    : { content: [item("hammer", "Bronze hammer")] });
  render(panel());

  expect(screen.getByRole("link", { name: "Items" })).toHaveAttribute("href", "/stash/roman");
  expect(await screen.findByText("Helmet 0")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(9);
  expect(screen.queryByText("Bronze hammer")).not.toBeInTheDocument();
  expect(itemRead).toHaveBeenCalledTimes(1);
  const viewport = document.querySelector('.thumbnail-list-viewport')!;
  Object.defineProperties(viewport, {
    clientHeight: { configurable: true, value: 192 },
    scrollHeight: { configurable: true, value: 576 },
    scrollTop: { configurable: true, value: 256, writable: true },
  });
  // The next cursor page starts loading while two rows remain below the viewport.
  fireEvent.scroll(viewport);
  expect(await screen.findByRole("link", { name: "Bronze hammer Tools" })).toHaveAttribute("href", "/stash/roman/items/hammer");
  expect(itemRead).toHaveBeenCalledWith("armor", "armor-2");
  expect(itemRead).toHaveBeenCalledWith("tools", undefined);

  fireEvent.change(screen.getByRole("searchbox", { name: "Filter items" }), { target: { value: "HELMET" } });
  expect(screen.getByText("Helmet 0")).toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Items pagination" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "tools" } });
  expect(screen.getByText("Bronze hammer")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "missing" } });
  expect(screen.getByText("No items match this filter.")).toBeInTheDocument();
  expect(screen.queryByText("Open Items to add your first item.")).not.toBeInTheDocument();
});

test("anchors the dismissible first-item hint to the Items heading for an empty owned stash", async () => {
  stashRead.mockResolvedValue({ groups: [{ id: "empty" }] });
  itemRead.mockResolvedValue({ content: [] });
  render(panel(true, "club-profile", null));

  expect(screen.queryByText("Open Items to add your first item.")).not.toBeInTheDocument();
  expect(await screen.findByText("No items yet.")).toBeInTheDocument();
  const link = screen.getByRole("link", { name: "Items" });
  expect(link).toHaveAttribute("href", "/stash/club-profile");
  expect(link.closest("h3")?.querySelector(".coachmark-anchor--visible")).toContainElement(link);
  expect(screen.getByText("Open Items to add your first item.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss hint" }));
  expect(screen.queryByText("Open Items to add your first item.")).not.toBeInTheDocument();
  expect(window.sessionStorage.getItem("tempvs:coachmark:open-owned-items:club-profile")).toBe("dismissed");
});

test("visitors can browse items without receiving owner hints", async () => {
  stashRead.mockResolvedValue({ groups: [{ id: "tools", name: "Tools" }] });
  itemRead.mockResolvedValue({ content: [item("hammer", "Hammer")] });
  const view = render(panel(false));
  expect(await screen.findByRole("link", { name: "Hammer Tools" })).toHaveAttribute("href", "/stash/roman/items/hammer");
  stashRead.mockResolvedValue({ groups: [] });
  view.rerender(panel(false, "another-profile", null));
  expect(await screen.findByText("No items yet.")).toBeInTheDocument();
  expect(screen.queryByText("Open Items to add your first item.")).not.toBeInTheDocument();
});

test("failed item reads do not claim the stash is empty and can be retried", async () => {
  stashRead.mockResolvedValue({ groups: [{ id: "tools" }] });
  itemRead.mockRejectedValueOnce(new Error("Unavailable"));
  render(panel());
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load items right now.");
  expect(screen.queryByText("No items yet.")).not.toBeInTheDocument();
  expect(screen.queryByText("Open Items to add your first item.")).not.toBeInTheDocument();
  itemRead.mockResolvedValue({ content: [item("hammer", "Hammer")] });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Hammer")).toBeInTheDocument();
});

test("ignores a previous profile's response after navigating to another profile", async () => {
  let resolveOld: (stash: Stash) => void = () => {};
  stashRead.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const view = render(panel());
  stashRead.mockResolvedValue({ groups: [{ id: "new" }] });
  itemRead.mockResolvedValue({ content: [item("new-item", "New item")] });
  view.rerender(panel(true, "new-profile", null));
  expect(await screen.findByText("New item")).toBeInTheDocument();
  resolveOld({ groups: [{ id: "old" }] });
  await waitFor(() => expect(itemRead).toHaveBeenCalledTimes(1));
  expect(itemRead).not.toHaveBeenCalledWith("old");
  expect(screen.getByText("New item")).toBeInTheDocument();
});

import { fireEvent, render, screen } from "@testing-library/react";

import OnDemandPanel from "./OnDemandPanel";

const originalMatchMedia = window.matchMedia;

function viewport(mobile: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: mobile }),
  });
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});

test("mobile sections start collapsed and preserve edits when closed and reopened", () => {
  viewport(true);
  const onOpen = jest.fn();
  render(
    <OnDemandPanel title="Items" collapseOnMobile onOpen={onOpen}>
      <input aria-label="Filter items" />
    </OnDemandPanel>,
  );

  const toggle = screen.getByRole("button", { name: "Items" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(onOpen).not.toHaveBeenCalled();

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Helmet" } });

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

  fireEvent.click(toggle);
  expect(screen.getByRole("textbox")).toHaveValue("Helmet");
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test("desktop sections show their content immediately", () => {
  viewport(false);
  const onOpen = jest.fn();
  render(
    <OnDemandPanel title="Items" collapseOnMobile onOpen={onOpen}>
      <input aria-label="Filter items" />
    </OnDemandPanel>,
  );

  expect(screen.getByRole("textbox")).toBeVisible();
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test("a direct handoff opens a collapsed mobile section", () => {
  viewport(true);
  const view = render(
    <OnDemandPanel title="Posts" collapseOnMobile>
      <textarea aria-label="Post draft" />
    </OnDemandPanel>,
  );
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

  view.rerender(
    <OnDemandPanel title="Posts" collapseOnMobile forceOpen>
      <textarea aria-label="Post draft" />
    </OnDemandPanel>,
  );
  expect(screen.getByRole("textbox")).toBeVisible();
  expect(screen.getByRole("button", { name: "Posts" })).toHaveAttribute("aria-expanded", "true");
});

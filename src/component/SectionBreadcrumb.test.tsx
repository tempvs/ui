import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import SectionBreadcrumb from "./SectionBreadcrumb";

test("anchors a switcher menu to its caret on the first open", () => {
  render(
    <MemoryRouter>
      <SectionBreadcrumb
        items={[
          {
            label: "Collection",
            switcher: {
              id: "collection-switcher",
              items: [
                { key: "one", label: "First collection", to: "/stash/one" },
              ],
            },
          },
        ]}
      />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole("button"));

  const menu = screen.getByRole("menu");
  expect(menu).toHaveClass("dropdown-menu", "dropdown-menu-end", "show");
  expect(menu).not.toHaveAttribute("x-placement");
  expect(menu).not.toHaveStyle({ position: "fixed" });
  expect(screen.getByRole("link", { name: "First collection" })).toBeVisible();
});

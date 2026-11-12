import React from "react";
import { render, screen } from "@testing-library/react";
import OnboardingProgress, { onboardingProgress } from "./OnboardingProgress";

test.each([[2, 4, 50], [1, 3, 33], [5, 8, 63], [7, 8, 88], [8, 9, 89], [9, 10, 90], [999, 1000, 99], [4, 4, 100], [-1, 4, 0], [9, 4, 100]])(
  "%i of %i gives %i percent without rounding incomplete work to 100", (completed, total, percentage) => {
    expect(onboardingProgress(completed, total)?.percentage).toBe(percentage);
  },
);
test("invalid totals have no percentage and non-finite completion is safe", () => {
  for (const total of [0, -1, NaN, Infinity, 0.5]) expect(onboardingProgress(1, total)).toBeNull();
  expect(onboardingProgress(NaN, 4)?.percentage).toBe(0);
  expect(onboardingProgress(Infinity, 4)?.percentage).toBe(0);
});
test("expanded and compact progress share accessible values and announce changes only", () => {
  const view = render(<OnboardingProgress completed={5} total={8} label="Library guide" countLabel="topics learned" />);
  expect(screen.getByRole("progressbar", { name: "Library guide" })).toHaveAttribute("aria-valuenow", "63");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "5 of 8 topics learned, 63 percent");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  view.rerender(<OnboardingProgress completed={7} total={8} label="Library guide" countLabel="topics learned" compact />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "88");
  expect(screen.getByRole("status")).toHaveTextContent("Library guide: 88% complete");
});
test.each(["loading", "unavailable"] as const)("%s never displays a misleading zero percent", (status) => {
  render(<OnboardingProgress completed={0} total={4} label="Profile setup" countLabel="foundations complete" status={status} />);
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(screen.queryByText("0% complete")).not.toBeInTheDocument();
  expect(screen.getAllByRole("status")[0]).toHaveTextContent(status === "loading" ? "Loading Profile setup" : "unavailable");
});

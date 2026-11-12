import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import PeriodMultiSelect from "../component/PeriodMultiSelect";
import messages from "../translations/en.json";
import PeriodTile from "./PeriodTile";

test("Interwar renders in the Library and the shared picker submits its API value", () => {
  const onChange = jest.fn();
  render(
    <IntlProvider locale="en" messages={messages}>
      <PeriodTile period="interwar" />
      <PeriodMultiSelect selected={[]} onChange={onChange} display="checkboxes" />
    </IntlProvider>,
  );
  expect(screen.getByRole("heading", { name: "Interwar (1918–1939)" })).toBeInTheDocument();
  expect(screen.getByText(/years between World War I and World War II/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Interwar (1918–1939)" }));
  expect(onChange).toHaveBeenCalledWith(["INTERWAR"]);
});

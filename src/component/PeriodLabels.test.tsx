import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { createIntl, IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import messages from "../translations/en.json";
import { getPeriodLabel, getPeriodOptionLabel } from "../util/periods";
import LibraryPeriodBreadcrumb from "../library/components/LibraryPeriodBreadcrumb";
import EditablePeriodSelectorField from "./EditablePeriodSelectorField";
import EditableSelectFieldRow from "./EditableSelectFieldRow";
import PeriodMultiSelect from "./PeriodMultiSelect";

test("breadcrumb navigation and its switcher use plain period names", () => {
  render(
    <IntlProvider locale="en" messages={messages}>
      <MemoryRouter>
        <LibraryPeriodBreadcrumb period="INTERWAR" />
      </MemoryRouter>
    </IntlProvider>,
  );
  expect(screen.getByRole("link", { name: "Interwar" })).toHaveAttribute("href", "/library/period/interwar");
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("link", { name: "Early modern" })).toBeInTheDocument();
  expect(screen.queryByText(/1500|1918|1939/)).not.toBeInTheDocument();
});

test("search filter options and the selected filter omit ranges", () => {
  const onChange = jest.fn();
  render(
    <IntlProvider locale="en" messages={messages}>
      <PeriodMultiSelect selected={["MODERN"]} onChange={onChange} />
    </IntlProvider>,
  );
  const toggle = screen.getByRole("button", { name: "Periods" });
  expect(toggle).toHaveTextContent("Modern / pre-WWI");
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole("checkbox", { name: "Interwar" }));
  expect(onChange).toHaveBeenCalledWith(["MODERN", "INTERWAR"]);
  expect(screen.queryByText(/1700|1914|1918|1939/)).not.toBeInTheDocument();
});

test("creation dropdowns include date guidance but their summary shows the period name", () => {
  render(
    <IntlProvider locale="en" messages={messages}>
      <PeriodMultiSelect includeRanges selected={["INTERWAR"]} onChange={jest.fn()} />
    </IntlProvider>,
  );
  const toggle = screen.getByRole("button", { name: "Periods" });
  expect(toggle).toHaveTextContent(/^Interwar$/);
  fireEvent.click(toggle);
  expect(screen.getByRole("checkbox", { name: "Interwar (1918–1939)" })).toBeChecked();
});

test("an owner's inline select shows ranges only while editing", () => {
  const intl = createIntl({ locale: "en", messages });
  const onChange = jest.fn();
  const onBlur = jest.fn();
  render(
    <EditableSelectFieldRow
      label="Period"
      editable
      value="INTERWAR"
      options={["WWI", "INTERWAR"].map(period => ({
        value: period,
        label: getPeriodOptionLabel(intl, period),
        readOnlyLabel: getPeriodLabel(intl, period),
      }))}
      onChange={onChange}
      onBlur={onBlur}
    />,
  );
  const select = screen.getByRole("combobox") as HTMLSelectElement;
  expect(select.selectedOptions[0]).toHaveTextContent(/^Interwar$/);
  fireEvent.click(select.closest(".inline-editable-control")!);
  expect(select).toBeEnabled();
  expect(screen.getByRole("option", { name: "Interwar (1918–1939)" })).toBeInTheDocument();
  fireEvent.change(select, { target: { value: "WWI" } });
  expect(onChange).toHaveBeenCalledTimes(1);
  fireEvent.blur(select);
  expect(onBlur).toHaveBeenCalledTimes(1);
  expect(select).toBeDisabled();
  expect(screen.queryByText(/1914|1918|1939/)).not.toBeInTheDocument();
});

test("event period choices include ranges while saved values use plain names", () => {
  render(
    <IntlProvider locale="en" messages={messages}>
      <EditablePeriodSelectorField label="Periods" editable value={["INTERWAR"]} onChange={jest.fn()} onBlur={jest.fn()} />
    </IntlProvider>,
  );
  fireEvent.click(screen.getByText("Interwar"));
  expect(screen.getByRole("button", { name: /Interwar \(1918–1939\)/ })).toBeInTheDocument();
  fireEvent.blur(screen.getByRole("button", { name: /Interwar \(1918–1939\)/ }), { relatedTarget: document.body });
  expect(screen.getByText("Interwar")).toBeInTheDocument();
  expect(screen.queryByText(/1918|1939/)).not.toBeInTheDocument();
});

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { ClassificationFacet } from "./ClassificationFacet";

test("a broad classification selects its collapsed descendants", () => {
  let selected: string[] = [];
  render(
    <IntlProvider locale="en" messages={{}}>
      <ClassificationFacet
        idPrefix="test"
        selected={selected}
        onChange={(next) => {
          selected = next;
        }}
      />
    </IntlProvider>,
  );

  fireEvent.click(screen.getByLabelText("Clothing"));
  expect(selected).toEqual(["CLOTHING", "FOOTWEAR"]);
  expect(screen.queryByLabelText("Footwear")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Expand Clothing" }));
  expect(screen.getByLabelText("Footwear")).toBeInTheDocument();
});

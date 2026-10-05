import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";

import EventFieldsPanel from "./EventFieldsPanel";
import { TempvsEvent } from "./eventApi";

const event: TempvsEvent = {
  id: "event-1",
  ownerProfileId: "profile-1",
  adminProfileIds: [],
  name: "Lantern Festival",
  description: "An evening gathering.",
  periods: ["MODERN"],
  schedule: {
    kind: "ONE_TIME" as const,
    startsAt: "2026-10-03T18:00:00.000Z",
    endsAt: "2026-10-03T21:00:00.000Z",
    timeZone: "UTC",
  },
  image: null,
  isActive: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  version: 1,
};

test("uses shared inline inputs for editable event metadata", () => {
  const onChange = jest.fn();
  const onBlur = jest.fn();
  render(
    <IntlProvider locale="en" messages={{}}>
      <EventFieldsPanel
        event={event}
        editable
        statuses={{}}
        onChange={onChange}
        onBlur={onBlur}
      />
    </IntlProvider>,
  );

  const name = screen.getByDisplayValue("Lantern Festival");
  expect(name).toHaveAttribute("readonly");
  fireEvent.click(name);
  expect(name).not.toHaveAttribute("readonly");
  fireEvent.change(name, { target: { value: "Moonlit Festival" } });
  fireEvent.blur(name);

  expect(onChange).toHaveBeenCalledWith("name", "Moonlit Festival");
  expect(onBlur).toHaveBeenCalledWith("name");
});

test("keeps the event description visible when entering edit mode", () => {
  render(
    <IntlProvider locale="en" messages={{}}>
      <EventFieldsPanel
        event={event}
        editable
        statuses={{}}
        onChange={jest.fn()}
        onBlur={jest.fn()}
      />
    </IntlProvider>,
  );

  const description = screen.getByDisplayValue("An evening gathering.");
  expect(description).toHaveAttribute("readonly");
  fireEvent.click(description);
  expect(description).not.toHaveAttribute("readonly");
  expect(description).toHaveValue("An evening gathering.");
});

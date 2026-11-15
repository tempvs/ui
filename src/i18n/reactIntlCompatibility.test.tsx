import React from "react";
import { render, screen } from "@testing-library/react";
import { FormattedMessage, IntlProvider } from "react-intl";

test("React 19 renders Intl rich text and plural arguments without formatter errors", () => {
  const onError = jest.fn();
  render(
    <IntlProvider locale="en" onError={onError} messages={{
      welcome: "Hello <strong>{name}</strong>",
      items: "{count, plural, one {# item} other {# items}}",
    }}>
      <p><FormattedMessage id="welcome" values={{
        name: "Ada", strong: (chunks) => <strong>{chunks}</strong>,
      }} /></p>
      <p><FormattedMessage id="items" values={{ count: 2 }} /></p>
    </IntlProvider>,
  );
  expect(screen.getByText("Ada").tagName).toBe("STRONG");
  expect(screen.getByText("2 items")).toBeInTheDocument();
  expect(onError).not.toHaveBeenCalled();
});

test("an untranslated message retains the application's default text", () => {
  const onError = jest.fn();
  render(
    <IntlProvider locale="en" messages={{}} onError={onError}>
      <FormattedMessage id="fixture.missing" defaultMessage="{count} available" values={{ count: 3 }} />
    </IntlProvider>,
  );
  expect(screen.getByText("3 available")).toBeInTheDocument();
});

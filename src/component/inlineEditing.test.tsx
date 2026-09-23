import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import EditableTextFieldRow from './EditableTextFieldRow';
import InlineEditableText from './InlineEditableText';

test('field rows leave edit mode as soon as their control loses focus', () => {
  const onBlur = jest.fn();
  render(
    <EditableTextFieldRow
      label="Name"
      editable
      value="Ada"
      readOnlyValue="Ada"
      onBlur={onBlur}
    />,
  );

  const input = screen.getByRole('textbox');
  expect(input).toHaveAttribute('readonly');
  fireEvent.click(input);
  expect(input).not.toHaveAttribute('readonly');
  fireEvent.blur(input);
  expect(onBlur).toHaveBeenCalledTimes(1);
  expect(input).toHaveAttribute('readonly');
});

test('inline text leaves edit mode immediately on blur while its save continues', () => {
  const onBlur = jest.fn();
  render(
    <InlineEditableText
      editable
      value="Source title"
      readOnlyValue="Source title"
      onBlur={onBlur}
      status="saving"
    />,
  );

  const input = screen.getByRole('textbox');
  expect(input).toHaveAttribute('readonly');
  fireEvent.click(input);
  expect(input).not.toHaveAttribute('readonly');
  fireEvent.blur(input);
  expect(onBlur).toHaveBeenCalledTimes(1);
  expect(input).toHaveAttribute('readonly');
});

test('opening a second field closes the first field', async () => {
  const user = userEvent.setup();
  render(
    <>
      <EditableTextFieldRow label="First" editable value="Ada" readOnlyValue="Ada" />
      <EditableTextFieldRow label="Second" editable value="Lovelace" readOnlyValue="Lovelace" />
    </>,
  );

  const [first, second] = screen.getAllByRole('textbox');
  await user.click(first);
  expect(first).not.toHaveAttribute('readonly');
  await user.click(second);
  expect(first).toHaveAttribute('readonly');
  expect(second).not.toHaveAttribute('readonly');
});

test('clicking non-focusable page chrome saves and closes the active field', async () => {
  const user = userEvent.setup();
  const onBlur = jest.fn();
  render(
    <>
      <EditableTextFieldRow label="Name" editable value="Ada" readOnlyValue="Ada" onBlur={onBlur} />
      <div data-testid="page-chrome">Page chrome</div>
    </>,
  );

  const input = screen.getByRole('textbox');
  await user.click(input);
  expect(input).not.toHaveAttribute('readonly');
  await user.click(screen.getByTestId('page-chrome'));
  expect(onBlur).toHaveBeenCalledTimes(1);
  expect(input).toHaveAttribute('readonly');
});

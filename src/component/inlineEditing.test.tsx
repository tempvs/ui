import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

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

import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders an app', () => {
  render(<App />);
  expect(document.querySelector("a").getAttribute("href")).toBe("/library");
});

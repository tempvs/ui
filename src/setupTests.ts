// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// MapLibre creates a worker blob while its module is evaluated. JSDOM does not
// implement this browser API, even though no map is mounted in most UI tests.
if (!window.URL.createObjectURL) {
  Object.defineProperty(window.URL, "createObjectURL", {
    configurable: true,
    value: () => "blob:test-map-worker",
  });
}

if (!window.URL.revokeObjectURL) {
  Object.defineProperty(window.URL, "revokeObjectURL", {
    configurable: true,
    value: () => undefined,
  });
}

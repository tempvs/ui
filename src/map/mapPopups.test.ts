import type { Map as MapLibreMap, Popup } from "maplibre-gl";
import { closeMapPopup, showMapPopup } from "./mapPopups";

function popupFixture() {
  let closed: (() => void) | undefined;
  const popup = {
    addTo: jest.fn(),
    once: jest.fn((_event: string, callback: () => void) => { closed = callback; }),
    remove: jest.fn(() => closed?.()),
  };
  return { ...popup, value: popup as unknown as Popup };
}

test("opening another popup closes the previous card only on the same map", () => {
  const map = {} as MapLibreMap;
  const otherMap = {} as MapLibreMap;
  const first = popupFixture();
  const second = popupFixture();
  const independent = popupFixture();
  showMapPopup(map, first.value);
  showMapPopup(otherMap, independent.value);
  showMapPopup(map, second.value);
  expect(first.remove).toHaveBeenCalledTimes(1);
  expect(second.remove).not.toHaveBeenCalled();
  expect(independent.remove).not.toHaveBeenCalled();
  closeMapPopup(map);
  expect(second.remove).toHaveBeenCalledTimes(1);
  expect(independent.remove).not.toHaveBeenCalled();
  closeMapPopup(otherMap);
});

test("a previous card's delayed close cannot unregister the current card", () => {
  const map = {} as MapLibreMap;
  const first = popupFixture();
  const second = popupFixture();
  showMapPopup(map, first.value);
  showMapPopup(map, second.value);
  first.remove();
  closeMapPopup(map);
  closeMapPopup(map);
  expect(second.remove).toHaveBeenCalledTimes(1);
});

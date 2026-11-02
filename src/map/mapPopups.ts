import type { Map, Popup } from "maplibre-gl";

// Weak keys avoid retaining a closed map. All marker types on the same map
// participate, while separate maps never dismiss each other's cards.
const activePopups = new WeakMap<Map, Popup>();

export function showMapPopup(map: Map, popup: Popup): void {
  const previous = activePopups.get(map);
  if (previous === popup) return;
  previous?.remove();
  activePopups.set(map, popup);
  popup.once("close", () => {
    if (activePopups.get(map) === popup) activePopups.delete(map);
  });
  popup.addTo(map);
}

export function closeMapPopup(map: Map): void {
  const popup = activePopups.get(map);
  activePopups.delete(map);
  popup?.remove();
}

import { Suspense, lazy } from "react";

import type { MapCanvasProps } from "./MapCanvas";

// MapLibre is large and only needed after a user opens a map. Keeping the
// import behind a Suspense boundary leaves entity/profile pages lightweight.
const MapCanvas = lazy(() => import("./MapCanvas"));

export default function LazyMapCanvas(props: MapCanvasProps) {
  return (
    <Suspense
      fallback={
        <div className="map-canvas map-canvas-loading" role="status">
          Loading map…
        </div>
      }
    >
      <MapCanvas {...props} />
    </Suspense>
  );
}

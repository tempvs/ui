import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// Keep renderer and matching, content-hashed worker behind the map's lazy
// import. Vite bundles the worker into a self-contained same-origin asset.
setWorkerUrl(workerUrl);

export * as maplibregl from "maplibre-gl";

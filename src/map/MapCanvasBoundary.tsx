import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onRetry: () => void;
};

/** A failed WebGL initialization must never unmount the application shell. */
export default class MapCanvasBoundary extends Component<
  Props,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("Interactive map failed", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="map-canvas-shell map-canvas-fallback" role="alert">
          <p>
            The interactive map could not be displayed. You can still use the
            rest of the page.
          </p>
          <button
            type="button"
            className="btn btn-outline-dark btn-sm"
            onClick={this.props.onRetry}
          >
            Retry map
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

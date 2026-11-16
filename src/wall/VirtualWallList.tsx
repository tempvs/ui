import {
  useWindowVirtualizer,
  defaultRangeExtractor,
} from "@tanstack/react-virtual";
import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { WallActivity } from "./wallApi";

export default function VirtualWallList({
  activities,
  hasMore,
  renderActivity,
}: {
  activities: WallActivity[];
  hasMore: boolean;
  renderActivity: (activity: WallActivity) => React.ReactNode;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [focusedId, setFocusedId] = useState<string>();
  const [showAll, setShowAll] = useState(false);
  const focusedIndex = useMemo(
    () => activities.findIndex((activity) => activity.id === focusedId),
    [activities, focusedId],
  );
  const getItemKey = useCallback(
    (index: number) => activities[index].id,
    [activities],
  );
  const virtualizer = useWindowVirtualizer({
    count: activities.length,
    estimateSize: () => 160,
    overscan: 5,
    gap: 14,
    scrollMargin,
    getItemKey,
    enabled: !showAll,
    // Keep the active card and its keyboard neighbours mounted, including
    // while an attachment dialog is open outside the list's DOM subtree.
    rangeExtractor: (range) =>
      Array.from(
        new Set([
          ...defaultRangeExtractor(range),
          ...[focusedIndex - 1, focusedIndex, focusedIndex + 1].filter(
            (index) =>
              focusedIndex >= 0 && index >= 0 && index < activities.length,
          ),
        ]),
      ).sort((a, b) => a - b),
  });

  useLayoutEffect(() => {
    const update = () => {
      if (element.current)
        setScrollMargin(
          element.current.getBoundingClientRect().top + window.scrollY,
        );
    };
    update();
    window.addEventListener("resize", update);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    if (element.current) observer?.observe(element.current);
    observer?.observe(document.body);
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (showAll) element.current?.focus();
  }, [showAll]);

  const rememberInteraction = (target: EventTarget) => {
    if (!(target instanceof Element)) return;
    const index = Number(
      target.closest<HTMLElement>("[data-wall-index]")?.dataset.wallIndex,
    );
    if (Number.isInteger(index) && activities[index])
      setFocusedId(activities[index].id);
  };
  const rows = showAll
    ? activities.map((activity, index) => ({
        key: activity.id,
        index,
        start: 0,
      }))
    : virtualizer.getVirtualItems();

  return (
    <>
      {!showAll && (
        <button
          type="button"
          className="visually-hidden-focusable"
          onClick={() => setShowAll(true)}
        >
          Show all loaded updates
        </button>
      )}
      <div
        ref={element}
        role="list"
        aria-label="Recent updates"
        tabIndex={-1}
        className={showAll ? "wall-list" : "wall-virtual-list"}
        style={
          showAll
            ? undefined
            : {
                height: virtualizer.getTotalSize(),
                position: "relative",
                overflowAnchor: "none",
              }
        }
        onFocusCapture={(event) => rememberInteraction(event.target)}
        onPointerDownCapture={(event) => rememberInteraction(event.target)}
      >
        {rows.map((row) => (
          <div
            key={row.key}
            ref={showAll ? undefined : virtualizer.measureElement}
            data-index={row.index}
            data-wall-index={row.index}
            role="listitem"
            aria-posinset={row.index + 1}
            aria-setsize={hasMore ? -1 : activities.length}
            style={
              showAll
                ? undefined
                : {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${row.start - scrollMargin}px)`,
                  }
            }
          >
            {renderActivity(activities[row.index])}
          </div>
        ))}
      </div>
    </>
  );
}

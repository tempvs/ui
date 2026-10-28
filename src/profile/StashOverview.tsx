import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { FaArrowLeft, FaPlus, FaTimes } from "react-icons/fa";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

import DefaultHourglassImage from "../component/DefaultHourglassImage";
import ConfirmationModal from "../component/ConfirmationModal";
import DismissibleCoachmark from "../component/DismissibleCoachmark";
import EditableDescriptionField from "../component/EditableDescriptionField";
import InlineEditableText from "../component/InlineEditableText";
import ImmediateImageUploadModal from "../component/ImmediateImageUploadModal";
import MultiImageFilePicker from "../component/MultiImageFilePicker";
import Spinner from "../component/Spinner";
import StackedImageGallery from "../component/StackedImageGallery";
import TextFilterInput from "../component/TextFilterInput";
import TemporalFitBadge from "./TemporalFitBadge";
import { compareAppText } from "../i18n/appLocale";
import { getClassificationLabel } from "../library/libraryShared";
import { ClassificationSelect } from "../library/components/ClassificationSelect";
import { SaveStatus } from "../component/EditableFieldRow";
import { clearAllTimers, clearTimer } from "../util/timers";
import { prepareImageFile } from "../util/fileUtils";
import RefreshingImage from "../image/RefreshingImage";
import {
  createStashGroup,
  createStashItem,
  createStashItemMarker,
  deleteStashGroup,
  deleteStashGroupImage,
  deleteStashItemMarker,
  getGroupItems,
  getProfileStash,
  getStashEntityImages,
  getStashItemMarkers,
  updateStashGroupDescription,
  updateStashGroupName,
  updateStashGroupImageDescription,
  updateStashItemMarker,
  uploadStashItemImage,
  uploadStashGroupImage,
} from "./stashApi";
import {
  EntityImage,
  Id,
  Stash,
  StashGroup,
  StashItem,
  StashItemMarker,
  StashPanelProps,
} from "./profileTypes";

const emptyGroupForm = { name: "", description: "" };
const emptyItemForm = { name: "", description: "", classification: "OTHER" };
const ArrowLeftIcon = FaArrowLeft as React.ComponentType<{
  className?: string;
}>;
const CloseIcon = FaTimes as React.ComponentType<{ className?: string }>;
const PlusIcon = FaPlus as React.ComponentType<{ className?: string }>;

type IdRecord<T> = Record<string, T>;

type MarkerPlacementState = {
  itemId: Id;
  markerId?: Id | null;
} | null;

type MarkerPreviewPosition = {
  x: number;
  y: number;
} | null;

type ArrowLayout = {
  itemId: Id;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/** The image is shorter than its shell when its description is visible. Markers
 * are stored relative to the image, so their overlay must use these bounds
 * instead of the taller shell. */
type ImageOverlayBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function toRecordKey(value: Id) {
  return String(value);
}

function idsEqual(left: Id | null | undefined, right: Id | null | undefined) {
  if (left == null || right == null) {
    return false;
  }

  return String(left) === String(right);
}

function truncateDescription(value: string, limit = 30) {
  const characters = Array.from(value);
  return characters.length > limit
    ? `${characters.slice(0, limit).join("")}...`
    : value;
}

function buildFirstImageMap(images: EntityImage[]) {
  return images.reduce<IdRecord<EntityImage>>((accumulator, image) => {
    const entityId = image.entityId || "";
    if (!entityId || accumulator[entityId]) {
      return accumulator;
    }

    return {
      ...accumulator,
      [entityId]: image,
    };
  }, {});
}

function buildImagesCountMap(images: EntityImage[]) {
  return images.reduce<IdRecord<number>>((accumulator, image) => {
    const entityId = image.entityId || "";
    if (!entityId) {
      return accumulator;
    }

    return {
      ...accumulator,
      [entityId]: (accumulator[entityId] || 0) + 1,
    };
  }, {});
}

function getImageSrc(image?: EntityImage | null) {
  if (!image) {
    return null;
  }

  return image.thumbnailUrl || image.url || null;
}

function temporalSummary(items: StashItem[], t: StashPanelProps["t"]) {
  const counts = items.reduce<Record<string, number>>((result, item) => {
    const status = item.temporalFit?.status || "UNAVAILABLE";
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});
  const parts = [
    counts.STRONG
      ? `${counts.STRONG} ${t("profile.stash.temporal.strongShort", "strong")}`
      : null,
    counts.GOOD
      ? `${counts.GOOD} ${t("profile.stash.temporal.goodShort", "good")}`
      : null,
    counts.PARTIAL || counts.DISTANT
      ? `${(counts.PARTIAL || 0) + (counts.DISTANT || 0)} ${t("profile.stash.temporal.reviewShort", "to review")}`
      : null,
    counts.NO_SOURCES
      ? `${counts.NO_SOURCES} ${t("profile.stash.temporal.needsSourcesShort", "need sources")}`
      : null,
    counts.SOURCES_UNDATED
      ? `${counts.SOURCES_UNDATED} ${t("profile.stash.temporal.undatedShort", "need dates")}`
      : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function sortItemsByMarker(
  items: StashItem[],
  markersByItemId: IdRecord<StashItemMarker>,
) {
  return [...items].sort((left, right) => {
    const leftMarker = markersByItemId[toRecordKey(left.id)];
    const rightMarker = markersByItemId[toRecordKey(right.id)];

    if (leftMarker && rightMarker) {
      if (leftMarker.y !== rightMarker.y) {
        return leftMarker.y - rightMarker.y;
      }

      if (leftMarker.x !== rightMarker.x) {
        return leftMarker.x - rightMarker.x;
      }
    }

    if (leftMarker) {
      return -1;
    }

    if (rightMarker) {
      return 1;
    }

    return compareAppText(
      String(left.name || left.id),
      String(right.name || right.id),
    );
  });
}

type MarkerPoint = {
  itemId: Id;
  x: number;
  y: number;
};

type SlotPoint = {
  x: number;
  y: number;
};

function getOrientation(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) {
  const epsilon = 0.0001;
  const first = getOrientation(ax, ay, bx, by, cx, cy);
  const second = getOrientation(ax, ay, bx, by, dx, dy);
  const third = getOrientation(cx, cy, dx, dy, ax, ay);
  const fourth = getOrientation(cx, cy, dx, dy, bx, by);

  if (
    Math.abs(first) < epsilon ||
    Math.abs(second) < epsilon ||
    Math.abs(third) < epsilon ||
    Math.abs(fourth) < epsilon
  ) {
    return false;
  }

  const firstPositive = first > 0;
  const secondPositive = second > 0;
  const thirdPositive = third > 0;
  const fourthPositive = fourth > 0;
  return firstPositive !== secondPositive && thirdPositive !== fourthPositive;
}

function countLineIntersections(
  orderedItemIds: Id[],
  markerPoints: IdRecord<MarkerPoint>,
  slotPoints: SlotPoint[],
) {
  let intersections = 0;

  for (let leftIndex = 0; leftIndex < orderedItemIds.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < orderedItemIds.length;
      rightIndex += 1
    ) {
      const leftMarker = markerPoints[toRecordKey(orderedItemIds[leftIndex])];
      const rightMarker = markerPoints[toRecordKey(orderedItemIds[rightIndex])];
      const leftSlot = slotPoints[leftIndex];
      const rightSlot = slotPoints[rightIndex];

      if (!leftMarker || !rightMarker || !leftSlot || !rightSlot) {
        continue;
      }

      if (
        segmentsIntersect(
          leftMarker.x,
          leftMarker.y,
          leftSlot.x,
          leftSlot.y,
          rightMarker.x,
          rightMarker.y,
          rightSlot.x,
          rightSlot.y,
        )
      ) {
        intersections += 1;
      }
    }
  }

  return intersections;
}

function optimizeMarkedItemOrder(
  orderedItemIds: Id[],
  markerPoints: IdRecord<MarkerPoint>,
  slotPoints: SlotPoint[],
) {
  let bestOrder = [...orderedItemIds];
  let bestScore = countLineIntersections(bestOrder, markerPoints, slotPoints);
  let improved = true;

  while (improved) {
    improved = false;

    for (let fromIndex = 0; fromIndex < bestOrder.length; fromIndex += 1) {
      for (let toIndex = 0; toIndex < bestOrder.length; toIndex += 1) {
        if (fromIndex === toIndex) {
          continue;
        }

        const candidate = [...bestOrder];
        const [movedItemId] = candidate.splice(fromIndex, 1);
        candidate.splice(toIndex, 0, movedItemId);
        const candidateScore = countLineIntersections(
          candidate,
          markerPoints,
          slotPoints,
        );

        if (candidateScore < bestScore) {
          bestOrder = candidate;
          bestScore = candidateScore;
          improved = true;
          break;
        }
      }

      if (improved) {
        break;
      }
    }
  }

  return bestOrder;
}

function scheduleArrowRefresh(callback: () => void) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(callback);
  });
}

export default function StashOverview({
  profile,
  isEditable,
  t,
  getPeriodLabel,
  embedded = true,
  initialGroupId = null,
  onActiveGroupChange,
  onGroupsChange,
}: StashPanelProps) {
  const intl = useIntl();
  const navigate = useNavigate();
  const [stash, setStash] = useState<Stash | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<Id | null>(null);
  // Holds a direct tab choice until the matching URL update reaches us.
  const [activeGroupOverrideId, setActiveGroupOverrideId] = useState<Id | null>(
    null,
  );
  const [itemsByGroup, setItemsByGroup] = useState<IdRecord<StashItem[]>>({});
  const [groupImages, setGroupImages] = useState<IdRecord<EntityImage>>({});
  const [itemImages, setItemImages] = useState<IdRecord<EntityImage>>({});
  const [itemImageCounts, setItemImageCounts] = useState<IdRecord<number>>({});
  const [markersByGroup, setMarkersByGroup] = useState<
    IdRecord<StashItemMarker[]>
  >({});
  const [itemOrderByGroup, setItemOrderByGroup] = useState<IdRecord<Id[]>>({});
  const [groupCreateVisible, setGroupCreateVisible] = useState(false);
  const [groupCreateSubmitting, setGroupCreateSubmitting] = useState(false);
  const [groupCreateImages, setGroupCreateImages] = useState<File[]>([]);
  const [groupDeleteTarget, setGroupDeleteTarget] = useState<StashGroup | null>(
    null,
  );
  const [groupDeleteSubmitting, setGroupDeleteSubmitting] = useState(false);
  const [itemCreateTarget, setItemCreateTarget] = useState<StashGroup | null>(
    null,
  );
  const [itemCreateSubmitting, setItemCreateSubmitting] = useState(false);
  const [itemCreateImages, setItemCreateImages] = useState<File[]>([]);
  const [itemFilter, setItemFilter] = useState("");
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [groupImageTarget, setGroupImageTarget] = useState<StashGroup | null>(
    null,
  );
  const [groupImageUploading, setGroupImageUploading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [groupDescriptionDraft, setGroupDescriptionDraft] = useState("");
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupDescriptionStatus, setGroupDescriptionStatus] =
    useState<SaveStatus>(null);
  const [groupNameStatus, setGroupNameStatus] = useState<SaveStatus>(null);
  const [groupImageDescriptionDraft, setGroupImageDescriptionDraft] =
    useState("");
  const [groupImageDescriptionStatus, setGroupImageDescriptionStatus] =
    useState<SaveStatus>(null);
  const [markerPlacement, setMarkerPlacement] =
    useState<MarkerPlacementState>(null);
  const [markerPreviewPosition, setMarkerPreviewPosition] =
    useState<MarkerPreviewPosition>(null);
  const [hoveredMarkerItemId, setHoveredMarkerItemId] = useState<Id | null>(
    null,
  );
  const [markerBusy, setMarkerBusy] = useState(false);
  const [arrowLayouts, setArrowLayouts] = useState<ArrowLayout[]>([]);
  const [imageOverlayBounds, setImageOverlayBounds] =
    useState<ImageOverlayBounds | null>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const imageShellRef = useRef<HTMLDivElement>(null);
  const itemRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const groupDescriptionTimersRef = useRef<Record<string, number>>({});
  const groupImageDescriptionTimersRef = useRef<Record<string, number>>({});

  const profileId = profile?.id;

  const loadStash = useCallback(async () => {
    if (!profileId) {
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const nextStash = await getProfileStash(profileId);
      const groups = nextStash?.groups || [];
      setStash(nextStash);
      setActiveGroupId((previousGroupId) =>
        groups.some((group) => idsEqual(group.id, previousGroupId))
          ? previousGroupId
          : (groups[0]?.id ?? null),
      );

      const groupImageList = await getStashEntityImages(
        "item-group",
        groups.map((group) => group.id),
      );
      setGroupImages(buildFirstImageMap(groupImageList));

      const groupEntries = await Promise.all(
        groups.map(async (group) => {
          const [items, markers] = await Promise.all([
            getGroupItems(group.id),
            getStashItemMarkers(group.id),
          ]);
          return [toRecordKey(group.id), { items, markers }] as const;
        }),
      );

      const nextItemsByGroup = Object.fromEntries(
        groupEntries.map(([groupId, payload]) => [groupId, payload.items]),
      ) as IdRecord<StashItem[]>;
      const nextMarkersByGroup = Object.fromEntries(
        groupEntries.map(([groupId, payload]) => [groupId, payload.markers]),
      ) as IdRecord<StashItemMarker[]>;
      setItemsByGroup(nextItemsByGroup);
      setMarkersByGroup(nextMarkersByGroup);

      const allItems = Object.values(nextItemsByGroup).flat();
      const itemIds = allItems.map((item) => item.id);
      const itemImageList = await getStashEntityImages("item", itemIds);
      setItemImages(buildFirstImageMap(itemImageList));
      setItemImageCounts(buildImagesCountMap(itemImageList));
    } catch (error) {
      setStash(null);
      setFeedback(
        t(
          "profile.stash.loadFailed",
          "Unable to load this club stash right now.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [profileId, t]);

  useEffect(() => {
    setStash(null);
    setItemsByGroup({});
    setGroupImages({});
    setItemImages({});
    setItemImageCounts({});
    setMarkersByGroup({});
    setItemOrderByGroup({});
    setActiveGroupId(null);
    setMarkerPlacement(null);
    setMarkerPreviewPosition(null);
    setHoveredMarkerItemId(null);
  }, [profile?.id]);

  useEffect(
    () => () => {
      clearAllTimers(groupDescriptionTimersRef.current);
      clearAllTimers(groupImageDescriptionTimersRef.current);
    },
    [],
  );

  // Keep the URL-selected collection in sync before parent effects publish an
  // active collection.  This avoids a stale selection navigating back to the
  // previous collection when a breadcrumb menu item is chosen.
  useLayoutEffect(() => {
    if (initialGroupId != null) {
      setActiveGroupId(initialGroupId);
    }
    setActiveGroupOverrideId(null);
  }, [initialGroupId]);

  useEffect(() => {
    if (!profileId || profile?.type !== "CLUB") {
      return;
    }

    void loadStash();
  }, [loadStash, profileId, profile?.type]);

  const groups = stash?.groups || [];
  const urlSelectedGroup =
    initialGroupId == null
      ? null
      : groups.find((group) => idsEqual(group.id, initialGroupId)) || null;
  const activeGroup =
    groups.find((group) => idsEqual(group.id, activeGroupOverrideId)) ||
    urlSelectedGroup ||
    groups.find((group) => idsEqual(group.id, activeGroupId)) ||
    groups[0] ||
    null;
  useEffect(() => {
    setGroupNameDraft(activeGroup?.name || "");
    setGroupNameStatus(null);
    clearTimer(groupDescriptionTimersRef.current, "name");
  }, [activeGroup?.id, activeGroup?.name]);
  useEffect(() => {
    setGroupDescriptionDraft(activeGroup?.description || "");
    setGroupDescriptionStatus(null);
    clearTimer(groupDescriptionTimersRef.current, "description");
  }, [activeGroup?.id, activeGroup?.description]);
  useEffect(() => {
    setItemFilter("");
  }, [activeGroup?.id]);
  useEffect(() => {
    onActiveGroupChange?.(activeGroup);
  }, [activeGroup, onActiveGroupChange]);
  useEffect(() => {
    onGroupsChange?.(stash?.groups || []);
  }, [onGroupsChange, stash?.groups]);
  const activeGroupImage = activeGroup
    ? groupImages[toRecordKey(activeGroup.id)]
    : null;
  useEffect(() => {
    setGroupImageDescriptionDraft(activeGroupImage?.description || "");
    setGroupImageDescriptionStatus(null);
    clearTimer(groupImageDescriptionTimersRef.current, "description");
  }, [activeGroupImage?.description, activeGroupImage?.id]);
  const hasActiveGroupImage = Boolean(activeGroupImage);
  const activeMarkers = useMemo(
    () =>
      activeGroup ? markersByGroup[toRecordKey(activeGroup.id)] || [] : [],
    [activeGroup, markersByGroup],
  );
  const activeMarkersByItemId = useMemo(
    () =>
      activeMarkers.reduce<IdRecord<StashItemMarker>>(
        (accumulator, marker) => ({
          ...accumulator,
          [toRecordKey(marker.itemId)]: marker,
        }),
        {},
      ),
    [activeMarkers],
  );
  const activeGroupKey = activeGroup ? toRecordKey(activeGroup.id) : null;
  const activeItems = useMemo(() => {
    const rawItems = activeGroupKey ? itemsByGroup[activeGroupKey] || [] : [];
    const fallbackItems = sortItemsByMarker(rawItems, activeMarkersByItemId);
    const persistedOrder = activeGroupKey
      ? itemOrderByGroup[activeGroupKey]
      : null;

    if (!persistedOrder?.length) {
      return fallbackItems;
    }

    const itemsById = rawItems.reduce<IdRecord<StashItem>>(
      (accumulator, item) => ({
        ...accumulator,
        [toRecordKey(item.id)]: item,
      }),
      {},
    );
    const orderedItems = persistedOrder
      .map((itemId) => itemsById[toRecordKey(itemId)])
      .filter(Boolean);
    const remainingItems = fallbackItems.filter(
      (item) => !persistedOrder.includes(item.id),
    );
    return [...orderedItems, ...remainingItems];
  }, [activeGroupKey, activeMarkersByItemId, itemOrderByGroup, itemsByGroup]);

  const activeGroupSourceCount = activeItems.reduce(
    (count, item) => count + (item.sources || []).length,
    0,
  );
  const activeGroupImageCount = activeItems.reduce(
    (count, item) => count + (itemImageCounts[toRecordKey(item.id)] || 0),
    0,
  );
  const allItems = useMemo(
    () => Object.values(itemsByGroup).flat(),
    [itemsByGroup],
  );
  const activeTemporalSummary = useMemo(
    () => temporalSummary(activeItems, t),
    [activeItems, t],
  );
  const profileTemporalSummary = useMemo(
    () => temporalSummary(allItems, t),
    [allItems, t],
  );
  const filteredActiveItems = useMemo(() => {
    const query = itemFilter.trim().toLowerCase();
    if (!query) return activeItems;
    return activeItems.filter((item) =>
      [item.name, item.description, item.classification]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [activeItems, itemFilter]);

  const headerStats = useMemo(
    () => [
      `${groups.length} ${t("profile.stash.collectionsCount", "collection(s)")}`,
      `${activeItems.length} ${t("profile.stash.itemsCount", "item(s)")}`,
      `${activeGroupSourceCount} ${t("profile.stash.sourcesCount", "source(s)")}`,
      `${activeGroupImageCount} ${t("profile.stash.imagesCount", "image(s)")}`,
    ],
    [
      activeGroupImageCount,
      activeGroupSourceCount,
      activeItems.length,
      groups.length,
      t,
    ],
  );

  const activePreviewMarker = useMemo(() => {
    if (!markerPlacement || !markerPreviewPosition) {
      return null;
    }

    return {
      itemId: markerPlacement.itemId,
      markerId: markerPlacement.markerId || null,
      x: markerPreviewPosition.x,
      y: markerPreviewPosition.y,
    };
  }, [markerPlacement, markerPreviewPosition]);

  const recalculateArrows = useCallback(() => {
    const layoutElement = layoutRef.current;
    const imageShellElement = imageShellRef.current;

    if (!layoutElement || !imageShellElement || !hasActiveGroupImage) {
      setArrowLayouts([]);
      setImageOverlayBounds(null);
      return;
    }

    const layoutBounds = layoutElement.getBoundingClientRect();
    const imageElement = imageShellElement.querySelector(".stash-hero-image");
    const imageBounds = (
      imageElement || imageShellElement
    ).getBoundingClientRect();
    const shellBounds = imageShellElement.getBoundingClientRect();
    const nextOverlayBounds = {
      left: imageBounds.left - shellBounds.left,
      top: imageBounds.top - shellBounds.top,
      width: imageBounds.width,
      height: imageBounds.height,
    };
    setImageOverlayBounds((current) =>
      current &&
      Math.abs(current.left - nextOverlayBounds.left) < 0.5 &&
      Math.abs(current.top - nextOverlayBounds.top) < 0.5 &&
      Math.abs(current.width - nextOverlayBounds.width) < 0.5 &&
      Math.abs(current.height - nextOverlayBounds.height) < 0.5
        ? current
        : nextOverlayBounds,
    );

    const nextArrowLayouts = activeItems.flatMap((item) => {
      const marker =
        activePreviewMarker?.itemId === item.id
          ? activePreviewMarker
          : activeMarkersByItemId[toRecordKey(item.id)];
      const itemRowElement = itemRowRefs.current[toRecordKey(item.id)];

      if (!marker || !itemRowElement) {
        return [];
      }

      const itemBounds = itemRowElement.getBoundingClientRect();
      const arrowButtonBounds = itemRowElement
        .querySelector(".stash-item-arrow-trigger")
        ?.getBoundingClientRect();
      const thumbnailBounds = itemRowElement
        .querySelector(".stash-item-thumb-shell")
        ?.getBoundingClientRect();
      const isCompactMobileLayout = window.matchMedia(
        "(max-width: 575.98px)",
      ).matches;
      const mobileArrowOriginBounds = arrowButtonBounds || thumbnailBounds;
      const arrowOriginBounds =
        isCompactMobileLayout && mobileArrowOriginBounds
          ? mobileArrowOriginBounds
          : itemBounds;
      const usesMobileControlOrigin = Boolean(
        isCompactMobileLayout && arrowButtonBounds,
      );
      const usesMobileThumbnailOrigin = Boolean(
        isCompactMobileLayout && !arrowButtonBounds && thumbnailBounds,
      );
      return [
        {
          itemId: item.id,
          x1:
            imageBounds.left - layoutBounds.left + marker.x * imageBounds.width,
          y1:
            imageBounds.top - layoutBounds.top + marker.y * imageBounds.height,
          x2:
            arrowOriginBounds.left -
            layoutBounds.left +
            (usesMobileControlOrigin || usesMobileThumbnailOrigin
              ? arrowOriginBounds.width / 2
              : 0),
          y2:
            arrowOriginBounds.top -
            layoutBounds.top +
            (usesMobileControlOrigin || usesMobileThumbnailOrigin
              ? 0
              : arrowOriginBounds.height / 2),
        },
      ];
    });

    setArrowLayouts(nextArrowLayouts);
  }, [
    activeItems,
    activeMarkersByItemId,
    activePreviewMarker,
    hasActiveGroupImage,
  ]);

  useLayoutEffect(() => {
    recalculateArrows();
  }, [recalculateArrows]);

  useLayoutEffect(() => {
    scheduleArrowRefresh(recalculateArrows);
  }, [filteredActiveItems, recalculateArrows]);

  useLayoutEffect(() => {
    if (!activeGroup || !hasActiveGroupImage) {
      return;
    }

    const layoutElement = layoutRef.current;
    const imageShellElement = imageShellRef.current;
    if (!layoutElement || !imageShellElement) {
      return;
    }

    const markedItems = activeItems.filter(
      (item) => activeMarkersByItemId[toRecordKey(item.id)],
    );
    if (markedItems.length < 2) {
      return;
    }

    const layoutBounds = layoutElement.getBoundingClientRect();
    const imageElement = imageShellElement.querySelector(".stash-hero-image");
    const imageBounds = (
      imageElement || imageShellElement
    ).getBoundingClientRect();
    const slotPoints = markedItems
      .map((item) => {
        const rowElement = itemRowRefs.current[toRecordKey(item.id)];
        if (!rowElement) {
          return null;
        }

        const rowBounds = rowElement.getBoundingClientRect();
        return {
          x: rowBounds.left - layoutBounds.left,
          y: rowBounds.top - layoutBounds.top + rowBounds.height / 2,
        };
      })
      .filter(Boolean) as SlotPoint[];

    if (slotPoints.length !== markedItems.length) {
      return;
    }

    const markerPoints = markedItems.reduce<IdRecord<MarkerPoint>>(
      (accumulator, item) => {
        const marker = activeMarkersByItemId[toRecordKey(item.id)];
        if (!marker) {
          return accumulator;
        }

        return {
          ...accumulator,
          [toRecordKey(item.id)]: {
            itemId: item.id,
            x:
              imageBounds.left -
              layoutBounds.left +
              marker.x * imageBounds.width,
            y:
              imageBounds.top -
              layoutBounds.top +
              marker.y * imageBounds.height,
          },
        };
      },
      {},
    );

    const currentMarkedOrder = markedItems.map((item) => item.id);
    const optimizedMarkedOrder = optimizeMarkedItemOrder(
      currentMarkedOrder,
      markerPoints,
      slotPoints,
    );
    const currentUnmarkedOrder = activeItems
      .filter((item) => !activeMarkersByItemId[toRecordKey(item.id)])
      .map((item) => item.id);
    const nextOrder = [...optimizedMarkedOrder, ...currentUnmarkedOrder];
    const orderChanged =
      nextOrder.length === activeItems.length &&
      nextOrder.some((itemId, index) => itemId !== activeItems[index]?.id);

    if (!orderChanged) {
      return;
    }

    const groupKey = toRecordKey(activeGroup.id);
    setItemOrderByGroup((previousState) => ({
      ...previousState,
      [groupKey]: nextOrder,
    }));
  }, [activeGroup, activeItems, activeMarkersByItemId, hasActiveGroupImage]);

  useEffect(() => {
    const layoutElement = layoutRef.current;
    if (!layoutElement || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      recalculateArrows();
    });
    observer.observe(layoutElement);
    return () => {
      observer.disconnect();
    };
  }, [recalculateArrows]);

  useEffect(() => {
    const handleWindowResize = () => recalculateArrows();
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [recalculateArrows]);

  useEffect(() => {
    if (!markerPlacement) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }

      const imageShellElement = imageShellRef.current;
      if (imageShellElement?.contains(event.target as Node)) {
        return;
      }

      setMarkerPlacement(null);
      setMarkerPreviewPosition(null);
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [markerPlacement]);

  function setActiveGroupDescription(description: string) {
    if (!activeGroup) {
      return;
    }

    const groupKey = toRecordKey(activeGroup.id);
    setStash((previousState) => {
      if (!previousState) {
        return previousState;
      }

      return {
        ...previousState,
        groups: (previousState.groups || []).map((group) =>
          toRecordKey(group.id) === groupKey
            ? { ...group, description }
            : group,
        ),
      };
    });
  }

  function setActiveGroupName(name: string) {
    if (!activeGroup) return;
    const groupKey = toRecordKey(activeGroup.id);
    setStash((previousState) =>
      !previousState
        ? previousState
        : {
            ...previousState,
            groups: (previousState.groups || []).map((group) =>
              toRecordKey(group.id) === groupKey ? { ...group, name } : group,
            ),
          },
    );
  }

  function handleGroupNameChange(value: string) {
    const persisted = activeGroup?.name || "";
    setGroupNameDraft(value);
    setGroupNameStatus(value === persisted ? null : "pending");
    clearTimer(groupDescriptionTimersRef.current, "name");
    groupDescriptionTimersRef.current.name = window.setTimeout(() => {
      void handleSaveGroupName();
    }, 1800);
  }

  async function handleSaveGroupName() {
    if (!activeGroup || !isEditable) return;
    const persisted = activeGroup.name || "";
    const draft = groupNameDraft.trim();
    clearTimer(groupDescriptionTimersRef.current, "name");
    if (draft === persisted) {
      setGroupNameStatus(null);
      return;
    }
    if (!draft) {
      setGroupNameDraft(persisted);
      setGroupNameStatus("error");
      return;
    }
    try {
      setGroupNameStatus("saving");
      const updatedGroup = await updateStashGroupName(activeGroup.id, draft);
      setActiveGroupName(updatedGroup.name || draft);
      setGroupNameDraft(updatedGroup.name || draft);
      setGroupNameStatus("saved");
      window.setTimeout(() => setGroupNameStatus(null), 1000);
    } catch {
      setGroupNameDraft(persisted);
      setGroupNameStatus("error");
    }
  }

  function handleGroupDescriptionChange(value: string) {
    const persisted = activeGroup?.description || "";
    setGroupDescriptionDraft(value);
    setGroupDescriptionStatus(value === persisted ? null : "pending");
    clearTimer(groupDescriptionTimersRef.current, "description");
    groupDescriptionTimersRef.current.description = window.setTimeout(() => {
      void handleSaveGroupDescription();
    }, 1800);
  }

  async function handleSaveGroupDescription() {
    if (!activeGroup || !isEditable) {
      return;
    }

    const persisted = activeGroup.description || "";
    const draft = groupDescriptionDraft || "";
    clearTimer(groupDescriptionTimersRef.current, "description");

    if (draft === persisted) {
      setGroupDescriptionStatus(null);
      return;
    }

    try {
      setGroupDescriptionStatus("saving");
      const updatedGroup = await updateStashGroupDescription(
        activeGroup.id,
        draft,
      );
      setActiveGroupDescription(updatedGroup?.description || "");
      setGroupDescriptionDraft(updatedGroup?.description || "");
      setGroupDescriptionStatus("saved");
      window.setTimeout(() => {
        setGroupDescriptionStatus(null);
      }, 1000);
    } catch (error) {
      setGroupDescriptionDraft(persisted);
      setGroupDescriptionStatus("error");
    }
  }

  function handleGroupImageDescriptionChange(value: string) {
    const persisted = activeGroupImage?.description || "";
    setGroupImageDescriptionDraft(value);
    setGroupImageDescriptionStatus(value === persisted ? null : "pending");
    clearTimer(groupImageDescriptionTimersRef.current, "description");
    groupImageDescriptionTimersRef.current.description = window.setTimeout(
      () => {
        void handleSaveGroupImageDescription();
      },
      1800,
    );
  }

  async function handleSaveGroupImageDescription() {
    if (!activeGroup || !activeGroupImage || !isEditable) {
      return;
    }

    const persisted = activeGroupImage.description || "";
    const draft = groupImageDescriptionDraft || "";
    clearTimer(groupImageDescriptionTimersRef.current, "description");
    if (draft === persisted) {
      setGroupImageDescriptionStatus(null);
      return;
    }

    try {
      setGroupImageDescriptionStatus("saving");
      const updatedImage = await updateStashGroupImageDescription(
        activeGroup.id,
        activeGroupImage.id,
        draft,
      );
      setGroupImages((previousState) => ({
        ...previousState,
        [toRecordKey(activeGroup.id)]: {
          ...previousState[toRecordKey(activeGroup.id)],
          ...updatedImage,
          entityId: activeGroup.id,
        },
      }));
      setGroupImageDescriptionStatus("saved");
      window.setTimeout(() => setGroupImageDescriptionStatus(null), 1000);
    } catch (error) {
      setGroupImageDescriptionDraft(persisted);
      setGroupImageDescriptionStatus("error");
    }
  }

  async function handleCreateGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileId) {
      return;
    }

    setGroupCreateSubmitting(true);
    setFeedback(null);

    try {
      const createdGroup = await createStashGroup(profileId, groupForm);
      let createdImage: EntityImage | null = null;
      if (groupCreateImages[0]) {
        const uploadedImage = await uploadStashGroupImage(
          createdGroup.id,
          await prepareImageFile(groupCreateImages[0]),
        );
        createdImage = {
          ...uploadedImage,
          entityId: createdGroup.id,
          belongsTo: "item-group",
          resourceId: createdGroup.id,
          resourceType: "item-group",
        };
      }
      // The creation response and image-upload response are sufficient to
      // render the new collection immediately. Avoid a second stash load so
      // the user lands on its tab with its picture already present.
      setStash((current) =>
        current
          ? { ...current, groups: [...(current.groups || []), createdGroup] }
          : ({ groups: [createdGroup] } as Stash),
      );
      setItemsByGroup((current) => ({
        ...current,
        [toRecordKey(createdGroup.id)]: [],
      }));
      setMarkersByGroup((current) => ({
        ...current,
        [toRecordKey(createdGroup.id)]: [],
      }));
      if (createdImage) {
        setGroupImages((current) => ({
          ...current,
          [toRecordKey(createdGroup.id)]: createdImage as EntityImage,
        }));
      }
      setGroupForm(emptyGroupForm);
      setGroupCreateImages([]);
      setGroupCreateVisible(false);
      setActiveGroupId(createdGroup.id);
      setActiveGroupOverrideId(createdGroup.id);
    } catch (error) {
      setFeedback(
        t("profile.stash.groupCreateFailed", "Unable to create a collection."),
      );
    } finally {
      setGroupCreateSubmitting(false);
    }
  }

  async function handleCreateItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemCreateTarget || !profile?.period) {
      return;
    }

    setItemCreateSubmitting(true);
    setFeedback(null);

    try {
      const createdItem = await createStashItem(itemCreateTarget.id, {
        ...itemForm,
        period: profile.period,
      });
      let initialItemImages: EntityImage[] = [];
      if (itemCreateImages.length) {
        const preparedImages = await Promise.all(
          itemCreateImages.map((image) => prepareImageFile(image)),
        );
        const uploadedImages = await Promise.all(
          preparedImages.map((image) =>
            uploadStashItemImage(createdItem.id, image),
          ),
        );
        initialItemImages = uploadedImages.map((image) => ({
          ...image,
          entityId: createdItem.id,
          belongsTo: "item",
          resourceId: createdItem.id,
          resourceType: "item",
        }));
      }
      setItemForm(emptyItemForm);
      setItemCreateImages([]);
      setItemCreateTarget(null);
      navigate(
        `/stash/${profile.alias || profile.id}/items/${createdItem.id}`,
        {
          state: { initialItemImages },
        },
      );
    } catch (error) {
      setFeedback(
        t("profile.stash.itemCreateFailed", "Unable to add this item."),
      );
    } finally {
      setItemCreateSubmitting(false);
    }
  }

  async function handleDeleteGroup(group: StashGroup) {
    setGroupDeleteSubmitting(true);
    setFeedback(null);
    try {
      await deleteStashGroup(group.id);
      setGroupDeleteTarget(null);
      await loadStash();
    } catch (error) {
      setFeedback(
        t(
          "profile.stash.groupDeleteFailed",
          "Unable to delete this collection.",
        ),
      );
    } finally {
      setGroupDeleteSubmitting(false);
    }
  }

  async function handleUploadGroupImage(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !groupImageTarget) {
      setFeedback(
        t("profile.stash.itemImageChooseFile", "Choose an image to upload."),
      );
      return;
    }

    setGroupImageUploading(true);
    setFeedback(null);

    try {
      const preparedFile = await prepareImageFile(file);
      const uploadedImage = await uploadStashGroupImage(
        groupImageTarget.id,
        preparedFile,
      );
      setGroupImages((previousState) => ({
        ...previousState,
        [toRecordKey(groupImageTarget.id)]: {
          ...uploadedImage,
          entityId: groupImageTarget.id,
          belongsTo: "item-group",
          resourceId: groupImageTarget.id,
          resourceType: "item-group",
        },
      }));
      setGroupImageTarget(null);
      setMarkerPlacement(null);
      setMarkerPreviewPosition(null);
    } catch (error) {
      setFeedback(
        t(
          "profile.stash.itemImageUploadFailed",
          "Unable to upload this image.",
        ),
      );
    } finally {
      setGroupImageUploading(false);
    }
  }

  async function handleDeleteGroupImage(groupId: Id) {
    try {
      await deleteStashGroupImage(groupId);
      setMarkerPlacement(null);
      setMarkerPreviewPosition(null);
      await loadStash();
    } catch (error) {
      setFeedback(
        t(
          "profile.stash.itemImageDeleteFailed",
          "Unable to delete this image.",
        ),
      );
    }
  }

  async function handleDeleteMarker(groupId: Id, markerId: Id) {
    try {
      const groupKey = toRecordKey(groupId);
      setMarkersByGroup((previousState) => ({
        ...previousState,
        [groupKey]: (previousState[groupKey] || []).filter(
          (marker) => marker.id !== markerId,
        ),
      }));
      await deleteStashItemMarker(groupId, markerId);
      setMarkerPlacement(null);
      setMarkerPreviewPosition(null);
    } catch (error) {
      await loadStash();
      setFeedback(
        t("profile.stash.markerDeleteFailed", "Unable to delete this marker."),
      );
    }
  }

  function getNormalizedMarkerPosition(event: React.MouseEvent<HTMLElement>) {
    const imageElement =
      imageShellRef.current?.querySelector(".stash-hero-image");
    const bounds = (
      imageElement || event.currentTarget
    ).getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function handleImageMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (
      !activeGroup ||
      !markerPlacement ||
      !hasActiveGroupImage ||
      markerBusy
    ) {
      return;
    }

    setMarkerPreviewPosition(getNormalizedMarkerPosition(event));
  }

  async function handleImageClick(
    event: React.MouseEvent<HTMLElement>,
    fromImagePreview = false,
  ) {
    if (
      !fromImagePreview &&
      (event.target as Element).closest("button, input, textarea")
    ) {
      return;
    }
    if (
      !activeGroup ||
      !markerPlacement ||
      !hasActiveGroupImage ||
      markerBusy
    ) {
      return;
    }

    // A shell-level mousemove can be stale.  Store the exact point clicked.
    const { x, y } = getNormalizedMarkerPosition(event);

    setMarkerBusy(true);
    setFeedback(null);
    const groupKey = toRecordKey(activeGroup.id);
    const previousMarkers = markersByGroup[groupKey] || [];

    try {
      const payload = {
        itemId: String(markerPlacement.itemId),
        x,
        y,
      };

      if (markerPlacement.markerId) {
        setMarkersByGroup((previousState) => ({
          ...previousState,
          [groupKey]: (previousState[groupKey] || []).map((marker) =>
            marker.id === markerPlacement.markerId
              ? { ...marker, x, y }
              : marker,
          ),
        }));
        scheduleArrowRefresh(recalculateArrows);
        const updatedMarker = await updateStashItemMarker(
          activeGroup.id,
          markerPlacement.markerId,
          payload,
        );
        setMarkersByGroup((previousState) => ({
          ...previousState,
          [groupKey]: (previousState[groupKey] || []).map((marker) =>
            marker.id === markerPlacement.markerId ? updatedMarker : marker,
          ),
        }));
      } else {
        const tempMarkerId = `temp-${markerPlacement.itemId}`;
        setMarkersByGroup((previousState) => ({
          ...previousState,
          [groupKey]: [
            ...(previousState[groupKey] || []).filter(
              (marker) => marker.itemId !== markerPlacement.itemId,
            ),
            { id: tempMarkerId, itemId: String(markerPlacement.itemId), x, y },
          ],
        }));
        scheduleArrowRefresh(recalculateArrows);
        const createdMarker = await createStashItemMarker(
          activeGroup.id,
          payload,
        );
        setMarkersByGroup((previousState) => ({
          ...previousState,
          [groupKey]: (previousState[groupKey] || []).map((marker) =>
            marker.id === tempMarkerId ? createdMarker : marker,
          ),
        }));
      }

      setMarkerPlacement(null);
      setMarkerPreviewPosition(null);
    } catch (error) {
      setMarkersByGroup((previousState) => ({
        ...previousState,
        [groupKey]: previousMarkers,
      }));
      setMarkerPreviewPosition(null);
      setFeedback(
        t("profile.stash.markerSaveFailed", "Unable to save this marker."),
      );
    } finally {
      setMarkerBusy(false);
    }
  }

  if (profile?.type !== "CLUB") {
    return null;
  }

  return (
    <div className={embedded ? "mt-4 pt-2" : ""}>
      <div className="stash-overview-shell">
        <div className="stash-overview-header">
          <div>
            <div className="stash-overview-title">
              {t("profile.stash.collectionsTitle", "Collections")}
            </div>
            <div className="stash-overview-copy">
              {t(
                "profile.stash.summary",
                "Track collections, items, and supporting sources for this profile.",
              )}
            </div>
          </div>
        </div>

        {feedback && <div className="stash-feedback-note">{feedback}</div>}

        {loading && <Spinner size="sm" />}

        {!loading && !groups.length && (
          <>
            <div
              className="stash-collection-tab-row stash-collection-tab-row--empty"
              aria-label={t("profile.stash.collectionsTitle", "Collections")}
            >
              <div className="stash-collection-tab-list" />
              {isEditable && (
                <DismissibleCoachmark
                  id={`create-first-collection:${profile.id}:v4`}
                  visible
                  message="Add a photo of yourself, then add your items and their images."
                >
                  <button
                    type="button"
                    className="stash-inline-icon-button"
                    title={t("profile.stash.groupCreate", "Create collection")}
                    aria-label={t(
                      "profile.stash.groupCreate",
                      "Create collection",
                    )}
                    onClick={() => setGroupCreateVisible(true)}
                  >
                    <PlusIcon />
                  </button>
                </DismissibleCoachmark>
              )}
            </div>
            <div className="stash-empty-state">
              <div className="fw-semibold mb-1">
                {t("profile.stash.emptyTitle", "No collections yet")}
              </div>
              <div className="small text-muted mb-3">
                {t(
                  "profile.stash.empty",
                  "Start by creating the first group of belongings.",
                )}
              </div>
            </div>
          </>
        )}

        {!loading && groups.length > 0 && (
          <>
            <div className="stash-collection-tab-row">
              <div className="stash-collection-tab-list">
                {groups.map((group) => {
                  const items = itemsByGroup[toRecordKey(group.id)] || [];
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`stash-collection-tab${idsEqual(group.id, activeGroup?.id) ? " is-active" : ""}`}
                      onClick={() => {
                        setActiveGroupId(group.id);
                        setActiveGroupOverrideId(group.id);
                        setMarkerPlacement(null);
                        setMarkerPreviewPosition(null);
                      }}
                    >
                      <span className="stash-collection-tab-name">
                        {group.name ||
                          t("profile.stash.groupName", "Collection")}
                      </span>
                      <span className="stash-collection-tab-meta">
                        {items.length}{" "}
                        {t("profile.stash.itemsCount", "item(s)")}
                      </span>
                    </button>
                  );
                })}
              </div>
              {isEditable && (
                <button
                  type="button"
                  className="stash-inline-icon-button"
                  title={t("profile.stash.groupCreate", "Create collection")}
                  onClick={() => setGroupCreateVisible(true)}
                >
                  <PlusIcon />
                </button>
              )}
            </div>

            {activeGroup && (
              <div
                className="stash-overview-layout stash-overview-layout--annotated"
                ref={layoutRef}
              >
                {arrowLayouts.length > 0 && (
                  <svg
                    className={`stash-arrow-layer${markerPlacement ? " is-marker-placing" : ""}`}
                    aria-hidden="true"
                  >
                    <defs>
                      <marker
                        id="stash-arrow-head-fill"
                        markerWidth="5.6"
                        markerHeight="5.6"
                        refX="4.4"
                        refY="2.8"
                        orient="auto"
                      >
                        <path
                          d="M0,0 L5.6,2.8 L0,5.6 z"
                          fill="#d4aa5a"
                          stroke="#1f1a14"
                          strokeWidth="0.45"
                        />
                      </marker>
                    </defs>
                    {arrowLayouts.map((arrow) => (
                      <g key={arrow.itemId}>
                        <line
                          className={`stash-arrow-line-outline${hoveredMarkerItemId === arrow.itemId ? " is-highlighted" : ""}`}
                          x1={arrow.x2}
                          y1={arrow.y2}
                          x2={arrow.x1}
                          y2={arrow.y1}
                        />
                        <line
                          className={`stash-arrow-line${hoveredMarkerItemId === arrow.itemId ? " is-highlighted" : ""}`}
                          x1={arrow.x2}
                          y1={arrow.y2}
                          x2={arrow.x1}
                          y2={arrow.y1}
                          markerEnd="url(#stash-arrow-head-fill)"
                          pointerEvents={markerPlacement ? "none" : "stroke"}
                          onMouseEnter={() =>
                            setHoveredMarkerItemId(arrow.itemId)
                          }
                          onMouseLeave={() =>
                            setHoveredMarkerItemId((previousState) =>
                              previousState === arrow.itemId
                                ? null
                                : previousState,
                            )
                          }
                        />
                      </g>
                    ))}
                  </svg>
                )}

                <aside className="stash-hero-panel">
                  <div
                    className={`stash-hero-image-shell${markerPlacement ? " is-marker-placing" : ""}`}
                    ref={imageShellRef}
                    onMouseMove={handleImageMouseMove}
                    onClick={handleImageClick}
                  >
                    <StackedImageGallery
                      mode="single"
                      images={activeGroupImage ? [activeGroupImage] : []}
                      title={
                        activeGroup.name ||
                        t("profile.stash.groupName", "Collection")
                      }
                      editable={isEditable}
                      onUploadImage={
                        isEditable
                          ? () => setGroupImageTarget(activeGroup)
                          : undefined
                      }
                      onReplaceImage={
                        isEditable
                          ? () => setGroupImageTarget(activeGroup)
                          : undefined
                      }
                      onDeleteImage={
                        isEditable
                          ? () => {
                              void handleDeleteGroupImage(activeGroup.id);
                            }
                          : undefined
                      }
                      imageDrafts={
                        activeGroupImage
                          ? {
                              [toRecordKey(activeGroupImage.id)]:
                                groupImageDescriptionDraft,
                            }
                          : {}
                      }
                      imageStatuses={
                        activeGroupImage
                          ? {
                              [toRecordKey(activeGroupImage.id)]:
                                groupImageDescriptionStatus,
                            }
                          : {}
                      }
                      onDescriptionChange={(_, value) =>
                        handleGroupImageDescriptionChange(value)
                      }
                      onDescriptionBlur={() => {
                        void handleSaveGroupImageDescription();
                      }}
                      replaceTitle={t(
                        "profile.stash.itemImageUpload",
                        "Replace image",
                      )}
                      replacePopover={t(
                        "profile.stash.itemImageUpload",
                        "Replace image",
                      )}
                      deleteTitle={t("profile.stash.delete", "Delete")}
                      deleteConfirmTitle={t("profile.stash.delete", "Delete")}
                      deleteConfirmMessage={t(
                        "profile.stash.groupImageDeleteConfirm",
                        "Delete this collection image?",
                      )}
                      deleteLabel={t("profile.action.delete", "Delete")}
                      cancelLabel={t("profile.action.cancel", "Cancel")}
                      imageClassName="stash-hero-image"
                      previewStyle={{ objectFit: "contain" }}
                      wrapperClassName="h-100"
                      onPreviewClick={
                        markerPlacement
                          ? (event) => {
                              void handleImageClick(event, true);
                              return false;
                            }
                          : undefined
                      }
                      showInlineDescription
                      emptyContent={
                        <div className="stash-hero-image stash-hero-image--empty">
                          <DefaultHourglassImage
                            alt={t(
                              "profile.stash.imagesEmptyShort",
                              "No images",
                            )}
                            className="stash-empty-image-art"
                          />
                        </div>
                      }
                    />

                    {hasActiveGroupImage &&
                      activeMarkers.map((marker) => (
                        <button
                          key={marker.id || marker.itemId}
                          type="button"
                          className={`stash-marker-dot${markerPlacement?.markerId === marker.id ? " is-active" : ""}${hoveredMarkerItemId === marker.itemId ? " is-highlighted" : ""}`}
                          style={{
                            left: imageOverlayBounds
                              ? `${
                                  imageOverlayBounds.left +
                                  (markerPlacement?.markerId === marker.id &&
                                  activePreviewMarker
                                    ? activePreviewMarker.x
                                    : marker.x) *
                                    imageOverlayBounds.width
                                }px`
                              : "50%",
                            top: imageOverlayBounds
                              ? `${
                                  imageOverlayBounds.top +
                                  (markerPlacement?.markerId === marker.id &&
                                  activePreviewMarker
                                    ? activePreviewMarker.y
                                    : marker.y) *
                                    imageOverlayBounds.height
                                }px`
                              : "50%",
                            pointerEvents:
                              markerPlacement?.markerId === marker.id
                                ? "none"
                                : undefined,
                          }}
                          onMouseEnter={() =>
                            setHoveredMarkerItemId(marker.itemId)
                          }
                          onMouseLeave={() =>
                            setHoveredMarkerItemId((previousState) =>
                              previousState === marker.itemId
                                ? null
                                : previousState,
                            )
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!isEditable) {
                              return;
                            }

                            setMarkerPlacement({
                              itemId: marker.itemId,
                              markerId: marker.id || null,
                            });
                            setMarkerPreviewPosition({
                              x: marker.x,
                              y: marker.y,
                            });
                          }}
                        />
                      ))}
                  </div>

                  <div className="stash-hero-copy">
                    <InlineEditableText
                      editable={isEditable}
                      value={groupNameDraft}
                      readOnlyValue={
                        activeGroup.name ||
                        t("profile.stash.groupName", "Collection")
                      }
                      onValueChange={handleGroupNameChange}
                      onBlur={() => {
                        void handleSaveGroupName();
                      }}
                      status={groupNameStatus}
                      className="stash-hero-title-field"
                      textClassName="stash-hero-title"
                      placeholder="Collection name"
                    />
                    <EditableDescriptionField
                      editable={isEditable}
                      value={groupDescriptionDraft}
                      readOnlyValue={
                        activeGroup.description ||
                        t("profile.stash.noDescription", "No description")
                      }
                      onValueChange={handleGroupDescriptionChange}
                      onBlur={() => {
                        void handleSaveGroupDescription();
                      }}
                      status={groupDescriptionStatus}
                      textClassName="stash-hero-description"
                      placeholderDisplay={!activeGroup.description}
                      placeholder={t(
                        "profile.stash.noDescription",
                        "No description",
                      )}
                      rows={3}
                      multilineUseContentEditable
                    />
                    <div className="stash-meta-row">
                      {headerStats.map((stat) => (
                        <span
                          key={stat}
                          className="stash-meta-chip stash-meta-chip-soft"
                        >
                          {stat}
                        </span>
                      ))}
                    </div>
                    {activeTemporalSummary && (
                      <div className="stash-temporal-summary">
                        {t(
                          "profile.stash.temporal.collection",
                          "Collection temporal fit",
                        )}
                        : {activeTemporalSummary}
                        {profileTemporalSummary &&
                          allItems.length !== activeItems.length && (
                            <>
                              {" · "}
                              {t(
                                "profile.stash.temporal.profile",
                                "Across profile",
                              )}
                              : {profileTemporalSummary}
                            </>
                          )}
                      </div>
                    )}
                    {markerPlacement && (
                      <div className="stash-marker-helper">
                        {t(
                          "profile.stash.markerHelper",
                          "Click on the image to place or move the arrow.",
                        )}
                      </div>
                    )}
                  </div>
                </aside>

                <section className="stash-items-pane">
                  <div className="stash-items-header">
                    <div className="stash-items-heading">
                      <h2 className="stash-items-title">
                        {t("profile.stash.itemsTitle", "Items")}
                      </h2>
                      <TextFilterInput
                        value={itemFilter}
                        onChange={setItemFilter}
                        placeholder={t(
                          "profile.stash.itemFilterPlaceholder",
                          "Filter items",
                        )}
                        className="stash-items-filter"
                      />
                    </div>
                    {isEditable && (
                      <DismissibleCoachmark
                        id={`create-first-item:${profile.id}:${activeGroup.id}`}
                        visible={
                          groups.length === 1 && activeItems.length === 0
                        }
                        message="Create your first item and upload its images, then mark it on your collection photo."
                      >
                        <button
                          type="button"
                          className="stash-inline-icon-button"
                          title={t("profile.stash.itemCreate", "Add item")}
                          onClick={() => {
                            setItemCreateImages([]);
                            setItemCreateTarget(activeGroup);
                          }}
                        >
                          <PlusIcon />
                        </button>
                      </DismissibleCoachmark>
                    )}
                  </div>
                  {activeItems.length === 0 && (
                    <div className="stash-empty-state stash-empty-state--compact">
                      <div className="fw-semibold mb-1">
                        {t("profile.stash.itemsEmptyTitle", "No items yet")}
                      </div>
                      <div className="small text-muted mb-3">
                        {t(
                          "profile.stash.itemsEmpty",
                          "Add the first item to this collection.",
                        )}
                      </div>
                      {isEditable && (
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => {
                            setItemCreateImages([]);
                            setItemCreateTarget(activeGroup);
                          }}
                        >
                          {t("profile.stash.itemCreateFirst", "Add first item")}
                        </Button>
                      )}
                    </div>
                  )}

                  {activeItems.length > 0 &&
                    filteredActiveItems.length === 0 && (
                      <div className="stash-empty-state stash-empty-state--compact">
                        <div className="small text-muted">
                          {t(
                            "profile.stash.itemFilterEmpty",
                            "No items match this filter.",
                          )}
                        </div>
                      </div>
                    )}

                  {filteredActiveItems.map((item) => {
                    const marker = activeMarkersByItemId[toRecordKey(item.id)];
                    const itemImage = itemImages[toRecordKey(item.id)];
                    const itemImageSrc = getImageSrc(itemImage);
                    const itemImageCount =
                      itemImageCounts[toRecordKey(item.id)] || 0;
                    const itemSummary = [
                      getClassificationLabel(intl, item.classification) ||
                        item.classification,
                      `${(item.sources || []).length} ${t("profile.stash.sourcesCount", "source(s)")}`,
                      `${itemImageCount} ${t("profile.stash.imagesCount", "image(s)")}`,
                    ].filter(Boolean);

                    return (
                      <div
                        key={item.id}
                        ref={(element) => {
                          itemRowRefs.current[toRecordKey(item.id)] = element;
                          if (element) {
                            scheduleArrowRefresh(recalculateArrows);
                          }
                        }}
                        className={`stash-item-list-card${marker ? " has-marker" : ""}${isEditable && hasActiveGroupImage ? " has-marker-controls" : ""}${hoveredMarkerItemId === item.id ? " is-highlighted" : ""}`}
                        role="button"
                        tabIndex={0}
                        onMouseEnter={() => {
                          if (marker) {
                            setHoveredMarkerItemId(item.id);
                          }
                        }}
                        onMouseLeave={() =>
                          setHoveredMarkerItemId((previousState) =>
                            previousState === item.id ? null : previousState,
                          )
                        }
                        onClick={(event) => {
                          // React portal events from a modal bubble through this component tree,
                          // even though the modal is not a DOM child of this card.
                          if (
                            !event.currentTarget.contains(event.target as Node)
                          ) {
                            return;
                          }
                          navigate(
                            `/stash/${profile?.alias || profile?.id}/items/${item.id}`,
                          );
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate(
                              `/stash/${profile?.alias || profile?.id}/items/${item.id}`,
                            );
                          }
                        }}
                      >
                        <div className="stash-item-media-column">
                          <div className="stash-item-marker-slot">
                            {isEditable && hasActiveGroupImage && (
                              <div className="stash-item-marker-controls">
                                <button
                                  type="button"
                                  className={`stash-item-arrow-trigger${markerPlacement?.itemId === item.id ? " is-active" : ""}`}
                                  title={
                                    marker
                                      ? t(
                                          "profile.stash.markerEdit",
                                          "Edit arrow",
                                        )
                                      : t(
                                          "profile.stash.markerCreate",
                                          "Add arrow",
                                        )
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setMarkerPlacement({
                                      itemId: item.id,
                                      markerId: marker?.id || null,
                                    });
                                    setMarkerPreviewPosition(
                                      marker
                                        ? { x: marker.x, y: marker.y }
                                        : null,
                                    );
                                  }}
                                >
                                  <ArrowLeftIcon />
                                </button>
                                {marker?.id && (
                                  <button
                                    type="button"
                                    className="stash-item-arrow-delete"
                                    title={t(
                                      "profile.stash.markerDelete",
                                      "Delete arrow",
                                    )}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleDeleteMarker(
                                        activeGroup.id,
                                        marker.id || "",
                                      );
                                    }}
                                  >
                                    <CloseIcon />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="stash-item-thumb-shell">
                            {itemImageSrc ? (
                              <RefreshingImage
                                image={
                                  itemImage || {
                                    url: itemImageSrc,
                                    resourceType: "item",
                                    resourceId: item.id,
                                  }
                                }
                                variant="thumbnail"
                                alt={item.name || "Item"}
                                className="stash-item-thumb"
                              />
                            ) : (
                              <DefaultHourglassImage
                                alt={t(
                                  "profile.stash.imagesEmptyShort",
                                  "No images",
                                )}
                                className="stash-item-thumb"
                              />
                            )}
                          </div>
                        </div>
                        <div className="stash-item-list-copy">
                          <div className="stash-item-list-head">
                            <div className="stash-item-list-title">
                              {item.name}
                            </div>
                          </div>
                          <div className="stash-item-list-description">
                            {item.description
                              ? truncateDescription(item.description)
                              : t(
                                  "profile.stash.noDescription",
                                  "No description",
                                )}
                          </div>
                          <div className="stash-meta-row">
                            <TemporalFitBadge fit={item.temporalFit} t={t} />
                            {itemSummary.map((value) => (
                              <span
                                key={value}
                                className="stash-meta-chip stash-meta-chip-soft"
                              >
                                {value}
                              </span>
                            ))}
                            {!marker && (
                              <span className="stash-meta-chip stash-meta-chip-soft">
                                {t(
                                  "profile.stash.markerMissing",
                                  "No arrow yet",
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </section>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        show={groupCreateVisible}
        onHide={() => {
          if (!groupCreateSubmitting) {
            setGroupCreateImages([]);
            setGroupCreateVisible(false);
          }
        }}
        centered
      >
        <Modal.Header closeButton={!groupCreateSubmitting}>
          <Modal.Title>
            {t("profile.stash.groupCreate", "Create collection")}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateGroup}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>
                {t("profile.stash.groupName", "Collection name")}
              </Form.Label>
              <Form.Control
                value={groupForm.name}
                onChange={(event) =>
                  setGroupForm((previousState) => ({
                    ...previousState,
                    name: event.target.value,
                  }))
                }
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>
                {t("profile.stash.groupDescription", "Description")}
              </Form.Label>
              <Form.Control
                value={groupForm.description}
                onChange={(event) =>
                  setGroupForm((previousState) => ({
                    ...previousState,
                    description: event.target.value,
                  }))
                }
              />
            </Form.Group>
            <MultiImageFilePicker
              files={groupCreateImages}
              onFilesChange={setGroupCreateImages}
              disabled={groupCreateSubmitting}
              label={t("profile.stash.groupPicture", "Picture")}
              maxFiles={1}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => {
                setGroupCreateImages([]);
                setGroupCreateVisible(false);
              }}
              disabled={groupCreateSubmitting}
            >
              {t("profile.action.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              variant="secondary"
              disabled={groupCreateSubmitting || !groupForm.name.trim()}
            >
              {t("profile.stash.groupCreate", "Create collection")}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={Boolean(itemCreateTarget)}
        onHide={() => {
          if (!itemCreateSubmitting) {
            setItemCreateImages([]);
            setItemCreateTarget(null);
          }
        }}
        centered
      >
        <Modal.Header closeButton={!itemCreateSubmitting}>
          <Modal.Title>{t("profile.stash.itemCreate", "Add item")}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateItem}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>
                {t("profile.stash.itemName", "Item name")}
              </Form.Label>
              <Form.Control
                value={itemForm.name}
                onChange={(event) =>
                  setItemForm((previousState) => ({
                    ...previousState,
                    name: event.target.value,
                  }))
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>
                {t("profile.stash.itemDescription", "Description")}
              </Form.Label>
              <Form.Control
                value={itemForm.description}
                onChange={(event) =>
                  setItemForm((previousState) => ({
                    ...previousState,
                    description: event.target.value,
                  }))
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>
                {t("profile.stash.itemClassification", "Classification")}
              </Form.Label>
              <ClassificationSelect
                value={itemForm.classification}
                onChange={(classification) =>
                  setItemForm((previousState) => ({
                    ...previousState,
                    classification,
                  }))
                }
              />
            </Form.Group>
            <div className="small text-muted">
              {t(
                "profile.stash.itemPeriodInherited",
                "Period is inherited from the club profile",
              )}
              : {getPeriodLabel(profile?.period)}
            </div>
            <MultiImageFilePicker
              files={itemCreateImages}
              onFilesChange={setItemCreateImages}
              disabled={itemCreateSubmitting}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => {
                setItemCreateImages([]);
                setItemCreateTarget(null);
              }}
              disabled={itemCreateSubmitting}
            >
              {t("profile.action.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              variant="secondary"
              disabled={itemCreateSubmitting || !itemForm.name.trim()}
            >
              {t("profile.stash.itemCreate", "Add item")}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ImmediateImageUploadModal
        show={Boolean(groupImageTarget)}
        title={t("profile.stash.itemImageUpload", "Upload image")}
        fileLabel={t("profile.stash.itemImageFile", "Image file")}
        onHide={() => setGroupImageTarget(null)}
        onFileChange={handleUploadGroupImage}
        uploading={groupImageUploading}
        uploadingText={t("profile.stash.itemImageUploading", "Uploading...")}
      />

      <ConfirmationModal
        show={Boolean(groupDeleteTarget)}
        title={t("profile.stash.groupDelete", "Delete collection")}
        message={t(
          "profile.stash.groupDeleteConfirm",
          "Delete this collection and all of its items, images, and source assignments? Sources themselves will not be deleted.",
        )}
        confirmLabel={t("profile.stash.groupDelete", "Delete collection")}
        cancelLabel={t("profile.action.cancel", "Cancel")}
        busy={groupDeleteSubmitting}
        onHide={() => setGroupDeleteTarget(null)}
        onConfirm={() => {
          if (groupDeleteTarget) void handleDeleteGroup(groupDeleteTarget);
        }}
      />
    </div>
  );
}

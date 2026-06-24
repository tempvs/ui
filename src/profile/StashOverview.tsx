import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { FaArrowLeft, FaHourglassHalf, FaPlus, FaTimes, FaTrash, FaUpload } from 'react-icons/fa';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';

import ConfirmingTrashButton from '../component/ConfirmingTrashButton';
import EditableDescriptionField from '../component/EditableDescriptionField';
import ImageOverlayActionButton from '../component/ImageOverlayActionButton';
import Spinner from '../component/Spinner';
import defaultImage from '../assets/default-image.png';
import { getClassificationLabel } from '../library/libraryShared';
import { SaveStatus } from '../component/EditableFieldRow';
import { clearAllTimers, clearTimer } from '../util/timers';
import { readFileAsBase64 } from '../util/fileUtils';
import {
  createStashGroup,
  createStashItem,
  createStashItemMarker,
  deleteStashItem,
  deleteStashGroup,
  deleteStashGroupImage,
  deleteStashItemMarker,
  getGroupItems,
  getProfileStash,
  getStashEntityImages,
  getStashItemMarkers,
  updateStashGroupDescription,
  updateStashItemMarker,
  uploadStashGroupImage,
} from './stashApi';
import {
  EntityImage,
  Id,
  Stash,
  StashGroup,
  StashItem,
  StashItemMarker,
  StashPanelProps,
} from './profileTypes';

const emptyGroupForm = { name: '', description: '' };
const emptyItemForm = { name: '', description: '', classification: 'OTHER' };
const ALL_CLASSIFICATIONS = ['ARMOR', 'CLOTHING', 'FOOTWEAR', 'ACCESSORY', 'WEAPON', 'OTHER'];
const ArrowLeftIcon = FaArrowLeft as React.ComponentType<{ className?: string }>;
const CloseIcon = FaTimes as React.ComponentType<{ className?: string }>;
const PlusIcon = FaPlus as React.ComponentType<{ className?: string }>;
const TrashIcon = FaTrash as React.ComponentType<{ className?: string }>;
const UploadIcon = FaUpload as React.ComponentType<{ className?: string }>;
const SavingIcon = FaHourglassHalf as React.ComponentType<{ className?: string }>;

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

function toRecordKey(value: Id) {
  return String(value);
}

function idsEqual(left: Id | null | undefined, right: Id | null | undefined) {
  if (left == null || right == null) {
    return false;
  }

  return String(left) === String(right);
}

function buildFirstImageMap(images: EntityImage[]) {
  return images.reduce<IdRecord<EntityImage>>((accumulator, image) => {
    const entityId = image.entityId || '';
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
    const entityId = image.entityId || '';
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

  if (image.url) {
    return image.url;
  }

  if (image.src) {
    return `data:image/jpeg;base64, ${image.src}`;
  }

  return null;
}

function sortItemsByMarker(items: StashItem[], markersByItemId: IdRecord<StashItemMarker>) {
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

    return String(left.name || left.id).localeCompare(String(right.name || right.id));
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

function getOrientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  return ((bx - ax) * (cy - ay)) - ((by - ay) * (cx - ax));
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

  if (Math.abs(first) < epsilon || Math.abs(second) < epsilon || Math.abs(third) < epsilon || Math.abs(fourth) < epsilon) {
    return false;
  }

  return (first > 0) !== (second > 0) && (third > 0) !== (fourth > 0);
}

function countLineIntersections(
  orderedItemIds: Id[],
  markerPoints: IdRecord<MarkerPoint>,
  slotPoints: SlotPoint[],
) {
  let intersections = 0;

  for (let leftIndex = 0; leftIndex < orderedItemIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < orderedItemIds.length; rightIndex += 1) {
      const leftMarker = markerPoints[toRecordKey(orderedItemIds[leftIndex])];
      const rightMarker = markerPoints[toRecordKey(orderedItemIds[rightIndex])];
      const leftSlot = slotPoints[leftIndex];
      const rightSlot = slotPoints[rightIndex];

      if (!leftMarker || !rightMarker || !leftSlot || !rightSlot) {
        continue;
      }

      if (segmentsIntersect(
        leftMarker.x,
        leftMarker.y,
        leftSlot.x,
        leftSlot.y,
        rightMarker.x,
        rightMarker.y,
        rightSlot.x,
        rightSlot.y,
      )) {
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
        const candidateScore = countLineIntersections(candidate, markerPoints, slotPoints);

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
}: StashPanelProps) {
  const intl = useIntl();
  const navigate = useNavigate();
  const [stash, setStash] = useState<Stash | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<Id | null>(null);
  const [itemsByGroup, setItemsByGroup] = useState<IdRecord<StashItem[]>>({});
  const [groupImages, setGroupImages] = useState<IdRecord<EntityImage>>({});
  const [itemImages, setItemImages] = useState<IdRecord<EntityImage>>({});
  const [itemImageCounts, setItemImageCounts] = useState<IdRecord<number>>({});
  const [markersByGroup, setMarkersByGroup] = useState<IdRecord<StashItemMarker[]>>({});
  const [itemOrderByGroup, setItemOrderByGroup] = useState<IdRecord<Id[]>>({});
  const [groupCreateVisible, setGroupCreateVisible] = useState(false);
  const [groupCreateSubmitting, setGroupCreateSubmitting] = useState(false);
  const [itemCreateTarget, setItemCreateTarget] = useState<StashGroup | null>(null);
  const [itemCreateSubmitting, setItemCreateSubmitting] = useState(false);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [groupImageTarget, setGroupImageTarget] = useState<StashGroup | null>(null);
  const [groupImageUploading, setGroupImageUploading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [groupDescriptionDraft, setGroupDescriptionDraft] = useState('');
  const [groupDescriptionStatus, setGroupDescriptionStatus] = useState<SaveStatus>(null);
  const [markerPlacement, setMarkerPlacement] = useState<MarkerPlacementState>(null);
  const [markerPreviewPosition, setMarkerPreviewPosition] = useState<MarkerPreviewPosition>(null);
  const [hoveredMarkerItemId, setHoveredMarkerItemId] = useState<Id | null>(null);
  const [markerBusy, setMarkerBusy] = useState(false);
  const [arrowLayouts, setArrowLayouts] = useState<ArrowLayout[]>([]);
  const groupImageInputRef = useRef<HTMLInputElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const imageShellRef = useRef<HTMLDivElement>(null);
  const itemRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const groupDescriptionTimersRef = useRef<Record<string, number>>({});

  const profileId = profile?.id;
  const groupUploadControl = groupImageUploading ? <SavingIcon className="text-muted" /> : <UploadIcon />;

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
      setActiveGroupId(previousGroupId => (
        groups.some(group => idsEqual(group.id, previousGroupId)) ? previousGroupId : (groups[0]?.id ?? null)
      ));

      const groupImageList = await getStashEntityImages('item-group', groups.map(group => group.id));
      setGroupImages(buildFirstImageMap(groupImageList));

      const groupEntries = await Promise.all(groups.map(async group => {
        const [items, markers] = await Promise.all([
          getGroupItems(group.id),
          getStashItemMarkers(group.id),
        ]);
        return [toRecordKey(group.id), { items, markers }] as const;
      }));

      const nextItemsByGroup = Object.fromEntries(groupEntries.map(([groupId, payload]) => [groupId, payload.items])) as IdRecord<StashItem[]>;
      const nextMarkersByGroup = Object.fromEntries(groupEntries.map(([groupId, payload]) => [groupId, payload.markers])) as IdRecord<StashItemMarker[]>;
      setItemsByGroup(nextItemsByGroup);
      setMarkersByGroup(nextMarkersByGroup);

      const allItems = Object.values(nextItemsByGroup).flat();
      const itemIds = allItems.map(item => item.id);
      const itemImageList = await getStashEntityImages('item', itemIds);
      setItemImages(buildFirstImageMap(itemImageList));
      setItemImageCounts(buildImagesCountMap(itemImageList));
    } catch (error) {
      setStash(null);
      setFeedback(t('profile.stash.loadFailed', 'Unable to load this club stash right now.'));
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

  useEffect(() => () => {
    clearAllTimers(groupDescriptionTimersRef.current);
  }, []);

  useEffect(() => {
    if (initialGroupId != null) {
      setActiveGroupId(initialGroupId);
    }
  }, [initialGroupId]);

  useEffect(() => {
    if (!profileId || profile?.type !== 'CLUB') {
      return;
    }

    void loadStash();
  }, [loadStash, profileId, profile?.type]);

  const groups = stash?.groups || [];
  const activeGroup = groups.find(group => idsEqual(group.id, activeGroupId)) || groups[0] || null;
  useEffect(() => {
    setGroupDescriptionDraft(activeGroup?.description || '');
    setGroupDescriptionStatus(null);
    clearTimer(groupDescriptionTimersRef.current, 'description');
  }, [activeGroup?.id, activeGroup?.description]);
  useEffect(() => {
    onActiveGroupChange?.(activeGroup);
  }, [activeGroup, onActiveGroupChange]);
  const activeGroupImage = activeGroup ? groupImages[toRecordKey(activeGroup.id)] : null;
  const activeGroupImageSrc = getImageSrc(activeGroupImage);
  const activeMarkers = useMemo(
    () => (activeGroup ? (markersByGroup[toRecordKey(activeGroup.id)] || []) : []),
    [activeGroup, markersByGroup]
  );
  const activeMarkersByItemId = useMemo(
    () => activeMarkers.reduce<IdRecord<StashItemMarker>>((accumulator, marker) => ({
      ...accumulator,
      [toRecordKey(marker.itemId)]: marker,
    }), {}),
    [activeMarkers]
  );
  const activeGroupKey = activeGroup ? toRecordKey(activeGroup.id) : null;
  const activeItems = useMemo(() => {
    const rawItems = activeGroupKey ? (itemsByGroup[activeGroupKey] || []) : [];
    const fallbackItems = sortItemsByMarker(rawItems, activeMarkersByItemId);
    const persistedOrder = activeGroupKey ? itemOrderByGroup[activeGroupKey] : null;

    if (!persistedOrder?.length) {
      return fallbackItems;
    }

    const itemsById = rawItems.reduce<IdRecord<StashItem>>((accumulator, item) => ({
      ...accumulator,
      [toRecordKey(item.id)]: item,
    }), {});
    const orderedItems = persistedOrder
      .map(itemId => itemsById[toRecordKey(itemId)])
      .filter(Boolean);
    const remainingItems = fallbackItems.filter(item => !persistedOrder.includes(item.id));
    return [...orderedItems, ...remainingItems];
  }, [activeGroupKey, activeMarkersByItemId, itemOrderByGroup, itemsByGroup]);

  const activeGroupSourceCount = activeItems.reduce((count, item) => count + (item.sources || []).length, 0);
  const activeGroupImageCount = activeItems.reduce(
    (count, item) => count + (itemImageCounts[toRecordKey(item.id)] || 0),
    0
  );

  const headerStats = useMemo(() => [
    `${groups.length} ${t('profile.stash.collectionsCount', 'collection(s)')}`,
    `${activeItems.length} ${t('profile.stash.itemsCount', 'item(s)')}`,
    `${activeGroupSourceCount} ${t('profile.stash.sourcesCount', 'source(s)')}`,
    `${activeGroupImageCount} ${t('profile.stash.imagesCount', 'image(s)')}`,
  ], [activeGroupImageCount, activeGroupSourceCount, activeItems.length, groups.length, t]);

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

    if (!layoutElement || !imageShellElement || !activeGroupImageSrc) {
      setArrowLayouts([]);
      return;
    }

    const layoutBounds = layoutElement.getBoundingClientRect();
    const imageBounds = imageShellElement.getBoundingClientRect();

    const nextArrowLayouts = activeItems.flatMap(item => {
      const marker = activePreviewMarker?.itemId === item.id
        ? activePreviewMarker
        : activeMarkersByItemId[toRecordKey(item.id)];
      const itemRowElement = itemRowRefs.current[toRecordKey(item.id)];

      if (!marker || !itemRowElement) {
        return [];
      }

      const itemBounds = itemRowElement.getBoundingClientRect();
      return [{
        itemId: item.id,
        x1: imageBounds.left - layoutBounds.left + (marker.x * imageBounds.width),
        y1: imageBounds.top - layoutBounds.top + (marker.y * imageBounds.height),
        x2: itemBounds.left - layoutBounds.left,
        y2: itemBounds.top - layoutBounds.top + (itemBounds.height / 2),
      }];
    });

    setArrowLayouts(nextArrowLayouts);
  }, [activeGroupImageSrc, activeItems, activeMarkersByItemId, activePreviewMarker]);

  useLayoutEffect(() => {
    recalculateArrows();
  }, [recalculateArrows]);

  useLayoutEffect(() => {
    if (!activeGroup || !activeGroupImageSrc) {
      return;
    }

    const layoutElement = layoutRef.current;
    const imageShellElement = imageShellRef.current;
    if (!layoutElement || !imageShellElement) {
      return;
    }

    const markedItems = activeItems.filter(item => activeMarkersByItemId[toRecordKey(item.id)]);
    if (markedItems.length < 2) {
      return;
    }

    const layoutBounds = layoutElement.getBoundingClientRect();
    const imageBounds = imageShellElement.getBoundingClientRect();
    const slotPoints = markedItems.map(item => {
      const rowElement = itemRowRefs.current[toRecordKey(item.id)];
      if (!rowElement) {
        return null;
      }

      const rowBounds = rowElement.getBoundingClientRect();
      return {
        x: rowBounds.left - layoutBounds.left,
        y: rowBounds.top - layoutBounds.top + (rowBounds.height / 2),
      };
    }).filter(Boolean) as SlotPoint[];

    if (slotPoints.length !== markedItems.length) {
      return;
    }

    const markerPoints = markedItems.reduce<IdRecord<MarkerPoint>>((accumulator, item) => {
      const marker = activeMarkersByItemId[toRecordKey(item.id)];
      if (!marker) {
        return accumulator;
      }

      return {
        ...accumulator,
        [toRecordKey(item.id)]: {
          itemId: item.id,
          x: imageBounds.left - layoutBounds.left + (marker.x * imageBounds.width),
          y: imageBounds.top - layoutBounds.top + (marker.y * imageBounds.height),
        },
      };
    }, {});

    const currentMarkedOrder = markedItems.map(item => item.id);
    const optimizedMarkedOrder = optimizeMarkedItemOrder(currentMarkedOrder, markerPoints, slotPoints);
    const currentUnmarkedOrder = activeItems
      .filter(item => !activeMarkersByItemId[toRecordKey(item.id)])
      .map(item => item.id);
    const nextOrder = [...optimizedMarkedOrder, ...currentUnmarkedOrder];
    const orderChanged = nextOrder.length === activeItems.length && nextOrder.some((itemId, index) => itemId !== activeItems[index]?.id);

    if (!orderChanged) {
      return;
    }

    const groupKey = toRecordKey(activeGroup.id);
    setItemOrderByGroup(previousState => ({
      ...previousState,
      [groupKey]: nextOrder,
    }));
  }, [activeGroup, activeGroupImageSrc, activeItems, activeMarkersByItemId]);

  useEffect(() => {
    const layoutElement = layoutRef.current;
    if (!layoutElement || typeof ResizeObserver === 'undefined') {
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
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
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

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [markerPlacement]);

  function setActiveGroupDescription(description: string) {
    if (!activeGroup) {
      return;
    }

    const groupKey = toRecordKey(activeGroup.id);
    setStash(previousState => {
      if (!previousState) {
        return previousState;
      }

      return {
        ...previousState,
        groups: (previousState.groups || []).map(group => (
          toRecordKey(group.id) === groupKey ? { ...group, description } : group
        )),
      };
    });
  }

  function handleGroupDescriptionChange(value: string) {
    const persisted = activeGroup?.description || '';
    setGroupDescriptionDraft(value);
    setGroupDescriptionStatus(value === persisted ? null : 'pending');
    clearTimer(groupDescriptionTimersRef.current, 'description');
    groupDescriptionTimersRef.current.description = window.setTimeout(() => {
      void handleSaveGroupDescription();
    }, 1800);
  }

  async function handleSaveGroupDescription() {
    if (!activeGroup || !isEditable) {
      return;
    }

    const persisted = activeGroup.description || '';
    const draft = groupDescriptionDraft || '';
    clearTimer(groupDescriptionTimersRef.current, 'description');

    if (draft === persisted) {
      setGroupDescriptionStatus(null);
      return;
    }

    try {
      setGroupDescriptionStatus('saving');
      const updatedGroup = await updateStashGroupDescription(activeGroup.id, draft);
      setActiveGroupDescription(updatedGroup?.description || '');
      setGroupDescriptionDraft(updatedGroup?.description || '');
      setGroupDescriptionStatus('saved');
      window.setTimeout(() => {
        setGroupDescriptionStatus(null);
      }, 1000);
    } catch (error) {
      setGroupDescriptionDraft(persisted);
      setGroupDescriptionStatus('error');
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
      setGroupForm(emptyGroupForm);
      setGroupCreateVisible(false);
      await loadStash();
      setActiveGroupId(createdGroup.id);
    } catch (error) {
      setFeedback(t('profile.stash.groupCreateFailed', 'Unable to create a collection.'));
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
      await createStashItem(itemCreateTarget.id, {
        ...itemForm,
        period: profile.period,
      });
      setItemForm(emptyItemForm);
      setItemCreateTarget(null);
      await loadStash();
      setActiveGroupId(itemCreateTarget.id);
    } catch (error) {
      setFeedback(t('profile.stash.itemCreateFailed', 'Unable to add this item.'));
    } finally {
      setItemCreateSubmitting(false);
    }
  }

  async function handleDeleteGroup(group: StashGroup) {
    try {
      await deleteStashGroup(group.id);
      await loadStash();
    } catch (error) {
      setFeedback(t('profile.stash.groupDeleteFailed', 'Unable to delete this collection.'));
    }
  }

  async function handleDeleteItem(itemId: Id) {
    try {
      await deleteStashItem(itemId);
      setMarkerPlacement(previousState => (
        previousState?.itemId === itemId ? null : previousState
      ));
      setMarkerPreviewPosition(previousState => (
        markerPlacement?.itemId === itemId ? null : previousState
      ));
      await loadStash();
    } catch (error) {
      setFeedback(t('profile.stash.itemDeleteFailed', 'Unable to delete this item.'));
    }
  }

  async function handleUploadGroupImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = groupImageInputRef.current?.files?.[0];

    if (!file || !groupImageTarget) {
      setFeedback(t('profile.stash.itemImageChooseFile', 'Choose an image to upload.'));
      return;
    }

    setGroupImageUploading(true);
    setFeedback(null);

    try {
      const content = await readFileAsBase64(file);
      await uploadStashGroupImage(groupImageTarget.id, {
        content,
        fileName: file.name,
        description: groupImageTarget.name || null,
      });
      if (groupImageInputRef.current) {
        groupImageInputRef.current.value = '';
      }
      setGroupImageTarget(null);
      setMarkerPlacement(null);
      setMarkerPreviewPosition(null);
      await loadStash();
    } catch (error) {
      setFeedback(t('profile.stash.itemImageUploadFailed', 'Unable to upload this image.'));
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
      setFeedback(t('profile.stash.itemImageDeleteFailed', 'Unable to delete this image.'));
    }
  }

  async function handleDeleteMarker(groupId: Id, markerId: Id) {
    try {
      const groupKey = toRecordKey(groupId);
      setMarkersByGroup(previousState => ({
        ...previousState,
        [groupKey]: (previousState[groupKey] || []).filter(marker => marker.id !== markerId),
      }));
      await deleteStashItemMarker(groupId, markerId);
      setMarkerPlacement(null);
      setMarkerPreviewPosition(null);
    } catch (error) {
      await loadStash();
      setFeedback(t('profile.stash.markerDeleteFailed', 'Unable to delete this marker.'));
    }
  }

  function getNormalizedMarkerPosition(event: React.MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function handleImageMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!activeGroup || !markerPlacement || !activeGroupImageSrc || markerBusy) {
      return;
    }

    setMarkerPreviewPosition(getNormalizedMarkerPosition(event));
  }

  async function handleImageClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!activeGroup || !markerPlacement || !activeGroupImageSrc || markerBusy) {
      return;
    }

    const { x, y } = markerPreviewPosition || getNormalizedMarkerPosition(event);

    setMarkerBusy(true);
    setFeedback(null);
    const groupKey = toRecordKey(activeGroup.id);
    const previousMarkers = markersByGroup[groupKey] || [];

    try {
      const payload = {
        itemId: markerPlacement.itemId,
        x,
        y,
      };

      if (markerPlacement.markerId) {
        setMarkersByGroup(previousState => ({
          ...previousState,
          [groupKey]: (previousState[groupKey] || []).map(marker => (
            marker.id === markerPlacement.markerId ? { ...marker, x, y } : marker
          )),
        }));
        scheduleArrowRefresh(recalculateArrows);
        const updatedMarker = await updateStashItemMarker(activeGroup.id, markerPlacement.markerId, payload);
        setMarkersByGroup(previousState => ({
          ...previousState,
          [groupKey]: (previousState[groupKey] || []).map(marker => (
            marker.id === markerPlacement.markerId ? updatedMarker : marker
          )),
        }));
      } else {
        const tempMarkerId = `temp-${markerPlacement.itemId}`;
        setMarkersByGroup(previousState => ({
          ...previousState,
          [groupKey]: [
            ...(previousState[groupKey] || []).filter(marker => marker.itemId !== markerPlacement.itemId),
            { id: tempMarkerId, itemId: markerPlacement.itemId, x, y },
          ],
        }));
        scheduleArrowRefresh(recalculateArrows);
        const createdMarker = await createStashItemMarker(activeGroup.id, payload);
        setMarkersByGroup(previousState => ({
          ...previousState,
          [groupKey]: (previousState[groupKey] || []).map(marker => (
            marker.id === tempMarkerId ? createdMarker : marker
          )),
        }));
      }

      setMarkerPlacement(null);
      setMarkerPreviewPosition(null);
    } catch (error) {
      setMarkersByGroup(previousState => ({
        ...previousState,
        [groupKey]: previousMarkers,
      }));
      setMarkerPreviewPosition(null);
      setFeedback(t('profile.stash.markerSaveFailed', 'Unable to save this marker.'));
    } finally {
      setMarkerBusy(false);
    }
  }

  if (profile?.type !== 'CLUB') {
    return null;
  }

  return (
    <div className={embedded ? 'mt-4 pt-2' : ''}>
      <div className="stash-overview-shell">
        <div className="stash-overview-header">
          <div>
            <div className="stash-overview-title">{t('profile.stash.collectionsTitle', 'Collections')}</div>
            <div className="stash-overview-copy">
              {t('profile.stash.summary', 'Track collections, items, and supporting sources for this profile.')}
            </div>
          </div>
        </div>

        {feedback && <div className="stash-feedback-note">{feedback}</div>}

        {loading && <Spinner size="sm" />}

        {!loading && !groups.length && (
          <div className="stash-empty-state">
            <div className="fw-semibold mb-1">{t('profile.stash.emptyTitle', 'No collections yet')}</div>
            <div className="small text-muted mb-3">{t('profile.stash.empty', 'Start by creating the first group of belongings.')}</div>
            {isEditable && (
              <Button variant="outline-secondary" size="sm" onClick={() => setGroupCreateVisible(true)}>
                {t('profile.stash.groupCreateFirst', 'Create first collection')}
              </Button>
            )}
          </div>
        )}

        {!loading && groups.length > 0 && (
          <>
            <div className="stash-collection-tab-row">
              <div className="stash-collection-tab-list">
                {groups.map(group => {
                  const items = itemsByGroup[toRecordKey(group.id)] || [];
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`stash-collection-tab${group.id === activeGroup?.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setActiveGroupId(group.id);
                        setMarkerPlacement(null);
                        setMarkerPreviewPosition(null);
                      }}
                    >
                      <span className="stash-collection-tab-name">{group.name || t('profile.stash.groupName', 'Collection')}</span>
                      <span className="stash-collection-tab-meta">{items.length} {t('profile.stash.itemsCount', 'item(s)')}</span>
                    </button>
                  );
                })}
              </div>
              {isEditable && (
                <button
                  type="button"
                  className="stash-inline-icon-button"
                  title={t('profile.stash.groupCreate', 'Create collection')}
                  onClick={() => setGroupCreateVisible(true)}
                >
                  <PlusIcon />
                </button>
              )}
            </div>

            {activeGroup && (
              <div className="stash-overview-layout stash-overview-layout--annotated" ref={layoutRef}>
                {arrowLayouts.length > 0 && (
                  <svg className={`stash-arrow-layer${markerPlacement ? ' is-marker-placing' : ''}`} aria-hidden="true">
                    <defs>
                      <marker id="stash-arrow-head-fill" markerWidth="5.6" markerHeight="5.6" refX="4.4" refY="2.8" orient="auto">
                        <path d="M0,0 L5.6,2.8 L0,5.6 z" fill="#d4aa5a" stroke="#1f1a14" strokeWidth="0.45" />
                      </marker>
                    </defs>
                    {arrowLayouts.map(arrow => (
                      <g key={arrow.itemId}>
                        <line
                          className={`stash-arrow-line-outline${hoveredMarkerItemId === arrow.itemId ? ' is-highlighted' : ''}`}
                          x1={arrow.x2}
                          y1={arrow.y2}
                          x2={arrow.x1}
                          y2={arrow.y1}
                        />
                        <line
                          className={`stash-arrow-line${hoveredMarkerItemId === arrow.itemId ? ' is-highlighted' : ''}`}
                          x1={arrow.x2}
                          y1={arrow.y2}
                          x2={arrow.x1}
                          y2={arrow.y1}
                          markerEnd="url(#stash-arrow-head-fill)"
                          pointerEvents={markerPlacement ? 'none' : 'stroke'}
                          onMouseEnter={() => setHoveredMarkerItemId(arrow.itemId)}
                          onMouseLeave={() => setHoveredMarkerItemId(previousState => (
                            previousState === arrow.itemId ? null : previousState
                          ))}
                        />
                      </g>
                    ))}
                  </svg>
                )}

                <aside className="stash-hero-panel">
                  <div
                    className={`stash-hero-image-shell${markerPlacement ? ' is-marker-placing' : ''}`}
                    ref={imageShellRef}
                    onMouseMove={handleImageMouseMove}
                    onClick={handleImageClick}
                  >
                    {activeGroupImageSrc ? (
                      <img
                        src={activeGroupImageSrc}
                        alt={activeGroup.name || 'Collection'}
                        className="stash-hero-image"
                        onLoad={() => scheduleArrowRefresh(recalculateArrows)}
                      />
                    ) : (
                      <div className="stash-hero-image stash-hero-image--empty">
                        <img src={defaultImage} alt={t('profile.stash.imagesEmptyShort', 'No images')} className="stash-empty-image-art" />
                      </div>
                    )}

                    {activeGroupImageSrc && activeMarkers.map(marker => (
                      <button
                        key={marker.id || marker.itemId}
                        type="button"
                        className={`stash-marker-dot${markerPlacement?.markerId === marker.id ? ' is-active' : ''}${hoveredMarkerItemId === marker.itemId ? ' is-highlighted' : ''}`}
                        style={{
                          left: `${(
                            markerPlacement?.markerId === marker.id && activePreviewMarker
                              ? activePreviewMarker.x
                              : marker.x
                          ) * 100}%`,
                          top: `${(
                            markerPlacement?.markerId === marker.id && activePreviewMarker
                              ? activePreviewMarker.y
                              : marker.y
                          ) * 100}%`,
                          pointerEvents: markerPlacement?.markerId === marker.id ? 'none' : undefined,
                        }}
                        onMouseEnter={() => setHoveredMarkerItemId(marker.itemId)}
                        onMouseLeave={() => setHoveredMarkerItemId(previousState => (
                          previousState === marker.itemId ? null : previousState
                        ))}
                        onClick={event => {
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

                    {isEditable && (
                      <ImageOverlayActionButton
                        className="position-absolute top-0 start-0 m-2"
                        onClick={event => {
                          event.stopPropagation();
                          setGroupImageTarget(activeGroup);
                        }}
                        title={t('profile.stash.itemImageUpload', 'Upload image')}
                        popover={t('profile.stash.itemImageUpload', 'Upload image')}
                      >
                        {groupUploadControl}
                      </ImageOverlayActionButton>
                    )}
                    {isEditable && activeGroupImageSrc && (
                      <ConfirmingTrashButton
                        className="position-absolute top-0 end-0 m-2"
                        fontSize="0.85rem"
                        title={t('profile.stash.delete', 'Delete')}
                        confirmTitle={t('profile.stash.delete', 'Delete')}
                        confirmMessage={t('profile.stash.groupImageDeleteConfirm', 'Delete this collection image?')}
                        confirmLabel={t('profile.action.delete', 'Delete')}
                        cancelLabel={t('profile.action.cancel', 'Cancel')}
                        onConfirm={() => {
                          void handleDeleteGroupImage(activeGroup.id);
                        }}
                      />
                    )}
                  </div>

                  <div className="stash-hero-copy">
                    <h2 className="stash-hero-title">{activeGroup.name}</h2>
                    <EditableDescriptionField
                      editable={isEditable}
                      value={groupDescriptionDraft}
                      readOnlyValue={activeGroup.description || t('profile.stash.noDescription', 'No description')}
                      onValueChange={handleGroupDescriptionChange}
                      onBlur={() => { void handleSaveGroupDescription(); }}
                      status={groupDescriptionStatus}
                      textClassName="stash-hero-description"
                      placeholderDisplay={!activeGroup.description}
                      placeholder={t('profile.stash.noDescription', 'No description')}
                      rows={3}
                      multilineUseContentEditable
                    />
                    <div className="stash-meta-row">
                      {headerStats.map(stat => (
                        <span key={stat} className="stash-meta-chip stash-meta-chip-soft">{stat}</span>
                      ))}
                    </div>
                    {markerPlacement && (
                      <div className="stash-marker-helper">
                        {t('profile.stash.markerHelper', 'Click on the image to place or move the arrow.')}
                      </div>
                    )}
                    {isEditable && (
                      <div className="stash-hero-manage">
                        <Button variant="outline-danger" size="sm" onClick={() => handleDeleteGroup(activeGroup)}>
                          {t('profile.stash.groupDelete', 'Delete collection')}
                        </Button>
                      </div>
                    )}
                  </div>
                </aside>

                <section className="stash-items-pane">
                  {activeItems.length === 0 && (
                    <div className="stash-empty-state stash-empty-state--compact">
                      <div className="fw-semibold mb-1">{t('profile.stash.itemsEmptyTitle', 'No items yet')}</div>
                      <div className="small text-muted mb-3">{t('profile.stash.itemsEmpty', 'Add the first item to this collection.')}</div>
                      {isEditable && (
                        <Button variant="outline-secondary" size="sm" onClick={() => setItemCreateTarget(activeGroup)}>
                          {t('profile.stash.itemCreateFirst', 'Add first item')}
                        </Button>
                      )}
                    </div>
                  )}

                  {activeItems.map(item => {
                    const marker = activeMarkersByItemId[toRecordKey(item.id)];
                    const itemImage = itemImages[toRecordKey(item.id)];
                    const itemImageSrc = getImageSrc(itemImage);
                    const itemImageCount = itemImageCounts[toRecordKey(item.id)] || 0;
                    const itemSummary = [
                      getClassificationLabel(intl, item.classification) || item.classification,
                      `${(item.sources || []).length} ${t('profile.stash.sourcesCount', 'source(s)')}`,
                      `${itemImageCount} ${t('profile.stash.imagesCount', 'image(s)')}`,
                    ].filter(Boolean);

                    return (
                      <div
                        key={item.id}
                        ref={element => {
                          itemRowRefs.current[toRecordKey(item.id)] = element;
                          if (element) {
                            scheduleArrowRefresh(recalculateArrows);
                          }
                        }}
                        className={`stash-item-list-card${marker ? ' has-marker' : ''}${hoveredMarkerItemId === item.id ? ' is-highlighted' : ''}`}
                        role="button"
                        tabIndex={0}
                        onMouseEnter={() => {
                          if (marker) {
                            setHoveredMarkerItemId(item.id);
                          }
                        }}
                        onMouseLeave={() => setHoveredMarkerItemId(previousState => (
                          previousState === item.id ? null : previousState
                        ))}
                        onClick={() => navigate(`/stash/${profile?.alias || profile?.id}/items/${item.id}`)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            navigate(`/stash/${profile?.alias || profile?.id}/items/${item.id}`);
                          }
                        }}
                      >
                        {isEditable && (
                          <button
                            type="button"
                            className="stash-item-delete-trigger"
                            title={t('profile.stash.itemDelete', 'Delete item')}
                            onClick={event => {
                              event.stopPropagation();
                              void handleDeleteItem(item.id);
                            }}
                          >
                            <TrashIcon />
                          </button>
                        )}
                        <div className="stash-item-media-column">
                          {isEditable && activeGroupImageSrc && (
                            <div className="stash-item-marker-controls">
                              <button
                                type="button"
                                className={`stash-item-arrow-trigger${markerPlacement?.itemId === item.id ? ' is-active' : ''}`}
                                title={marker ? t('profile.stash.markerEdit', 'Edit arrow') : t('profile.stash.markerCreate', 'Add arrow')}
                                onClick={event => {
                                  event.stopPropagation();
                                  setMarkerPlacement({
                                    itemId: item.id,
                                    markerId: marker?.id || null,
                                  });
                                  setMarkerPreviewPosition(marker ? { x: marker.x, y: marker.y } : null);
                                }}
                              >
                                <ArrowLeftIcon />
                              </button>
                              {marker?.id && (
                                <button
                                  type="button"
                                  className="stash-item-arrow-delete"
                                  title={t('profile.stash.markerDelete', 'Delete arrow')}
                                  onClick={event => {
                                    event.stopPropagation();
                                    void handleDeleteMarker(activeGroup.id, marker.id || '');
                                  }}
                                >
                                  <CloseIcon />
                                </button>
                              )}
                            </div>
                          )}
                          {itemImageSrc && (
                            <div className="stash-item-thumb-shell">
                              <img src={itemImageSrc} alt={item.name || 'Item'} className="stash-item-thumb" />
                            </div>
                          )}
                        </div>
                        <div className="stash-item-list-copy">
                          <div className="stash-item-list-head">
                            <div className="stash-item-list-title">{item.name}</div>
                          </div>
                          <div className="stash-item-list-description">
                            {item.description || t('profile.stash.noDescription', 'No description')}
                          </div>
                          <div className="stash-meta-row">
                            {itemSummary.map(value => (
                              <span key={value} className="stash-meta-chip stash-meta-chip-soft">{value}</span>
                            ))}
                            {!marker && (
                              <span className="stash-meta-chip stash-meta-chip-soft">
                                {t('profile.stash.markerMissing', 'No arrow yet')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {isEditable && activeGroup && (
                    <div className="stash-item-add-row">
                      <button
                        type="button"
                        className="stash-inline-icon-button"
                        title={t('profile.stash.itemCreate', 'Add item')}
                        onClick={() => setItemCreateTarget(activeGroup)}
                      >
                        <PlusIcon />
                      </button>
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>

      <Modal show={groupCreateVisible} onHide={() => !groupCreateSubmitting && setGroupCreateVisible(false)} centered>
        <Modal.Header closeButton={!groupCreateSubmitting}>
          <Modal.Title>{t('profile.stash.groupCreate', 'Create collection')}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateGroup}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('profile.stash.groupName', 'Collection name')}</Form.Label>
              <Form.Control
                value={groupForm.name}
                onChange={event => setGroupForm(previousState => ({ ...previousState, name: event.target.value }))}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>{t('profile.stash.groupDescription', 'Collection note')}</Form.Label>
              <Form.Control
                value={groupForm.description}
                onChange={event => setGroupForm(previousState => ({ ...previousState, description: event.target.value }))}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setGroupCreateVisible(false)} disabled={groupCreateSubmitting}>
              {t('profile.action.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="secondary" disabled={groupCreateSubmitting || !groupForm.name.trim()}>
              {t('profile.stash.groupCreate', 'Create collection')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(itemCreateTarget)} onHide={() => !itemCreateSubmitting && setItemCreateTarget(null)} centered>
        <Modal.Header closeButton={!itemCreateSubmitting}>
          <Modal.Title>{t('profile.stash.itemCreate', 'Add item')}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateItem}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('profile.stash.itemName', 'Item name')}</Form.Label>
              <Form.Control
                value={itemForm.name}
                onChange={event => setItemForm(previousState => ({ ...previousState, name: event.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('profile.stash.itemDescription', 'Description')}</Form.Label>
              <Form.Control
                value={itemForm.description}
                onChange={event => setItemForm(previousState => ({ ...previousState, description: event.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('profile.stash.itemClassification', 'Classification')}</Form.Label>
              <Form.Select
                value={itemForm.classification}
                onChange={event => setItemForm(previousState => ({ ...previousState, classification: event.target.value }))}
              >
                {ALL_CLASSIFICATIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="small text-muted">
              {t('profile.stash.itemPeriodInherited', 'Period is inherited from the club profile')}: {getPeriodLabel(profile?.period)}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setItemCreateTarget(null)} disabled={itemCreateSubmitting}>
              {t('profile.action.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="secondary" disabled={itemCreateSubmitting || !itemForm.name.trim()}>
              {t('profile.stash.itemCreate', 'Add item')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(groupImageTarget)} onHide={() => !groupImageUploading && setGroupImageTarget(null)} centered>
        <Modal.Header closeButton={!groupImageUploading}>
          <Modal.Title>{t('profile.stash.itemImageUpload', 'Upload image')}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUploadGroupImage}>
          <Modal.Body>
            <Form.Group>
              <Form.Label>{t('profile.stash.itemImageFile', 'Image file')}</Form.Label>
              <Form.Control ref={groupImageInputRef} type="file" accept="image/*" />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setGroupImageTarget(null)} disabled={groupImageUploading}>
              {t('profile.action.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="secondary" disabled={groupImageUploading}>
              {groupImageUploading
                ? t('profile.stash.itemImageUploading', 'Uploading...')
                : t('profile.stash.itemImageUpload', 'Upload image')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}

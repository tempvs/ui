import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { FaChevronDown, FaChevronRight, FaLink, FaUnlink } from 'react-icons/fa';

import ConfirmingTrashButton from '../component/ConfirmingTrashButton';
import EditableTextFieldRow from '../component/EditableTextFieldRow';
import InlineEditableText from '../component/InlineEditableText';
import PlusActionButton from '../component/PlusActionButton';
import SearchActionButton from '../component/SearchActionButton';
import Spinner from '../component/Spinner';
import StackedImageGallery from '../component/StackedImageGallery';
import { getClassificationLabel, getTypeLabel } from '../library/libraryShared';
import { readFileAsBase64 } from '../util/fileUtils';
import { clearAllTimers, clearTimer } from '../util/timers';
import {
  createStashGroup,
  createStashItem,
  deleteStashGroup,
  deleteStashItemImage,
  deleteStashItem,
  getGroupItems,
  getStashItemImages,
  getLibrarySourcesByIds,
  getProfileStash,
  linkStashItemSource,
  searchLibrarySources,
  unlinkStashItemSource,
  updateStashItemImageDescription,
  updateStashGroupDescription,
  updateStashGroupName,
  uploadStashItemImage,
  updateStashItemDescription,
  updateStashItemName,
} from './stashApi';
import {
  DraftFields,
  Feedback,
  Id,
  LibrarySourceSummary,
  ReplacingItemImage,
  SourceSearchState,
  Stash,
  StashGroup,
  StashItem,
  StashItemImage,
  StashPanelProps,
} from './profileTypes';
import { SaveStatus } from '../component/EditableFieldRow';

const ALL_SOURCE_TYPES = ['WRITTEN', 'GRAPHIC', 'ARCHAEOLOGICAL', 'OTHER'];

const emptyGroupForm = { name: '', description: '' };
const ChevronDownIcon = FaChevronDown as React.ComponentType;
const ChevronRightIcon = FaChevronRight as React.ComponentType;
const LinkIcon = FaLink as React.ComponentType<{ className?: string }>;
const UnlinkIcon = FaUnlink as React.ComponentType;

type FieldName = keyof DraftFields;
type FieldStatusMap = Partial<Record<FieldName, SaveStatus>>;
type IdRecord<T> = Record<Id, T>;

const emptyItemForm = (classification?: string | null): DraftFields & { classification: string } => ({
  name: '',
  description: '',
  classification: classification || 'OTHER',
});

function wait(milliseconds: number) {
  return new Promise(resolve => {
    window.setTimeout(resolve, milliseconds);
  });
}

function buildSourceLookupMap(sources: LibrarySourceSummary[]): IdRecord<LibrarySourceSummary> {
  return sources.reduce((accumulator, source) => ({
    ...accumulator,
    [source.id]: source,
  }), {} as IdRecord<LibrarySourceSummary>);
}

export default function StashPanel({ profile, isEditable, t, getPeriodLabel, embedded = true }: StashPanelProps) {
  const intl = useIntl();
  const [stash, setStash] = useState<Stash | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [groupDrafts, setGroupDrafts] = useState<IdRecord<DraftFields>>({});
  const [groupStatuses, setGroupStatuses] = useState<IdRecord<FieldStatusMap>>({});
  const [itemDrafts, setItemDrafts] = useState<IdRecord<DraftFields>>({});
  const [itemStatuses, setItemStatuses] = useState<IdRecord<FieldStatusMap>>({});
  const [groupCreateVisible, setGroupCreateVisible] = useState(false);
  const [groupExpanded, setGroupExpanded] = useState<IdRecord<boolean>>({});
  const [itemsByGroup, setItemsByGroup] = useState<IdRecord<StashItem[]>>({});
  const [itemsLoading, setItemsLoading] = useState<IdRecord<boolean>>({});
  const [itemExpanded, setItemExpanded] = useState<IdRecord<boolean>>({});
  const [sourceSearchVisible, setSourceSearchVisible] = useState<IdRecord<boolean>>({});
  const [itemCreateTarget, setItemCreateTarget] = useState<StashGroup | null>(null);
  const [itemCreateForm, setItemCreateForm] = useState(emptyItemForm(profile?.period));
  const [itemCreateSubmitting, setItemCreateSubmitting] = useState(false);
  const [itemCreatePendingByGroup, setItemCreatePendingByGroup] = useState<IdRecord<boolean>>({});
  const [sourceDetails, setSourceDetails] = useState<IdRecord<LibrarySourceSummary>>({});
  const [sourceSearch, setSourceSearch] = useState<IdRecord<SourceSearchState>>({});
  const [itemImagesByItem, setItemImagesByItem] = useState<IdRecord<StashItemImage[]>>({});
  const [itemImagesLoading, setItemImagesLoading] = useState<IdRecord<boolean>>({});
  const [itemImageDrafts, setItemImageDrafts] = useState<IdRecord<string>>({});
  const [itemImageStatuses, setItemImageStatuses] = useState<IdRecord<SaveStatus>>({});
  const [itemImageUploadTarget, setItemImageUploadTarget] = useState<StashItem | null>(null);
  const [itemImageDescription, setItemImageDescription] = useState('');
  const [itemImageUploading, setItemImageUploading] = useState(false);
  const groupSaveTimersRef = React.useRef<Record<string, number>>({});
  const itemSaveTimersRef = React.useRef<Record<string, number>>({});
  const itemImageSaveTimersRef = React.useRef<Record<string, number>>({});
  const itemImageInputRef = useRef<HTMLInputElement>(null);
  const replaceItemImageInputRef = useRef<HTMLInputElement>(null);
  const replacingItemImageRef = useRef<ReplacingItemImage | null>(null);

  const isClubProfile = profile?.type === 'CLUB';
  const profileId = profile?.id;
  useEffect(() => {
    setGroupForm(emptyGroupForm);
    setGroupCreateVisible(false);
    setItemCreateTarget(null);
    setItemCreateForm(emptyItemForm(profile?.period));
    setItemCreatePendingByGroup({});
    setItemImageUploadTarget(null);
    setItemImageDescription('');
    setSourceSearch({});
    setSourceSearchVisible({});
  }, [profile?.id, profile?.period]);

  useEffect(() => {
    if (!isClubProfile || !profile?.id) {
      setStash(null);
      setFeedback(null);
      return;
    }

    loadStash();
    // The stash should reload on profile changes, not on every callback identity change from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClubProfile, profile?.id]);

  useEffect(() => () => {
    clearAllTimers(groupSaveTimersRef.current);
    clearAllTimers(itemSaveTimersRef.current);
    clearAllTimers(itemImageSaveTimersRef.current);
  }, []);

  async function loadStash() {
    setLoading(true);
    setFeedback(null);

    try {
      if (!profileId) {
        return;
      }

      const payload = await getProfileStash(profileId);
      setStash(payload);
      const groups = payload?.groups || [];
      setGroupDrafts(Object.fromEntries(groups.map(group => [group.id, {
        name: group.name || '',
        description: group.description || '',
      }])));
      setGroupStatuses({});
      setGroupExpanded(prevState => ({
        ...prevState,
        ...Object.fromEntries(groups.map(group => [group.id, prevState[group.id] ?? true])),
      }));
      await Promise.all(groups.map(group => loadItems(group.id)));
    } catch (error) {
      setStash(null);
      setFeedback({
        variant: 'warning',
        text: t('profile.stash.loadFailed', 'Unable to load this club stash right now.'),
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadItems(groupId: Id) {
    setItemsLoading(prevState => ({ ...prevState, [groupId]: true }));

    try {
      const items = await getGroupItems(groupId);
      setItemsByGroup(prevState => ({ ...prevState, [groupId]: items || [] }));
      setItemDrafts(prevState => ({
        ...prevState,
        ...Object.fromEntries((items || []).map(item => [item.id, {
          name: item.name || '',
          description: item.description || '',
        }])),
      }));
      setItemStatuses(prevState => ({
        ...prevState,
        ...Object.fromEntries((items || []).map(item => [item.id, {
          name: null,
          description: null,
        }])),
      }));
      setItemExpanded(prevState => ({
        ...prevState,
        ...Object.fromEntries((items || []).map(item => [item.id, prevState[item.id] ?? true])),
      }));
      await hydrateSources(items || []);
      await Promise.all((items || []).map(item => loadItemImages(item.id)));
    } catch (error) {
      setItemsByGroup(prevState => ({ ...prevState, [groupId]: [] }));
    } finally {
      setItemsLoading(prevState => ({ ...prevState, [groupId]: false }));
    }
  }

  async function loadItemImages(itemId: Id) {
    setItemImagesLoading(prevState => ({ ...prevState, [itemId]: true }));

    try {
      const images = await getStashItemImages(itemId);
      const imageArray = Array.isArray(images) ? images : [];
      setItemImagesByItem(prevState => ({ ...prevState, [itemId]: imageArray }));
      setItemImageDrafts(prevState => ({
        ...prevState,
        ...Object.fromEntries(imageArray.map(image => [image.id, image.description || ''])),
      }));
      setItemImageStatuses(prevState => ({
        ...prevState,
        ...Object.fromEntries(imageArray.map(image => [image.id, null])),
      }));
    } catch (error) {
      setItemImagesByItem(prevState => ({ ...prevState, [itemId]: [] }));
    } finally {
      setItemImagesLoading(prevState => ({ ...prevState, [itemId]: false }));
    }
  }

  async function hydrateSources(items: StashItem[]) {
    const ids = Array.from(new Set<Id>(items.flatMap(item => item.sources || [])))
      .filter(id => !sourceDetails[id]);

    if (!ids.length) {
      return;
    }

    try {
      const sources = await getLibrarySourcesByIds(ids);
      setSourceDetails(prevState => ({
        ...prevState,
        ...buildSourceLookupMap(Array.isArray(sources) ? sources : []),
      }));
    } catch (error) {
      // ignore source hydration failures in the first pass
    }
  }

  async function handleCreateGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGroupSubmitting(true);
    setFeedback(null);

    try {
      if (!profileId) {
        return;
      }

      await createStashGroup(profileId, groupForm);
      setGroupForm(emptyGroupForm);
      setGroupCreateVisible(false);
      await loadStash();
      setFeedback({
        variant: 'success',
        text: t('profile.stash.groupCreateSuccess', 'Collection created.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.groupCreateFailed', 'Unable to create a collection.'),
      });
    } finally {
      setGroupSubmitting(false);
    }
  }

  function setGroupField(groupId: Id, field: FieldName, value: string) {
    setGroupDrafts(prevState => ({
      ...prevState,
      [groupId]: {
        ...prevState[groupId],
        [field]: value,
      },
    }));
    const group = (stash?.groups || []).find(entry => entry.id === groupId);
    setGroupStatuses(prevState => ({
      ...prevState,
      [groupId]: {
        ...(prevState[groupId] || {}),
        [field]: value === ((group?.[field] || '')) ? null : 'pending',
      },
    }));
    const timerKey = `${groupId}:${field}`;
    clearTimer(groupSaveTimersRef.current, timerKey);
    groupSaveTimersRef.current[timerKey] = window.setTimeout(() => {
      handleSaveGroupField(group, field);
    }, 1800);
  }

  async function handleSaveGroupField(group: StashGroup | undefined, field: FieldName) {
    if (!group) {
      return;
    }
    const draft = groupDrafts[group.id]?.[field] || '';
    const persisted = group?.[field] || '';
    const timerKey = `${group.id}:${field}`;
    clearTimer(groupSaveTimersRef.current, timerKey);
    if (draft === persisted) {
      setGroupStatuses(prevState => ({
        ...prevState,
        [group.id]: {
          ...(prevState[group.id] || {}),
          [field]: null,
        },
      }));
      return;
    }

    try {
      setGroupStatuses(prevState => ({
        ...prevState,
        [group.id]: {
          ...(prevState[group.id] || {}),
          [field]: 'saving',
        },
      }));
      if (field === 'name') {
        await updateStashGroupName(group.id, draft);
      } else {
        await updateStashGroupDescription(group.id, draft);
      }
      setStash(prevState => ({
        ...prevState,
        groups: (prevState?.groups || []).map(entry => entry.id === group.id ? { ...entry, [field]: draft } : entry),
      }));
      setGroupStatuses(prevState => ({
        ...prevState,
        [group.id]: {
          ...(prevState[group.id] || {}),
          [field]: 'saved',
        },
      }));
      window.setTimeout(() => {
        setGroupStatuses(prevState => ({
          ...prevState,
          [group.id]: {
            ...(prevState[group.id] || {}),
            [field]: null,
          },
        }));
      }, 1000);
    } catch (error) {
      setGroupDrafts(prevState => ({
        ...prevState,
        [group.id]: {
          ...prevState[group.id],
          [field]: persisted,
        },
      }));
      setGroupStatuses(prevState => ({
        ...prevState,
        [group.id]: {
          ...(prevState[group.id] || {}),
          [field]: 'error',
        },
      }));
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.groupSaveFailed', 'Unable to save collection changes.'),
      });
    }
  }

  function openCreateItem(group: StashGroup) {
    setItemCreateTarget(group);
    setItemCreateForm(emptyItemForm(group?.items?.[0]?.classification || 'OTHER'));
  }

  function toggleGroupExpanded(groupId: Id) {
    setGroupExpanded(prevState => ({ ...prevState, [groupId]: !(prevState[groupId] ?? true) }));
  }

  function toggleItemExpanded(itemId: Id) {
    setItemExpanded(prevState => ({ ...prevState, [itemId]: !(prevState[itemId] ?? true) }));
  }

  function toggleSourceSearchVisible(itemId: Id) {
    setSourceSearchVisible(prevState => ({ ...prevState, [itemId]: !prevState[itemId] }));
  }

  async function handleCreateItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemCreateTarget) {
      return;
    }

    if (!profile) {
      return;
    }

    const targetGroupId = itemCreateTarget.id;
    const payload = {
      ...itemCreateForm,
      period: profile.period,
    };

    setItemCreateSubmitting(true);
    setFeedback(null);
    setItemCreateTarget(null);
    setItemCreateForm(emptyItemForm(profile?.period));
    setItemCreatePendingByGroup(prevState => ({ ...prevState, [targetGroupId]: true }));

    try {
      await createStashItem(targetGroupId, payload);
      await wait(1000);
      await loadItems(targetGroupId);
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemCreateFailed', 'Unable to add this item.'),
      });
    } finally {
      setItemCreatePendingByGroup(prevState => ({ ...prevState, [targetGroupId]: false }));
      setItemCreateSubmitting(false);
    }
  }

  function setItemField(item: StashItem, field: FieldName, value: string) {
    setItemDrafts(prevState => ({
      ...prevState,
      [item.id]: {
        ...prevState[item.id],
        [field]: value,
      },
    }));
    setItemStatuses(prevState => ({
      ...prevState,
      [item.id]: {
        ...(prevState[item.id] || {}),
        [field]: value === ((item?.[field] || '')) ? null : 'pending',
      },
    }));
    const timerKey = `${item.id}:${field}`;
    clearTimer(itemSaveTimersRef.current, timerKey);
    itemSaveTimersRef.current[timerKey] = window.setTimeout(() => {
      handleSaveItemField(item, field);
    }, 1800);
  }

  async function handleSaveItemField(item: StashItem, field: FieldName) {
    const draft = itemDrafts[item.id]?.[field] || '';
    const persisted = item?.[field] || '';
    const timerKey = `${item.id}:${field}`;
    clearTimer(itemSaveTimersRef.current, timerKey);
    if (draft === persisted) {
      setItemStatuses(prevState => ({
        ...prevState,
        [item.id]: {
          ...(prevState[item.id] || {}),
          [field]: null,
        },
      }));
      return;
    }

    try {
      setItemStatuses(prevState => ({
        ...prevState,
        [item.id]: {
          ...(prevState[item.id] || {}),
          [field]: 'saving',
        },
      }));
      if (field === 'name') {
        await updateStashItemName(item.id, draft);
      } else {
        await updateStashItemDescription(item.id, draft);
      }
      setItemsByGroup(prevState => ({
        ...prevState,
        [item.itemGroup.id]: (prevState[item.itemGroup.id] || []).map(entry => entry.id === item.id ? { ...entry, [field]: draft } : entry),
      }));
      setItemStatuses(prevState => ({
        ...prevState,
        [item.id]: {
          ...(prevState[item.id] || {}),
          [field]: 'saved',
        },
      }));
      window.setTimeout(() => {
        setItemStatuses(prevState => ({
          ...prevState,
          [item.id]: {
            ...(prevState[item.id] || {}),
            [field]: null,
          },
        }));
      }, 1000);
    } catch (error) {
      setItemDrafts(prevState => ({
        ...prevState,
        [item.id]: {
          ...prevState[item.id],
          [field]: persisted,
        },
      }));
      setItemStatuses(prevState => ({
        ...prevState,
        [item.id]: {
          ...(prevState[item.id] || {}),
          [field]: 'error',
        },
      }));
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemSaveFailed', 'Unable to save item changes.'),
      });
    }
  }

  async function handleDeleteItem(item: StashItem) {
    try {
      await deleteStashItem(item.id);
      await loadItems(item.itemGroup.id);
      setItemExpanded(prevState => {
        const nextState = { ...prevState };
        delete nextState[item.id];
        return nextState;
      });
      setSourceSearchVisible(prevState => {
        const nextState = { ...prevState };
        delete nextState[item.id];
        return nextState;
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemDeleteFailed', 'Unable to delete this item.'),
      });
    }
  }

  async function handleDeleteGroup(group: StashGroup) {
    try {
      await deleteStashGroup(group.id);
      await loadStash();
      setGroupExpanded(prevState => {
        const nextState = { ...prevState };
        delete nextState[group.id];
        return nextState;
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.groupDeleteFailed', 'Unable to delete this collection.'),
      });
    }
  }

  async function handleUploadItemImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = itemImageInputRef.current?.files?.[0];

    if (!file || !itemImageUploadTarget) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemImageChooseFile', 'Choose an image to upload.'),
      });
      return;
    }

    setItemImageUploading(true);
    setFeedback(null);

    try {
      const content = await readFileAsBase64(file);
      await uploadStashItemImage(itemImageUploadTarget.id, {
        content,
        fileName: file.name,
        description: itemImageDescription || null,
      });
      if (itemImageInputRef.current) {
        itemImageInputRef.current.value = '';
      }
      setItemImageDescription('');
      setItemImageUploadTarget(null);
      await loadItemImages(itemImageUploadTarget.id);
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemImageUploadFailed', 'Unable to upload this image.'),
      });
    } finally {
      setItemImageUploading(false);
    }
  }

  function handleOpenReplaceItemImagePicker(item: StashItem, image: StashItemImage) {
    replacingItemImageRef.current = { itemId: item.id, image };
    if (replaceItemImageInputRef.current) {
      replaceItemImageInputRef.current.value = '';
      replaceItemImageInputRef.current.click();
    }
  }

  async function handleReplaceItemImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const target = replacingItemImageRef.current;

    if (!file || !target) {
      return;
    }

    setItemImageUploading(true);
    setFeedback(null);

    try {
      const content = await readFileAsBase64(file);
      await uploadStashItemImage(target.itemId, {
        content,
        fileName: file.name,
        description: itemImageDrafts[target.image.id] ?? target.image.description ?? null,
      });
      await deleteStashItemImage(target.itemId, target.image.id);
      await loadItemImages(target.itemId);
      setFeedback({
        variant: 'success',
        text: t('profile.stash.itemImageReplaceSuccess', 'Image replaced.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemImageReplaceFailed', 'Unable to replace this image.'),
      });
    } finally {
      setItemImageUploading(false);
      replacingItemImageRef.current = null;
      event.target.value = '';
    }
  }

  function clearItemImageSaveTimer(imageId: Id) {
    clearTimer(itemImageSaveTimersRef.current, String(imageId));
  }

  const resetItemImageStatusLater = (imageId: Id, delay = 1000) => {
    window.setTimeout(() => {
      setItemImageStatuses(prevState => ({
        ...prevState,
        [imageId]: null,
      }));
    }, delay);
  };

  async function handleDeleteItemImage(itemId: Id, imageId: Id) {
    try {
      await deleteStashItemImage(itemId, imageId);
      clearItemImageSaveTimer(imageId);
      await loadItemImages(itemId);
      setFeedback({
        variant: 'success',
        text: t('profile.stash.itemImageDeleteSuccess', 'Image deleted.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemImageDeleteFailed', 'Unable to delete this image.'),
      });
    }
  }

  async function handleUpdateItemImageDescription(itemId: Id, imageId: Id, nextValue = itemImageDrafts[imageId] || '') {
    const persistedValue = (itemImagesByItem[itemId] || []).find(image => image.id === imageId)?.description || '';
    if ((nextValue || '') === persistedValue) {
      setItemImageStatuses(prevState => ({
        ...prevState,
        [imageId]: null,
      }));
      return;
    }

    try {
      setItemImageStatuses(prevState => ({
        ...prevState,
        [imageId]: 'saving',
      }));
      await updateStashItemImageDescription(itemId, imageId, nextValue);
      setItemImagesByItem(prevState => ({
        ...prevState,
        [itemId]: (prevState[itemId] || []).map(image => (
          image.id === imageId ? { ...image, description: nextValue } : image
        )),
      }));
      setItemImageStatuses(prevState => ({
        ...prevState,
        [imageId]: 'saved',
      }));
      resetItemImageStatusLater(imageId);
    } catch (error) {
      setItemImageDrafts(prevState => ({
        ...prevState,
        [imageId]: persistedValue,
      }));
      setItemImageStatuses(prevState => ({
        ...prevState,
        [imageId]: 'error',
      }));
      resetItemImageStatusLater(imageId, 1500);
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemImageDescriptionFailed', 'Unable to save image description.'),
      });
    }
  }

  function handleItemImageDescriptionChange(itemId: Id, imageId: Id, value: string) {
    setItemImageDrafts(prevState => ({
      ...prevState,
      [imageId]: value,
    }));
    setItemImageStatuses(prevState => ({
      ...prevState,
      [imageId]: value === ((itemImagesByItem[itemId] || []).find(image => image.id === imageId)?.description || '') ? null : 'pending',
    }));
    clearItemImageSaveTimer(imageId);
    itemImageSaveTimersRef.current[imageId] = window.setTimeout(() => {
      handleUpdateItemImageDescription(itemId, imageId, value);
    }, 1800);
  }

  function handleItemImageDescriptionBlur(itemId: Id, imageId: Id) {
    clearItemImageSaveTimer(imageId);
    handleUpdateItemImageDescription(itemId, imageId);
  }

  async function handleSearchSources(item: StashItem) {
    const query = sourceSearch[item.id]?.query || '';
    setSourceSearch(prevState => ({
      ...prevState,
      [item.id]: {
        ...(prevState[item.id] || {}),
        loading: true,
        error: null,
      },
    }));

    try {
      const results = await searchLibrarySources({
        query,
        period: item.period,
        classifications: item.classification ? [item.classification] : [],
        types: ALL_SOURCE_TYPES,
      });
      setSourceSearch(prevState => ({
        ...prevState,
        [item.id]: {
          ...(prevState[item.id] || {}),
          loading: false,
          results: Array.isArray(results) ? results : [],
          error: null,
        },
      }));
    } catch (error) {
      setSourceSearch(prevState => ({
        ...prevState,
        [item.id]: {
          ...(prevState[item.id] || {}),
          loading: false,
          results: [],
          error: t('profile.stash.sourceSearchFailed', 'Unable to search library sources.'),
        },
      }));
    }
  }

  async function handleLinkSource(item: StashItem, sourceId: Id) {
    try {
      await linkStashItemSource(item.id, sourceId);
      await loadItems(item.itemGroup.id);
      setSourceSearchVisible(prevState => ({ ...prevState, [item.id]: false }));
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.sourceLinkFailed', 'Unable to link this source.'),
      });
    }
  }

  async function handleUnlinkSource(item: StashItem, sourceId: Id) {
    try {
      await unlinkStashItemSource(item.id, sourceId);
      await loadItems(item.itemGroup.id);
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.sourceUnlinkFailed', 'Unable to unlink this source.'),
      });
    }
  }

  if (!isClubProfile) {
    return null;
  }

  const groups = stash?.groups || [];
  const totalItems = groups.reduce((count, group) => count + (itemsByGroup[group.id] || []).length, 0);
  const totalSources = groups.reduce((count, group) => (
    count + (itemsByGroup[group.id] || []).reduce((itemCount, item) => itemCount + (item.sources || []).length, 0)
  ), 0);
  const loadedImageCount = Object.values(itemImagesByItem).reduce((count, images) => count + (images || []).length, 0);
  const headerStats = [
    `${groups.length} ${t('profile.stash.collectionsCount', 'collection(s)')}`,
    `${totalItems} ${t('profile.stash.itemsCount', 'item(s)')}`,
    `${totalSources} ${t('profile.stash.sourcesCount', 'source(s)')}`,
    loadedImageCount ? `${loadedImageCount} ${t('profile.stash.imagesCount', 'image(s)')}` : null,
  ].filter(Boolean);

  return (
    <div className={embedded ? 'mt-4 pt-2' : ''}>
      <div className="stash-shell p-3 p-lg-4">

        {feedback && <Alert variant={feedback.variant} className="py-2">{feedback.text}</Alert>}
        {loading && <Spinner size="sm" />}

        {!loading && (
          <div className="stash-summary-header d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4">
            <div style={{ minWidth: 0 }}>
              <div className="fw-semibold">
                {t('profile.stash.collectionsTitle', 'Collections')}
              </div>
              <div className="small text-muted mt-1">
                {t('profile.stash.summary', 'Track collections, item images, and linked library sources for this club profile.')}
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
                {headerStats.map(stat => (
                  <span
                    key={stat}
                    className="stash-meta-chip"
                  >
                    {stat}
                  </span>
                ))}
              </div>
            </div>
            {isEditable && (
              <PlusActionButton
                title={t('profile.stash.groupCreate', 'Create collection')}
                onClick={() => {
                  setFeedback(null);
                  setGroupForm(emptyGroupForm);
                  setGroupCreateVisible(true);
                }}
              />
            )}
          </div>
        )}

        {!loading && !groups.length && (
          <div className="py-5 px-3 text-center" style={{ backgroundColor: '#fffdf8', border: '1px dashed #d9ccb8' }}>
            <div className="fw-semibold mb-1">
              {t('profile.stash.emptyTitle', 'No collections yet')}
            </div>
            <div className="small text-muted mb-3">
              {t('profile.stash.empty', 'Start by creating the first group of belongings.')}
            </div>
            {isEditable && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  setFeedback(null);
                  setGroupForm(emptyGroupForm);
                  setGroupCreateVisible(true);
                }}
              >
                {t('profile.stash.groupCreateFirst', 'Create first collection')}
              </Button>
            )}
          </div>
        )}

        <div className="d-grid gap-4">
          {groups.map(group => {
            const items = itemsByGroup[group.id] || [];
            const isItemCreatePending = itemCreatePendingByGroup[group.id] || false;
            const searchStateByItem = sourceSearch;
            const loadedGroupImageCount = items.reduce(
              (count, item) => count + ((itemImagesByItem[item.id] || []).length),
              0
            );
            const hasLoadedGroupImages = items.some(item => Object.prototype.hasOwnProperty.call(itemImagesByItem, item.id));
            const groupSourceCount = items.reduce((count, item) => count + (item.sources || []).length, 0);
            const groupMetadata = [
              `${items.length} ${t('profile.stash.itemsCount', 'item(s)')}`,
              `${groupSourceCount} ${t('profile.stash.sourcesCount', 'source(s)')}`,
              hasLoadedGroupImages ? `${loadedGroupImageCount} ${t('profile.stash.imagesCount', 'image(s)')}` : null,
            ].filter(Boolean);
            const isGroupExpanded = groupExpanded[group.id] ?? true;
            const groupDescription = groupDrafts[group.id]?.description || group.description || '';
            const groupDescriptionMissing = !groupDescription;
            const groupDescriptionDisplay = groupDescription || t('profile.stash.noDescription', 'No description');

            return (
              <section
                key={group.id}
                className="stash-collection-section p-3 p-lg-4"
              >
                <div className={`stash-collection-header d-flex justify-content-between align-items-start gap-3 flex-wrap ${isGroupExpanded ? 'mb-3' : ''}`}>
                  <button
                    type="button"
                    className="stash-heading-toggle"
                    onClick={() => toggleGroupExpanded(group.id)}
                    aria-expanded={isGroupExpanded}
                  >
                    <span className="stash-chevron">
                      {isGroupExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                    </span>
                    <span className="d-block" style={{ minWidth: 0 }}>
                      <span className="d-block fw-semibold fs-5">{groupDrafts[group.id]?.name || group.name}</span>
                      <span className={`d-block small mt-1 ${groupDescriptionMissing ? 'description-placeholder' : 'text-muted'}`.trim()}>
                        {groupDescriptionDisplay}
                      </span>
                      <span className="stash-meta-row mt-2">
                        {groupMetadata.map(value => (
                          <span key={value} className="stash-meta-chip">{value}</span>
                        ))}
                      </span>
                    </span>
                  </button>
                  {isEditable && (
                    <div className="d-flex align-items-center gap-2">
                      <PlusActionButton
                        title={t('profile.stash.itemCreate', 'Add item')}
                        onClick={() => openCreateItem(group)}
                      />
                      <ConfirmingTrashButton
                        title={t('profile.stash.groupDelete', 'Delete collection')}
                        confirmTitle={t('profile.stash.groupDelete', 'Delete collection')}
                        confirmMessage={t('profile.stash.groupDeleteConfirm', 'Delete this collection and all of its items?')}
                        onConfirm={() => handleDeleteGroup(group)}
                        borderColor="#c77d7d"
                        color="#8e2323"
                        backgroundColor="#fff"
                        size="1.9rem"
                        fontSize="0.9rem"
                      />
                    </div>
                  )}
                </div>

                {isGroupExpanded && (
                  <div>
                    {isEditable && (
                      <Row className="stash-edit-strip g-2 mb-3">
                        <Col md={4}>
                          <EditableTextFieldRow
                            label=""
                            editable
                            value={groupDrafts[group.id]?.name || ''}
                            readOnlyValue={group.name}
                            onChange={event => setGroupField(group.id, 'name', event.target.value)}
                            onBlur={() => handleSaveGroupField(group, 'name')}
                            status={groupStatuses[group.id]?.name}
                            className=""
                            fieldMaxWidth="100%"
                          />
                        </Col>
                        <Col md={6}>
                          <EditableTextFieldRow
                            label=""
                            editable
                            value={groupDrafts[group.id]?.description || ''}
                            readOnlyValue={groupDescriptionDisplay}
                            readOnlyInputValue={groupDescriptionDisplay}
                            placeholderDisplay={groupDescriptionMissing}
                            placeholder={t('profile.stash.noDescription', 'No description')}
                            onChange={event => setGroupField(group.id, 'description', event.target.value)}
                            onBlur={() => handleSaveGroupField(group, 'description')}
                            status={groupStatuses[group.id]?.description}
                            className=""
                            fieldMaxWidth="100%"
                          />
                        </Col>
                      </Row>
                    )}
                    <div className="stash-subheading">
                      {t('profile.stash.itemsTitle', 'Items')}
                    </div>

                    {itemsLoading[group.id] && !isItemCreatePending && <Spinner size="sm" />}
                    {!itemsLoading[group.id] && !isItemCreatePending && !items.length && (
                      <div className="py-4 px-3 text-center" style={{ backgroundColor: '#fffdf8', border: '1px dashed #e3d8c6' }}>
                        <div className="small fw-semibold mb-1">
                          {t('profile.stash.itemsEmptyTitle', 'No items yet')}
                        </div>
                        <div className="small text-muted mb-3">
                          {t('profile.stash.itemsEmpty', 'Add the first item to this collection.')}
                        </div>
                        {isEditable && (
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => openCreateItem(group)}
                          >
                            {t('profile.stash.itemCreateFirst', 'Add first item')}
                          </Button>
                        )}
                      </div>
                    )}

                    <Row className="g-3">
                      {isItemCreatePending && (
                        <Col lg={6}>
                          <article className="stash-item-card stash-item-pending-card p-3 d-flex align-items-center justify-content-center">
                            <div className="d-flex align-items-center gap-2 small text-muted">
                              <Spinner size="sm" />
                              <span>{t('profile.stash.itemAdding', 'Adding item...')}</span>
                            </div>
                          </article>
                        </Col>
                      )}
                      {items.map(item => {
                        const sourceState = searchStateByItem[item.id] || {};
                        const hasLoadedImages = Object.prototype.hasOwnProperty.call(itemImagesByItem, item.id);
                        const itemMetadata = [
                          getClassificationLabel(intl, item.classification),
                          `${(item.sources || []).length} ${t('profile.stash.sourcesCount', 'source(s)')}`,
                          hasLoadedImages ? `${(itemImagesByItem[item.id] || []).length} ${t('profile.stash.imagesCount', 'image(s)')}` : null,
                        ].filter(Boolean);
                        const isItemExpanded = itemExpanded[item.id] ?? true;
                        const isSourceSearchVisible = sourceSearchVisible[item.id] || false;
                        const itemDescription = itemDrafts[item.id]?.description || item.description || '';
                        const itemDescriptionMissing = !itemDescription;
                        const itemDescriptionDisplay = itemDescription || t('profile.stash.noDescription', 'No description');

                        return (
                          <Col lg={6} key={item.id}>
                            <article className="stash-item-card p-3 position-relative">
                            {isEditable && (
                              <div className="position-absolute top-0 end-0 mt-2 me-2">
                                <ConfirmingTrashButton
                                  title={t('profile.stash.delete', 'Delete')}
                                  confirmTitle={t('profile.stash.itemDelete', 'Delete item')}
                                  confirmMessage={t('profile.stash.itemDeleteConfirm', 'Delete this item?')}
                                  onConfirm={() => handleDeleteItem(item)}
                                  borderColor="#c77d7d"
                                  color="#8e2323"
                                  backgroundColor="#fff"
                                  size="1.9rem"
                                  fontSize="0.9rem"
                                />
                              </div>
                            )}

                            <button
                              type="button"
                              className={`stash-heading-toggle stash-item-toggle ${isItemExpanded ? 'mb-3' : ''}`}
                              onClick={() => toggleItemExpanded(item.id)}
                              aria-expanded={isItemExpanded}
                            >
                              <span className="stash-chevron">
                                {isItemExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                              </span>
                              <span className="d-block">
                                <span className="d-block fw-semibold">{item.name}</span>
                                <span className={`d-block small mt-1 ${itemDescriptionMissing ? 'description-placeholder' : 'text-muted'}`.trim()}>
                                  {itemDescriptionDisplay}
                                </span>
                                <span className="stash-meta-row mt-2">
                                  {itemMetadata.map(value => (
                                    <span key={value} className="stash-meta-chip stash-meta-chip-soft">{value}</span>
                                  ))}
                                </span>
                              </span>
                            </button>

                              {isItemExpanded && (
                                <div className="stash-item-content">
                                  <Row className="g-3 align-items-start">
                                    <Col md={7}>
                                      <div className="stash-item-display-copy">
                                        <InlineEditableText
                                          editable={isEditable}
                                          value={itemDrafts[item.id]?.name || ''}
                                          readOnlyValue={item.name}
                                          onChange={event => setItemField(item, 'name', event.target.value)}
                                          onBlur={() => handleSaveItemField(item, 'name')}
                                          status={itemStatuses[item.id]?.name}
                                          textClassName="stash-item-title"
                                        />
                                        <InlineEditableText
                                          editable={isEditable}
                                          value={itemDrafts[item.id]?.description || ''}
                                          readOnlyValue={itemDescriptionDisplay}
                                          onChange={event => setItemField(item, 'description', event.target.value)}
                                          onBlur={() => handleSaveItemField(item, 'description')}
                                          status={itemStatuses[item.id]?.description}
                                          textClassName="stash-item-description"
                                          placeholderDisplay={itemDescriptionMissing}
                                          placeholder={t('profile.stash.noDescription', 'No description')}
                                          className="mt-1"
                                        />
                                      </div>
                                    </Col>
                                    <Col md={5}>
                                      <div className="stash-image-stack-panel">
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                          <div className="stash-subheading mb-0">
                                            {t('profile.stash.imagesTitle', 'Images')}
                                          </div>
                                          {isEditable && (
                                            <PlusActionButton
                                              title={t('profile.stash.itemImageUpload', 'Upload image')}
                                              onClick={() => {
                                                setFeedback(null);
                                                setItemImageDescription('');
                                                setItemImageUploadTarget(item);
                                              }}
                                            />
                                          )}
                                        </div>
                                        {itemImagesLoading[item.id] && <Spinner size="sm" />}
                                        {!itemImagesLoading[item.id] && (isEditable || hasLoadedImages) && (
                                          <StackedImageGallery
                                            images={itemImagesByItem[item.id] || []}
                                            title={item.name || undefined}
                                            emptyText={t('profile.stash.imagesEmpty', 'No images uploaded for this item yet.')}
                                            previewSize="compact"
                                            editable={isEditable}
                                            onDeleteImage={isEditable ? imageId => handleDeleteItemImage(item.id, imageId) : undefined}
                                            onReplaceImage={isEditable ? image => handleOpenReplaceItemImagePicker(item, image) : undefined}
                                            imageDrafts={itemImageDrafts}
                                            imageStatuses={itemImageStatuses}
                                            onDescriptionChange={(imageId, value) => handleItemImageDescriptionChange(item.id, imageId, value)}
                                            onDescriptionBlur={imageId => handleItemImageDescriptionBlur(item.id, imageId)}
                                          />
                                        )}
                                      </div>
                                    </Col>
                                    <Col xs={12}>
                                      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                                        <div className="stash-subheading mb-0 text-start">
                                          {t('profile.stash.sourcesTitle', 'Sources')}
                                        </div>
                                        {isEditable && (
                                          <Button
                                            type="button"
                                            variant="link"
                                            className="stash-text-action"
                                            onClick={() => toggleSourceSearchVisible(item.id)}
                                          >
                                            {isSourceSearchVisible ? t('profile.action.done', 'Done') : t('profile.stash.sourceAdd', 'Add source')}
                                          </Button>
                                        )}
                                      </div>

                                      {(item.sources || []).length === 0 && (
                                        <div className="small text-muted mb-2">
                                          {t('profile.stash.sourcesEmpty', 'No supporting sources linked yet.')}
                                        </div>
                                      )}

                                      <div className="stash-source-chip-row">
                                        {(item.sources || []).map(sourceId => {
                                          const source = sourceDetails[sourceId];
                                          return (
                                            <span key={sourceId} className="stash-source-chip">
                                              {source ? (
                                                <Link to={`/library/source/${sourceId}`} className="text-decoration-none">
                                                  {source.name}
                                                </Link>
                                              ) : (
                                                <span className="text-muted">#{sourceId}</span>
                                              )}
                                              {isEditable && (
                                                <button
                                                  type="button"
                                                  className="stash-source-chip-remove"
                                                  onClick={() => handleUnlinkSource(item, sourceId)}
                                                  aria-label={t('profile.stash.sourceUnlink', 'Unlink source')}
                                                >
                                                  <UnlinkIcon />
                                                </button>
                                              )}
                                            </span>
                                          );
                                        })}
                                      </div>

                                      {isEditable && isSourceSearchVisible && (
                                        <div className="stash-source-search-panel mt-3">
                                          <div className="input-group input-group-sm mb-2">
                                            <Form.Control
                                              value={sourceState.query || ''}
                                              onChange={event => setSourceSearch(prevState => ({
                                                ...prevState,
                                                [item.id]: {
                                                  ...(prevState[item.id] || {}),
                                                  query: event.target.value,
                                                },
                                              }))}
                                              placeholder={t('profile.stash.sourceSearchPlaceholder', 'Find matching library sources')}
                                            />
                                            <SearchActionButton
                                              title={t('profile.stash.search', 'Search')}
                                              onClick={() => handleSearchSources(item)}
                                              className="rounded-0 rounded-end"
                                              borderColor="#ced4da"
                                              color="#495057"
                                            />
                                          </div>
                                          {sourceState.error && <div className="small text-danger mb-2">{sourceState.error}</div>}
                                          {sourceState.loading && <Spinner size="sm" />}
                                          {(sourceState.results || []).length > 0 && (
                                            <div className="d-grid gap-2">
                                              {(sourceState.results || []).map(source => (
                                                <div key={source.id} className="stash-source-result">
                                                  <div className="small">
                                                    <Link to={`/library/source/${source.id}`} className="fw-semibold text-decoration-none">
                                                      {source.name}
                                                    </Link>
                                                    <div className="text-muted">{getTypeLabel(intl, source.type)}</div>
                                                  </div>
                                                  <Button
                                                    size="sm"
                                                    variant="outline-secondary"
                                                    disabled={(item.sources || []).includes(source.id)}
                                                    onClick={() => handleLinkSource(item, source.id)}
                                                  >
                                                    <LinkIcon className="me-2" />
                                                    {t('profile.stash.link', 'Link')}
                                                  </Button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </Col>
                                  </Row>
                                </div>
                              )}
                            </article>
                          </Col>
                        );
                      })}
                    </Row>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <Modal show={Boolean(itemCreateTarget)} onHide={() => setItemCreateTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('profile.stash.itemCreate', 'Add item')}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateItem}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('profile.stash.itemName', 'Item name')}</Form.Label>
              <Form.Control
                value={itemCreateForm.name}
                onChange={event => setItemCreateForm(prevState => ({ ...prevState, name: event.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('profile.stash.itemDescription', 'Description')}</Form.Label>
              <Form.Control
                value={itemCreateForm.description}
                onChange={event => setItemCreateForm(prevState => ({ ...prevState, description: event.target.value }))}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{t('profile.stash.itemClassification', 'Classification')}</Form.Label>
              <Form.Select
                value={itemCreateForm.classification}
                onChange={event => setItemCreateForm(prevState => ({ ...prevState, classification: event.target.value }))}
              >
                {['ARMOR', 'CLOTHING', 'FOOTWEAR', 'HOUSEHOLD', 'WEAPON', 'OTHER'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="small text-muted">
              {t('profile.stash.itemPeriodInherited', 'Period is inherited from the club profile')}: {getPeriodLabel(profile?.period)}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setItemCreateTarget(null)}>
              {t('profile.action.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="secondary" disabled={itemCreateSubmitting || !itemCreateForm.name.trim()}>
              {t('profile.stash.itemCreate', 'Add item')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {isEditable && (
        <>
          <Form.Control
            ref={replaceItemImageInputRef}
            type="file"
            accept="image/*"
            onChange={handleReplaceItemImage}
            className="d-none"
          />
          <Modal
            show={Boolean(itemImageUploadTarget)}
            onHide={() => {
              if (!itemImageUploading) {
                setItemImageUploadTarget(null);
              }
            }}
            centered
          >
            <Modal.Header closeButton={!itemImageUploading}>
              <Modal.Title>{t('profile.stash.itemImageUpload', 'Upload image')}</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleUploadItemImage}>
              <Modal.Body>
                <Form.Group className="mb-3">
                  <Form.Label>{t('profile.stash.itemImageFile', 'Image file')}</Form.Label>
                  <Form.Control ref={itemImageInputRef} type="file" accept="image/*" />
                </Form.Group>
                <Form.Group>
                  <Form.Label>{t('profile.stash.itemImageDescription', 'Description')}</Form.Label>
                  <Form.Control
                    value={itemImageDescription}
                    onChange={event => setItemImageDescription(event.target.value)}
                    placeholder={t('profile.stash.itemImageDescriptionPlaceholder', 'Optional description')}
                  />
                </Form.Group>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={() => setItemImageUploadTarget(null)}
                  disabled={itemImageUploading}
                >
                  {t('profile.action.cancel', 'Cancel')}
                </Button>
                <Button type="submit" variant="secondary" disabled={itemImageUploading}>
                  {itemImageUploading ? t('profile.stash.itemImageUploading', 'Uploading...') : t('profile.stash.itemImageUpload', 'Upload image')}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal>
        </>
      )}

      <Modal
        show={groupCreateVisible}
        onHide={() => {
          if (!groupSubmitting) {
            setGroupCreateVisible(false);
          }
        }}
        centered
      >
        <Modal.Header closeButton={!groupSubmitting}>
          <Modal.Title>{t('profile.stash.groupCreate', 'Create collection')}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateGroup}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('profile.stash.groupName', 'Collection name')}</Form.Label>
              <Form.Control
                value={groupForm.name}
                onChange={event => setGroupForm(prevState => ({ ...prevState, name: event.target.value }))}
                placeholder={t('profile.stash.groupNamePlaceholder', 'Helmet, camp, wardrobe...')}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>{t('profile.stash.groupDescription', 'Collection note')}</Form.Label>
              <Form.Control
                value={groupForm.description}
                onChange={event => setGroupForm(prevState => ({ ...prevState, description: event.target.value }))}
                placeholder={t('profile.stash.groupDescriptionPlaceholder', 'What this collection covers')}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              variant="outline-secondary"
              onClick={() => setGroupCreateVisible(false)}
              disabled={groupSubmitting}
            >
              {t('profile.action.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="secondary" disabled={groupSubmitting || !groupForm.name.trim()}>
              {groupSubmitting ? t('profile.stash.groupCreating', 'Creating...') : t('profile.stash.groupCreate', 'Create collection')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}





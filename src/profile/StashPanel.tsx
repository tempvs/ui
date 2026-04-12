import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Col, Form, Modal, Row } from 'react-bootstrap';
import { useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { FaLink, FaTrashAlt, FaUnlink } from 'react-icons/fa';

import DisclosureCard from '../component/DisclosureCard';
import EditableTextFieldRow from '../component/EditableTextFieldRow';
import EditableTextareaFieldRow from '../component/EditableTextareaFieldRow';
import IconActionButton from '../component/IconActionButton';
import PlusActionButton from '../component/PlusActionButton';
import SearchActionButton from '../component/SearchActionButton';
import Spinner from '../component/Spinner';
import StackedImageGallery from '../component/StackedImageGallery';
import { getClassificationLabel, getTypeLabel } from '../library/libraryShared';
import { readFileAsBase64 } from '../util/fileUtils';
import {
  createStashGroup,
  createStashItem,
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

const ALL_SOURCE_TYPES = ['WRITTEN', 'GRAPHIC', 'ARCHAEOLOGICAL', 'OTHER'];

const emptyGroupForm = { name: '', description: '' };
const LinkIcon = FaLink as React.ComponentType<{ className?: string }>;
const TrashIcon = FaTrashAlt as React.ComponentType;
const UnlinkIcon = FaUnlink as React.ComponentType;

const emptyItemForm = classification => ({
  name: '',
  description: '',
  classification: classification || 'OTHER',
});

function buildSourceLookupMap(sources) {
  return sources.reduce((accumulator, source) => ({
    ...accumulator,
    [source.id]: source,
  }), {});
}

export default function StashPanel({ profile, isEditable, t, getPeriodLabel, embedded = true }: any) {
  const intl = useIntl();
  const [stash, setStash] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [groupDrafts, setGroupDrafts] = useState<any>({});
  const [groupStatuses, setGroupStatuses] = useState<any>({});
  const [groupExpanded, setGroupExpanded] = useState<any>({});
  const [itemDrafts, setItemDrafts] = useState<any>({});
  const [itemStatuses, setItemStatuses] = useState<any>({});
  const [groupCreateVisible, setGroupCreateVisible] = useState(false);
  const [itemsByGroup, setItemsByGroup] = useState<any>({});
  const [itemsLoading, setItemsLoading] = useState<any>({});
  const [itemCreateTarget, setItemCreateTarget] = useState<any>(null);
  const [itemCreateForm, setItemCreateForm] = useState(emptyItemForm(profile?.period));
  const [itemCreateSubmitting, setItemCreateSubmitting] = useState(false);
  const [itemExpanded, setItemExpanded] = useState<any>({});
  const [sourceDetails, setSourceDetails] = useState<any>({});
  const [sourceSearch, setSourceSearch] = useState<any>({});
  const [itemImagesByItem, setItemImagesByItem] = useState<any>({});
  const [itemImagesLoading, setItemImagesLoading] = useState<any>({});
  const [itemImageDrafts, setItemImageDrafts] = useState<any>({});
  const [itemImageStatuses, setItemImageStatuses] = useState<any>({});
  const [itemImageUploadTarget, setItemImageUploadTarget] = useState<any>(null);
  const [itemImageDescription, setItemImageDescription] = useState('');
  const [itemImageUploading, setItemImageUploading] = useState(false);
  const groupSaveTimersRef = React.useRef<Record<string, number>>({});
  const itemSaveTimersRef = React.useRef<Record<string, number>>({});
  const itemImageSaveTimersRef = React.useRef<Record<string, number>>({});
  const itemImageInputRef = useRef<HTMLInputElement>(null);
  const replaceItemImageInputRef = useRef<HTMLInputElement>(null);
  const replacingItemImageRef = useRef<any>(null);

  const isClubProfile = profile?.type === 'CLUB';
  useEffect(() => {
    setGroupForm(emptyGroupForm);
    setGroupCreateVisible(false);
    setItemCreateTarget(null);
    setItemCreateForm(emptyItemForm(profile?.period));
    setItemImageUploadTarget(null);
    setItemImageDescription('');
    setSourceSearch({});
  }, [profile?.id, profile?.period]);

  useEffect(() => {
    if (!isClubProfile || !profile?.id) {
      setStash(null);
      setFeedback(null);
      return;
    }

    loadStash();
  }, [isClubProfile, profile?.id]);

  useEffect(() => () => {
    Object.values(groupSaveTimersRef.current).forEach(timerId => clearTimeout(timerId));
    Object.values(itemSaveTimersRef.current).forEach(timerId => clearTimeout(timerId));
    Object.values(itemImageSaveTimersRef.current).forEach(timerId => clearTimeout(timerId));
  }, []);

  async function loadStash() {
    setLoading(true);
    setFeedback(null);

    try {
      const payload = await getProfileStash(profile.id);
      setStash(payload);
      const groups = payload?.groups || [];
      setGroupDrafts(Object.fromEntries(groups.map(group => [group.id, {
        name: group.name || '',
        description: group.description || '',
      }])));
      setGroupStatuses({});
      setGroupExpanded(prevState => ({
        ...prevState,
        ...Object.fromEntries(groups.map(group => [group.id, prevState[group.id] || false])),
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

  async function loadItems(groupId) {
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
        ...Object.fromEntries((items || []).map(item => [item.id, prevState[item.id] || false])),
      }));
      await hydrateSources(items || []);
    } catch (error) {
      setItemsByGroup(prevState => ({ ...prevState, [groupId]: [] }));
    } finally {
      setItemsLoading(prevState => ({ ...prevState, [groupId]: false }));
    }
  }

  async function ensureItemImagesLoaded(itemId) {
    if (Object.prototype.hasOwnProperty.call(itemImagesByItem, itemId) || itemImagesLoading[itemId]) {
      return;
    }

    await loadItemImages(itemId);
  }

  async function loadItemImages(itemId) {
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

  async function hydrateSources(items) {
    const ids = Array.from(new Set<any>(items.flatMap(item => item.sources || [])))
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

  async function handleCreateGroup(event) {
    event.preventDefault();
    setGroupSubmitting(true);
    setFeedback(null);

    try {
      await createStashGroup(profile.id, groupForm);
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

  function setGroupField(groupId, field, value) {
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
    if (groupSaveTimersRef.current[timerKey]) {
      clearTimeout(groupSaveTimersRef.current[timerKey]);
    }
    groupSaveTimersRef.current[timerKey] = window.setTimeout(() => {
      handleSaveGroupField(group, field);
    }, 1800);
  }

  async function handleSaveGroupField(group, field) {
    if (!group) {
      return;
    }
    const draft = groupDrafts[group.id]?.[field] || '';
    const persisted = group?.[field] || '';
    const timerKey = `${group.id}:${field}`;
    if (groupSaveTimersRef.current[timerKey]) {
      clearTimeout(groupSaveTimersRef.current[timerKey]);
      delete groupSaveTimersRef.current[timerKey];
    }
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

  function openCreateItem(group) {
    setItemCreateTarget(group);
    setItemCreateForm(emptyItemForm(group?.items?.[0]?.classification || 'OTHER'));
  }

  async function handleCreateItem(event) {
    event.preventDefault();
    if (!itemCreateTarget) {
      return;
    }

    setItemCreateSubmitting(true);
    setFeedback(null);

    try {
      await createStashItem(itemCreateTarget.id, {
        ...itemCreateForm,
        period: profile.period,
      });
      setItemCreateTarget(null);
      setItemCreateForm(emptyItemForm(profile?.period));
      await loadItems(itemCreateTarget.id);
      await loadStash();
      setFeedback({
        variant: 'success',
        text: t('profile.stash.itemCreateSuccess', 'Item added.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemCreateFailed', 'Unable to add this item.'),
      });
    } finally {
      setItemCreateSubmitting(false);
    }
  }

  function setItemField(item, field, value) {
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
    if (itemSaveTimersRef.current[timerKey]) {
      clearTimeout(itemSaveTimersRef.current[timerKey]);
    }
    itemSaveTimersRef.current[timerKey] = window.setTimeout(() => {
      handleSaveItemField(item, field);
    }, 1800);
  }

  async function handleSaveItemField(item, field) {
    const draft = itemDrafts[item.id]?.[field] || '';
    const persisted = item?.[field] || '';
    const timerKey = `${item.id}:${field}`;
    if (itemSaveTimersRef.current[timerKey]) {
      clearTimeout(itemSaveTimersRef.current[timerKey]);
      delete itemSaveTimersRef.current[timerKey];
    }
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

  async function handleDeleteItem(item) {
    try {
      await deleteStashItem(item.id);
      setItemExpanded(prevState => {
        const nextState = { ...prevState };
        delete nextState[item.id];
        return nextState;
      });
      await loadItems(item.itemGroup.id);
      setFeedback({
        variant: 'success',
        text: t('profile.stash.itemDeleteSuccess', 'Item deleted.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.itemDeleteFailed', 'Unable to delete this item.'),
      });
    }
  }

  async function handleUploadItemImage(event) {
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

  function handleOpenReplaceItemImagePicker(item, image) {
    replacingItemImageRef.current = { itemId: item.id, image };
    if (replaceItemImageInputRef.current) {
      replaceItemImageInputRef.current.value = '';
      replaceItemImageInputRef.current.click();
    }
  }

  async function handleReplaceItemImage(event) {
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

  function clearItemImageSaveTimer(imageId) {
    if (itemImageSaveTimersRef.current[imageId]) {
      clearTimeout(itemImageSaveTimersRef.current[imageId]);
      delete itemImageSaveTimersRef.current[imageId];
    }
  }

  const resetItemImageStatusLater = (imageId, delay = 1000) => {
    window.setTimeout(() => {
      setItemImageStatuses(prevState => ({
        ...prevState,
        [imageId]: null,
      }));
    }, delay);
  };

  async function handleDeleteItemImage(itemId, imageId) {
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

  async function handleUpdateItemImageDescription(itemId, imageId, nextValue = itemImageDrafts[imageId] || '') {
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

  function handleItemImageDescriptionChange(itemId, imageId, value) {
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

  function handleItemImageDescriptionBlur(itemId, imageId) {
    clearItemImageSaveTimer(imageId);
    handleUpdateItemImageDescription(itemId, imageId);
  }

  async function handleSearchSources(item) {
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
        classifications: [item.classification],
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

  async function handleLinkSource(item, sourceId) {
    try {
      await linkStashItemSource(item.id, sourceId);
      await loadItems(item.itemGroup.id);
      setFeedback({
        variant: 'success',
        text: t('profile.stash.sourceLinkSuccess', 'Source linked.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.sourceLinkFailed', 'Unable to link this source.'),
      });
    }
  }

  async function handleUnlinkSource(item, sourceId) {
    try {
      await unlinkStashItemSource(item.id, sourceId);
      await loadItems(item.itemGroup.id);
      setFeedback({
        variant: 'success',
        text: t('profile.stash.sourceUnlinkSuccess', 'Source unlinked.'),
      });
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: t('profile.stash.sourceUnlinkFailed', 'Unable to unlink this source.'),
      });
    }
  }

  function toggleItemExpanded(itemId) {
    const nextExpanded = !itemExpanded[itemId];
    if (nextExpanded) {
      ensureItemImagesLoaded(itemId);
    }
    setItemExpanded(prevState => ({
      ...prevState,
      [itemId]: nextExpanded,
    }));
  }

  if (!isClubProfile) {
    return null;
  }

  const groups = stash?.groups || [];
  const totalItems = groups.reduce((count, group) => count + (itemsByGroup[group.id] || []).length, 0);
  const totalSources = groups.reduce((count, group) => (
    count + (itemsByGroup[group.id] || []).reduce((itemCount, item) => itemCount + (item.sources || []).length, 0)
  ), 0);
  const loadedImageCount = Object.values(itemImagesByItem).reduce((count, images: any) => count + (images || []).length, 0);
  const headerStats = [
    `${groups.length} ${t('profile.stash.collectionsCount', 'collection(s)')}`,
    `${totalItems} ${t('profile.stash.itemsCount', 'item(s)')}`,
    `${totalSources} ${t('profile.stash.sourcesCount', 'source(s)')}`,
    loadedImageCount ? `${loadedImageCount} ${t('profile.stash.imagesCount', 'image(s)')}` : null,
  ].filter(Boolean);

  return (
    <div className={embedded ? 'mt-4 pt-2' : ''}>
      <div className="p-3 p-lg-4 rounded border" style={{ backgroundColor: '#f7f4ee', borderColor: '#d9ccb8' }}>

        {feedback && <Alert variant={feedback.variant} className="py-2">{feedback.text}</Alert>}
        {loading && <Spinner size="sm" />}

        {!loading && (
          <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4 pb-3 border-bottom">
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
                    className="small px-2 py-1 border bg-white text-muted"
                    style={{ borderColor: '#e3d8c6' }}
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

        <div className="d-grid gap-3">
          {groups.map(group => {
            const items = itemsByGroup[group.id] || [];
            const searchStateByItem = sourceSearch;
            const isGroupExpanded = Boolean(groupExpanded[group.id]);
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

            return (
              <DisclosureCard
                key={group.id}
                className="bg-white"
                expanded={isGroupExpanded}
                onToggle={() => setGroupExpanded(prevState => ({
                  ...prevState,
                  [group.id]: !prevState[group.id],
                }))}
                style={{
                  borderColor: '#e3d8c6',
                }}
                summary={(
                  <>
                    <div className="fw-semibold">{groupDrafts[group.id]?.name || group.name}</div>
                    {(groupDrafts[group.id]?.description || group.description) && (
                      <div className="small text-muted mt-1">
                        {groupDrafts[group.id]?.description || group.description}
                      </div>
                    )}
                    <div className="small text-muted mt-2">
                      {groupMetadata.join(' \u2022 ')}
                    </div>
                  </>
                )}
              >
                <div className="mt-3">
                  {isEditable && (
                    <Row className="g-2 mb-3">
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
                          readOnlyValue={group.description || '-'}
                          onChange={event => setGroupField(group.id, 'description', event.target.value)}
                          onBlur={() => handleSaveGroupField(group, 'description')}
                          status={groupStatuses[group.id]?.description}
                          className=""
                          fieldMaxWidth="100%"
                        />
                      </Col>
                    </Row>
                  )}
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="small text-uppercase text-muted fw-bold">
                      {t('profile.stash.itemsTitle', 'Items')}
                    </div>
                    {isEditable && (
                      <PlusActionButton
                        title={t('profile.stash.itemCreate', 'Add item')}
                        onClick={() => openCreateItem(group)}
                      />
                    )}
                  </div>

                  {itemsLoading[group.id] && <Spinner size="sm" />}
                  {!itemsLoading[group.id] && !items.length && (
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

                  <div className="d-grid gap-3">
                    {items.map(item => {
                      const sourceState = searchStateByItem[item.id] || {};
                      const isExpanded = Boolean(itemExpanded[item.id]);
                      const hasLoadedImages = Object.prototype.hasOwnProperty.call(itemImagesByItem, item.id);
                      const itemMetadata = [
                        getClassificationLabel(intl, item.classification),
                        `${(item.sources || []).length} ${t('profile.stash.sourcesCount', 'source(s)')}`,
                        hasLoadedImages ? `${(itemImagesByItem[item.id] || []).length} ${t('profile.stash.imagesCount', 'image(s)')}` : null,
                      ].filter(Boolean);

                      return (
                        <DisclosureCard
                          key={item.id}
                          expanded={isExpanded}
                          onToggle={() => toggleItemExpanded(item.id)}
                          topRightAction={isEditable ? (
                            <div className="position-absolute top-0 end-0 mt-3 me-3">
                              <IconActionButton
                                title={t('profile.stash.delete', 'Delete')}
                                onClick={() => handleDeleteItem(item)}
                                borderColor="#c77d7d"
                                color="#8e2323"
                                backgroundColor="#fff"
                                size="1.9rem"
                                fontSize="0.9rem"
                              >
                                <TrashIcon />
                              </IconActionButton>
                            </div>
                          ) : null}
                          style={{
                            borderColor: '#ebe4d8',
                            backgroundColor: '#fcfbf8',
                          }}
                          summary={(
                            <>
                              <div className="fw-semibold">{item.name}</div>
                              {item.description && (
                                <div className="small text-muted mt-1">
                                  {item.description}
                                </div>
                              )}
                              <div className="small text-muted mt-2">
                                {itemMetadata.join(' \u2022 ')}
                              </div>
                            </>
                          )}
                        >
                          <Row className="g-3 mt-1">
                              <Col lg={6}>
                                {isEditable ? (
                                  <>
                                    <EditableTextFieldRow
                                      label=""
                                      editable
                                      value={itemDrafts[item.id]?.name || ''}
                                      readOnlyValue={item.name}
                                      onChange={event => setItemField(item, 'name', event.target.value)}
                                      onBlur={() => handleSaveItemField(item, 'name')}
                                      status={itemStatuses[item.id]?.name}
                                      className="mb-2"
                                      fieldMaxWidth="100%"
                                    />
                                    <EditableTextareaFieldRow
                                      label=""
                                      editable
                                      value={itemDrafts[item.id]?.description || ''}
                                      readOnlyValue={item.description || '-'}
                                      onChange={event => setItemField(item, 'description', event.target.value)}
                                      onBlur={() => handleSaveItemField(item, 'description')}
                                      status={itemStatuses[item.id]?.description}
                                      rows={2}
                                      className=""
                                      fieldMaxWidth="100%"
                                    />
                                    <div className="mt-3 pt-3 border-top">
                                      <div className="d-flex justify-content-between align-items-center mb-2">
                                        <div className="small text-uppercase text-muted fw-bold">
                                          {t('profile.stash.imagesTitle', 'Images')}
                                        </div>
                                        <PlusActionButton
                                          title={t('profile.stash.itemImageUpload', 'Upload image')}
                                          onClick={() => {
                                            setFeedback(null);
                                            setItemImageDescription('');
                                            setItemImageUploadTarget(item);
                                          }}
                                        />
                                      </div>
                                      {itemImagesLoading[item.id] && <Spinner size="sm" />}
                                      {!itemImagesLoading[item.id] && (
                                        <StackedImageGallery
                                          images={itemImagesByItem[item.id] || []}
                                          title={item.name}
                                          emptyText={t('profile.stash.imagesEmpty', 'No images uploaded for this item yet.')}
                                          editable={isEditable}
                                          onDeleteImage={imageId => handleDeleteItemImage(item.id, imageId)}
                                          onReplaceImage={image => handleOpenReplaceItemImagePicker(item, image)}
                                          imageDrafts={itemImageDrafts}
                                          imageStatuses={itemImageStatuses}
                                          onDescriptionChange={(imageId, value) => handleItemImageDescriptionChange(item.id, imageId, value)}
                                          onDescriptionBlur={imageId => handleItemImageDescriptionBlur(item.id, imageId)}
                                        />
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="fw-semibold">{item.name}</div>
                                    {item.description && <div className="small text-muted">{item.description}</div>}
                                    <div className="mt-3 pt-3 border-top">
                                      <div className="small text-uppercase text-muted fw-bold mb-2">
                                        {t('profile.stash.imagesTitle', 'Images')}
                                      </div>
                                      {itemImagesLoading[item.id] && <Spinner size="sm" />}
                                      {!itemImagesLoading[item.id] && hasLoadedImages && (
                                        <StackedImageGallery
                                          images={itemImagesByItem[item.id] || []}
                                          title={item.name}
                                          emptyText={t('profile.stash.imagesEmpty', 'No images uploaded for this item yet.')}
                                        />
                                      )}
                                    </div>
                                  </>
                                )}
                              </Col>
                              <Col lg={6}>
                                <div className="small text-uppercase text-muted fw-bold mb-2">
                                  {t('profile.stash.sourcesTitle', 'Linked sources')}
                                </div>

                                {(item.sources || []).length === 0 && (
                                  <div className="small text-muted mb-2">
                                    {t('profile.stash.sourcesEmpty', 'No supporting sources linked yet.')}
                                  </div>
                                )}

                                <div className="d-grid gap-2">
                                  {(item.sources || []).map(sourceId => {
                                    const source = sourceDetails[sourceId];
                                    return (
                                      <div key={sourceId} className="d-flex align-items-center justify-content-between gap-2">
                                        {source ? (
                                          <Link to={`/library/source/${sourceId}`} className="small text-decoration-none">
                                            {source.name}
                                          </Link>
                                        ) : (
                                          <span className="small text-muted">#{sourceId}</span>
                                        )}
                                        {isEditable && (
                                          <Button size="sm" variant="outline-secondary" onClick={() => handleUnlinkSource(item, sourceId)}>
                                            <UnlinkIcon />
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {isEditable && (
                                  <div className="mt-3 pt-2 border-top">
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
                                        {sourceState.results.map(source => (
                                          <div key={source.id} className="d-flex align-items-center justify-content-between gap-2">
                                            <div className="small">
                                              <div className="fw-semibold">{source.name}</div>
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
                        </DisclosureCard>
                      );
                    })}
                  </div>
                </div>
              </DisclosureCard>
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
                as="textarea"
                rows={3}
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





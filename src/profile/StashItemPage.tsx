import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Col, Container, Form, Modal, Row } from 'react-bootstrap';
import { injectIntl, IntlShape } from 'react-intl';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FaLink, FaPlus, FaUnlink } from 'react-icons/fa';

import ConfirmingTrashButton from '../component/ConfirmingTrashButton';
import EditableDescriptionField from '../component/EditableDescriptionField';
import ImageOverlayActionButton from '../component/ImageOverlayActionButton';
import InlineEditableText from '../component/InlineEditableText';
import defaultImage from '../assets/default-image.png';
import SectionBreadcrumb from '../component/SectionBreadcrumb';
import SectionHeaderBar from '../component/SectionHeaderBar';
import Spinner from '../component/Spinner';
import StackedImageGallery from '../component/StackedImageGallery';
import { SaveStatus } from '../component/EditableFieldRow';
import { getClassificationLabel, getTypeLabel } from '../library/libraryShared';
import { clearAllTimers, clearTimer } from '../util/timers';
import { getPeriodLabel as getSharedPeriodLabel } from '../util/periods';
import { prepareImageFile, readFileAsBase64 } from '../util/fileUtils';
import { buildClubProfileLabel, buildProfileLabel } from './profileLabels';
import {
  fetchCurrentUserInfo,
  fetchOwnerUserProfile,
  fetchProfileById,
} from './profileApi';
import {
  deleteStashItem,
  deleteStashItemImage,
  getLibrarySourcesByIds,
  getStashEntityImages,
  getStashItem,
  linkStashItemSource,
  searchLibrarySources,
  unlinkStashItemSource,
  updateStashItemDescription,
  updateStashItemImageDescription,
  updateStashItemName,
  uploadStashItemImage,
} from './stashApi';
import {
  EntityImage,
  Id,
  LibrarySourceSummary,
  Profile,
  SourceSearchState,
  StashItem,
} from './profileTypes';

type StashItemPageProps = {
  intl: IntlShape;
};

type IdRecord<T> = Record<string, T>;
type FieldName = 'name' | 'description';
type FieldStatusMap = Partial<Record<FieldName, SaveStatus>>;

const ALL_SOURCE_TYPES = ['WRITTEN', 'GRAPHIC', 'ARCHAEOLOGICAL', 'OTHER'];
const LinkIcon = FaLink as React.ComponentType<{ className?: string }>;
const PlusIcon = FaPlus as React.ComponentType<{ className?: string }>;
const UnlinkIcon = FaUnlink as React.ComponentType<{ className?: string }>;

function toRecordKey(value: Id) {
  return String(value);
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

function truncateLabel(value?: string | null, limit = 30) {
  if (!value) {
    return value || '';
  }

  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function StashItemPage({ intl }: StashItemPageProps) {
  const { id, itemId } = useParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ownerUserProfile, setOwnerUserProfile] = useState<Profile | null>(null);
  const [item, setItem] = useState<StashItem | null>(null);
  const [itemDrafts, setItemDrafts] = useState({ name: '', description: '' });
  const [itemStatuses, setItemStatuses] = useState<FieldStatusMap>({});
  const [itemImages, setItemImages] = useState<EntityImage[]>([]);
  const [imageDrafts, setImageDrafts] = useState<IdRecord<string>>({});
  const [imageStatuses, setImageStatuses] = useState<IdRecord<SaveStatus>>({});
  const [sources, setSources] = useState<LibrarySourceSummary[]>([]);
  const [sourceImages, setSourceImages] = useState<IdRecord<EntityImage>>({});
  const [currentUserId, setCurrentUserId] = useState<Id | null>(null);
  const [sourceSearchVisible, setSourceSearchVisible] = useState(false);
  const [sourceSearch, setSourceSearch] = useState<SourceSearchState>({});
  const [imageUploadVisible, setImageUploadVisible] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageDescription, setImageDescription] = useState('');
  const itemSaveTimersRef = useRef<Record<string, number>>({});
  const imageSaveTimersRef = useRef<Record<string, number>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const replacingImageRef = useRef<EntityImage | null>(null);

  const t = (messageId: string, defaultMessage: string, values?: Record<string, string | number | boolean | Date>) => (
    intl.formatMessage({ id: messageId, defaultMessage }, values)
  );

  const getPeriodLabel = (period?: string | null) => getSharedPeriodLabel(intl, period);
  const isEditable = profile?.type === 'CLUB' && currentUserId != null && currentUserId === profile?.userId;
  const availableSourceResults = (sourceSearch.results || []).filter(sourceResult => !((item?.sources || []).includes(sourceResult.id)));
  const sourceSearchFailedMessage = intl.formatMessage({
    id: 'profile.stash.sourceSearchFailed',
    defaultMessage: 'Unable to search library sources.',
  });

  useEffect(() => () => {
    clearAllTimers(itemSaveTimersRef.current);
    clearAllTimers(imageSaveTimersRef.current);
  }, []);

  useEffect(() => {
    fetchCurrentUserInfo(result => {
      setCurrentUserId(result.currentUserId || null);
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoaded(false);

      try {
        const nextItem = await getStashItem(itemId || '');
        const nextProfile = await new Promise<Profile | null>(resolve => {
          fetchProfileById(id, {
            onSuccess: value => resolve(value || null),
            onMissing: () => resolve(null),
          });
        });

        if (!active) {
          return;
        }

        setItem(nextItem || null);
        setItemDrafts({
          name: nextItem?.name || '',
          description: nextItem?.description || '',
        });
        setItemStatuses({});
        setProfile(nextProfile || null);

        if (nextProfile?.userId) {
          fetchOwnerUserProfile(nextProfile.userId, {
            onSuccess: ownerProfile => {
              if (active) {
                setOwnerUserProfile(ownerProfile || null);
              }
            },
            onError: () => {
              if (active) {
                setOwnerUserProfile(null);
              }
            },
          });
        } else {
          setOwnerUserProfile(null);
        }

        const [nextItemImages, nextSources] = await Promise.all([
          getStashEntityImages('item', nextItem?.id ? [nextItem.id] : []),
          getLibrarySourcesByIds(nextItem?.sources || []),
        ]);

        if (!active) {
          return;
        }

        const imageArray = Array.isArray(nextItemImages) ? nextItemImages : [];
        setItemImages(imageArray);
        setImageDrafts(Object.fromEntries(imageArray.map(image => [toRecordKey(image.id), image.description || ''])));
        setImageStatuses({});
        setSources(Array.isArray(nextSources) ? nextSources : []);

        const nextSourceImages = await getStashEntityImages('source', (nextSources || []).map(source => source.id));
        if (!active) {
          return;
        }

        setSourceImages(buildFirstImageMap(nextSourceImages));
      } catch (error) {
        if (!active) {
          return;
        }

        setItem(null);
        setProfile(null);
        setOwnerUserProfile(null);
        setItemImages([]);
        setSources([]);
        setSourceImages({});
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [id, itemId]);

  async function refreshItemData() {
    if (!itemId) {
      return;
    }

    const nextItem = await getStashItem(itemId);
    setItem(nextItem || null);
    setItemDrafts({
      name: nextItem?.name || '',
      description: nextItem?.description || '',
    });

    const [nextItemImages, nextSources] = await Promise.all([
      getStashEntityImages('item', nextItem?.id ? [nextItem.id] : []),
      getLibrarySourcesByIds(nextItem?.sources || []),
    ]);

    const imageArray = Array.isArray(nextItemImages) ? nextItemImages : [];
    setItemImages(imageArray);
    setImageDrafts(Object.fromEntries(imageArray.map(image => [toRecordKey(image.id), image.description || ''])));
    setSources(Array.isArray(nextSources) ? nextSources : []);
    const nextSourceImages = await getStashEntityImages('source', (nextSources || []).map(source => source.id));
    setSourceImages(buildFirstImageMap(nextSourceImages));
  }

  function setItemField(field: FieldName, value: string) {
    setItemDrafts(previousState => ({ ...previousState, [field]: value }));
    setItemStatuses(previousState => ({
      ...previousState,
      [field]: value === (item?.[field] || '') ? null : 'pending',
    }));
    clearTimer(itemSaveTimersRef.current, field);
    itemSaveTimersRef.current[field] = window.setTimeout(() => {
      void handleSaveItemField(field);
    }, 1800);
  }

  async function handleSaveItemField(field: FieldName) {
    if (!item) {
      return;
    }

    const draft = itemDrafts[field] || '';
    const persisted = item?.[field] || '';
    clearTimer(itemSaveTimersRef.current, field);

    if (draft === persisted) {
      setItemStatuses(previousState => ({ ...previousState, [field]: null }));
      return;
    }

    try {
      setItemStatuses(previousState => ({ ...previousState, [field]: 'saving' }));
      if (field === 'name') {
        await updateStashItemName(item.id, draft);
      } else {
        await updateStashItemDescription(item.id, draft);
      }
      setItem(previousState => previousState ? { ...previousState, [field]: draft } : previousState);
      setItemStatuses(previousState => ({ ...previousState, [field]: 'saved' }));
      window.setTimeout(() => {
        setItemStatuses(previousState => ({ ...previousState, [field]: null }));
      }, 1000);
    } catch (error) {
      setItemDrafts(previousState => ({ ...previousState, [field]: persisted }));
      setItemStatuses(previousState => ({ ...previousState, [field]: 'error' }));
    }
  }

  async function handleUploadImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = imageInputRef.current?.files?.[0];
    if (!file || !item) {
      return;
    }

    setImageUploading(true);
    try {
      const preparedFile = await prepareImageFile(file);
      const content = await readFileAsBase64(preparedFile);
      await uploadStashItemImage(item.id, {
        content,
        fileName: preparedFile.name,
        description: imageDescription || null,
      });
      setImageUploadVisible(false);
      setImageDescription('');
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      await refreshItemData();
    } finally {
      setImageUploading(false);
    }
  }

  async function handleDeleteItemImage(imageId: Id) {
    if (!item) {
      return;
    }
    await deleteStashItemImage(item.id, imageId);
    await refreshItemData();
  }

  function handleOpenReplaceImagePicker(image: EntityImage) {
    replacingImageRef.current = image;
    if (replaceImageInputRef.current) {
      replaceImageInputRef.current.value = '';
      replaceImageInputRef.current.click();
    }
  }

  async function handleReplaceImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const target = replacingImageRef.current;

    if (!file || !target || !item) {
      return;
    }

    setImageUploading(true);
    try {
      const preparedFile = await prepareImageFile(file);
      const content = await readFileAsBase64(preparedFile);
      await uploadStashItemImage(item.id, {
        content,
        fileName: preparedFile.name,
        description: imageDrafts[toRecordKey(target.id)] ?? target.description ?? null,
      });
      await deleteStashItemImage(item.id, target.id);
      await refreshItemData();
    } finally {
      setImageUploading(false);
      replacingImageRef.current = null;
      event.target.value = '';
    }
  }

  function handleImageDescriptionChange(imageId: Id, value: string) {
    const key = toRecordKey(imageId);
    setImageDrafts(previousState => ({ ...previousState, [key]: value }));
    setImageStatuses(previousState => ({ ...previousState, [key]: 'pending' }));
    clearTimer(imageSaveTimersRef.current, key);
    imageSaveTimersRef.current[key] = window.setTimeout(() => {
      void handleImageDescriptionBlur(imageId);
    }, 1800);
  }

  async function handleImageDescriptionBlur(imageId: Id) {
    if (!item) {
      return;
    }

    const key = toRecordKey(imageId);
    clearTimer(imageSaveTimersRef.current, key);
    try {
      setImageStatuses(previousState => ({ ...previousState, [key]: 'saving' }));
      await updateStashItemImageDescription(item.id, imageId, imageDrafts[key] || '');
      setImageStatuses(previousState => ({ ...previousState, [key]: 'saved' }));
      window.setTimeout(() => {
        setImageStatuses(previousState => ({ ...previousState, [key]: null }));
      }, 1000);
    } catch (error) {
      setImageStatuses(previousState => ({ ...previousState, [key]: 'error' }));
    }
  }

  async function handleDeleteItem() {
    if (!item || !profile) {
      return;
    }
    await deleteStashItem(item.id);
    navigate(`/stash/${profile.alias || profile.id}${item.itemGroup?.id ? `?group=${item.itemGroup.id}` : ''}`);
  }

  async function handleUnlinkSource(sourceId: Id) {
    if (!item) {
      return;
    }
    await unlinkStashItemSource(item.id, sourceId);
    await refreshItemData();
  }

  async function handleLinkSource(sourceId: Id) {
    if (!item) {
      return;
    }
    await linkStashItemSource(item.id, sourceId);
    setSourceSearchVisible(false);
    await refreshItemData();
  }

  const handleSearchSources = useCallback(async () => {
    if (!item) {
      return;
    }
    setSourceSearch(previousState => ({ ...previousState, loading: true, error: null }));
    try {
      const results = await searchLibrarySources({
        query: sourceSearch.query || '',
        period: item.period,
        classifications: item.classification ? [item.classification] : [],
        types: ALL_SOURCE_TYPES,
      });
      setSourceSearch(previousState => ({ ...previousState, loading: false, results, error: null }));
    } catch (error) {
      setSourceSearch(previousState => ({ ...previousState, loading: false, results: [], error: sourceSearchFailedMessage }));
    }
  }, [item, sourceSearch.query, sourceSearchFailedMessage]);

  useEffect(() => {
    if (!sourceSearchVisible || !item) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void handleSearchSources();
    }, 250);

    return () => window.clearTimeout(timerId);
  }, [handleSearchSources, item, sourceSearch.query, sourceSearchVisible]);

  if (!loaded) {
    return <Spinner />;
  }

  if (!profile || !item) {
    return (
      <Container fluid className="px-4 px-xl-5 pb-4">
        {t('profile.stash.notFound', 'Club stash not found.')}
      </Container>
    );
  }

  const clubLabel = buildClubProfileLabel(profile, getPeriodLabel);
  const ownerLabel = buildProfileLabel(ownerUserProfile);

  return (
    <Container fluid className="px-4 px-xl-5 pb-4">
      <Row>
        <Col sm={12} className="mb-3">
          <SectionHeaderBar
            title="ITEM"
            rightContent={(
              <SectionBreadcrumb
                items={[
                  ownerUserProfile ? { label: ownerLabel, to: `/profile/${ownerUserProfile.alias || ownerUserProfile.id}` } : null,
                  { label: clubLabel, to: `/profile/${profile.alias || profile.id}` },
                  { label: 'Stash', to: `/stash/${profile.alias || profile.id}` },
                  item.itemGroup?.name ? { label: item.itemGroup.name, to: `/stash/${profile.alias || profile.id}?group=${item.itemGroup.id}` } : null,
                  { label: truncateLabel(item.name || t('profile.stash.itemName', 'Item')), to: `/stash/${profile.alias || profile.id}/items/${item.id}` },
                ]}
              />
            )}
            backgroundColor="#f8f4ea"
            borderColor="#d8c7a1"
          />
        </Col>
      </Row>

      <div className="stash-item-page-shell">
        <div className="stash-item-page-hero">
          <div className="stash-item-page-main-image-shell">
            {itemImages.length > 0 ? (
              <div className="position-relative">
                <StackedImageGallery
                  images={itemImages}
                  title={item.name || t('profile.stash.itemName', 'Item')}
                  previewSize="default"
                  editable={isEditable}
                  onReplaceImage={isEditable ? handleOpenReplaceImagePicker : undefined}
                  onDeleteImage={isEditable ? handleDeleteItemImage : undefined}
                  imageDrafts={imageDrafts}
                  imageStatuses={imageStatuses}
                  onDescriptionChange={handleImageDescriptionChange}
                  onDescriptionBlur={handleImageDescriptionBlur}
                />
                {isEditable && (
                  <ImageOverlayActionButton
                    className="position-absolute top-0 end-0 m-2"
                    onClick={() => setImageUploadVisible(true)}
                    title={t('profile.stash.itemImageAdd', 'Add image')}
                    popover={t('profile.stash.itemImageAdd', 'Add image')}
                  >
                    <PlusIcon />
                  </ImageOverlayActionButton>
                )}
              </div>
            ) : (
              <div className="stash-empty-state stash-empty-state--compact position-relative">
                {isEditable && (
                  <ImageOverlayActionButton
                    className="position-absolute top-0 end-0 m-2"
                    onClick={() => setImageUploadVisible(true)}
                    title={t('profile.stash.itemImageAdd', 'Add image')}
                    popover={t('profile.stash.itemImageAdd', 'Add image')}
                  >
                    <PlusIcon />
                  </ImageOverlayActionButton>
                )}
                <img src={defaultImage} alt={t('profile.stash.imagesEmpty', 'No images uploaded for this item yet.')} className="stash-empty-image-art" />
              </div>
            )}
          </div>
          <div className="stash-item-page-copy">
            <div className="stash-item-page-title-row">
              <InlineEditableText
                editable={isEditable}
                value={itemDrafts.name}
                readOnlyValue={item.name}
                onChange={event => setItemField('name', event.target.value)}
                onBlur={() => { void handleSaveItemField('name'); }}
                status={itemStatuses.name}
                textClassName="stash-item-page-title stash-item-page-title-text"
              />
              {isEditable && (
                <ConfirmingTrashButton
                  title={t('profile.stash.itemDelete', 'Delete item')}
                  confirmTitle={t('profile.stash.itemDelete', 'Delete item')}
                  confirmMessage={t('profile.stash.itemDeleteConfirm', 'Delete this item?')}
                  confirmLabel={t('profile.action.delete', 'Delete')}
                  cancelLabel={t('profile.action.cancel', 'Cancel')}
                  onConfirm={() => { void handleDeleteItem(); }}
                />
              )}
            </div>
            <EditableDescriptionField
              editable={isEditable}
              value={itemDrafts.description}
              readOnlyValue={item.description || t('profile.stash.noDescription', 'No description')}
              onValueChange={value => setItemField('description', value)}
              onBlur={() => { void handleSaveItemField('description'); }}
              status={itemStatuses.description}
              textClassName="stash-item-page-description"
              placeholderDisplay={!item.description}
              placeholder={t('profile.stash.noDescription', 'No description')}
              rows={4}
              multilineUseContentEditable
              className="mt-2"
            />
            <div className="stash-meta-row mt-2">
              <span className="stash-meta-chip stash-meta-chip-soft">
                {getClassificationLabel(intl, item.classification)}
              </span>
              <span className="stash-meta-chip stash-meta-chip-soft">
                {getPeriodLabel(item.period)}
              </span>
              <span className="stash-meta-chip stash-meta-chip-soft">
                {sources.length} {t('profile.stash.sourcesCount', 'source(s)')}
              </span>
              <span className="stash-meta-chip stash-meta-chip-soft">
                {itemImages.length} {t('profile.stash.imagesCount', 'image(s)')}
              </span>
            </div>
          </div>
        </div>

        <section className="stash-source-list-shell">
          <div className="stash-source-list-header">
            <h2 className="stash-source-list-title">{t('profile.stash.sourcesTitle', 'Sources')}</h2>
            <Link className="stash-inline-link" to={`/stash/${profile.alias || profile.id}?group=${item.itemGroup?.id}`}>
              {item.itemGroup?.name || t('profile.stash.groupName', 'Collection')}
            </Link>
          </div>

          {sources.length === 0 && (
            <div className="stash-empty-state stash-empty-state--compact">
              <div className="small text-muted">{t('profile.stash.sourcesEmpty', 'No supporting sources linked yet.')}</div>
            </div>
          )}

          {sources.map(source => {
            const sourceImage = sourceImages[toRecordKey(source.id)];
            const sourceImageSrc = getImageSrc(sourceImage);

            return (
              <div key={source.id} className="stash-source-card">
                {sourceImageSrc && (
                  <div className="stash-source-thumb-shell">
                    <img src={sourceImageSrc} alt={source.name || 'Source'} className="stash-source-thumb" />
                  </div>
                )}
                <div className="stash-source-copy">
                  <Link to={`/library/source/${source.id}`} className="stash-source-title text-decoration-none">
                    {source.name}
                  </Link>
                  <div className="stash-source-description">
                    {source.description || t('profile.stash.noDescription', 'No description')}
                  </div>
                  <div className="stash-meta-row">
                    <span className="stash-meta-chip stash-meta-chip-soft">
                      {getTypeLabel(intl, source.type)}
                    </span>
                    {source.classification && (
                      <span className="stash-meta-chip stash-meta-chip-soft">
                        {getClassificationLabel(intl, source.classification)}
                      </span>
                    )}
                  </div>
                </div>
                {isEditable && (
                  <button
                    type="button"
                    className="stash-source-unlink-button"
                    title={t('profile.stash.sourceUnlink', 'Unlink source')}
                    onClick={() => { void handleUnlinkSource(source.id); }}
                  >
                    <UnlinkIcon />
                  </button>
                )}
              </div>
            );
          })}

          {isEditable && (
            <div className="stash-item-add-row">
              <button
                type="button"
                className="stash-inline-icon-button"
                title={t('profile.stash.sourceAdd', 'Add source')}
                onClick={() => setSourceSearchVisible(previousState => {
                  const nextVisible = !previousState;
                  if (!nextVisible) {
                    setSourceSearch({});
                  }
                  return nextVisible;
                })}
              >
                <LinkIcon />
              </button>
            </div>
          )}

          {isEditable && sourceSearchVisible && (
            <div className="stash-source-search-panel mt-2">
              <div className="input-group input-group-sm mb-2">
                <Form.Control
                  value={sourceSearch.query || ''}
                  onChange={event => setSourceSearch(previousState => ({ ...previousState, query: event.target.value }))}
                  placeholder={t('profile.stash.sourceSearchPlaceholder', 'Find matching library sources')}
                />
              </div>
              {sourceSearch.error && <div className="small text-danger mb-2">{sourceSearch.error}</div>}
              {sourceSearch.loading && <Spinner size="sm" />}
              {availableSourceResults.length > 0 && (
                <div className="d-grid gap-2">
                  {availableSourceResults.map(source => (
                    <div key={source.id} className="stash-source-result">
                      <div className="small stash-source-result-copy">
                        <Link to={`/library/source/${source.id}`} className="stash-source-result-name fw-semibold text-decoration-none">
                          {source.name}
                        </Link>
                        <div className="text-muted">{getTypeLabel(intl, source.type)}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        disabled={(item.sources || []).includes(source.id)}
                        onClick={() => { void handleLinkSource(source.id); }}
                      >
                        <LinkIcon className="me-2" />
                        {t('profile.stash.link', 'Link')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {!sourceSearch.loading && !sourceSearch.error && sourceSearchVisible && availableSourceResults.length === 0 && (
                <div className="small text-muted">
                  {t('profile.stash.sourceSearchEmpty', 'No matching sources available to link.')}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <Form.Control
        ref={replaceImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleReplaceImage}
        className="d-none"
      />

      <Modal show={imageUploadVisible} onHide={() => !imageUploading && setImageUploadVisible(false)} centered>
        <Modal.Header closeButton={!imageUploading}>
          <Modal.Title>{t('profile.stash.itemImageUpload', 'Upload image')}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleUploadImage}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>{t('profile.stash.itemImageFile', 'Image file')}</Form.Label>
              <Form.Control ref={imageInputRef} type="file" accept="image/*" />
            </Form.Group>
            <Form.Group>
              <Form.Label>{t('profile.stash.itemImageDescription', 'Description')}</Form.Label>
              <Form.Control
                value={imageDescription}
                onChange={event => setImageDescription(event.target.value)}
                placeholder={t('profile.stash.itemImageDescriptionPlaceholder', 'Optional description')}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setImageUploadVisible(false)} disabled={imageUploading}>
              {t('profile.action.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="secondary" disabled={imageUploading}>
              {t('profile.stash.itemImageUpload', 'Upload image')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default injectIntl(StashItemPage);

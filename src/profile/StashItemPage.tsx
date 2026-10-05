import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Container, Form, Modal } from "react-bootstrap";
import { injectIntl, IntlShape } from "react-intl";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaLink, FaPlus, FaUnlink } from "react-icons/fa";

import ConfirmingTrashButton from "../component/ConfirmingTrashButton";
import ConfirmationModal from "../component/ConfirmationModal";
import DefaultHourglassImage from "../component/DefaultHourglassImage";
import EditableDescriptionField from "../component/EditableDescriptionField";
import ImmediateImageUploadModal from "../component/ImmediateImageUploadModal";
import InlineEditableText from "../component/InlineEditableText";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import PageLayout from "../component/PageLayout";
import Spinner from "../component/Spinner";
import StackedImageGallery from "../component/StackedImageGallery";
import TextFilterInput from "../component/TextFilterInput";
import { SaveStatus } from "../component/EditableFieldRow";
import { getClassificationLabel, getTypeLabel } from "../library/libraryShared";
import { clearAllTimers, clearTimer } from "../util/timers";
import { getPeriodLabel as getSharedPeriodLabel } from "../util/periods";
import { prepareImageFile } from "../util/fileUtils";
import RefreshingImage from "../image/RefreshingImage";
import { buildClubProfileLabel, buildProfileLabel } from "./profileLabels";
import {
  fetchCurrentUserInfo,
  fetchOwnerUserProfile,
  fetchProfileById,
} from "./profileApi";
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
  replaceStashItemImage,
} from "./stashApi";
import {
  EntityImage,
  Id,
  LibrarySourceSummary,
  Profile,
  SourceSearchState,
  StashItem,
} from "./profileTypes";

type StashItemPageProps = {
  intl: IntlShape;
};

type IdRecord<T> = Record<string, T>;
type FieldName = "name" | "description";
type FieldStatusMap = Partial<Record<FieldName, SaveStatus>>;

const ALL_SOURCE_TYPES = ["WRITTEN", "GRAPHIC", "ARCHAEOLOGICAL", "OTHER"];
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

  return image.thumbnailUrl || image.url || null;
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

function truncateLabel(value?: string | null, limit = 30) {
  if (!value) {
    return value || "";
  }

  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function StashItemPage({ intl }: StashItemPageProps) {
  const { id, itemId } = useParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ownerUserProfile, setOwnerUserProfile] = useState<Profile | null>(
    null,
  );
  const [item, setItem] = useState<StashItem | null>(null);
  const [itemDrafts, setItemDrafts] = useState({ name: "", description: "" });
  const [itemStatuses, setItemStatuses] = useState<FieldStatusMap>({});
  const [itemImages, setItemImages] = useState<EntityImage[]>([]);
  const [imageDrafts, setImageDrafts] = useState<IdRecord<string>>({});
  const [imageStatuses, setImageStatuses] = useState<IdRecord<SaveStatus>>({});
  const [sources, setSources] = useState<LibrarySourceSummary[]>([]);
  const [sourceImages, setSourceImages] = useState<IdRecord<EntityImage>>({});
  const [currentUserId, setCurrentUserId] = useState<Id | null>(null);
  const [sourceLinkModalVisible, setSourceLinkModalVisible] = useState(false);
  const [sourceSearch, setSourceSearch] = useState<SourceSearchState>({});
  const [sourceFilter, setSourceFilter] = useState("");
  const [sourcePendingUnlink, setSourcePendingUnlink] =
    useState<LibrarySourceSummary | null>(null);
  const [imageUploadVisible, setImageUploadVisible] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const itemSaveTimersRef = useRef<Record<string, number>>({});
  const imageSaveTimersRef = useRef<Record<string, number>>({});
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const replacingImageRef = useRef<EntityImage | null>(null);

  const t = (
    messageId: string,
    defaultMessage: string,
    values?: Record<string, string | number | boolean | Date>,
  ) => intl.formatMessage({ id: messageId, defaultMessage }, values);

  const getPeriodLabel = (period?: string | null) =>
    getSharedPeriodLabel(intl, period);
  const isEditable =
    profile?.type === "CLUB" &&
    currentUserId != null &&
    currentUserId === profile?.userId;
  const availableSourceResults = (sourceSearch.results || []).filter(
    (sourceResult) => !(item?.sources || []).includes(sourceResult.id),
  );
  const filteredSources = sources.filter((source) => {
    const query = sourceFilter.trim().toLowerCase();
    if (!query) return true;
    return [source.name, source.description, source.type, source.classification]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const sourceSearchFailedMessage = intl.formatMessage({
    id: "profile.stash.sourceSearchFailed",
    defaultMessage: "Unable to search library sources.",
  });

  useEffect(
    () => () => {
      clearAllTimers(itemSaveTimersRef.current);
      clearAllTimers(imageSaveTimersRef.current);
    },
    [],
  );

  useEffect(() => {
    fetchCurrentUserInfo((result) => {
      setCurrentUserId(result.currentUserId || null);
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoaded(false);

      try {
        const nextItem = await getStashItem(itemId || "");
        const nextProfile = await new Promise<Profile | null>((resolve) => {
          fetchProfileById(id, {
            onSuccess: (value) => resolve(value || null),
            onMissing: () => resolve(null),
          });
        });

        if (!active) {
          return;
        }

        setItem(nextItem || null);
        setItemDrafts({
          name: nextItem?.name || "",
          description: nextItem?.description || "",
        });
        setItemStatuses({});
        setProfile(nextProfile || null);

        if (nextProfile?.userId) {
          fetchOwnerUserProfile(nextProfile.userId, {
            onSuccess: (ownerProfile) => {
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
          getStashEntityImages("item", nextItem?.id ? [nextItem.id] : []),
          getLibrarySourcesByIds(nextItem?.sources || []),
        ]);

        if (!active) {
          return;
        }

        const imageArray = Array.isArray(nextItemImages) ? nextItemImages : [];
        setItemImages(imageArray);
        setImageDrafts(
          Object.fromEntries(
            imageArray.map((image) => [
              toRecordKey(image.id),
              image.description || "",
            ]),
          ),
        );
        setImageStatuses({});
        setSources(Array.isArray(nextSources) ? nextSources : []);

        const nextSourceImages = await getStashEntityImages(
          "source",
          (nextSources || []).map((source) => source.id),
        );
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
      name: nextItem?.name || "",
      description: nextItem?.description || "",
    });

    const [nextItemImages, nextSources] = await Promise.all([
      getStashEntityImages("item", nextItem?.id ? [nextItem.id] : []),
      getLibrarySourcesByIds(nextItem?.sources || []),
    ]);

    const imageArray = Array.isArray(nextItemImages) ? nextItemImages : [];
    setItemImages(imageArray);
    setImageDrafts(
      Object.fromEntries(
        imageArray.map((image) => [
          toRecordKey(image.id),
          image.description || "",
        ]),
      ),
    );
    setSources(Array.isArray(nextSources) ? nextSources : []);
    const nextSourceImages = await getStashEntityImages(
      "source",
      (nextSources || []).map((source) => source.id),
    );
    setSourceImages(buildFirstImageMap(nextSourceImages));
  }

  function setItemField(field: FieldName, value: string) {
    setItemDrafts((previousState) => ({ ...previousState, [field]: value }));
    setItemStatuses((previousState) => ({
      ...previousState,
      [field]: value === (item?.[field] || "") ? null : "pending",
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

    const draft = itemDrafts[field] || "";
    const persisted = item?.[field] || "";
    clearTimer(itemSaveTimersRef.current, field);

    if (draft === persisted) {
      setItemStatuses((previousState) => ({ ...previousState, [field]: null }));
      return;
    }

    try {
      setItemStatuses((previousState) => ({
        ...previousState,
        [field]: "saving",
      }));
      if (field === "name") {
        await updateStashItemName(item.id, draft);
      } else {
        await updateStashItemDescription(item.id, draft);
      }
      setItem((previousState) =>
        previousState ? { ...previousState, [field]: draft } : previousState,
      );
      setItemStatuses((previousState) => ({
        ...previousState,
        [field]: "saved",
      }));
      window.setTimeout(() => {
        setItemStatuses((previousState) => ({
          ...previousState,
          [field]: null,
        }));
      }, 1000);
    } catch (error) {
      setItemDrafts((previousState) => ({
        ...previousState,
        [field]: persisted,
      }));
      setItemStatuses((previousState) => ({
        ...previousState,
        [field]: "error",
      }));
    }
  }

  async function handleUploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !item) {
      return;
    }

    setImageUploading(true);
    try {
      const preparedFile = await prepareImageFile(file);
      const uploadedImage = await uploadStashItemImage(item.id, preparedFile);
      const pendingImage: EntityImage = {
        ...uploadedImage,
        entityId: item.id,
        belongsTo: "item",
        resourceId: item.id,
        resourceType: "item",
      };
      setItemImages((current) => [
        pendingImage,
        ...current.filter((image) => image.id !== pendingImage.id),
      ]);
      setImageDrafts((current) => ({
        ...current,
        [toRecordKey(pendingImage.id)]: pendingImage.description || "",
      }));
      setImageUploadVisible(false);
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
      replaceImageInputRef.current.value = "";
      replaceImageInputRef.current.click();
    }
  }

  async function handleReplaceImage(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    const target = replacingImageRef.current;

    if (!file || !target || !item) {
      return;
    }

    setImageUploading(true);
    try {
      const preparedFile = await prepareImageFile(file);
      await replaceStashItemImage(
        item.id,
        target.id,
        preparedFile,
        imageDrafts[toRecordKey(target.id)] ?? target.description ?? null,
      );
      await refreshItemData();
    } finally {
      setImageUploading(false);
      replacingImageRef.current = null;
      event.target.value = "";
    }
  }

  function handleImageDescriptionChange(imageId: Id, value: string) {
    const key = toRecordKey(imageId);
    setImageDrafts((previousState) => ({ ...previousState, [key]: value }));
    setImageStatuses((previousState) => ({
      ...previousState,
      [key]: "pending",
    }));
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
      setImageStatuses((previousState) => ({
        ...previousState,
        [key]: "saving",
      }));
      await updateStashItemImageDescription(
        item.id,
        imageId,
        imageDrafts[key] || "",
      );
      setImageStatuses((previousState) => ({
        ...previousState,
        [key]: "saved",
      }));
      window.setTimeout(() => {
        setImageStatuses((previousState) => ({
          ...previousState,
          [key]: null,
        }));
      }, 1000);
    } catch (error) {
      setImageStatuses((previousState) => ({
        ...previousState,
        [key]: "error",
      }));
    }
  }

  async function handleDeleteItem() {
    if (!item || !profile) {
      return;
    }
    await deleteStashItem(item.id);
    navigate(
      `/stash/${profile.alias || profile.id}${item.itemGroup?.id ? `?group=${item.itemGroup.id}` : ""}`,
      { replace: true },
    );
  }

  async function handleUnlinkSource(sourceId: string) {
    if (!item) {
      return;
    }
    await unlinkStashItemSource(item.id, sourceId);
    await refreshItemData();
  }

  async function handleLinkSource(sourceId: string) {
    if (!item) {
      return;
    }
    const linkedItem = await linkStashItemSource(item.id, sourceId);
    const linkedSource = (sourceSearch.results || []).find(
      (source) => source.id === sourceId,
    );
    setItem((previousState) =>
      previousState
        ? {
            ...previousState,
            sources: linkedItem.sources || previousState.sources,
          }
        : linkedItem,
    );
    if (linkedSource) {
      setSources((previousState) =>
        previousState.some((source) => source.id === sourceId)
          ? previousState
          : [...previousState, linkedSource],
      );
      const images = await getStashEntityImages("source", [sourceId]);
      setSourceImages((previousState) => ({
        ...previousState,
        ...buildFirstImageMap(images),
      }));
    }
  }

  function closeSourceLinkModal() {
    setSourceLinkModalVisible(false);
    setSourceSearch({});
  }

  const handleSearchSources = useCallback(
    async (nextToken?: string) => {
      if (!item) {
        return;
      }
      setSourceSearch((previousState) => ({
        ...previousState,
        loading: true,
        error: null,
      }));
      try {
        const page = await searchLibrarySources({
          query: sourceSearch.query || "",
          period: item.period,
          classifications: item.classification ? [item.classification] : [],
          types: ALL_SOURCE_TYPES,
          nextToken,
        });
        setSourceSearch((previousState) => ({
          ...previousState,
          loading: false,
          results: nextToken
            ? [...(previousState.results || []), ...page.content]
            : page.content,
          nextToken: page.nextToken,
          error: null,
        }));
      } catch (error) {
        setSourceSearch((previousState) => ({
          ...previousState,
          loading: false,
          results: nextToken ? previousState.results || [] : [],
          nextToken: nextToken || null,
          error: sourceSearchFailedMessage,
        }));
      }
    },
    [item, sourceSearch.query, sourceSearchFailedMessage],
  );

  useEffect(() => {
    if (!sourceLinkModalVisible || !item) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void handleSearchSources();
    }, 250);

    return () => window.clearTimeout(timerId);
  }, [handleSearchSources, item, sourceSearch.query, sourceLinkModalVisible]);

  if (!loaded) {
    return <Spinner />;
  }

  if (!profile || !item) {
    return (
      <Container fluid className="px-4 px-xl-5 pb-4">
        {t("profile.stash.notFound", "Club stash not found.")}
      </Container>
    );
  }

  const clubLabel = buildClubProfileLabel(profile, getPeriodLabel);
  const ownerLabel = buildProfileLabel(ownerUserProfile);

  return (
    <PageLayout header={{
      title: "ITEM",
      rightContent:
              <SectionBreadcrumb
                items={[
                  ownerUserProfile
                    ? {
                        label: ownerLabel,
                        to: `/profile/${ownerUserProfile.alias || ownerUserProfile.id}`,
                      }
                    : null,
                  {
                    label: clubLabel,
                    to: `/profile/${profile.alias || profile.id}`,
                  },
                  {
                    label: "Stash",
                    to: `/stash/${profile.alias || profile.id}`,
                  },
                  item.itemGroup?.name
                    ? {
                        label: item.itemGroup.name,
                        to: `/stash/${profile.alias || profile.id}?group=${item.itemGroup.id}`,
                      }
                    : null,
                  {
                    label: truncateLabel(
                      item.name || t("profile.stash.itemName", "Item"),
                    ),
                    to: `/stash/${profile.alias || profile.id}/items/${item.id}`,
                  },
                ]}
              />,
      backgroundColor: "#f8f4ea",
      borderColor: "#d8c7a1",
    }}>

      <div className="stash-item-page-shell">
        <div className="stash-item-page-hero">
          <div className="stash-item-page-main-image-shell">
            <StackedImageGallery
              images={itemImages}
              title={item.name || t("profile.stash.itemName", "Item")}
              previewSize="default"
              mode="single"
              editable={isEditable}
              onUploadImage={
                isEditable ? () => setImageUploadVisible(true) : undefined
              }
              onReplaceImage={
                isEditable ? handleOpenReplaceImagePicker : undefined
              }
              onDeleteImage={isEditable ? handleDeleteItemImage : undefined}
              imageDrafts={imageDrafts}
              imageStatuses={imageStatuses}
              onDescriptionChange={handleImageDescriptionChange}
              onDescriptionBlur={handleImageDescriptionBlur}
              showInlineDescription
              emptyContent={
                <div className="stash-empty-state stash-empty-state--compact">
                  <DefaultHourglassImage
                    alt={t(
                      "profile.stash.imagesEmpty",
                      "No images uploaded for this item yet.",
                    )}
                    className="stash-empty-image-art"
                  />
                </div>
              }
            />
          </div>
          <div className="stash-item-page-copy">
            <div className="stash-item-page-title-row">
              <InlineEditableText
                editable={isEditable}
                value={itemDrafts.name}
                readOnlyValue={item.name}
                onChange={(event) => setItemField("name", event.target.value)}
                onBlur={() => {
                  void handleSaveItemField("name");
                }}
                status={itemStatuses.name}
                textClassName="stash-item-page-title stash-item-page-title-text"
              />
              {isEditable && (
                <ConfirmingTrashButton
                  title={t("profile.stash.itemDelete", "Delete item")}
                  confirmTitle={t("profile.stash.itemDelete", "Delete item")}
                  confirmMessage={t(
                    "profile.stash.itemDeleteConfirm",
                    "Delete this item?",
                  )}
                  confirmLabel={t("profile.action.delete", "Delete")}
                  cancelLabel={t("profile.action.cancel", "Cancel")}
                  onConfirm={() => {
                    void handleDeleteItem();
                  }}
                />
              )}
            </div>
            <Link
              className="stash-inline-link stash-item-page-collection-link"
              to={`/stash/${profile.alias || profile.id}?group=${item.itemGroup?.id}`}
            >
              {item.itemGroup?.name ||
                t("profile.stash.groupName", "Collection")}
            </Link>
            <EditableDescriptionField
              editable={isEditable}
              value={itemDrafts.description}
              readOnlyValue={
                item.description ||
                t("profile.stash.noDescription", "No description")
              }
              onValueChange={(value) => setItemField("description", value)}
              onBlur={() => {
                void handleSaveItemField("description");
              }}
              status={itemStatuses.description}
              textClassName="stash-item-page-description"
              placeholderDisplay={!item.description}
              placeholder={t("profile.stash.noDescription", "No description")}
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
                {sources.length} {t("profile.stash.sourcesCount", "source(s)")}
              </span>
              <span className="stash-meta-chip stash-meta-chip-soft">
                {itemImages.length} {t("profile.stash.imagesCount", "image(s)")}
              </span>
            </div>
          </div>
        </div>

        <section className="stash-source-list-shell">
          <div className="stash-source-list-header">
            <div className="stash-source-list-heading">
              <h2 className="stash-source-list-title">
                {t("profile.stash.sourcesTitle", "Sources")}
              </h2>
              <TextFilterInput
                value={sourceFilter}
                onChange={setSourceFilter}
                placeholder={t(
                  "profile.stash.sourceFilterPlaceholder",
                  "Filter sources",
                )}
                className="stash-source-filter"
              />
            </div>
            {isEditable && (
              <button
                type="button"
                className="stash-inline-icon-button"
                title={t("profile.stash.sourceAdd", "Add source")}
                aria-label={t("profile.stash.sourceAdd", "Add source")}
                onClick={() => setSourceLinkModalVisible(true)}
              >
                <PlusIcon />
              </button>
            )}
          </div>

          {sources.length === 0 && (
            <div className="stash-empty-state stash-empty-state--compact">
              <div className="small text-muted">
                {t(
                  "profile.stash.sourcesEmpty",
                  "No supporting sources linked yet.",
                )}
              </div>
            </div>
          )}

          {sources.length > 0 && filteredSources.length === 0 && (
            <div className="stash-empty-state stash-empty-state--compact">
              <div className="small text-muted">
                {t(
                  "profile.stash.sourceFilterEmpty",
                  "No linked sources match this filter.",
                )}
              </div>
            </div>
          )}

          {filteredSources.map((source) => {
            const sourceImage = sourceImages[toRecordKey(source.id)];
            const sourceImageSrc = getImageSrc(sourceImage);

            return (
              <div key={source.id} className="stash-source-card">
                <Link
                  to={`/library/source/${source.id}`}
                  className="stash-source-thumb-shell"
                >
                  {sourceImageSrc ? (
                    <RefreshingImage
                      image={
                        sourceImage || {
                          url: sourceImageSrc,
                          resourceType: "source",
                          resourceId: source.id,
                        }
                      }
                      variant="thumbnail"
                      alt={source.name || "Source"}
                      className="stash-source-thumb"
                    />
                  ) : (
                    <DefaultHourglassImage
                      alt={t("profile.stash.imagesEmptyShort", "No images")}
                      className="stash-source-thumb"
                    />
                  )}
                </Link>
                <Link
                  to={`/library/source/${source.id}`}
                  className="stash-source-copy text-decoration-none text-reset"
                >
                  <div className="stash-source-title">{source.name}</div>
                  <div className="stash-source-description">
                    {source.description ||
                      t("profile.stash.noDescription", "No description")}
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
                </Link>
                {isEditable && (
                  <button
                    type="button"
                    className="stash-source-unlink-button"
                    title={t("profile.stash.sourceUnlink", "Unlink source")}
                    onClick={() => setSourcePendingUnlink(source)}
                  >
                    <UnlinkIcon />
                  </button>
                )}
              </div>
            );
          })}
        </section>
      </div>

      <Modal
        show={sourceLinkModalVisible}
        onHide={closeSourceLinkModal}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {t("profile.stash.sourceAdd", "Add source")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="input-group input-group-sm mb-2">
            <Form.Control
              value={sourceSearch.query || ""}
              onChange={(event) =>
                setSourceSearch((previousState) => ({
                  ...previousState,
                  query: event.target.value,
                }))
              }
              placeholder={t(
                "profile.stash.sourceSearchPlaceholder",
                "Find matching library sources",
              )}
            />
          </div>
          {sourceSearch.error && (
            <div className="small text-danger mb-2">{sourceSearch.error}</div>
          )}
          {sourceSearch.loading && <Spinner size="sm" />}
          {availableSourceResults.length > 0 && (
            <div className="d-grid gap-2">
              {availableSourceResults.map((source) => (
                <div key={source.id} className="stash-source-result">
                  <div className="small stash-source-result-copy">
                    <Link
                      to={`/library/source/${source.id}`}
                      className="stash-source-result-name fw-semibold text-decoration-none"
                    >
                      {source.name}
                    </Link>
                    <div className="text-muted">
                      {getTypeLabel(intl, source.type)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="stash-inline-icon-button"
                    disabled={(item.sources || []).includes(source.id)}
                    title={t("profile.stash.link", "Link")}
                    aria-label={`${t("profile.stash.link", "Link")} ${source.name || ""}`.trim()}
                    onClick={() => {
                      void handleLinkSource(source.id);
                    }}
                  >
                    <LinkIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
          {sourceSearch.nextToken && (
            <Button
              size="sm"
              variant="outline-secondary"
              disabled={sourceSearch.loading}
              onClick={() => {
                void handleSearchSources(sourceSearch.nextToken || undefined);
              }}
              className="mt-2"
            >
              {t("profile.action.loadMore", "Load more")}
            </Button>
          )}
          {!sourceSearch.loading &&
            !sourceSearch.error &&
            availableSourceResults.length === 0 &&
            !sourceSearch.nextToken && (
              <div className="small text-muted">
                {t(
                  "profile.stash.sourceSearchEmpty",
                  "No matching sources available to link.",
                )}
              </div>
            )}
        </Modal.Body>
      </Modal>

      <ConfirmationModal
        show={sourcePendingUnlink !== null}
        title={t("profile.stash.sourceUnlink", "Unlink source")}
        message={t(
          "profile.stash.sourceUnlinkConfirm",
          "Are you sure you want to unlink this source?",
        )}
        confirmLabel={t("profile.stash.sourceUnlink", "Unlink source")}
        onHide={() => setSourcePendingUnlink(null)}
        onConfirm={() => {
          const source = sourcePendingUnlink;
          setSourcePendingUnlink(null);
          if (source) void handleUnlinkSource(source.id);
        }}
      />

      <Form.Control
        ref={replaceImageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif"
        onChange={handleReplaceImage}
        className="d-none"
      />

      <ImmediateImageUploadModal
        show={imageUploadVisible}
        title={t("profile.stash.itemImageUpload", "Upload image")}
        fileLabel={t("profile.stash.itemImageFile", "Image file")}
        onHide={() => setImageUploadVisible(false)}
        onFileChange={handleUploadImage}
        uploading={imageUploading}
        uploadingText={t("profile.stash.itemImageUploading", "Uploading...")}
      />
    </PageLayout>
  );
}

export default injectIntl(StashItemPage);

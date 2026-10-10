import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Form, Overlay, Popover } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";

import PageLayout from "../../component/PageLayout";
import { PageColumn, PageColumns } from "../../component/PageColumns";
import EditableDescriptionField from "../../component/EditableDescriptionField";
import InlineEditableText from "../../component/InlineEditableText";
import ImmediateImageUploadModal from "../../component/ImmediateImageUploadModal";
import StackedImageGallery from "../../component/StackedImageGallery";
import Spinner from "../../component/Spinner";
import TextFilterInput from "../../component/TextFilterInput";
import { type HistoricalYearInput } from "../../component/HistoricalRangeFilter";
import EditableHistoricalRangeField from "../../component/EditableHistoricalRangeField";
import PlacePickerField from "../../component/PlacePickerField";
import {
  deleteSourceImage,
  getSource,
  getSourceImages,
  getSourceProfiles,
  getSourceChangeLog,
  LibrarySource,
  LibrarySourceImage,
  LibrarySourceProfile,
  LibraryViewer,
  getLibraryViewer,
  SourceChangeLogEntry,
  patchSourceField,
  patchSourceRange,
  replaceSourceImage,
  updateSourceImageDescription,
  uploadSourceImage,
} from "../libraryApi";
import LibraryPeriodBreadcrumb from "../components/LibraryPeriodBreadcrumb";
import { getClassificationLabel, getTypeLabel } from "../libraryShared";
import { canContribute, canEditSource } from "../libraryRoles";
import { prepareImageFile } from "../../util/fileUtils";
import { getErrorMessage } from "../../util/errors";
import { clearAllTimers, clearTimer } from "../../util/timers";
import { SaveStatus } from "../../component/EditableFieldRow";
import ProfileList from "../../profile/components/ProfileList";
import { getUserProfilesByUserIds } from "../../profile/profileApi";
import { getImageThumbnails } from "../../image/imageApi";
import { Profile } from "../../profile/profileTypes";
import { buildProfileLabel } from "../../profile/currentProfile";
import PostPanel from "../../post/PostPanel";
import {
  formatSourceChangeValue,
  sourceChangeFieldLabel,
} from "../sourceChangeDisplay";

type SourceField = "name" | "description" | "from" | "to";

type SourceFieldStatuses = Partial<Record<SourceField, SaveStatus>>;

type ImageRecord<T> = Record<string | number, T>;

export default function LibrarySourcePage() {
  const { sourceId } = useParams();
  const intl = useIntl();
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [source, setSource] = useState<LibrarySource | null>(null);
  const [images, setImages] = useState<LibrarySourceImage[]>([]);
  const [sourceProfiles, setSourceProfiles] = useState<LibrarySourceProfile[]>(
    [],
  );
  const [sourceProfilesLoaded, setSourceProfilesLoaded] = useState(false);
  const [sourceProfilesError, setSourceProfilesError] = useState<string | null>(
    null,
  );
  const [profileFilter, setProfileFilter] = useState("");
  const [userInfo, setUserInfo] = useState<LibraryViewer>(null);
  const [changeLog, setChangeLog] = useState<SourceChangeLogEntry[]>([]);
  const [actors, setActors] = useState<Record<string, Profile>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingProposalsRef = useRef<HTMLAnchorElement>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [rangeFrom, setRangeFrom] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [rangeTo, setRangeTo] = useState<HistoricalYearInput>({
    year: "",
    era: "AD",
  });
  const [savingRange, setSavingRange] = useState(false);
  const [fieldStatuses, setFieldStatuses] = useState<SourceFieldStatuses>({});
  const [imageDrafts, setImageDrafts] = useState<ImageRecord<string>>({});
  const [imageStatuses, setImageStatuses] = useState<ImageRecord<SaveStatus>>(
    {},
  );
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const imageSaveTimersRef = useRef<ImageRecord<number>>({});
  const fieldSaveTimersRef = useRef<Partial<Record<SourceField, number>>>({});
  const rangeSaveTimerRef = useRef<number | null>(null);
  const fieldSaveInFlightRef = useRef<Partial<Record<SourceField, string>>>({});
  const replacingImageRef = useRef<LibrarySourceImage | null>(null);

  const loadSource = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    setSourceProfilesLoaded(false);
    setSourceProfilesError(null);

    try {
      const [sourceResult, viewer] = await Promise.all([
        getSource(sourceId),
        getLibraryViewer(),
      ]);
      if (!sourceResult.ok) {
        throw new Error("Unable to load the source.");
      }

      // The source itself is public. Do not let an optional image, usage, or
      // audit request turn a successfully loaded source into “not found”.
      setSource(sourceResult.data);
      setDraftName(sourceResult.data?.name || "");
      setDraftDescription(sourceResult.data?.description || "");
      setRangeFrom({
        year: sourceResult.data?.from?.year
          ? String(sourceResult.data.from.year)
          : "",
        era: sourceResult.data?.from?.era || "AD",
      });
      setRangeTo({
        year: sourceResult.data?.to?.year
          ? String(sourceResult.data.to.year)
          : "",
        era: sourceResult.data?.to?.era || "AD",
      });
      setFieldStatuses({});

      const imageResult = await getSourceImages(sourceId).catch(() => null);

      const sourceProfilesResult = await getSourceProfiles(sourceId).catch(
        () => null,
      );

      const changeLogResult = await getSourceChangeLog(sourceId).catch(
        () => null,
      );
      const auditActors = Array.from(
        new Set(
          (changeLogResult?.data || []).flatMap((entry) =>
            [entry.actorId, entry.proposerId].filter((value): value is string =>
              Boolean(value),
            ),
          ),
        ),
      );
      const profilesUsingSource = sourceProfilesResult?.data || [];
      const [actorProfiles, profileThumbnails] = await Promise.all([
        getUserProfilesByUserIds(auditActors).catch(() => []),
        getImageThumbnails(
          profilesUsingSource.map((profile) => ({
            resourceType: "profile",
            resourceId: profile.id,
          })),
        ).catch(() => []),
      ]);
      const thumbnailsByProfileId = new Map(
        profileThumbnails.map((entry) => [entry.resourceId, entry.image]),
      );
      const imageData = imageResult?.data;
      const loadedImages = Array.isArray(imageData) ? imageData : [];

      setImages(loadedImages);
      setSourceProfiles(
        profilesUsingSource.map((profile) => ({
          ...profile,
          avatarUrl:
            thumbnailsByProfileId.get(String(profile.id))?.thumbnailUrl ||
            thumbnailsByProfileId.get(String(profile.id))?.url ||
            null,
        })),
      );
      setProfileFilter("");
      setSourceProfilesError(
        sourceProfilesResult?.ok
          ? null
          : "Unable to load profiles using this source.",
      );
      setSourceProfilesLoaded(true);
      setImageDrafts(
        Object.fromEntries(
          loadedImages.map((image) => [image.id, image.description || ""]),
        ),
      );
      setImageStatuses({});
      setUserInfo(viewer);
      setChangeLog(changeLogResult?.data || []);
      setActors(
        Object.fromEntries(
          actorProfiles
            .filter((profile) => Boolean(profile.userId))
            .map((profile) => [String(profile.userId), profile]),
        ),
      );
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    loadSource();
  }, [loadSource]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Save failures are transient feedback. Keeping them in an overlay prevents
  // a short error message from moving the source layout while it is visible.
  useEffect(() => {
    if (!error || !source) return undefined;
    const timer = window.setTimeout(() => setError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [error, source]);

  useEffect(
    () => () => {
      clearAllTimers(imageSaveTimersRef.current);
      clearAllTimers(fieldSaveTimersRef.current);
      if (rangeSaveTimerRef.current !== null) {
        window.clearTimeout(rangeSaveTimerRef.current);
      }
    },
    [],
  );

  const patchSource = async (field: SourceField, value: string) => {
    const persistedValue =
      field === "name" ? source?.name || "" : source?.description || "";
    if ((value || "") === persistedValue) {
      setFieldStatuses((prevState) => ({
        ...prevState,
        [field]: null,
      }));
      return;
    }
    // A debounce can fire immediately before the control blurs. Do not submit
    // the same field value twice in that narrow window.
    if (fieldSaveInFlightRef.current[field] === value) return;

    try {
      setError(null);
      setNotice(null);
      setFieldStatuses((prevState) => ({
        ...prevState,
        [field]: "saving",
      }));
      if (!source) throw new Error("Source version is unavailable.");
      fieldSaveInFlightRef.current[field] = value;
      const result = await patchSourceField(
        sourceId,
        field,
        value,
        source.version,
      );

      if (!result.ok) {
        throw new Error(`Unable to update source ${field}.`);
      }

      const change =
        result.data &&
        typeof result.data === "object" &&
        !Array.isArray(result.data)
          ? result.data
          : null;
      if (change && "source" in change && change.source) {
        setSource(change.source as LibrarySource);
      }
      setFieldStatuses((prevState) => ({
        ...prevState,
        [field]: "saved",
      }));
      window.setTimeout(() => {
        setFieldStatuses((prevState) => ({
          ...prevState,
          [field]: null,
        }));
      }, 1000);
    } catch (fetchError) {
      if (field === "name") {
        setDraftName(persistedValue);
      } else {
        setDraftDescription(persistedValue);
      }
      setFieldStatuses((prevState) => ({
        ...prevState,
        [field]: "error",
      }));
      window.setTimeout(() => {
        setFieldStatuses((prevState) => ({
          ...prevState,
          [field]: null,
        }));
      }, 1500);
      setError(getErrorMessage(fetchError));
    } finally {
      if (fieldSaveInFlightRef.current[field] === value) {
        delete fieldSaveInFlightRef.current[field];
      }
    }
  };

  const scheduleFieldSave = (field: SourceField, value: string) => {
    if (fieldSaveTimersRef.current[field]) {
      clearTimeout(fieldSaveTimersRef.current[field]);
    }
    setFieldStatuses((prevState) => ({
      ...prevState,
      [field]:
        value ===
        ((field === "name" ? source?.name : source?.description) || "")
          ? null
          : "pending",
    }));
    fieldSaveTimersRef.current[field] = window.setTimeout(() => {
      patchSource(field, value);
    }, 1800);
  };

  const handleFieldBlur = (field: SourceField) => {
    clearTimer(fieldSaveTimersRef.current, field);
    patchSource(field, field === "name" ? draftName : draftDescription);
  };

  const saveSourceRange = async () => {
    if (!source || savingRange) return;
    const from = rangeFrom.year
      ? { year: Number(rangeFrom.year), era: rangeFrom.era }
      : null;
    const to = rangeTo.year
      ? { year: Number(rangeTo.year), era: rangeTo.era }
      : null;
    if (
      JSON.stringify(source.from || null) === JSON.stringify(from) &&
      JSON.stringify(source.to || null) === JSON.stringify(to)
    ) {
      return;
    }
    setSavingRange(true);
    setError(null);
    setNotice(null);
    try {
      const result = await patchSourceRange(
        sourceId,
        {
          from,
          to,
        },
        source.version,
      );
      if (!result.ok) {
        throw new Error("Unable to update the source year range.");
      }
      const change =
        result.data && typeof result.data === "object" ? result.data : null;
      if (change && "source" in change && change.source) {
        setSource(change.source as LibrarySource);
      }
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setSavingRange(false);
    }
  };

  const scheduleSourceRangeSave = () => {
    if (rangeSaveTimerRef.current !== null) {
      window.clearTimeout(rangeSaveTimerRef.current);
    }
    rangeSaveTimerRef.current = window.setTimeout(() => {
      rangeSaveTimerRef.current = null;
      void saveSourceRange();
    }, 250);
  };

  const handleUploadImage: React.ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingImage(true);
    setError(null);

    try {
      const preparedFile = await prepareImageFile(file);
      const result = await uploadSourceImage(sourceId, preparedFile, null);

      if (!result.ok) {
        throw new Error("Unable to upload the image.");
      }

      const uploadedImage = result.data;
      if (!uploadedImage || !("id" in uploadedImage)) {
        throw new Error("Library returned an invalid image upload response.");
      }

      // The Image processor is asynchronous. Keep its pending record in the
      // shared gallery immediately; RefreshingImage then polls this exact
      // image until a signed display/thumbnail URL is available.
      setImages((current) => [
        ...current.filter((image) => image.id !== uploadedImage.id),
        uploadedImage,
      ]);
      setImageDrafts((current) => ({
        ...current,
        [uploadedImage.id]: uploadedImage.description || "",
      }));

      setShowUploadModal(false);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleOpenReplaceImagePicker = (image: LibrarySourceImage) => {
    replacingImageRef.current = image;
    if (replaceImageInputRef.current) {
      replaceImageInputRef.current.value = "";
      replaceImageInputRef.current.click();
    }
  };

  const handleReplaceImage: React.ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    const file = event.target.files?.[0];
    const targetImage = replacingImageRef.current;

    if (!file || !targetImage) {
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const preparedFile = await prepareImageFile(file);
      const uploadResult = await replaceSourceImage(
        sourceId,
        targetImage.id,
        preparedFile,
        imageDrafts[targetImage.id] ?? targetImage.description ?? null,
      );

      if (!uploadResult.ok) {
        throw new Error("Unable to replace the image.");
      }

      const uploadedImage = uploadResult.data;
      if (!uploadedImage || !("id" in uploadedImage)) {
        throw new Error(
          "Library returned an invalid image replacement response.",
        );
      }

      setImages((current) =>
        current.map((image) =>
          image.id === targetImage.id ? uploadedImage : image,
        ),
      );
      setImageDrafts((current) => {
        const next = { ...current };
        delete next[targetImage.id];
        next[uploadedImage.id] = uploadedImage.description || "";
        return next;
      });
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setUploadingImage(false);
      replacingImageRef.current = null;
      event.target.value = "";
    }
  };

  const clearImageSaveTimer = (imageId: LibrarySourceImage["id"]) => {
    clearTimer(imageSaveTimersRef.current, String(imageId));
  };

  const resetImageStatusLater = (
    imageId: LibrarySourceImage["id"],
    delay = 1000,
  ) => {
    window.setTimeout(() => {
      setImageStatuses((prevState) => ({
        ...prevState,
        [imageId]: null,
      }));
    }, delay);
  };

  const handleDeleteImage = async (imageId: LibrarySourceImage["id"]) => {
    try {
      const result = await deleteSourceImage(sourceId, imageId);

      if (!result.ok) {
        throw new Error("Unable to delete the image.");
      }

      clearImageSaveTimer(imageId);
      // Clear the gallery synchronously, rather than waiting for the source
      // reload, so its shared empty-state placeholder is visible immediately.
      setImages((current) => current.filter((image) => image.id !== imageId));
      setImageDrafts((current) => {
        const next = { ...current };
        delete next[imageId];
        return next;
      });
      setImageStatuses((current) => {
        const next = { ...current };
        delete next[imageId];
        return next;
      });
      void loadSource();
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    }
  };

  const handleUpdateImageDescription = async (
    imageId: LibrarySourceImage["id"],
    nextValue = imageDrafts[imageId] || "",
  ) => {
    const persistedValue =
      images.find((image) => image.id === imageId)?.description || "";
    if ((nextValue || "") === persistedValue) {
      setImageStatuses((prevState) => ({
        ...prevState,
        [imageId]: null,
      }));
      return;
    }

    try {
      setImageStatuses((prevState) => ({
        ...prevState,
        [imageId]: "saving",
      }));
      const result = await updateSourceImageDescription(
        sourceId,
        imageId,
        nextValue,
      );

      if (!result.ok) {
        throw new Error("Unable to update the image description.");
      }

      setImages((prevState) =>
        prevState.map((image) =>
          image.id === imageId ? { ...image, description: nextValue } : image,
        ),
      );
      setImageStatuses((prevState) => ({
        ...prevState,
        [imageId]: "saved",
      }));
      resetImageStatusLater(imageId);
    } catch (fetchError) {
      setImageDrafts((prevState) => ({
        ...prevState,
        [imageId]: persistedValue,
      }));
      setImageStatuses((prevState) => ({
        ...prevState,
        [imageId]: "error",
      }));
      resetImageStatusLater(imageId, 1500);
      setError(getErrorMessage(fetchError));
    }
  };

  const handleImageDescriptionChange = (
    imageId: LibrarySourceImage["id"],
    value: string,
  ) => {
    setImageDrafts((prevState) => ({
      ...prevState,
      [imageId]: value,
    }));
    setImageStatuses((prevState) => ({
      ...prevState,
      [imageId]:
        value ===
        (images.find((image) => image.id === imageId)?.description || "")
          ? null
          : "pending",
    }));
    clearImageSaveTimer(imageId);
    imageSaveTimersRef.current[imageId] = window.setTimeout(() => {
      handleUpdateImageDescription(imageId, value);
    }, 1800);
  };

  const handleImageDescriptionBlur = (imageId: LibrarySourceImage["id"]) => {
    clearImageSaveTimer(imageId);
    handleUpdateImageDescription(imageId);
  };

  const filteredSourceProfiles = useMemo(() => {
    const normalizedFilter = profileFilter.trim().toLocaleLowerCase();
    if (!normalizedFilter) return sourceProfiles;

    return sourceProfiles.filter((profile) =>
      [profile.name, profile.alias, profile.period].some((value) =>
        value?.toLocaleLowerCase().includes(normalizedFilter),
      ),
    );
  }, [profileFilter, sourceProfiles]);

  if (loading) {
    return (
      <PageLayout header={{ title: "SOURCE" }}>
        <Spinner />
      </PageLayout>
    );
  }

  if (!source) {
    return (
      <PageLayout header={{ title: "SOURCE" }}>
        <div className="tempvs-plain-message text-danger">
          {error || "Source not found."}
        </div>
      </PageLayout>
    );
  }

  const headerTitle = [
    "SOURCE",
    getClassificationLabel(intl, source.classification),
    getTypeLabel(intl, source.type),
  ]
    .filter(Boolean)
    .join(" \u2022 ");
  const sourceDescription = draftDescription || source.description || "";
  const sourceDescriptionMissing = !sourceDescription;
  const sourceDescriptionDisplay = sourceDescription || "No description";
  return (
    <PageLayout
      header={{
        title: headerTitle,
        backgroundColor: "#f3efe4",
        borderColor: "#d9ccb0",
        middleContent: canEditSource(userInfo) ? (
          <div className="d-flex gap-2">
            <Link
              ref={pendingProposalsRef}
              to={`/library/source/${source.id}/proposals`}
              className="btn btn-outline-dark btn-sm"
            >
              Changesets
            </Link>
            <Link
              to={`/library/source/${source.id}/edit`}
              className="btn btn-dark btn-sm"
            >
              Edit source
            </Link>
          </div>
        ) : null,
        rightContent: (
          <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
            <LibraryPeriodBreadcrumb
              period={source.period}
              variant="source"
              trailingItem={{
                label: source.name,
                to: `/library/source/${source.id}`,
              }}
            />
          </div>
        ),
      }}
    >
      <Overlay
        target={pendingProposalsRef.current}
        show={Boolean(notice)}
        placement="bottom"
      >
        {(overlayProps) => (
          <Popover {...overlayProps} id="source-proposal-notice">
            <Popover.Body role="status">{notice}</Popover.Body>
          </Popover>
        )}
      </Overlay>
      <Overlay
        target={pendingProposalsRef.current}
        show={Boolean(error)}
        placement="bottom"
      >
        {(overlayProps) => (
          <Popover {...overlayProps} id="source-save-error">
            <Popover.Body className="text-danger" role="alert">
              {error}
            </Popover.Body>
          </Popover>
        )}
      </Overlay>

      <PageColumns variant="two" className="library-source-columns">
        <PageColumn>
          <div className="stash-source-copy stash-item-display-copy text-start">
            <InlineEditableText
              editable={false}
              value={draftName}
              onChange={(event) => {
                const value = event.target.value;
                setDraftName(value);
                scheduleFieldSave("name", value);
              }}
              onBlur={() => handleFieldBlur("name")}
              readOnlyValue={source.name}
              status={fieldStatuses.name}
              textClassName="stash-item-title"
              popoverValue={source.name}
              truncateSingleLine
              savingTitle="Saving"
              errorTitle="Save failed"
            />
            <EditableDescriptionField
              editable={false}
              value={draftDescription}
              onValueChange={(value) => {
                setDraftDescription(value);
                scheduleFieldSave("description", value);
              }}
              onBlur={() => handleFieldBlur("description")}
              readOnlyValue={sourceDescriptionDisplay}
              status={fieldStatuses.description}
              className="mt-1"
              textClassName="stash-item-description"
              placeholderDisplay={sourceDescriptionMissing}
              placeholder="No description"
              rows={5}
              savingTitle="Saving"
              errorTitle="Save failed"
            />
            <div className="mt-3 text-start">
              <EditableHistoricalRangeField
                label="Years"
                editable={false}
                from={rangeFrom}
                to={rangeTo}
                onFromChange={setRangeFrom}
                onToChange={setRangeTo}
                onBlur={scheduleSourceRangeSave}
                status={savingRange ? "saving" : null}
              />
              <PlacePickerField
                label="Discovered at"
                value={
                  source.discoveredAtPlaceId && source.discoveredAtPlaceName
                    ? {
                        id: source.discoveredAtPlaceId,
                        canonicalName: source.discoveredAtPlaceName,
                      }
                    : null
                }
                readOnlyLabel={source.discoveredAtPlaceName}
                editable={false}
                onChange={() => undefined}
                className="mt-2 mb-0"
                relatedMapScope={{ type: "SOURCE", id: source.id }}
              />
              <PlacePickerField
                label="Held at"
                value={
                  source.heldAtPlaceId && source.heldAtPlaceName
                    ? {
                        id: source.heldAtPlaceId,
                        canonicalName: source.heldAtPlaceName,
                      }
                    : null
                }
                readOnlyLabel={source.heldAtPlaceName}
                editable={false}
                onChange={() => undefined}
                className="mt-2 mb-0"
                relatedMapScope={{ type: "SOURCE", id: source.id }}
              />
            </div>
          </div>
          <PostPanel
            targetType="SOURCE"
            targetId={source.id}
            canCreate={canContribute(userInfo)}
          />
        </PageColumn>
        <PageColumn>
          <section>
            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
              <div className="stash-subheading mb-0">Images</div>
            </div>

            {canContribute(userInfo) && (
              <Form.Control
                ref={replaceImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={handleReplaceImage}
                className="d-none"
              />
            )}

            <StackedImageGallery
              images={images.map((image) => ({
                ...image,
                resourceType: image.resourceType || "source",
                resourceId: image.resourceId || sourceId,
              }))}
              title={source.name || undefined}
              emptyText="No images uploaded for this source yet."
              previewSize="compact"
              previewStyle={{ width: "100%" }}
              fitPreviewHeightToImage
              editable={false}
              canAddImage={false}
              onAddImage={() => {
                setError(null);
                setShowUploadModal(true);
              }}
              addTitle="Upload image"
              addPopover="Upload image"
              wrapperClassName="source-image-gallery"
              onDeleteImage={(imageId) => handleDeleteImage(String(imageId))}
              onReplaceImage={(image) => {
                const sourceImage = images.find(
                  (entry) => entry.id === String(image.id),
                );
                if (sourceImage) handleOpenReplaceImagePicker(sourceImage);
              }}
              imageDrafts={imageDrafts}
              imageStatuses={imageStatuses}
              onDescriptionChange={(imageId, value) =>
                handleImageDescriptionChange(String(imageId), value)
              }
              onDescriptionBlur={(imageId) =>
                handleImageDescriptionBlur(String(imageId))
              }
            />
            <section
              className="source-profile-links mt-4"
              aria-label="Profiles using this source"
            >
              <div className="source-profile-links-heading">
                <div className="stash-subheading mb-0">
                  Profiles using this source
                </div>
                <TextFilterInput
                  value={profileFilter}
                  onChange={setProfileFilter}
                  placeholder="Filter profiles"
                  className="source-profile-filter"
                />
              </div>
              {!sourceProfilesLoaded && (
                <p className="text-muted mt-2 mb-0">Loading profiles...</p>
              )}
              {sourceProfilesError && (
                <p className="text-danger mt-2 mb-0">{sourceProfilesError}</p>
              )}
              {sourceProfilesLoaded &&
                !sourceProfilesError &&
                sourceProfiles.length === 0 && (
                  <p className="text-muted mt-2 mb-0">
                    No profiles use this source yet.
                  </p>
                )}
              {sourceProfilesLoaded &&
                !sourceProfilesError &&
                sourceProfiles.length > 0 &&
                filteredSourceProfiles.length === 0 && (
                  <p className="text-muted mt-2 mb-0">
                    No profiles match this filter.
                  </p>
                )}
              {sourceProfilesLoaded &&
                !sourceProfilesError &&
                filteredSourceProfiles.length > 0 && (
                  <ProfileList
                    profiles={filteredSourceProfiles}
                    className="source-profile-list"
                  />
                )}
            </section>
          </section>
        </PageColumn>
      </PageColumns>

      <section className="stash-shell p-3 mt-4" aria-label="Source change log">
        <div className="stash-subheading mb-2">Change log</div>
        {changeLog.length === 0 ? (
          <p className="text-muted mb-0">No recorded changes yet.</p>
        ) : (
          <ol className="list-unstyled d-flex flex-column gap-3 mb-0">
            {changeLog.map((entry) => {
              const actor = actors[entry.actorId];
              const actorLabel = actor
                ? buildProfileLabel(actor)
                : entry.actorId;
              const actorPath = actor
                ? `/profile/${actor.alias || actor.id}`
                : `/profile/user/${entry.actorId}`;
              const proposer = entry.proposerId
                ? actors[entry.proposerId]
                : null;
              const proposerPath = proposer
                ? `/profile/${proposer.alias || proposer.id}`
                : entry.proposerId
                  ? `/profile/user/${entry.proposerId}`
                  : null;
              const action =
                entry.action === "CREATED"
                  ? "created this source"
                  : entry.action === "PROPOSAL_APPLIED"
                    ? "approved and applied a proposal"
                    : entry.action === "PROPOSAL_SUPERSEDED"
                      ? "superseded an outdated proposal"
                      : "rejected a proposal";
              return (
                <li key={entry.id} className="border-bottom pb-2">
                  <div>
                    <Link to={actorPath}>
                      {entry.actorId === userInfo?.userId ? "You" : actorLabel}
                    </Link>{" "}
                    {action}{" "}
                    {entry.proposerId && proposerPath && (
                      <>
                        <span className="text-muted">, proposed by </span>
                        <Link to={proposerPath}>
                          {entry.proposerId === userInfo?.userId
                            ? "You"
                            : proposer
                              ? buildProfileLabel(proposer)
                              : "Unknown profile"}
                        </Link>{" "}
                      </>
                    )}
                    <time className="text-muted">
                      {new Date(entry.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <ul className="small text-muted mt-1 mb-0">
                    {Object.entries(entry.changes).map(([field, change]) => (
                      <li key={field}>
                        <strong>{sourceChangeFieldLabel(field)}</strong>:{" "}
                        {formatSourceChangeValue(change.before)} →{" "}
                        {formatSourceChangeValue(change.after)}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {canContribute(userInfo) && (
        <ImmediateImageUploadModal
          show={showUploadModal}
          title="Upload source image"
          fileLabel="Image file"
          onHide={() => setShowUploadModal(false)}
          onFileChange={handleUploadImage}
          uploading={uploadingImage}
        />
      )}
    </PageLayout>
  );
}

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Col, Form, Row } from "react-bootstrap";
import { FaTrashAlt } from "react-icons/fa";
import { useIntl } from "react-intl";
import { Link, useNavigate, useParams } from "react-router-dom";

import IconActionButton from "../../component/IconActionButton";
import ConfirmationModal from "../../component/ConfirmationModal";
import EditableDescriptionField from "../../component/EditableDescriptionField";
import InlineEditableText from "../../component/InlineEditableText";
import ImmediateImageUploadModal from "../../component/ImmediateImageUploadModal";
import StackedImageGallery from "../../component/StackedImageGallery";
import Spinner from "../../component/Spinner";
import TextFilterInput from "../../component/TextFilterInput";
import HistoricalRangeFilter, {
  type HistoricalYearInput,
} from "../../component/HistoricalRangeFilter";
import {
  deleteSourceImage,
  getSource,
  getSourceImages,
  getSourceProfiles,
  getSourceProposals,
  getSourceChangeLog,
  LibrarySource,
  LibrarySourceImage,
  LibrarySourceProfile,
  LibraryViewer,
  getLibraryViewer,
  SourceChangeProposal,
  SourceChangeLogEntry,
  applySourceProposal,
  rejectSourceProposal,
  patchSourceField,
  patchSourceRange,
  removeSource,
  replaceSourceImage,
  updateSourceImageDescription,
  uploadSourceImage,
} from "../libraryApi";
import LibraryPeriodBreadcrumb from "../components/LibraryPeriodBreadcrumb";
import LibrarySectionHeader from "../components/LibrarySectionHeader";
import { getClassificationLabel, getTypeLabel } from "../libraryShared";
import { canContribute, canDeleteSource, canEditSource } from "../libraryRoles";
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

type SourceField = "name" | "description" | "from" | "to";

type SourceFieldStatuses = Partial<Record<SourceField, SaveStatus>>;

type ImageRecord<T> = Record<string | number, T>;

const TrashIcon = FaTrashAlt as React.ComponentType;
export default function LibrarySourcePage() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const intl = useIntl();
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
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
  const [proposals, setProposals] = useState<SourceChangeProposal[]>([]);
  const [changeLog, setChangeLog] = useState<SourceChangeLogEntry[]>([]);
  const [actors, setActors] = useState<Record<string, Profile>>({});
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SourceChangeProposal | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [rangeEnabled, setRangeEnabled] = useState(false);
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
      setRangeEnabled(Boolean(sourceResult.data?.from || sourceResult.data?.to));
      setRangeFrom({
        year: sourceResult.data?.from?.year ? String(sourceResult.data.from.year) : "",
        era: sourceResult.data?.from?.era || "AD",
      });
      setRangeTo({
        year: sourceResult.data?.to?.year ? String(sourceResult.data.to.year) : "",
        era: sourceResult.data?.to?.era || "AD",
      });
      setFieldStatuses({});

      const imageResult = await getSourceImages(sourceId).catch(() => null);

      const sourceProfilesResult = await getSourceProfiles(sourceId).catch(
        () => null,
      );

      const proposalResult = canEditSource(viewer)
        ? await getSourceProposals(sourceId).catch(() => null)
        : null;
      const changeLogResult = await getSourceChangeLog(sourceId).catch(
        () => null,
      );
      const auditActors = Array.from(
        new Set([
          ...(proposalResult?.data || []).map(
            (proposal) => proposal.proposerId,
          ),
          ...(changeLogResult?.data || []).flatMap((entry) =>
            [entry.actorId, entry.proposerId].filter((value): value is string =>
              Boolean(value),
            ),
          ),
        ]),
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
      setProposals(proposalResult?.data || []);
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

  useEffect(
    () => () => {
      clearAllTimers(imageSaveTimersRef.current);
      clearAllTimers(fieldSaveTimersRef.current);
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
      } else if (change && "proposal" in change && change.proposal) {
        const proposal = change.proposal as SourceChangeProposal;
        setProposals((current) => [
          ...current.filter((candidate) => candidate.id !== proposal.id),
          proposal,
        ]);
        if (field === "name") setDraftName(persistedValue);
        else setDraftDescription(persistedValue);
        setNotice("Change proposed for another editor to review and apply.");
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
    setSavingRange(true);
    setError(null);
    setNotice(null);
    try {
      const result = await patchSourceRange(
        sourceId,
        {
          from:
            rangeEnabled && rangeFrom.year
              ? { year: Number(rangeFrom.year), era: rangeFrom.era }
              : null,
          to:
            rangeEnabled && rangeTo.year
              ? { year: Number(rangeTo.year), era: rangeTo.era }
              : null,
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
      } else if (change && "proposal" in change && change.proposal) {
        const proposal = change.proposal as SourceChangeProposal;
        setProposals((current) => [
          ...current.filter((candidate) => candidate.id !== proposal.id),
          proposal,
        ]);
        setNotice(
          "Year range change proposed for another editor to review and apply.",
        );
      }
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setSavingRange(false);
    }
  };

  const handleDeleteSource = async () => {
    if (!source) {
      return;
    }

    try {
      const result = await removeSource(sourceId, source.version);
      if (!result.ok) {
        throw new Error(
          (typeof result.data === "string" && result.data) ||
            (result.data &&
            typeof result.data === "object" &&
            "message" in result.data
              ? result.data.message
              : null) ||
            "Unable to delete the source.",
        );
      }

      navigate(`/library/period/${(source.period || "").toLowerCase()}`);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    }
  };

  const handleApplyProposal = async (proposal: SourceChangeProposal) => {
    try {
      setReviewBusy(proposal.id);
      setError(null);
      setNotice(null);
      const result = await applySourceProposal(sourceId, proposal.id);
      if (!result.ok || !result.data || !("version" in result.data)) {
        throw new Error("Unable to apply the source proposal.");
      }
      await loadSource();
    } catch (applyError) {
      setError(getErrorMessage(applyError));
    } finally {
      setReviewBusy(null);
    }
  };

  const handleRejectProposal = async (proposal: SourceChangeProposal) => {
    try {
      setReviewBusy(proposal.id);
      setError(null);
      setNotice(null);
      const result = await rejectSourceProposal(sourceId, proposal.id);
      if (!result.ok) throw new Error("Unable to reject the source proposal.");
      setRejectTarget(null);
      await loadSource();
    } catch (rejectError) {
      setError(getErrorMessage(rejectError));
    } finally {
      setReviewBusy(null);
    }
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
    return <Spinner />;
  }

  if (!source) {
    return (
      <div className="px-4 px-xl-5 pb-4">
        <div className="tempvs-plain-message text-danger">
          {error || "Source not found."}
        </div>
      </div>
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
  const sourceYearRange = [
    source.from ? `From: ${source.from.year} ${source.from.era}` : null,
    source.to ? `To: ${source.to.year} ${source.to.era}` : null,
  ]
    .filter(Boolean)
    .join(" – ");

  return (
    <div className="px-4 px-xl-5 pb-4">
      <LibrarySectionHeader
        title={headerTitle}
        subtitle={null}
        period={source.period}
        variant="source"
        rightContent={
          <LibraryPeriodBreadcrumb
            period={source.period}
            variant="source"
            trailingItem={{
              label: source.name,
              to: `/library/source/${source.id}`,
            }}
          />
        }
      />

      {canDeleteSource(userInfo) && (
        <div className="d-flex justify-content-end mb-4">
          <IconActionButton
            title="Delete source"
            onClick={() => setShowDeleteConfirmation(true)}
            borderColor="#c77d7d"
            color="#8e2323"
            backgroundColor="#fff"
            size="1.9rem"
            fontSize="0.9rem"
          >
            <TrashIcon />
          </IconActionButton>
        </div>
      )}

      <ConfirmationModal
        show={showDeleteConfirmation}
        title="Delete source"
        message="Delete this source?"
        confirmLabel="Delete"
        onHide={() => setShowDeleteConfirmation(false)}
        onConfirm={() => {
          setShowDeleteConfirmation(false);
          void handleDeleteSource();
        }}
      />
      <ConfirmationModal
        show={rejectTarget !== null}
        title="Reject source proposal"
        message="Reject this proposed source change? The source will remain unchanged."
        confirmLabel="Reject proposal"
        busy={reviewBusy !== null}
        onHide={() => {
          if (!reviewBusy) setRejectTarget(null);
        }}
        onConfirm={() => {
          if (rejectTarget) void handleRejectProposal(rejectTarget);
        }}
      />

      {error && <div className="tempvs-plain-message text-danger">{error}</div>}
      {notice && (
        <div className="tempvs-plain-message text-muted" role="status">
          {notice}
        </div>
      )}

      {canEditSource(userInfo) && proposals.length > 0 && (
        <div className="stash-shell p-3 mb-3">
          <div className="stash-subheading mb-2">Pending source proposals</div>
          <div className="d-flex flex-column gap-2">
            {proposals.map((proposal) => {
              const ownProposal = proposal.proposerId === userInfo?.userId;
              const canReview = !ownProposal;
              const proposer = actors[proposal.proposerId];
              const proposerLabel = proposer
                ? buildProfileLabel(proposer)
                : proposal.proposerId;
              const proposerPath = proposer
                ? `/profile/${proposer.alias || proposer.id}`
                : `/profile/user/${proposal.proposerId}`;
              const changeSummary = [
                proposal.changes.name !== undefined
                  ? `Name: ${proposal.changes.name}`
                  : null,
                proposal.changes.description !== undefined
                  ? "Description change"
                  : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={proposal.id}
                  className="d-flex justify-content-between align-items-center gap-3 flex-wrap"
                >
                  <div className="small">
                    <strong>
                      {Object.entries(proposal.changes)
                        .map(([field, after]) => {
                          const before =
                            proposal.previous?.[field as SourceField];
                          return `${field === "name" ? "Name" : "Description"}: ${before || "(empty)"} → ${after || "(empty)"}`;
                        })
                        .join(" · ") || changeSummary}
                    </strong>
                    <span className="text-muted ms-2">
                      Proposed by{" "}
                      <Link to={proposerPath}>
                        {ownProposal ? "you" : proposerLabel}
                      </Link>{" "}
                      on {new Date(proposal.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="d-flex gap-2">
                    <Button
                      size="sm"
                      variant="outline-success"
                      disabled={!canReview || reviewBusy !== null}
                      title={
                        !canReview
                          ? "Another editor must review your proposal."
                          : undefined
                      }
                      onClick={() => void handleApplyProposal(proposal)}
                    >
                      {canReview ? "Approve" : "Awaiting another editor"}
                    </Button>
                    {canReview && (
                      <Button
                        size="sm"
                        variant="outline-danger"
                        disabled={reviewBusy !== null}
                        onClick={() => setRejectTarget(proposal)}
                      >
                        Reject
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Row className="g-4 align-items-start">
        <Col md={7}>
          <div className="stash-source-copy stash-item-display-copy text-start">
            <InlineEditableText
              editable={canEditSource(userInfo)}
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
              editable={canEditSource(userInfo)}
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
              multilineUseContentEditable
              savingTitle="Saving"
              errorTitle="Save failed"
            />
            <div className="mt-3 text-start">
              {canEditSource(userInfo) ? (
                <>
                  <HistoricalRangeFilter
                    enabled={rangeEnabled}
                    from={rangeFrom}
                    to={rangeTo}
                    onEnabledChange={setRangeEnabled}
                    onFromChange={setRangeFrom}
                    onToChange={setRangeTo}
                    label="Set year range"
                  />
                  <Button
                    size="sm"
                    variant="outline-dark"
                    disabled={savingRange}
                    onClick={() => void saveSourceRange()}
                  >
                    {savingRange ? "Saving..." : "Save year range"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="stash-subheading mb-1">Year range</div>
                  <div className="stash-item-description mt-0 text-start">
                    {sourceYearRange || "No year range"}
                  </div>
                </>
              )}
            </div>
          </div>
          <PostPanel
            targetType="SOURCE"
            targetId={source.id}
            canCreate={canContribute(userInfo)}
          />
        </Col>
        <Col md={5}>
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
              editable={canEditSource(userInfo)}
              canAddImage={canContribute(userInfo)}
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
        </Col>
      </Row>

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
                    <time className="text-muted">
                      {new Date(entry.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <ul className="small text-muted mt-1 mb-0">
                    {Object.entries(entry.changes).map(([field, change]) => (
                      <li key={field}>
                        <strong>{field}</strong>: {change.before || "(empty)"} →{" "}
                        {change.after || "(empty)"}
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
    </div>
  );
}

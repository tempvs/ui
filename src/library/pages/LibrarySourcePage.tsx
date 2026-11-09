import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import PageLayout from "../../component/PageLayout";
import ChangeLogEntry from "../../component/ChangeLogEntry";
import { PageColumn, PageColumns } from "../../component/PageColumns";
import EditableDescriptionField from "../../component/EditableDescriptionField";
import EntityDetailPage from "../../component/EntityDetailPage";
import StackedImageGallery from "../../component/StackedImageGallery";
import Spinner from "../../component/Spinner";
import TextFilterInput from "../../component/TextFilterInput";
import EditableHistoricalRangeField from "../../component/EditableHistoricalRangeField";
import PlacePickerField from "../../component/PlacePickerField";
import {
  getSource,
  getSourceImages,
  getSourceProfiles,
  getSourceChangeLog,
  getSourceChangesets,
  setSourceCover,
  LibrarySource,
  LibrarySourceImage,
  LibrarySourceProfile,
  LibraryViewer,
  SourceImageOperation,
  getLibraryViewer,
  SourceChangeLogEntry,
} from "../libraryApi";
import LibraryPeriodBreadcrumb from "../components/LibraryPeriodBreadcrumb";
import { LibraryHint, useLibraryTopic } from "../onboarding/LibraryJourney";
import { canContribute, canEditSource } from "../libraryRoles";
import { getErrorMessage } from "../../util/errors";
import ProfileList from "../../profile/components/ProfileList";
import { getUserProfilesByUserIds } from "../../profile/profileApi";
import { getImageThumbnails } from "../../image/imageApi";
import { Profile } from "../../profile/profileTypes";
import PostPanel from "../../post/PostPanel";
import SourceChangeLogDiffModal from "../components/SourceChangeLogDiffModal";
import { loadSourceRelatedMapContent } from "../../map/ownedMapContent";

const EMPTY_APPROVED_IMAGES: LibrarySourceImage[] = [];
const EMPTY_APPROVED_IMAGE_OPERATIONS: SourceImageOperation[] = [];

export default function LibrarySourcePage() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const approvalNavigation = location.state as {
    approvedSource?: LibrarySource;
    approvedImages?: LibrarySourceImage[];
    publishedImagesBeforeApproval?: LibrarySourceImage[];
    approvedImageOperations?: SourceImageOperation[];
  } | null;
  const approvedSource = approvalNavigation?.approvedSource;
  const approvedImages =
    approvalNavigation?.approvedImages || EMPTY_APPROVED_IMAGES;
  const publishedImagesBeforeApproval =
    approvalNavigation?.publishedImagesBeforeApproval || EMPTY_APPROVED_IMAGES;
  const approvedImageOperations =
    approvalNavigation?.approvedImageOperations ||
    EMPTY_APPROVED_IMAGE_OPERATIONS;
  const [loading, setLoading] = useState(!approvedSource);
  const [source, setSource] = useState<LibrarySource | null>(
    approvedSource || null,
  );
  const visibleSourceRef = useRef<LibrarySource | null>(approvedSource || null);
  const [images, setImages] = useState<LibrarySourceImage[]>(approvedImages);
  useLibraryTopic("source", Boolean(source) && !loading);
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
  const [selectedChange, setSelectedChange] =
    useState<SourceChangeLogEntry | null>(null);
  const [actors, setActors] = useState<Record<string, Profile>>({});
  const [error, setError] = useState<string | null>(null);
  const [coverSaving, setCoverSaving] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const loadSource = useCallback(async () => {
    // A just-approved changeset gives us the authoritative source payload.
    // Keep it visible while the auxiliary images, usage, and audit reads
    // refresh so a React-router navigation does not visibly blink.
    if (visibleSourceRef.current?.id !== sourceId) setLoading(true);
    setError(null);
    setSourceProfilesLoaded(false);
    setSourceProfilesError(null);

    try {
      const [sourceResult, viewer] = await Promise.all([
        getSource(sourceId),
        getLibraryViewer(),
      ]);
      if (!sourceResult.ok) {
        if (sourceResult.status === 404 && canEditSource(viewer)) {
          const proposals = await getSourceChangesets(sourceId);
          const creation = proposals.data?.content.find(changeset => changeset.kind === "CREATE" && (changeset.status === "PENDING" || changeset.status === "APPROVED"));
          if (proposals.ok && creation) {
            navigate(`/library/source/${sourceId}/changesets/${creation.id}`, { replace: true });
            return;
          }
        }
        throw new Error("Unable to load the source.");
      }

      // The source itself is public. Do not let an optional image, usage, or
      // audit request turn a successfully loaded source into “not found”.
      visibleSourceRef.current = sourceResult.data;
      setSource(sourceResult.data);

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
      const removedImageIds = new Set(
        approvedImageOperations.flatMap((operation) =>
          operation.kind === "REMOVE" ? [operation.imageId] : [],
        ),
      );
      const publicPromotionComplete = approvedSourceImagePromotionComplete(
        publishedImagesBeforeApproval,
        loadedImages,
        approvedImageOperations,
        removedImageIds,
      );

      // Do not briefly replace an approved staged image with an old public
      // list while EventBridge promotion is still running.
      setImages(
        approvedImageOperations.length && !publicPromotionComplete
          ? approvedImages
          : loadedImages,
      );
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
  }, [
    approvedImageOperations,
    approvedImages,
    publishedImagesBeforeApproval,
    sourceId,
    navigate,
  ]);

  // Keep the staged replacement visible during Image's asynchronous promotion,
  // then swap it for the durable public record without asking the visitor to
  // reload the source page.
  useEffect(() => {
    if (!sourceId || !approvedImageOperations.length) return;
    let active = true;
    let attempts = 0;
    const refresh = async () => {
      const result = await getSourceImages(sourceId).catch(() => null);
      if (!active || !result?.ok) return;
      const next = Array.isArray(result.data) ? result.data : [];
      const removed = new Set(
        approvedImageOperations.flatMap((operation) =>
          operation.kind === "REMOVE" ? [operation.imageId] : [],
        ),
      );
      if (
        approvedSourceImagePromotionComplete(
          publishedImagesBeforeApproval,
          next,
          approvedImageOperations,
          removed,
        )
      ) {
        setImages(next);
        return;
      }
      attempts += 1;
      if (active && attempts < 40) window.setTimeout(refresh, 750);
    };
    void refresh();
    return () => {
      active = false;
    };
  }, [
    approvedImageOperations,
    publishedImagesBeforeApproval,
    sourceId,
  ]);

  useEffect(() => {
    loadSource();
  }, [loadSource]);

  // Save failures are transient feedback. Keeping them in an overlay prevents
  // a short error message from moving the source layout while it is visible.
  useEffect(() => {
    if (!error || !source) return undefined;
    const timer = window.setTimeout(() => setError(null), 3000);
    return () => window.clearTimeout(timer);
  }, [error, source]);

  const filteredSourceProfiles = useMemo(() => {
    const normalizedFilter = profileFilter.trim().toLocaleLowerCase();
    if (!normalizedFilter) return sourceProfiles;

    return sourceProfiles.filter((profile) =>
      [profile.name, profile.alias, profile.period].some((value) =>
        value?.toLocaleLowerCase().includes(normalizedFilter),
      ),
    );
  }, [profileFilter, sourceProfiles]);
  const setCover = async (imageId: string) => {
    if (!source || coverSaving || imageId === source.coverImageId) return;
    setCoverSaving(true);
    setCoverError(null);
    try {
      const result = await setSourceCover(source.id, imageId);
      if (!result.ok || !result.data) {
        throw new Error(
          result.status === 404
            ? "This photo is no longer available as a cover."
            : "Unable to set the source cover. Please try again.",
        );
      }
      if (visibleSourceRef.current?.id === source.id) {
        visibleSourceRef.current = result.data;
        setSource(result.data);
      }
    } catch (error) {
      setCoverError(getErrorMessage(error));
    } finally {
      setCoverSaving(false);
    }
  };

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

  const sourceDescription = source.description || "";
  const sourceDescriptionMissing = !sourceDescription;
  const sourceDescriptionDisplay = sourceDescription || "No description";
  const imagesById = Object.fromEntries(
    images.map((image) => [image.id, image]),
  );
  const albumImages = images.map((image) => ({
    ...image,
    resourceType: image.resourceType || "source",
    resourceId: image.resourceId || source.id,
  }));
  const cover =
    albumImages.find((image) => image.id === source.coverImageId) ||
    albumImages[0];
  const canEdit = canEditSource(userInfo);
  return (
    <PageLayout
      header={{
        title: (
          <LibraryPeriodBreadcrumb
            period={source.period}
            variant="source"
            trailingItem={{
              label: source.name,
              to: `/library/source/${source.id}`,
            }}
          />
        ),
        backgroundColor: "#f3efe4",
        borderColor: "#d9ccb0",
        rightContent: canEdit ? (
          <div className="d-flex gap-2">
            <LibraryHint
              topic="status"
              priority={20}
              message="Changesets shows this source's proposals, their status, and published history."
            >
              <Link
                to={`/library/source/${source.id}/proposals`}
                className="btn btn-outline-dark btn-sm"
              >
                Changesets
              </Link>
            </LibraryHint>
            <LibraryHint
              topic="proposal"
              priority={10}
              message="Edit source to propose an improvement. Review and submit your changes before another member approves them."
            >
              <Link
                to={`/library/source/${source.id}/edit`}
                className="btn btn-dark btn-sm"
              >
                Edit source
              </Link>
            </LibraryHint>
          </div>
        ) : null,
      }}
    >
      <EntityDetailPage>
        <PageColumns variant="two" className="library-source-columns">
        <PageColumn className="library-source-details">
          <div className="stash-source-copy stash-item-display-copy text-start">
            <div className="stash-item-title">{source.name}</div>
            <EditableDescriptionField
              editable={false}
              value={sourceDescription}
              onValueChange={() => undefined}
              onBlur={() => undefined}
              readOnlyValue={sourceDescriptionDisplay}
              className="mt-1"
              textClassName="stash-item-description"
              placeholderDisplay={sourceDescriptionMissing}
              placeholder="No description"
              rows={5}
              savingTitle="Saving"
              errorTitle="Save failed"
            />
            <div className="mt-3 text-start">
              <div className="d-flex align-items-baseline gap-2 mb-2">
                <span className="editable-field-row-label">Type</span>
                <span>{formatSourceType(source.type)}</span>
              </div>
              <EditableHistoricalRangeField
                label="Years"
                editable={false}
                from={{
                  year: source.from ? String(source.from.year) : "",
                  era: source.from?.era || "AD",
                }}
                to={{
                  year: source.to ? String(source.to.year) : "",
                  era: source.to?.era || "AD",
                }}
                onFromChange={() => undefined}
                onToChange={() => undefined}
                onBlur={() => undefined}
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
                loadRelatedMapContent={() =>
                  loadSourceRelatedMapContent(source, cover)
                }
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
                loadRelatedMapContent={() =>
                  loadSourceRelatedMapContent(source, cover)
                }
                relatedMapScope={{ type: "SOURCE", id: source.id }}
              />
            </div>
          </div>
        </PageColumn>
        <PageColumn className="library-source-images">
          <h2 className="stash-subheading mb-2">Cover</h2>
          <StackedImageGallery
            key={`cover-${source.id}`}
            mode="single"
            images={cover ? [cover] : []}
            title="Source cover"
            emptyText="No source cover yet."
            previewStyle={{ maxHeight: "24rem", objectFit: "contain" }}
            wrapperClassName="source-image-gallery"
          />
          <div className="d-flex align-items-center justify-content-between gap-2 mt-4 mb-2">
            <h2 className="stash-subheading mb-0">Photo album</h2>
            {canEdit && (
              <Link to={`/library/source/${source.id}/edit`}>
                Edit album photos
              </Link>
            )}
          </div>
          <StackedImageGallery
            key={`album-${source.id}`}
            images={albumImages}
            title="Source photo album"
            emptyText="No photos in this album yet."
            previewSize="compact"
            wrapperClassName="source-image-gallery"
            renderImageControls={(image) => (
              <div className="px-3 pt-2">
                {image.id === source.coverImageId ? (
                  <span role="status">Current cover</span>
                ) : canEdit ? (
                  <button
                    type="button"
                    className="btn btn-outline-dark btn-sm"
                    disabled={coverSaving}
                    onClick={() => void setCover(String(image.id))}
                  >
                    {coverSaving ? "Saving cover…" : "Set as cover"}
                  </button>
                ) : null}
                {coverError && (
                  <p role="alert" className="text-danger mt-2">{coverError}</p>
                )}
              </div>
            )}
          />
        </PageColumn>
        <PageColumn className="library-source-posts">
          <PostPanel
            targetType="SOURCE"
            targetId={source.id}
            canCreate={canContribute(userInfo)}
          />
        </PageColumn>
        <PageColumn className="library-source-profiles">
          <details
            className="source-profile-links"
            aria-label="Profiles using this source"
          >
            <summary className="source-profile-links-heading stash-subheading mb-0 source-collapsible-summary">
                Profiles using this source
            </summary>
            <div className="mt-2">
              <TextFilterInput
                value={profileFilter}
                onChange={setProfileFilter}
                placeholder="Filter profiles"
                className="source-profile-filter"
              />
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
            </div>
          </details>
        </PageColumn>
        </PageColumns>
      </EntityDetailPage>

      <details className="stash-shell p-3 mt-4" aria-label="Source change log">
        <summary className="stash-subheading mb-2">Change log</summary>
        {changeLog.length === 0 ? (
          <p className="text-muted mb-0">No recorded changes yet.</p>
        ) : (
          <ol className="list-unstyled d-flex flex-column gap-3 mb-0">
            {changeLog.map((entry) => (
              <li key={entry.id} className="border-bottom pb-2">
                <ChangeLogEntry
                  actorUserId={entry.actorId}
                  proposerUserId={entry.proposerId}
                  action={sourceChangeActionLabel(entry.action)}
                  occurredAt={entry.createdAt}
                  currentUserId={userInfo?.userId}
                  profiles={actors}
                  {...(entry.changesetId
                    ? { onDetails: () => setSelectedChange(entry) }
                    : {})}
                />
              </li>
            ))}
          </ol>
        )}
      </details>
      <SourceChangeLogDiffModal
        entry={selectedChange}
        imagesById={imagesById}
        onHide={() => setSelectedChange(null)}
      />
    </PageLayout>
  );
}

function sourceChangeActionLabel(
  action: SourceChangeLogEntry["action"],
): string {
  return (
    {
      CREATED: "created this source",
      PROPOSAL_APPLIED: "approved and applied a proposal",
      PROPOSAL_REJECTED: "rejected a proposal",
      PROPOSAL_SUPERSEDED: "superseded an outdated proposal",
      CHANGESET_APPLIED: "published a changeset",
      CHANGESET_REJECTED: "rejected a changeset",
      CHANGESET_WITHDRAWN: "withdrew a changeset",
      CHANGESET_SUPERSEDED: "superseded an outdated changeset",
    } satisfies Record<SourceChangeLogEntry["action"], string>
  )[action];
}

function formatSourceType(value: string | null | undefined): string {
  if (!value) return "Other";
  return `${value.slice(0, 1)}${value.slice(1).toLocaleLowerCase()}`;
}

/**
 * Replacements retain the original public image ID. Checking only that ID
 * therefore reports success while Image has not yet promoted the new bytes.
 * Keep the staged image mounted until the public record's URL or thumbnail
 * actually changes; ADD and REMOVE retain their simpler identity checks.
 */
export function approvedSourceImagePromotionComplete(
  publishedBeforeApproval: LibrarySourceImage[],
  publishedNow: LibrarySourceImage[],
  operations: SourceImageOperation[],
  removedImageIds = new Set<string>(),
): boolean {
  const beforeById = new Map(
    publishedBeforeApproval.map((image) => [image.id, image]),
  );
  const nowById = new Map(publishedNow.map((image) => [image.id, image]));
  const addedComplete = operations
    .filter(
      (
        operation,
      ): operation is Extract<SourceImageOperation, { kind: "ADD" }> =>
        operation.kind === "ADD",
    )
    .every((operation) => nowById.has(operation.stagedImageId));
  const replacementsComplete = operations
    .filter(
      (
        operation,
      ): operation is Extract<SourceImageOperation, { kind: "REPLACE" }> =>
        operation.kind === "REPLACE",
    )
    .every((operation) => {
      const before = beforeById.get(operation.imageId);
      const current = nowById.get(operation.imageId);
      if (!current || (!current.url && !current.thumbnailUrl)) return false;
      if (!before) return true;
      return (
        current.url !== before.url ||
        current.thumbnailUrl !== before.thumbnailUrl
      );
    });
  return (
    addedComplete &&
    replacementsComplete &&
    !publishedNow.some((image) => removedImageIds.has(image.id))
  );
}

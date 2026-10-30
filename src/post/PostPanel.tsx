import React, { useEffect, useMemo, useRef, useState } from "react";
import { Form } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { FaCheck, FaPaperPlane, FaPen, FaTimes, FaTrash } from "react-icons/fa";

import ConfirmationModal from "../component/ConfirmationModal";
import IconActionButton from "../component/IconActionButton";
import { formatAppDateTime } from "../i18n/appLocale";
import {
  fetchClubProfiles,
  fetchCurrentUserInfo,
  getProfilesByIds,
  getUserProfileByUserId,
  getUserProfilesByUserIds,
} from "../profile/profileApi";
import ProfileThumbnailLink from "../profile/components/ProfileThumbnailLink";
import ProfilePicker from "../profile/components/ProfilePicker";
import CommentThread from "../comment/CommentThread";
import { listCommentsBatch, type CommentPage } from "../comment/commentApi";
import MapReferenceAttachment, {
  type PublicMapReference,
} from "../map/MapReferenceAttachment";
import MapSnapshotPicker, {
  SelectedMapPreview,
} from "../map/MapSnapshotPicker";
import {
  takeStagedMapAttachmentForTarget,
  takeStagedMapAuthorProfile,
} from "../map/pendingMapAttachment";
import {
  buildProfileLabel,
  resolveCurrentOwnedProfileId,
  useCurrentProfileValue,
} from "../profile/currentProfile";
import { Profile } from "../profile/profileTypes";
import "./posts.css";

type TargetType = "PROFILE" | "CLUB" | "EVENT" | "SOURCE" | "ITEM";
type Post = {
  id: string;
  content: string;
  authorUserId: string;
  authorProfileId?: string;
  createdAt: string;
  updatedAt?: string;
  mapReference?: PublicMapReference;
};
type PostPanelProps = {
  targetType: TargetType;
  targetId: string | number;
  canCreate?: boolean;
};

const SendIcon = FaPaperPlane as React.ComponentType<{
  "aria-hidden"?: boolean;
}>;
const EditIcon = FaPen as React.ComponentType<{ "aria-hidden"?: boolean }>;
const DeleteIcon = FaTrash as React.ComponentType<{ "aria-hidden"?: boolean }>;
const SaveIcon = FaCheck as React.ComponentType<{ "aria-hidden"?: boolean }>;
const CancelIcon = FaTimes as React.ComponentType<{ "aria-hidden"?: boolean }>;

function hasBeenEdited(post: Post) {
  return Boolean(post.updatedAt && post.updatedAt !== post.createdAt);
}

function getClubProfiles(userId: string) {
  return new Promise<Profile[]>((resolve) => {
    fetchClubProfiles(userId, {
      onSuccess: (profiles) => resolve(Array.isArray(profiles) ? profiles : []),
      onError: () => resolve([]),
    });
  });
}

export default function PostPanel({
  targetType,
  targetId,
  canCreate = false,
}: PostPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentProfileValue = useCurrentProfileValue();
  const [posts, setPosts] = useState<Post[]>([]);
  const [commentPages, setCommentPages] = useState<Record<string, CommentPage>>(
    {},
  );
  const [commentPagesReady, setCommentPagesReady] = useState(false);
  const postElements = useRef<Record<string, HTMLElement | null>>({});
  const [authors, setAuthors] = useState<Record<string, Profile | null>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [ownedProfiles, setOwnedProfiles] = useState<Profile[]>([]);
  const [selectedAuthorProfileId, setSelectedAuthorProfileId] = useState<
    string | null
  >(null);
  const [draft, setDraft] = useState("");
  const [selectedMapReference, setSelectedMapReference] =
    useState<PublicMapReference | null>(null);
  const [editMapReference, setEditMapReference] =
    useState<PublicMapReference | null>(null);
  const [editMapChanged, setEditMapChanged] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editAuthorProfileId, setEditAuthorProfileId] = useState<string | null>(
    null,
  );
  const [deletingPost, setDeletingPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetchCurrentUserInfo((result) => {
      if (!active) return;
      setCurrentUserId(result.currentUserId);
      if (!result.currentUserId) {
        setCurrentProfileId(null);
        setOwnedProfiles([]);
        setSelectedAuthorProfileId(null);
        return;
      }
      Promise.all([
        getUserProfileByUserId(result.currentUserId),
        getClubProfiles(result.currentUserId),
      ])
        .then(([userProfile, clubProfiles]) => {
          if (!active) return;
          const profiles = [
            ...(userProfile ? [userProfile] : []),
            ...clubProfiles,
          ];
          const currentId = resolveCurrentOwnedProfileId(profiles);
          setOwnedProfiles(profiles);
          setCurrentProfileId(currentId);
          setSelectedAuthorProfileId((selected) =>
            selected &&
            profiles.some((profile) => String(profile.id) === selected)
              ? selected
              : currentId,
          );
        })
        .catch(() => {
          if (active) {
            setCurrentProfileId(null);
            setOwnedProfiles([]);
            setSelectedAuthorProfileId(null);
          }
        });
    });
    return () => {
      active = false;
    };
  }, [targetId, targetType]);
  useEffect(() => {
    const navigationState = location.state as {
      mapAttachment?: PublicMapReference;
      mapAuthorProfileId?: string;
      mapTarget?: { type?: string; id?: string };
    } | null;
    const stateAttachment =
      navigationState?.mapTarget?.type === targetType &&
      navigationState.mapTarget.id === String(targetId)
        ? navigationState.mapAttachment
        : null;
    const staged =
      stateAttachment ||
      takeStagedMapAttachmentForTarget({
        type: targetType,
        id: String(targetId),
      });
    if (staged) {
      setSelectedMapReference(staged);
      const authorProfileId =
        navigationState?.mapAuthorProfileId || takeStagedMapAuthorProfile();
      if (authorProfileId) setSelectedAuthorProfileId(authorProfileId);
      // Browser history state survives a reload. Consume the one-shot handoff
      // immediately so a successfully posted map is never offered again.
      if (stateAttachment)
        navigate(`${location.pathname}${location.search}`, {
          replace: true,
          state: null,
        });
    }
  }, [
    location.pathname,
    location.search,
    location.state,
    navigate,
    targetId,
    targetType,
  ]);

  // Keep the composer on the page that is already open, but immediately use
  // the newly selected profile as its default author.
  useEffect(() => {
    if (!ownedProfiles.length) return;
    if (
      selectedAuthorProfileId &&
      ownedProfiles.some(
        (profile) => String(profile.id) === selectedAuthorProfileId,
      )
    )
      return;
    const currentId = resolveCurrentOwnedProfileId(ownedProfiles);
    setCurrentProfileId(currentId);
    setSelectedAuthorProfileId(currentId);
  }, [currentProfileValue, ownedProfiles, selectedAuthorProfileId]);

  useEffect(() => {
    let active = true;
    setError("");
    // Keep post comment threads dormant until their shared first-page batch
    // arrives. Clear an old wall before requesting a new one as well.
    setCommentPagesReady(false);
    setCommentPages({});
    setPosts([]);
    fetch(
      `/api/post/posts?${new URLSearchParams({ targetType, targetId: String(targetId) })}`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load posts");
        return response.json() as Promise<{ content: Post[] }>;
      })
      .then((page) => {
        if (!active) return;
        // This must happen in the same update as the new post rows. An effect
        // runs after those rows mount, which previously left one render where
        // every CommentThread started an individual legacy request.
        setCommentPagesReady(false);
        setCommentPages({});
        setPosts(page.content);
      })
      .catch(() => {
        if (active) setError("Unable to load posts right now.");
      });
    return () => {
      active = false;
    };
  }, [targetId, targetType]);

  const authorReferences = useMemo(
    () =>
      Array.from(
        new Map(
          posts.map((post) => {
            const key = post.authorProfileId
              ? `profile:${post.authorProfileId}`
              : `user:${post.authorUserId}`;
            return [
              key,
              {
                key,
                profileId: post.authorProfileId,
                userId: post.authorUserId,
              },
            ];
          }),
        ).values(),
      ),
    [posts],
  );

  const ownedProfileOptions = useMemo(
    () =>
      ownedProfiles.map((profile) => ({
        value: String(profile.id),
        label: buildProfileLabel(profile),
        profile,
      })),
    [ownedProfiles],
  );

  useEffect(() => {
    let active = true;
    const missingAuthors = authorReferences.filter(
      (author) => !(author.key in authors),
    );
    if (!missingAuthors.length)
      return () => {
        active = false;
      };
    const profileIds = missingAuthors.flatMap((author) =>
      author.profileId ? [author.profileId] : [],
    );
    const userIds = missingAuthors
      .filter((author) => !author.profileId)
      .map((author) => author.userId);
    Promise.all([
      getProfilesByIds(profileIds),
      getUserProfilesByUserIds(userIds),
    ])
      .then(([profileAuthors, userAuthors]) => {
        const byProfileId = new Map(
          profileAuthors.map((profile) => [String(profile.id), profile]),
        );
        const byUserId = new Map(
          userAuthors.map((profile) => [String(profile.userId), profile]),
        );
        const entries = missingAuthors.map(
          (author) =>
            [
              author.key,
              author.profileId
                ? byProfileId.get(String(author.profileId)) || null
                : byUserId.get(String(author.userId)) || null,
            ] as const,
        );
        if (active)
          setAuthors((current) => ({
            ...current,
            ...Object.fromEntries(entries),
          }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [authorReferences, authors]);

  useEffect(() => {
    const ids = posts.map((post) => post.id);
    if (!ids.length) {
      setCommentPages({});
      setCommentPagesReady(true);
      return;
    }
    let active = true;
    setCommentPagesReady(false);
    void listCommentsBatch("POST", ids)
      .then((pages) => {
        if (active) setCommentPages(pages);
      })
      .catch(() => {
        if (active) setCommentPages({});
      })
      .finally(() => {
        if (active) setCommentPagesReady(true);
      });
    return () => {
      active = false;
    };
  }, [posts]);

  const publish = async () => {
    if (!draft.trim() && !selectedMapReference) return;
    setBusy(true);
    setError("");
    try {
      if (!selectedAuthorProfileId) throw new Error();
      const response = await fetch("/api/post/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId: String(targetId),
          authorProfileId: selectedAuthorProfileId,
          content: draft.trim() || "Shared a map",
          ...(selectedMapReference
            ? { mapReference: selectedMapReference }
            : {}),
        }),
      });
      if (!response.ok) throw new Error();
      const post = (await response.json()) as Post;
      setPosts((current) => [post, ...current]);
      window.requestAnimationFrame(() =>
        postElements.current[post.id]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      );
      setDraft("");
      setSelectedMapReference(null);
    } catch {
      setError("Unable to publish this post right now.");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editingPostId || !editDraft.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (!editAuthorProfileId) throw new Error();
      const response = await fetch(
        `/api/post/posts/${encodeURIComponent(editingPostId)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            content: editDraft,
            authorProfileId: editAuthorProfileId,
            ...(editMapChanged ? { mapReference: editMapReference } : {}),
          }),
        },
      );
      if (!response.ok) throw new Error();
      const updatedPost = (await response.json()) as Post;
      setPosts((current) =>
        current.map((post) =>
          post.id === updatedPost.id ? updatedPost : post,
        ),
      );
      setEditingPostId(null);
      setEditDraft("");
      setEditAuthorProfileId(null);
    } catch {
      setError("Unable to save this post right now.");
    } finally {
      setBusy(false);
    }
  };

  const beginEditing = (post: Post) => {
    setEditingPostId(post.id);
    setEditDraft(post.content);
    setEditMapReference(post.mapReference || null);
    setEditMapChanged(false);
    // Editing starts with the author already assigned to the post. The
    // current picker selection is only a fallback for legacy posts which did
    // not persist an author profile.
    setEditAuthorProfileId(post.authorProfileId ?? currentProfileId);
  };

  const deletePost = async () => {
    if (!deletingPost) return;
    setDeleteBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/post/posts/${encodeURIComponent(deletingPost.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error();
      setPosts((current) =>
        current.filter((post) => post.id !== deletingPost.id),
      );
      setDeletingPost(null);
    } catch {
      setError("Unable to delete this post right now.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <section className="post-panel" aria-label="Posts">
      <h2>Posts</h2>
      {error && <p className="text-danger">{error}</p>}
      {canCreate && (
        <div className="post-composer-wrap">
          <Form.Control
            as="textarea"
            rows={3}
            className="post-composer"
            value={draft}
            maxLength={5000}
            placeholder="Write a post"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="post-composer-actions">
            <div className="post-author-select">
              <span>Send as</span>
              <ProfilePicker
                ariaLabel="Post author profile"
                value={selectedAuthorProfileId}
                options={ownedProfileOptions}
                disabled={busy || !ownedProfiles.length}
                onChange={(value) => setSelectedAuthorProfileId(value)}
              />
            </div>
            <IconActionButton
              title="Publish post"
              disabled={
                busy ||
                (!draft.trim() && !selectedMapReference) ||
                !selectedAuthorProfileId
              }
              onClick={() => void publish()}
              size="2rem"
              fontSize="0.8rem"
              borderColor="#343a40"
              color="#fff"
              backgroundColor="#343a40"
            >
              <SendIcon aria-hidden />
            </IconActionButton>
            <MapSnapshotPicker onSelect={setSelectedMapReference} />
            {selectedMapReference && (
              <SelectedMapPreview
                reference={selectedMapReference}
                onRemove={() => setSelectedMapReference(null)}
              />
            )}
          </div>
        </div>
      )}
      {posts.length === 0 ? (
        <p className="text-muted mb-0">No posts yet.</p>
      ) : (
        <div className="d-flex flex-column gap-2">
          {posts.map((post) => {
            const authorKey = post.authorProfileId
              ? `profile:${post.authorProfileId}`
              : `user:${post.authorUserId}`;
            const author = authors[authorKey];
            const canManagePost = currentUserId === post.authorUserId;
            const editing = editingPostId === post.id;
            return (
              <article
                key={post.id}
                ref={(element) => {
                  postElements.current[post.id] = element;
                }}
                className="post-entry"
              >
                <div className="post-entry-header">
                  {author ? (
                    <ProfileThumbnailLink
                      profile={author}
                      className="post-author"
                    />
                  ) : authorKey in authors ? (
                    <span className="post-author-unavailable">
                      Profile unavailable
                    </span>
                  ) : (
                    <span className="post-author-unavailable">
                      Loading profile...
                    </span>
                  )}
                </div>
                {canManagePost && !editing && (
                  <div className="post-entry-controls">
                    <IconActionButton
                      title="Edit post"
                      disabled={busy}
                      onClick={() => beginEditing(post)}
                      size="1.75rem"
                      fontSize="0.72rem"
                    >
                      <EditIcon aria-hidden />
                    </IconActionButton>
                    <IconActionButton
                      title="Delete post"
                      disabled={busy}
                      onClick={() => setDeletingPost(post)}
                      size="1.75rem"
                      fontSize="0.72rem"
                      borderColor="rgba(160, 68, 68, 0.24)"
                      color="#9c3b3b"
                      backgroundColor="rgba(252, 241, 241, 0.92)"
                    >
                      <DeleteIcon aria-hidden />
                    </IconActionButton>
                  </div>
                )}
                {editing ? (
                  <div className="post-edit-wrap">
                    <Form.Control
                      as="textarea"
                      rows={3}
                      className="post-composer"
                      value={editDraft}
                      maxLength={5000}
                      onChange={(event) => setEditDraft(event.target.value)}
                    />
                    <div className="post-composer-actions">
                      <div className="post-author-select">
                        <span>Send as</span>
                        <ProfilePicker
                          ariaLabel="Edit post author profile"
                          value={editAuthorProfileId}
                          options={ownedProfileOptions}
                          disabled={busy || !ownedProfiles.length}
                          onChange={(value) => setEditAuthorProfileId(value)}
                        />
                      </div>
                      <div className="post-edit-controls">
                        <IconActionButton
                          title="Save post"
                          disabled={
                            busy || !editDraft.trim() || !editAuthorProfileId
                          }
                          onClick={() => void saveEdit()}
                          size="1.75rem"
                          fontSize="0.72rem"
                          borderColor="#343a40"
                          color="#fff"
                          backgroundColor="#343a40"
                        >
                          <SaveIcon aria-hidden />
                        </IconActionButton>
                        <IconActionButton
                          title="Cancel editing"
                          disabled={busy}
                          onClick={() => {
                            setEditingPostId(null);
                            setEditDraft("");
                            setEditAuthorProfileId(null);
                            setEditMapReference(null);
                            setEditMapChanged(false);
                          }}
                          size="1.75rem"
                          fontSize="0.72rem"
                        >
                          <CancelIcon aria-hidden />
                        </IconActionButton>
                      </div>
                      <MapSnapshotPicker
                        onSelect={(reference) => {
                          setEditMapReference(reference);
                          setEditMapChanged(true);
                        }}
                      />
                      {editMapReference && (
                        <SelectedMapPreview
                          reference={editMapReference}
                          onRemove={() => {
                            setEditMapReference(null);
                            setEditMapChanged(true);
                          }}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="post-entry-content">{post.content}</div>
                )}
                {post.mapReference && (
                  <MapReferenceAttachment
                    reference={post.mapReference}
                    className="post-map-reference-attachment"
                  />
                )}
                <div className="post-entry-meta">
                  <time className="text-muted small" dateTime={post.createdAt}>
                    {formatAppDateTime(post.createdAt)}
                  </time>
                  {hasBeenEdited(post) && (
                    <span className="post-edited">Edited</span>
                  )}
                </div>
                <CommentThread
                  targetType="POST"
                  targetId={post.id}
                  initialPage={commentPages[post.id]}
                  deferInitialLoad={!commentPagesReady}
                />
              </article>
            );
          })}
        </div>
      )}
      <ConfirmationModal
        show={deletingPost != null}
        title="Delete post"
        message="Are you sure you want to delete this post?"
        confirmLabel="Delete"
        busy={deleteBusy}
        onHide={() => {
          if (!deleteBusy) setDeletingPost(null);
        }}
        onConfirm={() => {
          void deletePost();
        }}
      />
    </section>
  );
}

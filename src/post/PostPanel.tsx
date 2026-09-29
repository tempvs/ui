import React, { useEffect, useMemo, useState } from "react";
import { Form } from "react-bootstrap";
import { FaCheck, FaPaperPlane, FaPen, FaTimes, FaTrash } from "react-icons/fa";

import ConfirmationModal from "../component/ConfirmationModal";
import IconActionButton from "../component/IconActionButton";
import { fetchCurrentUserInfo, getUserProfileByUserId } from "../profile/profileApi";
import ProfileThumbnailLink from "../profile/components/ProfileThumbnailLink";
import { Profile } from "../profile/profileTypes";
import "./posts.css";

type TargetType = "PROFILE" | "CLUB" | "SOURCE";
type Post = { id: string; content: string; authorUserId: string; createdAt: string; updatedAt?: string };
type PostPanelProps = { targetType: TargetType; targetId: string | number; canCreate?: boolean };

const SendIcon = FaPaperPlane as React.ComponentType<{ "aria-hidden"?: boolean }>;
const EditIcon = FaPen as React.ComponentType<{ "aria-hidden"?: boolean }>;
const DeleteIcon = FaTrash as React.ComponentType<{ "aria-hidden"?: boolean }>;
const SaveIcon = FaCheck as React.ComponentType<{ "aria-hidden"?: boolean }>;
const CancelIcon = FaTimes as React.ComponentType<{ "aria-hidden"?: boolean }>;

function hasBeenEdited(post: Post) {
  return Boolean(post.updatedAt && post.updatedAt !== post.createdAt);
}

export default function PostPanel({ targetType, targetId, canCreate = false }: PostPanelProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [authors, setAuthors] = useState<Record<string, Profile | null>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deletingPost, setDeletingPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCurrentUserInfo(result => { if (active) setCurrentUserId(result.currentUserId); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setError("");
    fetch(`/api/post/posts?${new URLSearchParams({ targetType, targetId: String(targetId) })}`)
      .then(async response => {
        if (!response.ok) throw new Error("Unable to load posts");
        return response.json() as Promise<{ content: Post[] }>;
      })
      .then(page => { if (active) setPosts(page.content); })
      .catch(() => { if (active) setError("Unable to load posts right now."); });
    return () => { active = false; };
  }, [targetId, targetType]);

  const authorUserIds = useMemo(
    () => Array.from(new Set(posts.map(post => post.authorUserId).filter(Boolean))),
    [posts],
  );

  useEffect(() => {
    let active = true;
    const missingAuthorIds = authorUserIds.filter(authorUserId => !(authorUserId in authors));
    if (!missingAuthorIds.length) return () => { active = false; };
    Promise.all(missingAuthorIds.map(async authorUserId => {
      try { return [authorUserId, await getUserProfileByUserId(authorUserId)] as const; }
      catch { return [authorUserId, null] as const; }
    })).then(entries => {
      if (active) setAuthors(current => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => { active = false; };
  }, [authorUserIds, authors]);

  const publish = async () => {
    if (!draft.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/post/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetType, targetId: String(targetId), content: draft }) });
      if (!response.ok) throw new Error();
      const post = await response.json() as Post;
      setPosts(current => [post, ...current]);
      setDraft("");
    } catch { setError("Unable to publish this post right now."); }
    finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editingPostId || !editDraft.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/post/posts/${encodeURIComponent(editingPostId)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: editDraft }) });
      if (!response.ok) throw new Error();
      const updatedPost = await response.json() as Post;
      setPosts(current => current.map(post => post.id === updatedPost.id ? updatedPost : post));
      setEditingPostId(null); setEditDraft("");
    } catch { setError("Unable to save this post right now."); }
    finally { setBusy(false); }
  };

  const deletePost = async () => {
    if (!deletingPost) return;
    setDeleteBusy(true); setError("");
    try {
      const response = await fetch(`/api/post/posts/${encodeURIComponent(deletingPost.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setPosts(current => current.filter(post => post.id !== deletingPost.id));
      setDeletingPost(null);
    } catch { setError("Unable to delete this post right now."); }
    finally { setDeleteBusy(false); }
  };

  return <section className="post-panel" aria-label="Posts">
    <h2>Posts</h2>
    {error && <p className="text-danger">{error}</p>}
    {canCreate && <div className="post-composer-wrap">
      <Form.Control as="textarea" rows={3} className="post-composer" value={draft} maxLength={5000} placeholder="Write a post" onChange={event => setDraft(event.target.value)} />
      <div className="post-composer-actions"><IconActionButton title="Publish post" disabled={busy || !draft.trim()} onClick={() => void publish()} size="2rem" fontSize="0.8rem" borderColor="#343a40" color="#fff" backgroundColor="#343a40"><SendIcon aria-hidden /></IconActionButton></div>
    </div>}
    {posts.length === 0 ? <p className="text-muted mb-0">No posts yet.</p> : <div className="d-flex flex-column gap-2">
      {posts.map(post => {
        const author = authors[post.authorUserId];
        const canManagePost = currentUserId === post.authorUserId;
        const editing = editingPostId === post.id;
        return <article key={post.id} className="post-entry">
          <div className="post-entry-header">{author ? <ProfileThumbnailLink profile={author} className="post-author" /> : <span className="post-author-unavailable">Profile unavailable</span>}</div>
          {canManagePost && !editing && <div className="post-entry-controls">
            <IconActionButton title="Edit post" disabled={busy} onClick={() => { setEditingPostId(post.id); setEditDraft(post.content); }} size="1.75rem" fontSize="0.72rem"><EditIcon aria-hidden /></IconActionButton>
            <IconActionButton title="Delete post" disabled={busy} onClick={() => setDeletingPost(post)} size="1.75rem" fontSize="0.72rem" borderColor="rgba(160, 68, 68, 0.24)" color="#9c3b3b" backgroundColor="rgba(252, 241, 241, 0.92)"><DeleteIcon aria-hidden /></IconActionButton>
          </div>}
          {editing ? <div className="post-edit-wrap">
            <Form.Control as="textarea" rows={3} className="post-composer" value={editDraft} maxLength={5000} onChange={event => setEditDraft(event.target.value)} />
            <div className="post-composer-actions"><IconActionButton title="Save post" disabled={busy || !editDraft.trim()} onClick={() => void saveEdit()} size="1.75rem" fontSize="0.72rem" borderColor="#343a40" color="#fff" backgroundColor="#343a40"><SaveIcon aria-hidden /></IconActionButton><IconActionButton title="Cancel editing" disabled={busy} onClick={() => { setEditingPostId(null); setEditDraft(""); }} size="1.75rem" fontSize="0.72rem"><CancelIcon aria-hidden /></IconActionButton></div>
          </div> : <div className="post-entry-content">{post.content}</div>}
          <div className="post-entry-meta"><time className="text-muted small" dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time>{hasBeenEdited(post) && <span className="post-edited">Edited</span>}</div>
        </article>;
      })}
    </div>}
    <ConfirmationModal show={deletingPost != null} title="Delete post" message="Are you sure you want to delete this post?" confirmLabel="Delete" busy={deleteBusy} onHide={() => { if (!deleteBusy) setDeletingPost(null); }} onConfirm={() => { void deletePost(); }} />
  </section>;
}

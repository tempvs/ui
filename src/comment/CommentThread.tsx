import React, { useEffect, useMemo, useState } from "react";
import { Form } from "react-bootstrap";
import { FaCheck, FaPaperPlane, FaPen, FaTimes, FaTrash } from "react-icons/fa";

import ConfirmationModal from "../component/ConfirmationModal";
import IconActionButton from "../component/IconActionButton";
import { fetchClubProfiles, fetchCurrentUserInfo, fetchProfileById, getUserProfileByUserId } from "../profile/profileApi";
import ProfilePicker from "../profile/components/ProfilePicker";
import ProfileThumbnailLink from "../profile/components/ProfileThumbnailLink";
import { buildProfileLabel, resolveCurrentOwnedProfileId } from "../profile/currentProfile";
import type { Profile } from "../profile/profileTypes";
import { createComment, deleteComment, listComments, type Comment, type CommentTargetType, updateComment } from "./commentApi";
import "./comments.css";

const SendIcon = FaPaperPlane as React.ComponentType<{ "aria-hidden"?: boolean }>;
const EditIcon = FaPen as React.ComponentType<{ "aria-hidden"?: boolean }>;
const DeleteIcon = FaTrash as React.ComponentType<{ "aria-hidden"?: boolean }>;
const SaveIcon = FaCheck as React.ComponentType<{ "aria-hidden"?: boolean }>;
const CancelIcon = FaTimes as React.ComponentType<{ "aria-hidden"?: boolean }>;

function profileById(id: string) {
  return new Promise<Profile | null>(resolve => fetchProfileById(id, { onSuccess: resolve, onMissing: () => resolve(null), onError: () => resolve(null) }));
}
function clubProfiles(userId: string) {
  return new Promise<Profile[]>(resolve => fetchClubProfiles(userId, { onSuccess: value => resolve(value || []), onError: () => resolve([]) }));
}

export default function CommentThread({ targetType, targetId }: { targetType: CommentTargetType; targetId: string | number }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({});
  const [owned, setOwned] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [removing, setRemoving] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { let active = true; listComments(targetType, targetId).then(page => { if (active) setComments(page.content); }).catch(() => { if (active) setError("Unable to load comments right now."); }); return () => { active = false; }; }, [targetId, targetType]);
  useEffect(() => { let active = true; fetchCurrentUserInfo(result => { if (!active || !result.currentUserId) return; Promise.all([getUserProfileByUserId(result.currentUserId), clubProfiles(result.currentUserId)]).then(([personal, clubs]) => { if (!active) return; const available = [...(personal ? [personal] : []), ...clubs]; setOwned(available); setSelectedProfile(resolveCurrentOwnedProfileId(available)); }); }); return () => { active = false; }; }, []);
  const ids = useMemo(() => Array.from(new Set(comments.map(comment => comment.authorProfileId))), [comments]);
  useEffect(() => { let active = true; const missing = ids.filter(id => !(id in profiles)); if (!missing.length) return () => { active = false; }; Promise.all(missing.map(async id => [id, await profileById(id)] as const)).then(items => { if (active) setProfiles(current => ({ ...current, ...Object.fromEntries(items) })); }); return () => { active = false; }; }, [ids, profiles]);
  const options = useMemo(() => owned.map(profile => ({ value: String(profile.id), label: buildProfileLabel(profile), profile })), [owned]);
  const submit = async () => { if (!draft.trim() || !selectedProfile) return; setBusy(true); setError(""); try { const comment = await createComment(targetType, targetId, selectedProfile, draft); setComments(current => [...current, comment]); setDraft(""); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } };
  const save = async () => { if (!editing || !editDraft.trim()) return; setBusy(true); setError(""); try { const updated = await updateComment(editing, editDraft); setComments(current => current.map(comment => comment.id === updated.id ? updated : comment)); setEditing(null); setEditDraft(""); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } };
  const remove = async () => { if (!removing) return; setBusy(true); setError(""); try { await deleteComment(removing.id); setComments(current => current.filter(comment => comment.id !== removing.id)); setRemoving(null); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } };
  return <section className="comment-thread" aria-label="Comments">
    <h3>Comments</h3>
    {error && <p className="text-danger small">{error}</p>}
    {comments.map(comment => { const profile = profiles[comment.authorProfileId]; const canManage = owned.some(item => String(item.id) === comment.authorProfileId); const isEditing = editing === comment.id; return <article className="comment-entry" key={comment.id}>
      <div className="comment-entry-header">{profile ? <ProfileThumbnailLink profile={profile} /> : <span className="text-muted small">Loading profile…</span>}{canManage && !isEditing && <span className="comment-controls"><IconActionButton title="Edit comment" size="1.5rem" fontSize="0.62rem" onClick={() => { setEditing(comment.id); setEditDraft(comment.content); }}><EditIcon aria-hidden /></IconActionButton><IconActionButton title="Delete comment" size="1.5rem" fontSize="0.62rem" onClick={() => setRemoving(comment)}><DeleteIcon aria-hidden /></IconActionButton></span>}</div>
      {isEditing ? <div className="comment-edit"><Form.Control as="textarea" rows={2} maxLength={2000} value={editDraft} onChange={event => setEditDraft(event.target.value)} /><IconActionButton title="Save comment" size="1.55rem" fontSize="0.62rem" disabled={busy || !editDraft.trim()} onClick={() => void save()}><SaveIcon aria-hidden /></IconActionButton><IconActionButton title="Cancel editing" size="1.55rem" fontSize="0.62rem" onClick={() => { setEditing(null); setEditDraft(""); }}><CancelIcon aria-hidden /></IconActionButton></div> : <p className="comment-content">{comment.content}</p>}
      <time className="text-muted small" dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}{comment.edited ? " · Edited" : ""}</time>
    </article>; })}
    {owned.length > 0 && <div className="comment-composer"><Form.Control as="textarea" rows={2} maxLength={2000} placeholder="Leave a comment" value={draft} onChange={event => setDraft(event.target.value)} /><div className="comment-composer-actions"><ProfilePicker ariaLabel="Comment author profile" value={selectedProfile} options={options} disabled={busy} onChange={setSelectedProfile} /><IconActionButton title="Post comment" size="1.75rem" fontSize="0.72rem" disabled={busy || !draft.trim() || !selectedProfile} onClick={() => void submit()}><SendIcon aria-hidden /></IconActionButton></div></div>}
    <ConfirmationModal show={removing !== null} title="Delete comment" message="Are you sure you want to delete this comment?" confirmLabel="Delete" busy={busy} onHide={() => { if (!busy) setRemoving(null); }} onConfirm={() => { void remove(); }} />
  </section>;
}

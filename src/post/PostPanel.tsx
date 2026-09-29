import React, { useEffect, useState } from 'react';
import { Button, Form } from 'react-bootstrap';

type TargetType = 'PROFILE' | 'CLUB' | 'SOURCE';
type Post = { id: string; content: string; createdAt: string };

export default function PostPanel({ targetType, targetId, canCreate = false }: { targetType: TargetType; targetId: string | number; canCreate?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]); const [draft, setDraft] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; fetch(`/api/post/posts?${new URLSearchParams({ targetType, targetId: String(targetId) })}`).then(async response => { if (!response.ok) throw new Error('Unable to load posts'); return response.json() as Promise<{ content: Post[] }>; }).then(page => { if (active) setPosts(page.content); }).catch(() => { if (active) setError('Unable to load posts right now.'); }); return () => { active = false; }; }, [targetId, targetType]);
  const publish = async () => { if (!draft.trim()) return; setBusy(true); setError(''); try { const response = await fetch('/api/post/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetType, targetId: String(targetId), content: draft }) }); if (!response.ok) throw new Error(); const post = await response.json() as Post; setPosts(current => [post, ...current]); setDraft(''); } catch { setError('Unable to publish this post right now.'); } finally { setBusy(false); } };
  return <section className="post-panel" aria-label="Posts"><h2>Posts</h2>{error && <p className="text-danger">{error}</p>}{canCreate && <div className="mb-3"><Form.Control as="textarea" rows={3} className="post-composer" value={draft} maxLength={5000} placeholder="Write a post" onChange={event => setDraft(event.target.value)} /><Button className="mt-2" size="sm" variant="dark" disabled={busy || !draft.trim()} onClick={() => void publish()}>Post</Button></div>}{posts.length === 0 ? <p className="text-muted mb-0">No posts yet.</p> : <div className="d-flex flex-column gap-2">{posts.map(post => <article key={post.id} className="post-entry"><div>{post.content}</div><time className="text-muted small" dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time></article>)}</div>}</section>;
}

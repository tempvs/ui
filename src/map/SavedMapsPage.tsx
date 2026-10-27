import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Button, Form } from "react-bootstrap";
import { FaCopy as CopyIcon, FaPen as PenIcon, FaTrash as TrashIcon } from "react-icons/fa";
import { Link } from "react-router-dom";
import PageLayout from "../component/PageLayout";
import SectionBreadcrumb from "../component/SectionBreadcrumb";
import { publicMapReferencePath } from "./MapReferenceAttachment";
import { deleteMapSnapshot, listMyMapSnapshots, renameMapSnapshot, type MapSnapshot } from "./mapApi";
const FaCopy = CopyIcon as ComponentType<{ "aria-hidden"?: boolean }>;
const FaPen = PenIcon as ComponentType<{ "aria-hidden"?: boolean }>;
const FaTrash = TrashIcon as ComponentType<{ "aria-hidden"?: boolean }>;

const scopeLabel = (snapshot: MapSnapshot) => snapshot.scope ? `${snapshot.scope.type[0]}${snapshot.scope.type.slice(1).toLowerCase()} map` : "Map view";

export default function SavedMapsPage() {
  const [items, setItems] = useState<MapSnapshot[]>([]);
  const [profile, setProfile] = useState("all");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  useEffect(() => { void listMyMapSnapshots().then(setItems).catch(() => setError("Unable to load saved maps.")); }, []);
  const profiles = useMemo(() => Array.from(new Set(items.map((item) => item.profileId).filter((value): value is string => Boolean(value)))), [items]);
  const visible = items.filter((item) => profile === "all" || (profile === "none" ? !item.profileId : item.profileId === profile));
  const copy = async (item: MapSnapshot) => { try { await navigator.clipboard.writeText(`${window.location.origin}${publicMapReferencePath(item.reference)}`); } catch { setError("Copy the map link from the opened map instead."); } };
  const rename = async (item: MapSnapshot) => { const next = title.trim(); if (!next) return; try { const updated = await renameMapSnapshot(item.id, next); setItems((current) => current.map((value) => value.id === updated.id ? updated : value)); setEditing(null); } catch { setError("Unable to rename saved map."); } };
  const remove = async (item: MapSnapshot) => { if (!window.confirm(`Delete saved map “${item.title}”?`)) return; try { await deleteMapSnapshot(item.id); setItems((current) => current.filter((value) => value.id !== item.id)); } catch { setError("Unable to delete saved map."); } };
  return <PageLayout header={{ title: <SectionBreadcrumb items={[{ label: "Map", to: "/map" }, { label: "Saved maps" }]} /> }}><section className="club-panel saved-maps-page"><div className="d-flex justify-content-between align-items-center gap-3 flex-wrap"><div><h1>Saved maps</h1><p className="text-muted mb-0">Saved views are private to you until you attach one in a message, post, or comment. Private content is never stored in an attachment.</p></div><Link className="btn btn-outline-dark" to="/map">Back to map</Link></div><Form.Group className="mt-3"><Form.Label htmlFor="saved-map-profile">Profile</Form.Label><Form.Select id="saved-map-profile" value={profile} onChange={(event) => setProfile(event.target.value)}><option value="all">All my profiles</option><option value="none">No profile</option>{profiles.map((id) => <option key={id} value={id}>Profile {id}</option>)}</Form.Select></Form.Group>{error && <p className="text-danger mt-3">{error}</p>}<div className="mt-3 d-flex flex-column gap-2">{visible.map((item) => <article className="saved-map-card" key={item.id}><div className="saved-map-thumbnail" aria-hidden>{item.reference.placeName || "Map"}</div><div className="flex-grow-1">{editing === item.id ? <Form onSubmit={(event) => { event.preventDefault(); void rename(item); }}><Form.Control aria-label="Saved map title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} autoFocus /></Form> : <><h2 className="h6 mb-1">{item.title}</h2><p className="small text-muted mb-1">{item.reference.placeName || `${item.reference.latitude.toFixed(3)}, ${item.reference.longitude.toFixed(3)}`} · {scopeLabel(item)} · {item.profileId ? `Profile ${item.profileId}` : "No profile"}</p><time className="small text-muted" dateTime={item.updatedAt}>Saved {new Date(item.updatedAt).toLocaleString()}</time></>}</div><div className="d-flex gap-1 align-items-start"><Link className="btn btn-sm btn-outline-dark" aria-label={`Open ${item.title}`} to={publicMapReferencePath(item.reference)}>Open</Link><Button size="sm" variant="outline-dark" aria-label={`Copy ${item.title} link`} title="Copy public map link" onClick={() => void copy(item)}><FaCopy aria-hidden /></Button>{editing === item.id ? <Button size="sm" variant="dark" onClick={() => void rename(item)}>Save</Button> : <Button size="sm" variant="outline-dark" aria-label={`Rename ${item.title}`} onClick={() => { setEditing(item.id); setTitle(item.title); }}><FaPen aria-hidden /></Button>}<Button size="sm" variant="outline-danger" aria-label={`Delete ${item.title}`} onClick={() => void remove(item)}><FaTrash aria-hidden /></Button></div></article>)}</div>{!visible.length && !error && <p className="text-muted mt-3">No saved maps for this profile yet.</p>}</section></PageLayout>;
}

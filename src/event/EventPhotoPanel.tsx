import React, { useEffect, useRef, useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import StackedImageGallery, { type GalleryImage } from '../component/StackedImageGallery';
import { deleteEventImage, EventImage, getEventImages, updateEventImageDescription, uploadEventImage } from './eventApi';

export default function EventPhotoPanel({ eventId, name, editable }: { eventId: string; name: string; editable: boolean }) {
  const [images, setImages] = useState<EventImage[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replacement, setReplacement] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { let active = true; getEventImages(eventId).then(value => { if (active) { setImages(value); setDrafts(Object.fromEntries(value.map(image => [image.id, image.description || '']))); } }).catch(() => undefined); return () => { active = false; }; }, [eventId]);
  const openPicker = (imageId?: string) => { setReplacement(imageId); input.current?.click(); };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a JPEG or PNG picture up to 5 MB.'); return; }
    setBusy(true); setError('');
    try { const saved = await uploadEventImage(eventId, file, replacement); setImages(current => replacement ? current.map(image => image.id === saved.id ? saved : image) : [...current, saved]); setDrafts(current => ({ ...current, [saved.id]: saved.description || '' })); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); setReplacement(undefined); }
  };
  const remove = async (imageId: string | number) => {
    setBusy(true); setError('');
    try { await deleteEventImage(eventId, String(imageId)); setImages(current => current.filter(image => image.id !== String(imageId))); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const saveDescription = async (imageId: string | number) => { const description = drafts[String(imageId)] || ''; try { const saved = await updateEventImageDescription(eventId, String(imageId), description); setImages(current => current.map(image => image.id === saved.id ? saved : image)); } catch (caught) { setError((caught as Error).message); } };
  const galleryImages: GalleryImage[] = images.map(image => ({ ...image, resourceType: 'event', resourceId: eventId }));
  return <section className="event-photo-panel">
    <StackedImageGallery mode="multiple" images={galleryImages} title={name} emptyText="No event pictures yet." editable={editable && !busy} onAddImage={editable ? () => openPicker() : undefined} onReplaceImage={editable ? image => openPicker(String(image.id)) : undefined} onDeleteImage={editable ? remove : undefined} imageDrafts={drafts} onDescriptionChange={(id, value) => setDrafts(current => ({ ...current, [String(id)]: value }))} onDescriptionBlur={id => { void saveDescription(id); }} imageClassName="event-detail-photo" />
    {editable && <Form.Control ref={input} type="file" accept="image/jpeg,image/png" className="d-none" onChange={upload} disabled={busy} />}
    {busy && <p role="status" className="mt-2">Saving picture…</p>}
    {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
  </section>;
}

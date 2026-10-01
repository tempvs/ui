import React, { useEffect, useRef, useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import StackedImageGallery from '../component/StackedImageGallery';
import { deleteEventImage, EventImage, getEventImages, uploadEventImage } from './eventApi';

export default function EventPhotoPanel({ eventId, name, editable }: { eventId: string; name: string; editable: boolean }) {
  const [images, setImages] = useState<EventImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { let active = true; getEventImages(eventId).then(value => { if (active) setImages(value); }).catch(() => undefined); return () => { active = false; }; }, [eventId]);
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a JPEG or PNG picture up to 5 MB.'); return; }
    setBusy(true); setError('');
    try { setImages([await uploadEventImage(eventId, file, images[0]?.id)]); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (imageId: string | number) => {
    setBusy(true); setError('');
    try { await deleteEventImage(eventId, String(imageId)); setImages([]); }
    catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="event-photo-panel">
    <StackedImageGallery mode="single" images={images.map(image => ({ ...image, resourceType: 'event', resourceId: eventId }))} title={name} emptyText="No event picture yet." editable={editable && !busy} onUploadImage={editable ? () => input.current?.click() : undefined} onReplaceImage={editable ? () => input.current?.click() : undefined} onDeleteImage={editable ? remove : undefined} imageClassName="event-detail-photo" />
    {editable && <Form.Control ref={input} type="file" accept="image/jpeg,image/png" className="d-none" onChange={upload} disabled={busy} />}
    {busy && <p role="status" className="mt-2">Saving picture…</p>}
    {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
  </section>;
}

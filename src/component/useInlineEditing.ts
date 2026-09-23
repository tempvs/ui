import { useCallback, useEffect, useRef, useState } from 'react';

/** Shared interaction state for the two inline-edit field presentations. */
export default function useInlineEditing<TElement extends HTMLElement = HTMLDivElement>(editable: boolean) {
  const [editing, setEditing] = useState(false);
  const editRootRef = useRef<TElement | null>(null);

  const beginEditing = useCallback(() => {
    if (editable) setEditing(true);
  }, [editable]);

  const endEditing = useCallback(() => {
    setEditing(false);
  }, []);

  useEffect(() => {
    if (!editable) endEditing();
  }, [editable, endEditing]);

  useEffect(() => {
    if (!editing) return undefined;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || editRootRef.current?.contains(target)) return;

      // Clicking non-focusable page chrome does not necessarily emit a blur.
      // Blur the active control explicitly so its owner saves, then closes.
      const active = document.activeElement;
      if (active instanceof HTMLElement && editRootRef.current?.contains(active)) {
        active.blur();
      } else {
        endEditing();
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
  }, [editing, endEditing]);

  return { editing, beginEditing, endEditing, editRootRef };
}

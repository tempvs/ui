import { useCallback, useEffect, useState } from 'react';

/** Shared interaction state for the two inline-edit field presentations. */
export default function useInlineEditing(editable: boolean) {
  const [editing, setEditing] = useState(false);

  const beginEditing = useCallback(() => {
    if (editable) setEditing(true);
  }, [editable]);

  const endEditing = useCallback(() => {
    setEditing(false);
  }, []);

  useEffect(() => {
    if (!editable) endEditing();
  }, [editable, endEditing]);

  return { editing, beginEditing, endEditing };
}

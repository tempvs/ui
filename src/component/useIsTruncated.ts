import { RefObject, useEffect, useState } from 'react';

export default function useIsTruncated<T extends HTMLElement>(
  ref: RefObject<T>,
  dependencies: unknown[] = []
): boolean {
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const update = () => {
      const element = ref.current;
      if (!element) {
        setIsTruncated(false);
        return;
      }

      setIsTruncated(element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight);
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [ref, ...dependencies]);

  return isTruncated;
}

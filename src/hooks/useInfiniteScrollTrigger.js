import { useEffect, useRef } from 'react';

export function useInfiniteScrollTrigger({ rootRef, onIntersect, disabled = false, rootMargin = '240px' }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    const root = rootRef?.current || null;
    const sentinel = sentinelRef.current;
    if (!sentinel || disabled) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;

    let disposed = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (disposed) return;
        if (entries.some((entry) => entry.isIntersecting)) {
          onIntersect?.();
        }
      },
      { root, rootMargin, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [rootRef, onIntersect, disabled, rootMargin]);

  return sentinelRef;
}


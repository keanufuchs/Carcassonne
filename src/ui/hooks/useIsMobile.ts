import { useState, useEffect } from 'react';

/** Mobile breakpoint — mirrors the `@media (max-width: 768px)` blocks in CSS. */
const MOBILE_QUERY = '(max-width: 768px)';

/**
 * Tracks whether the viewport is at or below the mobile breakpoint, updating
 * live on resize/orientation change. Shared by the in-game layout and the menu
 * screens so "is this mobile?" is decided in exactly one place.
 */
export function useIsMobile(query: string = MOBILE_QUERY): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return isMobile;
}

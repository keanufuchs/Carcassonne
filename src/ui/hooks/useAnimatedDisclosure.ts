import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Open/close state for a popover that keeps rendering through a brief close
 * animation. While `isClosing` is true the element should stay mounted (with a
 * closing CSS class) so the exit animation can play before it unmounts.
 */
export function useAnimatedDisclosure(closeMs = 140) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const timer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const open = useCallback(() => {
    clearTimer();
    setIsClosing(false);
    setIsOpen(true);
  }, [clearTimer]);

  const close = useCallback(() => {
    clearTimer();
    setIsClosing(true);
    timer.current = window.setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      timer.current = null;
    }, closeMs);
  }, [clearTimer, closeMs]);

  const toggle = useCallback(() => {
    if (isOpen && !isClosing) close();
    else open();
  }, [isOpen, isClosing, open, close]);

  useEffect(() => clearTimer, [clearTimer]);

  // `expanded` reflects the visually-open state (false while closing) so the
  // trigger chevron + highlight reverse together with the dropdown.
  return { isOpen, isClosing, expanded: isOpen && !isClosing, open, close, toggle };
}

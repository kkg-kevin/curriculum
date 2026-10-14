import { useCallback, useEffect, useRef, useState } from "react";

// Desktop sidebar: an icon rail that opens to full width while the pointer is over it (or
// keyboard focus is inside it) and closes again when it leaves. The open sidebar slides OVER the
// page rather than pushing it, so layouts always reserve only SIDEBAR_COLLAPSED_WIDTH on desktop
// and the content never reflows as the pointer passes. Mobile has its own open/close drawer
// (isMobileOpen) and passes enabled = false.
export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

// A short open delay stops the sidebar flashing open when the pointer only crosses it on its way
// somewhere else; a short close delay forgives briefly overshooting its edge.
const OPEN_DELAY_MS = 80;
const CLOSE_DELAY_MS = 150;

export function useSidebarHover(enabled = true) {
  const [expanded, setExpanded] = useState(false);
  const timer = useRef(null);

  const schedule = useCallback((next, delay) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setExpanded(next), delay);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handlers = {
    onMouseEnter: () => schedule(true, OPEN_DELAY_MS),
    onMouseLeave: () => schedule(false, CLOSE_DELAY_MS),
    onFocus: () => schedule(true, 0),
    onBlur: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) schedule(false, 0);
    },
  };

  return { expanded: enabled && expanded, handlers: enabled ? handlers : {} };
}

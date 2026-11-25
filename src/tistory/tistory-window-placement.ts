/**
 * Where the visible Tistory browser window opens.
 *
 * It used to open at a fixed 100,100 — that is the PRIMARY monitor. A user working on another monitor
 * (or with a switched-off TV registered as the primary display) got a browser window on a screen they
 * were not looking at: the app said "opened", nothing appeared. The main process registers a provider
 * that returns the work area of the display the Orbit window is on, and the window opens there.
 */

export type WorkArea = { x: number; y: number; width: number; height: number };
export type WindowPosition = { left: number; top: number };

const FALLBACK_POSITION: WindowPosition = { left: 100, top: 100 };
const OFFSET_LEFT = 60;
const OFFSET_TOP = 40;

let workAreaProvider: (() => WorkArea | null | undefined) | null = null;

/** Registered once by the Electron main process. Pass null to clear (tests). */
export function setTistoryWorkAreaProvider(provider: (() => WorkArea | null | undefined) | null): void {
  workAreaProvider = provider;
}

export function positionOnWorkArea(area?: WorkArea | null): WindowPosition {
  if (!area) return { ...FALLBACK_POSITION };
  const usable = [area.x, area.y, area.width, area.height].every((value) => Number.isFinite(value)) && area.width > 0 && area.height > 0;
  if (!usable) return { ...FALLBACK_POSITION };
  return { left: Math.round(area.x) + OFFSET_LEFT, top: Math.round(area.y) + OFFSET_TOP };
}

/** Position for a visible window: on the display the app is on, else the old fixed position. */
export function visibleWindowPosition(): WindowPosition {
  try {
    return positionOnWorkArea(workAreaProvider ? workAreaProvider() : null);
  } catch {
    return { ...FALLBACK_POSITION };
  }
}

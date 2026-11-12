import {useEffect, useRef} from "react";
import {readLastActivity, writeLastActivity} from "./idleActivityStore";
import {ACTIVITY_EVENTS, ACTIVITY_SAVE_INTERVAL_MS, IDLE_TIMEOUT_MS} from "./idleTimeoutConfig";

type UseIdleTimeoutOptions = {
  /** Only watch for inactivity while this is true (the user is logged in). */
  enabled: boolean;
  /** The current login session. Activity saved by an older session is ignored. */
  sessionId: string;
  /** Called once, when there has been no activity for timeoutMs in any open tab. */
  onIdle: () => void;
  timeoutMs?: number;
};

/**
 * Calls onIdle when the user has not used the mouse, keyboard, scroll wheel or
 * touch screen for timeoutMs (15 minutes by default) in ANY open tab of the app.
 *
 * The time of the last activity is kept in localStorage, so:
 * - working in one tab keeps the other tabs logged in,
 * - after the computer sleeps, or the page is reloaded, the real idle time is used.
 */
export const useIdleTimeout = ({
  enabled,
  sessionId,
  onIdle,
  timeoutMs = IDLE_TIMEOUT_MS,
}: UseIdleTimeoutOptions): void => {
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const listenerOptions: AddEventListenerOptions = {capture: true, passive: true};
    let timer: ReturnType<typeof setTimeout> | undefined;
    let isIdle = false;

    const startedAt = Date.now();
    const saved = readLastActivity();
    const savedForThisSession = saved !== null && saved.session === sessionId ? saved.at : null;
    // The app was reopened (or the page reloaded) after the time was already up.
    const alreadyTimedOut = savedForThisSession !== null && startedAt - savedForThisSession >= timeoutMs;

    let lastActivityInThisTab = alreadyTimedOut && savedForThisSession !== null ? savedForThisSession : startedAt;
    let lastSavedAt = 0;

    // Latest activity from any tab of this session.
    const getLastActivity = (): number => {
      const stored = readLastActivity();
      return stored !== null && stored.session === sessionId
        ? Math.max(stored.at, lastActivityInThisTab)
        : lastActivityInThisTab;
    };

    const stop = (): void => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, onActivity, listenerOptions));
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };

    const goIdle = (): void => {
      if (isIdle) {
        return;
      }
      isIdle = true;
      stop();
      onIdleRef.current();
    };

    // Sleeps until the time could be up, then checks again (another tab may have been active).
    const check = (): void => {
      clearTimeout(timer);
      const msLeft = getLastActivity() + timeoutMs - Date.now();
      if (msLeft <= 0) {
        goIdle();
        return;
      }
      timer = setTimeout(check, msLeft);
    };

    function onActivity(): void {
      if (isIdle) {
        return;
      }
      const now = Date.now();
      // The computer may have been asleep: if the time is already up, log out instead of restarting it.
      if (now - getLastActivity() >= timeoutMs) {
        goIdle();
        return;
      }
      lastActivityInThisTab = now;
      if (now - lastSavedAt >= ACTIVITY_SAVE_INTERVAL_MS) {
        lastSavedAt = now;
        writeLastActivity({at: now, session: sessionId});
      }
    }

    // Browsers slow down timers in background tabs, so check again as soon as the tab is shown.
    function onVisibilityChange(): void {
      if (document.visibilityState === "visible") {
        check();
      }
    }

    if (alreadyTimedOut) {
      goIdle();
      return stop;
    }

    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, onActivity, listenerOptions));
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Opening or reloading the app counts as activity.
    lastSavedAt = startedAt;
    writeLastActivity({at: startedAt, session: sessionId});
    check();

    return stop;
  }, [enabled, sessionId, timeoutMs]);
};

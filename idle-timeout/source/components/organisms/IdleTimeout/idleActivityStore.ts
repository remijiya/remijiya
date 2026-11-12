import {LAST_ACTIVITY_STORAGE_KEY} from "./idleTimeoutConfig";

export type LastActivity = {
  /** When the user was last active, in milliseconds since 1970 (Date.now()). */
  at: number;
  /** Which login session the activity belongs to (see getSessionId). */
  session: string;
};

// Used only when localStorage is blocked (for example in some private browsing modes).
let memoryFallback: LastActivity | null = null;

const isLastActivity = (value: unknown): value is LastActivity =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as LastActivity).at === "number" &&
  typeof (value as LastActivity).session === "string";

export const readLastActivity = (): LastActivity | null => {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
  } catch {
    return memoryFallback;
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isLastActivity(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const writeLastActivity = (value: LastActivity): void => {
  memoryFallback = value;
  try {
    window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // localStorage is blocked: memoryFallback keeps this tab working.
  }
};

export const clearLastActivity = (): void => {
  memoryFallback = null;
  try {
    window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
  } catch {
    // localStorage is blocked: nothing else to clear.
  }
};

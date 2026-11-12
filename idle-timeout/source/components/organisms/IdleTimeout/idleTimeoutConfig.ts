// How long the user can be inactive before they are logged out.
export const IDLE_TIMEOUT_MINUTES = 15;
export const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;

// Browser events that count as "the user is active".
export const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "pointerdown",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
] as const;

// mousemove fires many times a second, so activity is saved at most once per second.
export const ACTIVITY_SAVE_INTERVAL_MS = 1000;

// Shared by every open tab of the app, so activity in one tab keeps the other tabs logged in.
export const LAST_ACTIVITY_STORAGE_KEY = "pinch.idleTimeout.lastActivity";

// Lets the tab where the user clicked OK tell the other open tabs that the session has ended.
export const IDLE_LOGOUT_CHANNEL = "pinch.idleTimeout.logout";
export const IDLE_LOGOUT_MESSAGE = "logout";

import {act, renderHook} from "@testing-library/react";
import {IDLE_TIMEOUT_MS, LAST_ACTIVITY_STORAGE_KEY} from "./idleTimeoutConfig";
import {useIdleTimeout} from "./useIdleTimeout";

const SESSION = "user-1|session-1";
const MINUTE = 60 * 1000;

type HookProps = Parameters<typeof useIdleTimeout>[0];

const renderIdleHook = (props: Partial<HookProps> = {}) => {
  const onIdle = jest.fn();
  const view = renderHook((hookProps: HookProps) => useIdleTimeout(hookProps), {
    initialProps: {enabled: true, sessionId: SESSION, onIdle, ...props},
  });
  return {onIdle, ...view};
};

const saveActivity = (at: number, session = SESSION) =>
  window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, JSON.stringify({at, session}));

const wait = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

const userIsActive = (eventName = "mousemove") =>
  act(() => {
    window.dispatchEvent(new Event(eventName));
  });

describe("useIdleTimeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls onIdle after 15 minutes without activity", () => {
    const {onIdle} = renderIdleHook();

    wait(IDLE_TIMEOUT_MS - 1000);
    expect(onIdle).not.toHaveBeenCalled();

    wait(1000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("starts the 15 minutes again when the user is active", () => {
    const {onIdle} = renderIdleHook();

    wait(10 * MINUTE);
    userIsActive("keydown");
    wait(10 * MINUTE);
    expect(onIdle).not.toHaveBeenCalled();

    wait(5 * MINUTE);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("calls onIdle only once", () => {
    const {onIdle} = renderIdleHook();

    wait(IDLE_TIMEOUT_MS);
    userIsActive();
    wait(IDLE_TIMEOUT_MS);

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("does nothing while disabled", () => {
    const {onIdle} = renderIdleHook({enabled: false});

    wait(2 * IDLE_TIMEOUT_MS);

    expect(onIdle).not.toHaveBeenCalled();
  });

  it("stops watching when it is unmounted", () => {
    const {onIdle, unmount} = renderIdleHook();

    unmount();
    wait(2 * IDLE_TIMEOUT_MS);

    expect(onIdle).not.toHaveBeenCalled();
  });

  it("keeps the user logged in while they are active in another tab", () => {
    const {onIdle} = renderIdleHook();

    wait(10 * MINUTE);
    saveActivity(Date.now()); // another tab saved activity
    wait(10 * MINUTE);
    expect(onIdle).not.toHaveBeenCalled();

    wait(5 * MINUTE);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("calls onIdle right away when the app is reopened after the time is up", () => {
    saveActivity(Date.now() - IDLE_TIMEOUT_MS - 1000);

    const {onIdle} = renderIdleHook();

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("ignores old activity from a previous login session", () => {
    saveActivity(Date.now() - 2 * IDLE_TIMEOUT_MS, "user-1|old-session");

    const {onIdle} = renderIdleHook();
    expect(onIdle).not.toHaveBeenCalled();

    wait(IDLE_TIMEOUT_MS);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("calls onIdle instead of restarting when activity comes after the time is up (computer was asleep)", () => {
    const {onIdle} = renderIdleHook();

    // Move the clock forward without running timers, like a sleeping laptop.
    jest.setSystemTime(Date.now() + IDLE_TIMEOUT_MS + MINUTE);
    userIsActive();

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("checks again as soon as the tab is shown", () => {
    const {onIdle} = renderIdleHook();

    jest.setSystemTime(Date.now() + IDLE_TIMEOUT_MS + MINUTE);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("still works when localStorage is blocked", () => {
    const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const {onIdle} = renderIdleHook();
    wait(10 * MINUTE);
    userIsActive();
    wait(10 * MINUTE);
    expect(onIdle).not.toHaveBeenCalled();

    wait(5 * MINUTE);
    expect(onIdle).toHaveBeenCalledTimes(1);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

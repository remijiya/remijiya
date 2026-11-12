import {act, fireEvent, render, screen} from "@testing-library/react";
import {useAuth} from "react-oidc-context";
import {RouteUrl} from "types/routes";
import {goToSignIn} from "./goToSignIn";
import {IdleTimeout} from "./IdleTimeout";
import {IDLE_LOGOUT_CHANNEL, IDLE_LOGOUT_MESSAGE, IDLE_TIMEOUT_MS} from "./idleTimeoutConfig";

jest.mock("react-oidc-context", () => ({useAuth: jest.fn()}));

jest.mock("./goToSignIn", () => ({
  ...jest.requireActual("./goToSignIn"),
  goToSignIn: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | {defaultValue?: string}) =>
      typeof options === "string" ? options : options?.defaultValue ?? key,
  }),
}));

// jsdom has no BroadcastChannel, so tabs are simulated with this small fake.
class FakeBroadcastChannel {
  static open: FakeBroadcastChannel[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public readonly name: string) {
    FakeBroadcastChannel.open.push(this);
  }

  postMessage(data: unknown) {
    FakeBroadcastChannel.open
      .filter((channel) => channel !== this && channel.name === this.name)
      .forEach((channel) => channel.onmessage?.({data} as MessageEvent));
  }

  close() {
    FakeBroadcastChannel.open = FakeBroadcastChannel.open.filter((channel) => channel !== this);
  }
}

const mockedUseAuth = useAuth as jest.Mock;
const mockedGoToSignIn = goToSignIn as jest.Mock;

const createAuth = (overrides: Record<string, unknown> = {}) => ({
  isAuthenticated: true,
  user: {profile: {sub: "user-1", sid: "session-1"}},
  stopSilentRenew: jest.fn(),
  removeUser: jest.fn().mockResolvedValue(undefined),
  signoutRedirect: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const waitForIdle = () =>
  act(() => {
    jest.advanceTimersByTime(IDLE_TIMEOUT_MS);
  });

describe("IdleTimeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
    mockedGoToSignIn.mockClear();
    FakeBroadcastChannel.open = [];
    Object.defineProperty(window, "BroadcastChannel", {
      value: FakeBroadcastChannel,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (window as {BroadcastChannel?: unknown}).BroadcastChannel;
  });

  it("shows nothing while the user is active", () => {
    mockedUseAuth.mockReturnValue(createAuth());
    render(<IdleTimeout />);

    act(() => {
      jest.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000);
    });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows the pop-up after 15 minutes idle and stops refreshing tokens", () => {
    const auth = createAuth();
    mockedUseAuth.mockReturnValue(auth);
    render(<IdleTimeout />);

    waitForIdle();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(auth.stopSilentRenew).toHaveBeenCalled();
  });

  it("does nothing when the user is not logged in", () => {
    mockedUseAuth.mockReturnValue(createAuth({isAuthenticated: false, user: null}));
    render(<IdleTimeout />);

    waitForIdle();

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("logs out at Keycloak and returns to the sign-in page when OK is clicked", async () => {
    const auth = createAuth();
    mockedUseAuth.mockReturnValue(auth);
    render(<IdleTimeout />);
    waitForIdle();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", {name: "OK"}));
    });

    expect(auth.signoutRedirect).toHaveBeenCalledWith({
      post_logout_redirect_uri: `${window.location.origin}${RouteUrl.SIGN_IN}`,
    });
    expect(screen.getByRole("button", {name: "OK"})).toBeDisabled();
  });

  it("tells the other open tabs when OK is clicked", async () => {
    mockedUseAuth.mockReturnValue(createAuth());
    const otherTab = new FakeBroadcastChannel(IDLE_LOGOUT_CHANNEL);
    const received: unknown[] = [];
    otherTab.onmessage = (event) => received.push(event.data);
    render(<IdleTimeout />);
    waitForIdle();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", {name: "OK"}));
    });

    expect(received).toEqual([IDLE_LOGOUT_MESSAGE]);
  });

  it("still goes to the sign-in page if the Keycloak logout fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const auth = createAuth({signoutRedirect: jest.fn().mockRejectedValue(new Error("network"))});
    mockedUseAuth.mockReturnValue(auth);
    render(<IdleTimeout />);
    waitForIdle();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", {name: "OK"}));
    });

    expect(auth.removeUser).toHaveBeenCalled();
    expect(mockedGoToSignIn).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it("shows the pop-up when another tab logged out, and OK only cleans up this tab", async () => {
    const auth = createAuth();
    mockedUseAuth.mockReturnValue(auth);
    render(<IdleTimeout />);

    act(() => {
      new FakeBroadcastChannel(IDLE_LOGOUT_CHANNEL).postMessage(IDLE_LOGOUT_MESSAGE);
    });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", {name: "OK"}));
    });

    expect(auth.signoutRedirect).not.toHaveBeenCalled();
    expect(auth.removeUser).toHaveBeenCalled();
    expect(mockedGoToSignIn).toHaveBeenCalledTimes(1);
  });
});

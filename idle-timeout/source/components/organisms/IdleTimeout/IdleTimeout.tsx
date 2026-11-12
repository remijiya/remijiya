import {useEffect, useState} from "react";
import type {User} from "oidc-client-ts";
import {useAuth} from "react-oidc-context";
import {clearLastActivity} from "./idleActivityStore";
import {IdleTimeoutDialog} from "./IdleTimeoutDialog";
import {IDLE_LOGOUT_CHANNEL, IDLE_LOGOUT_MESSAGE} from "./idleTimeoutConfig";
import {getSignInUrl, goToSignIn} from "./goToSignIn";
import {useIdleTimeout} from "./useIdleTimeout";

/**
 * Same login session -> same id in every tab. A new login gets a new id,
 * so activity saved by an old session is never used.
 * Keycloak puts the session id ("sid") in the ID token.
 */
export const getSessionId = (user: User | null | undefined): string => {
  if (!user) {
    return "";
  }
  return `${user.profile.sub}|${user.profile.sid ?? ""}`;
};

// BroadcastChannel is missing in very old browsers and in Jest's jsdom.
const openLogoutChannel = (): BroadcastChannel | null =>
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(IDLE_LOGOUT_CHANNEL);

/**
 * Logs the user out after 15 minutes without activity.
 * Render it once, inside <AuthProvider>. It shows nothing until the user has been idle.
 */
export const IdleTimeout = () => {
  const {isAuthenticated, user, stopSilentRenew, removeUser, signoutRedirect} = useAuth();
  const [isIdle, setIsIdle] = useState(false);
  const [loggedOutInAnotherTab, setLoggedOutInAnotherTab] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useIdleTimeout({
    enabled: isAuthenticated && !isIdle,
    sessionId: getSessionId(user),
    onIdle: () => {
      // Stop refreshing the tokens in the background, so the session is not kept alive.
      stopSilentRenew();
      setIsIdle(true);
    },
  });

  // Another tab ended the session: show the same pop-up here.
  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }
    const channel = openLogoutChannel();
    if (!channel) {
      return undefined;
    }
    channel.onmessage = (event: MessageEvent) => {
      if (event.data === IDLE_LOGOUT_MESSAGE) {
        stopSilentRenew();
        setLoggedOutInAnotherTab(true);
        setIsIdle(true);
      }
    };
    return () => channel.close();
  }, [isAuthenticated, stopSilentRenew]);

  const handleConfirm = async (): Promise<void> => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    clearLastActivity();

    if (loggedOutInAnotherTab) {
      // The login server session is already ended by the other tab: only clean up this tab.
      await removeUser().catch(() => undefined);
      goToSignIn();
      return;
    }

    const channel = openLogoutChannel();
    channel?.postMessage(IDLE_LOGOUT_MESSAGE);
    channel?.close();

    try {
      // Ends the Keycloak session, then Keycloak sends the browser back to the sign-in page.
      await signoutRedirect({post_logout_redirect_uri: getSignInUrl()});
    } catch (error) {
      console.error("Idle timeout: logout redirect failed", error);
      await removeUser().catch(() => undefined);
      goToSignIn();
    }
  };

  return <IdleTimeoutDialog open={isIdle} isLoggingOut={isLoggingOut} onConfirm={handleConfirm} />;
};

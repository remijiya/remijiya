import {RouteUrl} from "types/routes";

export const getSignInUrl = (): string => `${window.location.origin}${RouteUrl.SIGN_IN}`;

// Full page load (not a router navigate), so no data from the old session stays in memory.
export const goToSignIn = (): void => {
  window.location.assign(getSignInUrl());
};

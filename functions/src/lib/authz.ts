// Custom claim checks for callables.
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

export interface Caller {
  uid: string;
  isAdmin: boolean;
  isPhotographer: boolean;
}

export function callerOf(request: Pick<CallableRequest<unknown>, "auth">): Caller {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return {
    uid: auth.uid,
    isAdmin: auth.token.admin === true,
    isPhotographer: auth.token.photographer === true,
  };
}

export function requireAdmin(request: Pick<CallableRequest<unknown>, "auth">): Caller {
  const caller = callerOf(request);
  if (!caller.isAdmin) throw new HttpsError("permission-denied", "Admin access is required.");
  return caller;
}

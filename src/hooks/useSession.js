import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { fetchSessionUser } from "../services/sessionService";

export const SessionContext = createContext({ expired: false, expireSession: () => {} });

export function useSession(guestOnly = false) {
  const [session, setSession] = useState({ status: guestOnly ? "guest" : "checking", user: null });
  const requestVersion = useRef(0);
  const pendingRequest = useRef(null);

  const checkSession = useCallback(async () => {
    const version = ++requestVersion.current;
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setSession({ status: "checking", user: null });
    try {
      const user = await fetchSessionUser(controller.signal);
      if (version === requestVersion.current) setSession({ status: "authenticated", user });
    } catch (error) {
      if (version === requestVersion.current) {
        setSession({ status: error.status === 401 ? "guest" : "unavailable", user: null });
      }
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    if (!guestOnly) checkSession();
    return () => {
      requestVersion.current += 1;
      pendingRequest.current?.abort();
    };
  }, [checkSession, guestOnly]);

  const setUser = useCallback(user => {
    requestVersion.current += 1;
    pendingRequest.current?.abort();
    setSession({ status: user ? "authenticated" : "guest", user });
  }, []);

  const continueAsGuest = useCallback(() => setUser(null), [setUser]);

  const expireSession = useCallback(ownerId => {
    setSession(current => current.user?.id === ownerId && current.status === "authenticated"
      ? { ...current, status: "expired" }
      : current);
  }, []);

  return { ...session, setUser, checkSession, continueAsGuest, expireSession };
}

// A delayed write must not update another account's view or continue a batch
// after its page was unmounted during logout/account switching.
export function useSessionGuard(user) {
  const { expired, expireSession } = useContext(SessionContext);
  const ownerId = user?.id ?? null;
  const currentOwner = useRef(ownerId);
  const currentSession = useRef(user);
  const mounted = useRef(false);
  const sessionExpired = useRef(expired);
  sessionExpired.current = expired;
  currentOwner.current = ownerId;
  currentSession.current = user;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, [ownerId]);
  const isCurrent = useCallback(() => mounted.current && currentOwner.current === ownerId, [ownerId]);
  const isSameSession = useCallback(() => isCurrent() && currentSession.current === user, [isCurrent, user]);
  const canWrite = useCallback(() => isSameSession() && !sessionExpired.current, [isSameSession]);
  const reportSessionError = useCallback(error => {
    if (isSameSession() && ownerId && error.status === 401) expireSession(ownerId);
  }, [isSameSession, ownerId, expireSession]);
  return { isCurrent, isSameSession, canWrite, reportSessionError, expired };
}

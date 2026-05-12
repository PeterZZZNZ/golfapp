"use client";

import * as React from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseAuth, googleProvider } from "./config";
import { ensureUserProfile, getUserProfile } from "./profiles";
import type { UserProfile } from "./types";

type AuthState =
  | { status: "loading"; user: null; profile: null }
  | { status: "anon"; user: null; profile: null }
  | { status: "authed"; user: User; profile: UserProfile | null };

type AuthContextValue = AuthState & {
  refreshProfile: () => Promise<void>;
  signUpEmail: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    status: "loading",
    user: null,
    profile: null,
  });

  // The state setter triggered from inside callbacks — wrap once.
  const refreshProfile = React.useCallback(async () => {
    const auth = firebaseAuth();
    const u = auth.currentUser;
    if (!u) {
      setState({ status: "anon", user: null, profile: null });
      return;
    }
    const profile = await getUserProfile(u.uid);
    setState({ status: "authed", user: u, profile });
  }, []);

  React.useEffect(() => {
    const auth = firebaseAuth();

    // Handle the result of a redirect-based Google sign-in (mobile).
    getRedirectResult(auth).catch(() => {
      // Ignore errors here — the onAuthStateChanged listener below will
      // pick up the signed-in user if the redirect succeeded.
    });

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setState({ status: "anon", user: null, profile: null });
        return;
      }
      // Make sure a profile doc exists, then load it.
      try {
        await ensureUserProfile(u);
      } catch {
        // Non-fatal if rules briefly reject; we'll retry on next sign-in.
      }
      const profile = await getUserProfile(u.uid).catch(() => null);
      setState({ status: "authed", user: u, profile });
    });
    return () => unsub();
  }, []);

  const signUpEmail = React.useCallback(
    async (email: string, password: string, displayName?: string) => {
      const cred = await createUserWithEmailAndPassword(
        firebaseAuth(),
        email.trim(),
        password
      );
      if (displayName && displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }
      await ensureUserProfile(cred.user);
    },
    []
  );

  const signInEmail = React.useCallback(
    async (email: string, password: string) => {
      await signInWithEmailAndPassword(
        firebaseAuth(),
        email.trim(),
        password
      );
    },
    []
  );

  const signInGoogle = React.useCallback(async () => {
    const auth = firebaseAuth();
    const provider = googleProvider();
    // Use redirect on mobile (popup is blocked by Google's WebView policy);
    // use popup on desktop for the better UX.
    const isMobile =
      typeof navigator !== "undefined" &&
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      await signInWithRedirect(auth, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
  }, []);

  const signOut = React.useCallback(async () => {
    await fbSignOut(firebaseAuth());
  }, []);

  const value: AuthContextValue = React.useMemo(
    () => ({
      ...state,
      refreshProfile,
      signUpEmail,
      signInEmail,
      signInGoogle,
      signOut,
    }),
    [state, refreshProfile, signUpEmail, signInEmail, signInGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Convenience hook for pages that require authentication. */
export function useRequireAuth(): {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
} {
  const a = useAuth();
  return {
    user: a.user,
    profile: a.profile,
    loading: a.status === "loading",
  };
}

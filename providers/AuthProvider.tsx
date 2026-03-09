// providers/AuthProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";

import { supabase } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type AuthCtx = {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  refreshSession: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

type ParsedAuthUrl = {
  access_token?: string;
  refresh_token?: string;
  code?: string;
  error?: string;
};

function parseAuthFromUrl(url: string): ParsedAuthUrl {
  try {
    const u = new URL(url);

    const hash = u.hash?.startsWith("#") ? u.hash.slice(1) : u.hash;
    const hashParams = new URLSearchParams(hash);

    const access_token = hashParams.get("access_token") ?? undefined;
    const refresh_token = hashParams.get("refresh_token") ?? undefined;
    const code = u.searchParams.get("code") ?? undefined;

    const error =
      hashParams.get("error_description") ??
      hashParams.get("error") ??
      u.searchParams.get("error_description") ??
      u.searchParams.get("error") ??
      undefined;

    return {
      access_token,
      refresh_token,
      code,
      error: error ?? undefined,
    };
  } catch (e: any) {
    return {
      error: String(e?.message ?? e ?? "Invalid redirect URL"),
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  const mountedRef = useRef(true);
  const didHydrateRef = useRef(false);
  const ensureInFlightRef = useRef<Set<string>>(new Set());

  const applySession = useCallback((s: Session | null) => {
    setSession(s);
    setUser(s?.user ?? null);
  }, []);

  const ensureProfileRow = useCallback(async (u: User | null) => {
    const uid = u?.id;
    if (!uid) return;

    if (ensureInFlightRef.current.has(uid)) return;
    ensureInFlightRef.current.add(uid);

    try {
      await supabase.from("profiles").upsert({ id: uid }, { onConflict: "id" });
    } catch {
      // ignore in MVP
    } finally {
      ensureInFlightRef.current.delete(uid);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (!mountedRef.current) return;

      if (error) {
        applySession(null);
        return;
      }

      const next = data.session ?? null;
      applySession(next);
      void ensureProfileRow(next?.user ?? null);
    } catch {
      if (!mountedRef.current) return;
      applySession(null);
    }
  }, [applySession, ensureProfileRow]);

  const createSessionFromUrl = useCallback(
    async (url: string) => {
      const { access_token, refresh_token, code, error } = parseAuthFromUrl(url);

      if (error) {
        throw new Error(error);
      }

      // PKCE / code flow
      if (code) {
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) throw exchangeError;

        const next = data.session ?? null;
        applySession(next);
        void ensureProfileRow(next?.user ?? null);
        return next;
      }

      // implicit/token flow
      if (access_token && refresh_token) {
        const { data, error: setError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (setError) throw setError;

        const next = data.session ?? null;
        applySession(next);
        void ensureProfileRow(next?.user ?? null);
        return next;
      }

      return null;
    },
    [applySession, ensureProfileRow]
  );

  const getRedirectTo = useCallback(() => {
    return makeRedirectUri({ path: "auth/callback" });
  }, []);

  const openOAuth = useCallback(
    async (provider: "google" | "apple") => {
      const redirectTo = getRedirectTo();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error(`Missing OAuth URL for ${provider}`);

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === "success" && result.url) {
        await createSessionFromUrl(result.url);
        return;
      }

      if (result.type === "cancel") {
        throw new Error("OAuth sign-in cancelled");
      }

      if (result.type === "dismiss") {
        throw new Error("OAuth sign-in dismissed");
      }
    },
    [createSessionFromUrl, getRedirectTo]
  );

  const signInWithGoogle = useCallback(async () => {
    await openOAuth("google");
  }, [openOAuth]);

  const signInWithApple = useCallback(async () => {
    await openOAuth("apple");
  }, [openOAuth]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    applySession(null);
  }, [applySession]);

  useEffect(() => {
    const sub = Linking.addEventListener("url", async ({ url }) => {
      try {
        await createSessionFromUrl(url);
      } catch {
        // ignore
      }
    });

    return () => sub.remove();
  }, [createSessionFromUrl]);

  useEffect(() => {
    mountedRef.current = true;

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mountedRef.current) return;

      applySession(newSession ?? null);
      void ensureProfileRow(newSession?.user ?? null);

      if (didHydrateRef.current) {
        setInitializing(false);
      }
    });

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mountedRef.current) return;

        if (error) {
          applySession(null);
        } else {
          const next = data.session ?? null;
          applySession(next);
          void ensureProfileRow(next?.user ?? null);
        }
      } catch {
        if (!mountedRef.current) return;
        applySession(null);
      } finally {
        if (!mountedRef.current) return;
        didHydrateRef.current = true;
        setInitializing(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [applySession, ensureProfileRow]);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user,
      initializing,
      refreshSession,
      signInWithGoogle,
      signInWithApple,
      signOut,
    }),
    [session, user, initializing, refreshSession, signInWithGoogle, signInWithApple, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
// app/_layout.tsx
import "react-native-reanimated";

import React, { useEffect, useMemo, useRef } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useGlobalSearchParams, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useColorScheme } from "../hooks/use-color-scheme";
import { getOnboardingStatus } from "../lib/onboarding";
import { AuthProvider, useAuth } from "../providers/AuthProvider";
import { PlansProvider } from "../providers/PlansProvider";

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const params = useGlobalSearchParams();
  const { user, initializing } = useAuth();

  const first = segments?.[0];

  const inTabs = first === "(tabs)";
  const inAuth = first === "login" || first === "register";
  const inOnboarding = first === "onboarding";
  const inPlan = first === "plan";
  const inCreate = first === "create";
  const inIndex = !first;

  const userId = user?.id ?? null;

  const lastNavRef = useRef<string>("");
  const lastUserIdRef = useRef<string | null>(null);
  const onboardingCacheRef = useRef<{ userId: string; done: boolean } | null>(null);
  const guestFlowRef = useRef(false);

  const guestIntent = String((params as any)?.guest ?? "").trim() === "1";
  const routeKey = useMemo(() => (segments ?? []).join("/"), [segments]);

  useEffect(() => {
    if (lastUserIdRef.current !== userId) {
      lastUserIdRef.current = userId;
      lastNavRef.current = "";
      onboardingCacheRef.current = null;
      guestFlowRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (inOnboarding && guestIntent) {
      guestFlowRef.current = true;
    }

    if (!inOnboarding && !userId) {
      guestFlowRef.current = false;
    }
  }, [inOnboarding, guestIntent, userId]);

  useEffect(() => {
    if (initializing) return;

    let cancelled = false;

    const safeReplace = (path: string) => {
      if (cancelled) return;
      if (lastNavRef.current === path) return;
      lastNavRef.current = path;
      router.replace(path as any);
    };

    (async () => {
      if (!userId) {
        const guestAllowed = inIndex || inAuth || inPlan;
        const guestOnboardingAllowed = inOnboarding && guestFlowRef.current;

        if (inCreate) {
          safeReplace("/login");
          return;
        }

        if (inTabs) {
          safeReplace("/");
          return;
        }

        if (!guestAllowed && !guestOnboardingAllowed) {
          safeReplace("/");
          return;
        }

        return;
      }

      let done = false;

      if (onboardingCacheRef.current?.userId === userId) {
        done = onboardingCacheRef.current.done;
      } else {
        try {
          const status = await getOnboardingStatus();
          done = !!status?.completed;
          onboardingCacheRef.current = { userId, done };
        } catch {
          done = false;
          onboardingCacheRef.current = { userId, done };
        }
      }

      if (!done) {
        if (!inOnboarding) {
          safeReplace("/onboarding/name");
        }
        return;
      }

      if (inIndex || inAuth || inOnboarding) {
        safeReplace("/(tabs)/feed");
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    initializing,
    userId,
    routeKey,
    inTabs,
    inAuth,
    inOnboarding,
    inPlan,
    inCreate,
    inIndex,
    router,
  ]);

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <PlansProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />

              <Stack.Screen name="onboarding" />

              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="plan/[id]" />
              <Stack.Screen name="plan/participants" />
              <Stack.Screen name="create" options={{ presentation: "modal" }} />
            </Stack>
          </AuthGate>
        </ThemeProvider>
      </PlansProvider>
    </AuthProvider>
  );
}
// app/onboarding/name.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";

import { getOnboarding, upsertOnboarding } from "../../lib/onboarding";

type OnboardingData = {
  firstName?: string | null;
  lastName?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

function cleanName(s: string) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

export default function OnboardingName() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const isEditMode = params?.from === "profile";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  const lastNameRef = useRef<TextInput>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef("");

  const clearDebounce = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = null;
  };

  const safeBack = useCallback(() => {
    if (!hydrated || saving) return;

    const canGoBack = (router as any)?.canGoBack?.() ?? false;
    if (canGoBack) {
      router.back();
      return;
    }

    if (isEditMode) {
      router.replace("/(tabs)/profile");
    } else {
      router.replace("/");
    }
  }, [router, isEditMode, hydrated, saving]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = (await getOnboarding()) as OnboardingData | null;
        if (!mounted) return;

        const fn = String(data?.firstName ?? data?.first_name ?? "").trim();
        const ln = String(data?.lastName ?? data?.last_name ?? "").trim();

        setFirstName(fn);
        setLastName(ln);

        lastSavedRef.current = `${cleanName(fn)}|${cleanName(ln)}`;
      } catch {
        // ignore
      } finally {
        if (mounted) {
          setHydrated(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => clearDebounce();
  }, []);

  const fnClean = useMemo(() => cleanName(firstName), [firstName]);
  const lnClean = useMemo(() => cleanName(lastName), [lastName]);

  const canContinue = useMemo(() => {
    if (!hydrated || saving) return false;
    return fnClean.length > 0 && lnClean.length > 0;
  }, [fnClean, lnClean, hydrated, saving]);

  const canClear = hydrated && !saving && (fnClean.length > 0 || lnClean.length > 0);

  const persist = async (fn: string | null, ln: string | null) => {
    const fnC = fn ? cleanName(fn) : null;
    const lnC = ln ? cleanName(ln) : null;

    try {
      await upsertOnboarding({
        firstName: fnC,
        lastName: lnC,
      });

      lastSavedRef.current = `${cleanName(fnC ?? "")}|${cleanName(lnC ?? "")}`;
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    if (!isEditMode) return;
    if (saving) return;

    const nextKey = `${fnClean}|${lnClean}`;
    if (nextKey === lastSavedRef.current) return;

    clearDebounce();

    saveTimer.current = setTimeout(() => {
      const fnVal = fnClean.length ? fnClean : null;
      const lnVal = lnClean.length ? lnClean : null;
      void persist(fnVal, lnVal);
    }, 350);

    return () => clearDebounce();
  }, [fnClean, lnClean, hydrated, isEditMode, saving]);

  const onClear = useCallback(async () => {
    if (!hydrated || saving) return;

    clearDebounce();

    setFirstName("");
    setLastName("");

    setSaving(true);
    try {
      await persist(null, null);
    } finally {
      setSaving(false);
    }
  }, [hydrated, saving]);

  const onNext = useCallback(async () => {
    if (!canContinue) return;

    clearDebounce();

    setSaving(true);
    try {
      await persist(fnClean, lnClean);
    } finally {
      setSaving(false);
    }

    if (isEditMode) {
      safeBack();
      return;
    }

    router.push("/onboarding/gender");
  }, [canContinue, fnClean, lnClean, isEditMode, router, safeBack]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Pressable onPress={safeBack} style={styles.back} hitSlop={10} disabled={!hydrated || saving}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>What’s your name?</Text>
        <Text style={styles.subtitle}>
          {isEditMode ? "Edit your name anytime." : "This helps people recognize you."}
        </Text>

        <TextInput
          placeholder="First name"
          placeholderTextColor="rgba(255,255,255,0.5)"
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="next"
          blurOnSubmit={false}
          editable={hydrated && !saving}
          onSubmitEditing={() => lastNameRef.current?.focus()}
        />

        <TextInput
          ref={lastNameRef}
          placeholder="Last name"
          placeholderTextColor="rgba(255,255,255,0.5)"
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="done"
          editable={hydrated && !saving}
          onSubmitEditing={() => void onNext()}
        />

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => void onClear()}
            style={[styles.secondaryBtn, !canClear && styles.btnDisabled]}
            disabled={!canClear}
          >
            <Text style={styles.secondaryText}>Clear</Text>
          </Pressable>

          <Pressable
            style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
            onPress={() => void onNext()}
            disabled={!canContinue}
          >
            <Text style={styles.primaryText}>
              {saving ? "Saving..." : isEditMode ? "Save" : canContinue ? "Next" : "Enter your name"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18 },

  back: { paddingVertical: 8, alignSelf: "flex-start" },
  backText: { color: "rgba(255,255,255,0.8)", fontSize: 14 },

  title: { color: "#fff", fontSize: 30, fontWeight: "900", marginTop: 6 },
  subtitle: { color: "rgba(255,255,255,0.65)", marginTop: 8, marginBottom: 18, fontSize: 13 },

  input: {
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#fff",
    marginBottom: 12,
  },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },

  secondaryBtn: {
    width: 110,
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "900" },

  primaryBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "900" },

  btnDisabled: { opacity: 0.35 },
});
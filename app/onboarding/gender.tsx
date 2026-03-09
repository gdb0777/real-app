// app/onboarding/gender.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { getOnboarding, setOnboardingField, type Gender } from "../../lib/onboarding";

type OnboardingData = {
  gender?: Gender | null;
};

const GENDERS = ["Male", "Female", "Other"] as const;

function isGender(v: unknown): v is Gender {
  return typeof v === "string" && (GENDERS as readonly string[]).includes(v);
}

const UI = [
  { value: "Male" as const, title: "Male", sub: "He/Him" },
  { value: "Female" as const, title: "Female", sub: "She/Her" },
  { value: "Other" as const, title: "Prefer not to say", sub: "You can change this later" },
];

export default function OnboardingGender() {
  const router = useRouter();

  const [gender, setGender] = useState<Gender | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  const lastSavedRef = useRef<string>("");

  const safeBack = () => {
    if (saving) return;

    const canGoBack = (router as any)?.canGoBack?.() ?? false;
    if (canGoBack) {
      router.back();
      return;
    }

    router.replace("/onboarding/name");
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = (await getOnboarding()) as OnboardingData | null;
        if (!mounted) return;

        const g = data?.gender;
        if (isGender(g)) {
          setGender(g);
          lastSavedRef.current = g;
        }
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

  const canContinue = useMemo(
    () => hydrated && gender !== null && !saving,
    [hydrated, gender, saving]
  );

  const pick = (value: Gender) => {
    if (!hydrated || saving) return;
    if (!isGender(value)) return;

    setGender(value);

    if (value === lastSavedRef.current) return;

    setOnboardingField("gender", value)
      .then(() => {
        lastSavedRef.current = value;
      })
      .catch(() => {});
  };

  const onNext = async () => {
    if (!hydrated || !gender || saving) return;

    setSaving(true);
    try {
      await setOnboardingField("gender", gender);
      lastSavedRef.current = gender;
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }

    router.replace("/onboarding/birthdate");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Pressable onPress={safeBack} style={styles.back} hitSlop={10} disabled={saving}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Select your gender</Text>
        <Text style={styles.subtitle}>We’ll use this for your profile.</Text>

        <View style={styles.options}>
          {UI.map((x) => {
            const active = gender === x.value;

            return (
              <Pressable
                key={x.value}
                style={[styles.card, active && styles.cardActive]}
                onPress={() => pick(x.value)}
                disabled={!hydrated || saving}
              >
                <Text style={styles.cardTitle}>{x.title}</Text>
                <Text style={styles.cardSub}>{x.sub}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
          onPress={onNext}
          disabled={!canContinue}
        >
          <Text style={styles.primaryText}>{saving ? "Saving..." : "Next"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 18 },

  back: { paddingVertical: 8, alignSelf: "flex-start" },
  backText: { color: "rgba(255,255,255,0.8)", fontSize: 14 },

  title: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 6 },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    marginTop: 8,
    marginBottom: 18,
    fontSize: 13,
  },

  options: { gap: 12 },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 16,
  },
  cardActive: {
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  cardSub: { color: "rgba(255,255,255,0.6)", marginTop: 6, fontSize: 12 },

  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "800" },
});
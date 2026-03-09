// app/onboarding/birthdate.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { getOnboarding, setOnboardingField } from "../../lib/onboarding";

type OnboardingData = {
  birthdate?: string;
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function yearsAgo(years: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function toISODateOnly(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODateOnly(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const [y, m, d] = s.split("-").map(Number);
  if ([y, m, d].some((n) => Number.isNaN(n))) return null;

  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;

  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }

  return dt;
}

function clampRange(date: Date, min: Date, max: Date) {
  const t = date.getTime();
  if (t < min.getTime()) return min;
  if (t > max.getTime()) return max;
  return date;
}

function isWithinRange(date: Date, min: Date, max: Date) {
  const t = date.getTime();
  return t >= min.getTime() && t <= max.getTime();
}

export default function OnboardingBirthdate() {
  const router = useRouter();

  const maxDate = useMemo(() => yearsAgo(18), []);
  const minDate = useMemo(() => yearsAgo(100), []);

  const [birthdate, setBirthdate] = useState<Date>(() =>
    clampRange(yearsAgo(20), minDate, maxDate)
  );
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedRef = useRef("");

  const safeBack = () => {
    if (saving) return;

    const canGoBack = (router as any)?.canGoBack?.() ?? false;
    if (canGoBack) {
      router.back();
      return;
    }

    router.replace("/onboarding/gender");
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = (await getOnboarding()) as OnboardingData | null;
        if (!mounted) return;

        const raw = data?.birthdate;
        const saved = raw ? parseISODateOnly(String(raw)) : null;

        if (saved && isWithinRange(saved, minDate, maxDate)) {
          setBirthdate(saved);
          lastPersistedRef.current = toISODateOnly(saved);
        } else {
          setBirthdate((prev) => clampRange(prev, minDate, maxDate));
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
  }, [minDate, maxDate]);

  const persistDebounced = (d: Date) => {
    if (!hydrated) return;
    if (!isWithinRange(d, minDate, maxDate)) return;

    const iso = toISODateOnly(d);
    if (iso === lastPersistedRef.current) return;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    saveTimer.current = setTimeout(() => {
      setOnboardingField("birthdate", iso)
        .then(() => {
          lastPersistedRef.current = iso;
        })
        .catch(() => {});
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const onNext = async () => {
    if (!hydrated || saving) return;

    if (birthdate.getTime() > maxDate.getTime()) {
      Alert.alert("Not eligible", "You must be 18+ to use Real.");
      return;
    }

    const safeDate = clampRange(birthdate, minDate, maxDate);
    const iso = toISODateOnly(safeDate);

    setSaving(true);

    try {
      await setOnboardingField("birthdate", iso);
      lastPersistedRef.current = iso;
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }

    router.replace("/onboarding/interests");
  };

  const onChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android" && event?.type === "dismissed") return;
    if (!date) return;

    const next = clampRange(date, minDate, maxDate);
    setBirthdate(next);
    persistDebounced(next);
  };

  const canContinue = hydrated && !saving;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Pressable onPress={safeBack} style={styles.back} hitSlop={10} disabled={saving}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>When’s your birthday?</Text>
        <Text style={styles.subtitle}>You must be 18+ to use Real.</Text>

        <View style={styles.pickerCard}>
          <Text style={styles.previewLabel}>Selected</Text>
          <Text style={styles.previewValue}>{formatDate(birthdate)}</Text>

          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={birthdate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onChange}
              maximumDate={maxDate}
              minimumDate={minDate}
              themeVariant="dark"
            />
          </View>
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

  pickerCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 16,
  },
  previewLabel: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  previewValue: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 6 },

  pickerWrap: {
    marginTop: 10,
    borderRadius: 16,
    overflow: "hidden",
  },

  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "800" },
});
// app/onboarding/location.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";

import { getOnboarding, setOnboardingField } from "../../lib/onboarding";

type Place = {
  id: string;
  label: string;
  city: string;
  country: string;
};

type OnboardingData = {
  location?: string | null;
};

const PLACES: Place[] = [
  { id: "sofia-bg", label: "Sofia, Bulgaria", city: "Sofia", country: "Bulgaria" },
  { id: "plovdiv-bg", label: "Plovdiv, Bulgaria", city: "Plovdiv", country: "Bulgaria" },
  { id: "varna-bg", label: "Varna, Bulgaria", city: "Varna", country: "Bulgaria" },
  { id: "burgas-bg", label: "Burgas, Bulgaria", city: "Burgas", country: "Bulgaria" },
  { id: "ruse-bg", label: "Ruse, Bulgaria", city: "Ruse", country: "Bulgaria" },
  { id: "stz-bg", label: "Stara Zagora, Bulgaria", city: "Stara Zagora", country: "Bulgaria" },
  { id: "pleven-bg", label: "Pleven, Bulgaria", city: "Pleven", country: "Bulgaria" },
  { id: "sliven-bg", label: "Sliven, Bulgaria", city: "Sliven", country: "Bulgaria" },
  { id: "dobrich-bg", label: "Dobrich, Bulgaria", city: "Dobrich", country: "Bulgaria" },
  { id: "shumen-bg", label: "Shumen, Bulgaria", city: "Shumen", country: "Bulgaria" },
  { id: "pernik-bg", label: "Pernik, Bulgaria", city: "Pernik", country: "Bulgaria" },
  { id: "haskovo-bg", label: "Haskovo, Bulgaria", city: "Haskovo", country: "Bulgaria" },
  { id: "blagoevgrad-bg", label: "Blagoevgrad, Bulgaria", city: "Blagoevgrad", country: "Bulgaria" },
  {
    id: "veliko-tarnovo-bg",
    label: "Veliko Tarnovo, Bulgaria",
    city: "Veliko Tarnovo",
    country: "Bulgaria",
  },
  { id: "kardzhali-bg", label: "Kardzhali, Bulgaria", city: "Kardzhali", country: "Bulgaria" },
  { id: "vidin-bg", label: "Vidin, Bulgaria", city: "Vidin", country: "Bulgaria" },
  { id: "vratsa-bg", label: "Vratsa, Bulgaria", city: "Vratsa", country: "Bulgaria" },
  { id: "gabrovo-bg", label: "Gabrovo, Bulgaria", city: "Gabrovo", country: "Bulgaria" },
  { id: "kazanlak-bg", label: "Kazanlak, Bulgaria", city: "Kazanlak", country: "Bulgaria" },
  { id: "hisarya-bg", label: "Hisarya, Bulgaria", city: "Hisarya", country: "Bulgaria" },
];

function normalize(s: string) {
  return (s ?? "").trim().toLowerCase();
}

function findPlaceByLabel(label: string) {
  const n = normalize(label);
  return PLACES.find((p) => normalize(p.label) === n) ?? null;
}

export default function OnboardingLocation() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const isEditMode = params?.from === "profile";

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Place | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

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
      router.replace("/onboarding/birthdate");
    }
  }, [router, isEditMode, hydrated, saving]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = (await getOnboarding()) as OnboardingData | null;
        if (!mounted) return;

        const saved = String(data?.location ?? "").trim();
        if (!saved) return;

        setQuery(saved);

        const exact = findPlaceByLabel(saved);
        setSelected(exact);
        lastSavedRef.current = saved;
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

  const q = normalize(query);

  const results = useMemo(() => {
    if (!q) return PLACES.slice(0, 12);
    return PLACES.filter((p) => normalize(p.label).includes(q)).slice(0, 12);
  }, [q]);

  const canContinue = useMemo(() => {
    if (!hydrated || saving) return false;
    return isEditMode ? query.trim().length > 0 : !!selected;
  }, [hydrated, saving, isEditMode, query, selected]);

  const canClear = hydrated && !saving && (query.trim().length > 0 || !!selected);

  const persist = async (value: string | null) => {
    try {
      await setOnboardingField("location", value);
      lastSavedRef.current = value ?? "";
    } catch {
      // ignore
    }
  };

  const onPick = async (p: Place) => {
    if (!hydrated || saving) return;

    clearDebounce();

    setSelected(p);
    setQuery(p.label);

    setSaving(true);
    try {
      await persist(p.label);
    } finally {
      setSaving(false);
    }
  };

  const onClear = async () => {
    if (!hydrated || saving) return;

    clearDebounce();

    setQuery("");
    setSelected(null);

    setSaving(true);
    try {
      await persist(null);
    } finally {
      setSaving(false);
    }
  };

  const onSubmitSearch = () => {
    const text = query.trim();
    if (!text) return;

    const exact = findPlaceByLabel(text);
    if (exact) {
      void onPick(exact);
      return;
    }

    if (results.length === 1) {
      void onPick(results[0]);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    if (!isEditMode) return;
    if (saving) return;

    const text = query.trim();
    const nextValue = text.length ? text : null;

    const nextKey = nextValue ?? "";
    if (nextKey === lastSavedRef.current) return;

    clearDebounce();

    saveTimer.current = setTimeout(() => {
      void persist(nextValue);
    }, 350);

    return () => clearDebounce();
  }, [query, hydrated, isEditMode, saving]);

  const onNext = async () => {
    if (!hydrated || saving) return;

    clearDebounce();

    const text = query.trim();

    if (!isEditMode) {
      if (!selected) return;

      setSaving(true);
      try {
        await persist(selected.label);
      } finally {
        setSaving(false);
      }

      router.replace("/onboarding/photos");
      return;
    }

    if (!text) return;

    setSaving(true);
    try {
      await persist(text);
    } finally {
      setSaving(false);
    }

    safeBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Pressable onPress={safeBack} style={styles.back} hitSlop={10} disabled={!hydrated || saving}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>{isEditMode ? "Where are you based?" : "Where are you from?"}</Text>
        <Text style={styles.subtitle}>
          {isEditMode ? "Edit your location anytime." : "Start typing and pick from the list."}
        </Text>

        <View style={styles.searchRow}>
          <TextInput
            placeholder='Type a city (e.g. "Plo" → Plovdiv)'
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.search}
            value={query}
            onChangeText={(t) => {
              setQuery(t);

              const exact = findPlaceByLabel(t);
              setSelected(exact ?? null);
            }}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={onSubmitSearch}
            editable={hydrated && !saving}
          />
          <Pressable
            onPress={() => void onClear()}
            style={[styles.clearBtn, !canClear && styles.clearBtnDisabled]}
            disabled={!canClear}
          >
            <Text style={[styles.clearText, !canClear && styles.clearTextDisabled]}>Clear</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Suggestions</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {results.map((p) => {
              const active = selected?.id === p.id;

              return (
                <Pressable
                  key={p.id}
                  onPress={() => void onPick(p)}
                  style={[styles.row, active && styles.rowActive]}
                  disabled={!hydrated || saving}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, active && styles.rowTitleActive]}>{p.city}</Text>
                    <Text style={[styles.rowSub, active && styles.rowSubActive]}>{p.country}</Text>
                  </View>
                  <Text style={[styles.chev, active && styles.chevActive]}>›</Text>
                </Pressable>
              );
            })}

            {results.length === 0 && (
              <Text style={styles.empty}>No results. Try another city spelling.</Text>
            )}
          </ScrollView>
        </View>

        <Pressable
          style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
          onPress={onNext}
          disabled={!canContinue}
        >
          <Text style={styles.primaryText}>
            {saving ? "Saving..." : isEditMode ? "Save" : canContinue ? "Next" : "Pick a place"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18 },

  back: { paddingVertical: 8, alignSelf: "flex-start" },
  backText: { color: "rgba(255,255,255,0.8)", fontSize: 14 },

  title: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 6 },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    marginTop: 8,
    marginBottom: 14,
    fontSize: 13,
  },

  searchRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  search: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#fff",
  },
  clearBtn: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { color: "rgba(255,255,255,0.8)", fontWeight: "800" },
  clearBtnDisabled: { opacity: 0.35 },
  clearTextDisabled: { opacity: 0.9 },

  card: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    flex: 1,
  },
  cardTitle: { color: "#fff", fontWeight: "900", marginBottom: 10 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 10,
  },
  rowActive: { backgroundColor: "#fff", borderColor: "#fff" },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  rowSub: { color: "rgba(255,255,255,0.65)", marginTop: 2, fontSize: 12, fontWeight: "700" },
  rowTitleActive: { color: "#000" },
  rowSubActive: { color: "rgba(0,0,0,0.65)" },
  chev: { color: "rgba(255,255,255,0.55)", fontSize: 24, fontWeight: "900", marginLeft: 10 },
  chevActive: { color: "rgba(0,0,0,0.55)" },

  empty: {
    marginTop: 10,
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    textAlign: "center",
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
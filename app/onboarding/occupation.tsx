// app/onboarding/occupation.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getOnboarding, setOnboardingField } from "../../lib/onboarding";

type Item = { id: string; label: string };

type OnboardingData = {
  occupation?: string | null;
};

const OCCUPATIONS: Item[] = [
  { id: "student", label: "Student" },
  { id: "software", label: "Software / IT" },
  { id: "design", label: "Design" },
  { id: "marketing", label: "Marketing" },
  { id: "sales", label: "Sales" },
  { id: "finance", label: "Finance" },
  { id: "entrepreneur", label: "Entrepreneur" },
  { id: "real_estate", label: "Real Estate" },
  { id: "healthcare", label: "Healthcare" },
  { id: "fitness", label: "Fitness Coach" },
  { id: "law", label: "Law" },
  { id: "education", label: "Education" },
  { id: "hospitality", label: "Hospitality" },
  { id: "logistics", label: "Logistics" },
  { id: "construction", label: "Construction" },
  { id: "artist", label: "Artist / Creator" },
  { id: "photographer", label: "Photographer" },
  { id: "music", label: "Music" },
];

function normalize(s: string) {
  return String(s ?? "").trim().toLowerCase();
}

function findByLabel(label: string) {
  const n = normalize(label);
  return OCCUPATIONS.find((x) => normalize(x.label) === n) ?? null;
}

export default function OnboardingOccupation() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const isEditMode = params?.from === "profile";

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef("");

  const clearDebounce = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
  };

  const safeBack = useCallback(() => {
    if (!hydrated || saving) return;

    clearDebounce();

    const canGoBack = (router as any)?.canGoBack?.() ?? false;
    if (canGoBack) {
      router.back();
      return;
    }

    if (isEditMode) {
      router.replace("/(tabs)/profile");
    } else {
      router.replace("/onboarding/interests");
    }
  }, [router, isEditMode, hydrated, saving]);

  useEffect(() => {
    return () => clearDebounce();
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = (await getOnboarding()) as OnboardingData | null;
        if (!mounted) return;

        const savedLabel = String(data?.occupation ?? "").trim();
        if (!savedLabel) return;

        setQuery(savedLabel);

        const exact = findByLabel(savedLabel);
        setSelected(exact);

        lastSavedRef.current = savedLabel;
      } catch {
        // ignore
      } finally {
        if (mounted) setHydrated(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const q = normalize(query);

  const results = useMemo(() => {
    const list = !q ? OCCUPATIONS : OCCUPATIONS.filter((x) => normalize(x.label).includes(q));

    const sorted = [...list].sort((a, b) => {
      const aSel = selected?.id === a.id ? 1 : 0;
      const bSel = selected?.id === b.id ? 1 : 0;
      return bSel - aSel;
    });

    return sorted.slice(0, 18);
  }, [q, selected]);

  const canContinue = useMemo(() => {
    if (!hydrated || saving) return false;
    return isEditMode ? query.trim().length > 0 : !!selected;
  }, [hydrated, saving, isEditMode, query, selected]);

  const canClear = hydrated && !saving && (query.trim().length > 0 || !!selected);

  const persist = async (occupationLabel: string | null) => {
    try {
      await setOnboardingField("occupation", occupationLabel);
      lastSavedRef.current = occupationLabel ?? "";
    } catch {
      // ignore
    }
  };

  const onPick = useCallback(
    async (it: Item) => {
      if (!hydrated || saving) return;

      clearDebounce();

      setSelected(it);
      setQuery(it.label);

      setSaving(true);
      try {
        await persist(it.label);
      } finally {
        setSaving(false);
      }
    },
    [hydrated, saving]
  );

  const onClear = useCallback(async () => {
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
  }, [hydrated, saving]);

  const onSubmitSearch = useCallback(() => {
    const text = query.trim();
    if (!text) return;

    const exact = findByLabel(text);
    if (exact) {
      void onPick(exact);
      return;
    }

    if (results.length === 1) {
      void onPick(results[0]);
    }
  }, [query, results, onPick]);

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

  const onNext = useCallback(async () => {
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

      router.replace("/onboarding/location");
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
  }, [hydrated, saving, isEditMode, selected, query, router, safeBack]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Pressable onPress={safeBack} style={styles.back} hitSlop={10} disabled={!hydrated || saving}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Occupation</Text>
        <Text style={styles.subtitle}>
          {isEditMode ? "Edit your occupation anytime." : "Search and tap to select."}
        </Text>

        <View style={styles.searchRow}>
          <TextInput
            placeholder='Type (e.g. "stu" → Student)'
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.search}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              const exact = findByLabel(t);
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
            style={[styles.clearBtn, !canClear && styles.btnDisabled]}
            disabled={!canClear}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Suggested</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {results.map((it) => {
              const active = selected?.id === it.id;
              return (
                <Pressable
                  key={it.id}
                  onPress={() => void onPick(it)}
                  style={[styles.row, active && styles.rowActive]}
                  disabled={!hydrated || saving}
                >
                  <Text style={[styles.rowTitle, active && styles.rowTitleActive]}>{it.label}</Text>
                  <Text style={[styles.chev, active && styles.chevActive]}>›</Text>
                </Pressable>
              );
            })}

            {results.length === 0 && (
              <Text style={styles.empty}>No results. Try a different keyword.</Text>
            )}
          </ScrollView>
        </View>

        <Pressable
          style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
          onPress={() => void onNext()}
          disabled={!canContinue}
        >
          <Text style={styles.primaryText}>
            {saving ? "Saving..." : isEditMode ? "Save" : canContinue ? "Next" : "Select an occupation"}
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
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 10,
  },
  rowActive: { backgroundColor: "#fff", borderColor: "#fff" },
  rowTitle: { color: "#fff", fontSize: 14, fontWeight: "900" },
  rowTitleActive: { color: "#000" },
  chev: { color: "rgba(255,255,255,0.55)", fontSize: 24, fontWeight: "900" },
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

  btnDisabled: { opacity: 0.35 },
});
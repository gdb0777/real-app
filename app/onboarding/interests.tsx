// app/onboarding/interests.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getOnboarding, setOnboardingField } from "../../lib/onboarding";

type Category =
  | "All"
  | "Sports"
  | "Outdoors"
  | "Social"
  | "Creative"
  | "Business"
  | "Games"
  | "Wellness";

type Interest = {
  id: string;
  label: string;
  category: Exclude<Category, "All">;
};

type OnboardingData = {
  interests?: string[] | null;
};

const INTERESTS: Interest[] = [
  { id: "football", label: "Football", category: "Sports" },
  { id: "gym", label: "Gym", category: "Sports" },
  { id: "basketball", label: "Basketball", category: "Sports" },
  { id: "tennis", label: "Tennis", category: "Sports" },
  { id: "running", label: "Running", category: "Sports" },
  { id: "swimming", label: "Swimming", category: "Sports" },
  { id: "boxing", label: "Boxing", category: "Sports" },
  { id: "mma", label: "MMA", category: "Sports" },
  { id: "volleyball", label: "Volleyball", category: "Sports" },
  { id: "padel", label: "Padel", category: "Sports" },

  { id: "hiking", label: "Hiking", category: "Outdoors" },
  { id: "camping", label: "Camping", category: "Outdoors" },
  { id: "roadtrips", label: "Road trips", category: "Outdoors" },
  { id: "ski", label: "Skiing", category: "Outdoors" },
  { id: "cycling", label: "Cycling", category: "Outdoors" },
  { id: "travel", label: "Travel", category: "Outdoors" },
  { id: "beach", label: "Beach days", category: "Outdoors" },
  { id: "sunrise", label: "Sunrise / Sunset", category: "Outdoors" },
  { id: "picnics", label: "Picnics", category: "Outdoors" },

  { id: "coffee", label: "Coffee", category: "Social" },
  { id: "cinema", label: "Cinema", category: "Social" },
  { id: "nightlife", label: "Nightlife", category: "Social" },
  { id: "restaurants", label: "Restaurants", category: "Social" },
  { id: "events", label: "Events", category: "Social" },
  { id: "concerts", label: "Concerts", category: "Social" },
  { id: "museums", label: "Museums", category: "Social" },
  { id: "bars", label: "Bars", category: "Social" },

  { id: "photography", label: "Photography", category: "Creative" },
  { id: "music", label: "Music", category: "Creative" },
  { id: "content", label: "Content creation", category: "Creative" },
  { id: "art", label: "Art", category: "Creative" },
  { id: "fashion", label: "Fashion", category: "Creative" },
  { id: "design", label: "Design", category: "Creative" },
  { id: "videography", label: "Videography", category: "Creative" },

  { id: "entrepreneur", label: "Entrepreneurship", category: "Business" },
  { id: "investing", label: "Investing", category: "Business" },
  { id: "marketing", label: "Marketing", category: "Business" },
  { id: "startups", label: "Startups", category: "Business" },
  { id: "networking", label: "Networking", category: "Business" },
  { id: "realestate", label: "Real estate", category: "Business" },
  { id: "ecommerce", label: "E-commerce", category: "Business" },

  { id: "boardgames", label: "Board games", category: "Games" },
  { id: "gaming", label: "Gaming", category: "Games" },
  { id: "poker", label: "Poker", category: "Games" },
  { id: "chess", label: "Chess", category: "Games" },
  { id: "trivia", label: "Trivia nights", category: "Games" },

  { id: "yoga", label: "Yoga", category: "Wellness" },
  { id: "meditation", label: "Meditation", category: "Wellness" },
  { id: "spa", label: "Spa / Wellness", category: "Wellness" },
  { id: "selfcare", label: "Self-care", category: "Wellness" },
];

const CATEGORIES: Category[] = [
  "All",
  "Sports",
  "Outdoors",
  "Social",
  "Creative",
  "Business",
  "Games",
  "Wellness",
];

const MIN_SELECTED = 4;

function normalize(s: string) {
  return (s ?? "").trim().toLowerCase();
}

function stableKeyFromSet(s: Set<string>) {
  return Array.from(s).sort().join("|");
}

export default function OnboardingInterests() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const isEditMode = params?.from === "profile";

  const allowedIds = useMemo(() => new Set(INTERESTS.map((i) => i.id)), []);

  const sanitizeSelected = useCallback(
    (ids: unknown) => {
      if (!Array.isArray(ids)) return [];

      const clean = ids
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
        .filter((id) => allowedIds.has(id));

      return Array.from(new Set(clean));
    },
    [allowedIds]
  );

  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  const lastSavedRef = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safeBack = useCallback(() => {
    if (saving) return;

    const canGoBack = (router as any)?.canGoBack?.() ?? false;
    if (canGoBack) {
      router.back();
      return;
    }

    if (isEditMode) router.replace("/(tabs)/profile");
    else router.replace("/onboarding/birthdate");
  }, [router, isEditMode, saving]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = (await getOnboarding()) as OnboardingData | null;
        if (!mounted) return;

        const saved = sanitizeSelected(data?.interests);
        const next = new Set(saved);

        setSelected(next);
        lastSavedRef.current = stableKeyFromSet(next);
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
  }, [sanitizeSelected]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const normalizedQuery = normalize(query);

  const filtered = useMemo(() => {
    let list = INTERESTS;

    if (activeCategory !== "All") {
      list = list.filter((i) => i.category === activeCategory);
    }

    if (normalizedQuery.length > 0) {
      list = list.filter((i) => normalize(i.label).includes(normalizedQuery));
    }

    const sel = selected;

    return [...list].sort((a, b) => {
      const aSel = sel.has(a.id) ? 1 : 0;
      const bSel = sel.has(b.id) ? 1 : 0;
      return bSel - aSel;
    });
  }, [activeCategory, normalizedQuery, selected]);

  const selectedCount = selected.size;

  const canContinue = useMemo(() => {
    if (!hydrated || saving) return false;
    if (isEditMode) return true;
    return selectedCount >= MIN_SELECTED;
  }, [hydrated, saving, isEditMode, selectedCount]);

  useEffect(() => {
    if (!hydrated || saving) return;

    const fingerprint = stableKeyFromSet(selected);
    if (fingerprint === lastSavedRef.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      const arr = Array.from(selected);

      setOnboardingField("interests", arr.length ? arr : null)
        .then(() => {
          lastSavedRef.current = fingerprint;
        })
        .catch(() => {});
    }, 250);
  }, [selected, hydrated, saving]);

  const toggle = (id: string) => {
    if (!hydrated || saving) return;
    if (!id || !allowedIds.has(id)) return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearAll = async () => {
    if (!hydrated || saving) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    setSelected(new Set());
    setQuery("");
    setActiveCategory("All");

    try {
      await setOnboardingField("interests", null);
      lastSavedRef.current = "";
    } catch {
      // ignore
    }
  };

  const onNext = async () => {
    if (!hydrated || saving) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    const selectedIds = Array.from(selected);
    if (!isEditMode && selectedIds.length < MIN_SELECTED) return;

    setSaving(true);
    try {
      await setOnboardingField("interests", selectedIds.length ? selectedIds : null);
      lastSavedRef.current = stableKeyFromSet(selected);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }

    if (isEditMode) {
      safeBack();
      return;
    }

    router.replace("/onboarding/occupation");
  };

  const canClear =
    hydrated && !saving && (query.trim().length > 0 || selected.size > 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Pressable onPress={safeBack} style={styles.back} hitSlop={10} disabled={saving}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{isEditMode ? "Edit interests" : "Pick your interests"}</Text>
            <Text style={styles.subtitle}>
              {isEditMode
                ? "Update what you like. This improves your matches."
                : `Choose at least ${MIN_SELECTED}. This improves your matches.`}
            </Text>
          </View>

          {!isEditMode && (
            <View style={styles.counterWrap}>
              <Text style={styles.counterText}>
                {Math.min(selectedCount, MIN_SELECTED)}/{MIN_SELECTED}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.searchRow}>
          <TextInput
            placeholder="Search interests…"
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            editable={hydrated && !saving}
          />
          <Pressable
            onPress={() => void clearAll()}
            style={[styles.clearBtn, !canClear && styles.clearBtnDisabled]}
            disabled={!canClear}
          >
            <Text style={[styles.clearText, !canClear && styles.clearTextDisabled]}>Clear</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {CATEGORIES.map((c) => {
            const active = c === activeCategory;

            return (
              <Pressable
                key={c}
                onPress={() => hydrated && !saving && setActiveCategory(c)}
                style={[
                  styles.catPill,
                  active && styles.catPillActive,
                  (!hydrated || saving) && styles.disabledChip,
                ]}
                disabled={!hydrated || saving}
              >
                <Text style={[styles.catText, active && styles.catTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.chipsWrap}>
          <View style={styles.chips}>
            {filtered.map((item) => {
              const isOn = selected.has(item.id);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggle(item.id)}
                  style={[
                    styles.chip,
                    isOn && styles.chipOn,
                    (!hydrated || saving) && styles.disabledChip,
                  ]}
                  disabled={!hydrated || saving}
                >
                  <Text style={[styles.chipText, isOn && styles.chipTextOn]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {filtered.length === 0 && (
            <Text style={styles.empty}>No results. Try a different keyword.</Text>
          )}
        </ScrollView>

        <Pressable
          style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
          onPress={onNext}
          disabled={!canContinue}
        >
          <Text style={styles.primaryText}>
            {isEditMode
              ? saving
                ? "Saving..."
                : "Save"
              : saving
              ? "Saving..."
              : canContinue
              ? "Next"
              : `Select ${Math.max(0, MIN_SELECTED - selectedCount)} more`}
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

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  title: { color: "#fff", fontSize: 30, fontWeight: "900" },
  subtitle: { color: "rgba(255,255,255,0.65)", marginTop: 8, fontSize: 13 },

  counterWrap: {
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  counterText: { color: "#fff", fontSize: 14, fontWeight: "900" },

  searchRow: { flexDirection: "row", gap: 10, marginTop: 16 },
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
  clearText: { color: "rgba(255,255,255,0.8)", fontWeight: "900" },
  clearBtnDisabled: { opacity: 0.35 },
  clearTextDisabled: { opacity: 0.9 },

  categories: { paddingVertical: 14, gap: 10 },
  catPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  catPillActive: { backgroundColor: "#fff", borderColor: "#fff" },
  catText: { color: "rgba(255,255,255,0.85)", fontWeight: "900", fontSize: 13 },
  catTextActive: { color: "#000" },

  chipsWrap: { paddingBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  chip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chipOn: { backgroundColor: "#fff", borderColor: "#fff" },
  chipText: { color: "rgba(255,255,255,0.85)", fontWeight: "900", fontSize: 13 },
  chipTextOn: { color: "#000" },
  disabledChip: { opacity: 0.7 },

  empty: {
    marginTop: 14,
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
    marginTop: 16,
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "900" },
});
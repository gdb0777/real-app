// app/(tabs)/explore.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { usePlans, type Plan } from "../../providers/PlansProvider";

type Category =
  | "All"
  | "Sports"
  | "Outdoors"
  | "Social"
  | "Creative"
  | "Business"
  | "Games"
  | "Wellness";

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

function safeText(v: unknown) {
  return String(v ?? "").trim();
}

function clampNonNegative(n: number) {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function safeTags(tags?: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.map((x) => safeText(x)).filter(Boolean);
}

function guessCategoryFromTags(tags?: unknown): Exclude<Category, "All"> {
  const t = safeTags(tags).map((x) => x.toLowerCase());
  if (t.length === 0) return "Social";

  const has = (arr: string[]) => arr.some((k) => t.some((x) => x.includes(k)));

  if (
    has([
      "football",
      "basket",
      "tennis",
      "gym",
      "run",
      "boxing",
      "mma",
      "padel",
      "swim",
      "volley",
      "sports",
    ])
  ) {
    return "Sports";
  }

  if (has(["hiking", "camp", "ski", "cycling", "travel", "road", "beach", "sunrise", "outdoor"])) {
    return "Outdoors";
  }

  if (has(["coffee", "cinema", "nightlife", "restaurant", "bar", "event", "concert", "museum", "social"])) {
    return "Social";
  }

  if (has(["photo", "music", "content", "art", "fashion", "design", "video", "creative"])) {
    return "Creative";
  }

  if (
    has([
      "entrepreneur",
      "invest",
      "marketing",
      "startup",
      "network",
      "realestate",
      "real estate",
      "ecommerce",
      "e-commerce",
      "business",
    ])
  ) {
    return "Business";
  }

  if (has(["gaming", "poker", "chess", "board", "trivia", "games"])) {
    return "Games";
  }

  if (has(["yoga", "meditation", "spa", "selfcare", "self-care", "wellness"])) {
    return "Wellness";
  }

  return "Social";
}

function fallbackImageForTitle(title: string) {
  const seed = encodeURIComponent(safeText(title) || "event");
  return `https://picsum.photos/seed/${seed}/1200/800`;
}

function CategoriesHeader({
  activeCategory,
  setActiveCategory,
}: {
  activeCategory: Category;
  setActiveCategory: (c: Category) => void;
}) {
  return (
    <View style={styles.listHeader}>
      <View style={styles.catsRow}>
        {CATEGORIES.map((c) => {
          const active = c === activeCategory;

          return (
            <Pressable
              key={c}
              onPress={() => setActiveCategory(c)}
              style={[styles.catPill, active && styles.catPillOn]}
            >
              <Text style={[styles.catText, active && styles.catTextOn]}>{c}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function ExploreScreen() {
  const { plans } = usePlans();

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const normalized = query.trim().toLowerCase();

  const prepared = useMemo(() => {
    const list = Array.isArray(plans) ? plans : [];

    return list.map((p: Plan) => {
      const tags = safeTags(p.tags);
      const category = guessCategoryFromTags(tags);

      const host = safeText(p.host) || "Someone";
      const spotsLeft = clampNonNegative(Number(p.spotsLeft ?? 0));
      const peopleCount = Array.isArray(p.participants) ? p.participants.length : 0;

      const title = safeText(p.title) || "Untitled plan";
      const location = safeText(p.location);
      const dateLabel = safeText(p.dateLabel);
      const imageUri = safeText(p.imageUri) || fallbackImageForTitle(title);

      const hay = `${title} ${location} ${host} ${tags.join(" ")} ${category}`.toLowerCase();

      const id = safeText(p.id);
      const stableKey = id || `${title}|${dateLabel}|${host}|${location}`;

      return {
        plan: p,
        stableKey,
        category,
        tags,
        host,
        spotsLeft,
        peopleCount,
        title,
        location,
        dateLabel,
        imageUri,
        hay,
      };
    });
  }, [plans]);

  const filtered = useMemo(() => {
    let list = prepared;

    if (activeCategory !== "All") {
      list = list.filter((x) => x.category === activeCategory);
    }

    if (normalized.length > 0) {
      list = list.filter((x) => x.hay.includes(normalized));
    }

    return list;
  }, [prepared, activeCategory, normalized]);

  const goDetails = useCallback((id: string) => {
    const safeId = safeText(id);
    if (!safeId) return;
    router.push({ pathname: "/plan/[id]", params: { id: safeId } });
  }, []);

  const header = useMemo(() => {
    return <CategoriesHeader activeCategory={activeCategory} setActiveCategory={setActiveCategory} />;
  }, [activeCategory]);

  const empty = useMemo(() => {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="search-outline" size={24} color="rgba(255,255,255,0.72)" />
        <Text style={styles.emptyTitle}>No results</Text>
        <Text style={styles.emptyText}>Try a different keyword or category.</Text>
      </View>
    );
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: (typeof filtered)[number] }) => {
      const { plan, category, tags, host, peopleCount, spotsLeft, title, dateLabel, location, imageUri } = item;
      const id = safeText(plan.id);

      return (
        <Pressable onPress={() => goDetails(id)} style={styles.card}>
          <View style={styles.coverWrap}>
            <Image source={{ uri: imageUri }} style={styles.coverImg} resizeMode="cover" />

            <View style={styles.coverTopRow}>
              <View style={styles.overlayBadge}>
                <Text style={styles.overlayBadgeText}>{category}</Text>
              </View>

              <View style={[styles.overlayBadge, spotsLeft <= 0 && styles.overlayBadgeDanger]}>
                <Text style={styles.overlayBadgeText}>
                  {spotsLeft > 0 ? `${spotsLeft} left` : "Full"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={styles.hostLine} numberOfLines={1}>
                  Hosted by {host}
                </Text>
              </View>

              <View style={styles.peopleMini}>
                <Ionicons name="people-outline" size={15} color="rgba(255,255,255,0.9)" />
                <Text style={styles.peopleMiniText}>{peopleCount}</Text>
              </View>
            </View>

            <View style={styles.metaStack}>
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color="#fff" />
                <Text style={styles.metaText}>{dateLabel || "Today"}</Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color="#fff" />
                <Text style={styles.metaText} numberOfLines={1}>
                  {location || "Unknown location"}
                </Text>
              </View>
            </View>

            {tags.length > 0 && (
              <View style={styles.tagsRow}>
                {tags.slice(0, 3).map((t, idx) => (
                  <View key={`${t}-${idx}`} style={styles.tag}>
                    <Text style={styles.tagText}>{t}</Text>
                  </View>
                ))}
                {tags.length > 3 && <Text style={styles.moreTag}>+{tags.length - 3}</Text>}
              </View>
            )}

            <View style={styles.actionsRow}>
              <View style={styles.viewBtn}>
                <Text style={styles.viewBtnText}>View details</Text>
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [goDetails]
  );

  const canClear = query.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />

      <View style={styles.container}>
        <Text style={styles.h1}>Explore</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.62)" />
            <TextInput
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                if (t.trim().length > 0 && activeCategory !== "All") {
                  setActiveCategory("All");
                }
              }}
              placeholder="Search plans, places, tags..."
              placeholderTextColor="rgba(255,255,255,0.42)"
              style={styles.search}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          <Pressable
            onPress={() => setQuery("")}
            style={[styles.clearBtn, !canClear && styles.clearBtnDisabled]}
            disabled={!canClear}
          >
            <Text style={[styles.clearText, !canClear && styles.clearTextDisabled]}>Clear</Text>
          </Pressable>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(x) => x.stableKey}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },

  h1: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
    letterSpacing: -0.8,
  },

  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  searchWrap: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  search: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  clearBtn: {
    height: 54,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    color: "rgba(255,255,255,0.88)",
    fontWeight: "800",
    fontSize: 14,
  },
  clearBtnDisabled: { opacity: 0.35 },
  clearTextDisabled: { opacity: 0.9 },

  listHeader: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  catsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  catPill: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  catPillOn: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  catText: {
    color: "rgba(255,255,255,0.88)",
    fontWeight: "800",
    fontSize: 13,
  },
  catTextOn: {
    color: "#000",
  },

  listContent: {
    paddingTop: 10,
    paddingBottom: 28,
  },

  card: {
    marginBottom: 18,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  coverWrap: {
    width: "100%",
    aspectRatio: 16 / 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  coverImg: {
    width: "100%",
    height: "100%",
  },

  coverTopRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  overlayBadge: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.46)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayBadgeDanger: {
    backgroundColor: "rgba(90,20,20,0.72)",
    borderColor: "rgba(255,255,255,0.10)",
  },
  overlayBadgeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },

  cardContent: {
    padding: 14,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22,
  },
  hostLine: {
    color: "rgba(255,255,255,0.56)",
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
  },

  peopleMini: {
    minWidth: 52,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  peopleMiniText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },

  metaStack: {
    marginTop: 14,
    gap: 8,
  },
  metaRow: {
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },

  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  tag: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: {
    color: "rgba(255,255,255,0.88)",
    fontWeight: "700",
    fontSize: 12,
  },
  moreTag: {
    color: "rgba(255,255,255,0.58)",
    fontWeight: "800",
    alignSelf: "center",
  },

  actionsRow: {
    marginTop: 16,
  },
  viewBtn: {
    height: 48,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  viewBtnText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 15,
  },

  emptyWrap: {
    marginTop: 34,
    borderRadius: 22,
    padding: 18,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
  },
});
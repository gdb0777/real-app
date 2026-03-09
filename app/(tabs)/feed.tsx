// app/(tabs)/feed.tsx
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { usePlans, type Plan } from "../../providers/PlansProvider";
import { getOnboarding } from "../../lib/onboarding";

type Filter = "All" | "Today" | "This week";
type Mode = "For You" | "All";

function safeText(v: unknown) {
  return String(v ?? "").trim();
}

function norm(v: unknown) {
  return safeText(v).toLowerCase();
}

function includesLoose(a: unknown, b: unknown) {
  const A = norm(a);
  const B = norm(b);
  if (!A || !B) return false;
  return A.includes(B) || B.includes(A);
}

function pickCity(text: unknown) {
  const t = safeText(text);
  if (!t) return "";
  return (t.split(",")[0] ?? "").trim();
}

function parseCreatedAt(plan: Plan): number {
  const n = Number(plan.createdAt ?? 0);
  if (!Number.isNaN(n) && n > 0) return n;

  const ms = Date.parse(String(plan.createdAt ?? ""));
  return Number.isNaN(ms) ? 0 : ms;
}

function clampNonNegative(n: number) {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function getHost(plan: Plan) {
  return safeText(plan.host) || "Someone";
}

function getDateLabel(plan: Plan) {
  return safeText(plan.dateLabel) || "Any day";
}

function getSpotsLeft(plan: Plan) {
  return clampNonNegative(Number(plan.spotsLeft ?? 0));
}

function getImageUri(plan: Plan) {
  return safeText(plan.imageUri);
}

function getTags(plan: Plan): string[] {
  return Array.isArray(plan.tags) ? plan.tags.map(safeText).filter(Boolean) : [];
}

function stableKeyForPlan(plan: Plan) {
  const id = safeText(plan.id);
  if (id) return id;

  const title = safeText(plan.title);
  const loc = safeText(plan.location);
  const dl = getDateLabel(plan);
  const host = getHost(plan);
  const created = String(parseCreatedAt(plan) || "");
  return `${title}|${dl}|${loc}|${host}|${created}`.trim();
}

function fallbackImageForTitle(title: string) {
  const seed = encodeURIComponent(safeText(title) || "event");
  return `https://picsum.photos/seed/${seed}/1200/800`;
}

export default function FeedScreen() {
  const { plans, toggleJoin, isGuest } = usePlans();

  const [filter, setFilter] = useState<Filter>("All");
  const [mode, setMode] = useState<Mode>("For You");

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [locationText, setLocationText] = useState("");
  const [interestIds, setInterestIds] = useState<string[]>([]);

  const requireLogin = useCallback(() => {
    router.push("/login");
  }, []);

  const loadProfile = useCallback(async () => {
    if (isGuest) {
      setLocationText("");
      setInterestIds([]);
      setLoadingProfile(false);
      return;
    }

    try {
      setLoadingProfile(true);
      const data = await getOnboarding();
      setLocationText(safeText(data?.location));
      setInterestIds(
        Array.isArray(data?.interests) ? data.interests.map((x: unknown) => String(x)) : []
      );
    } catch {
      setLocationText("");
      setInterestIds([]);
    } finally {
      setLoadingProfile(false);
    }
  }, [isGuest]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  useEffect(() => {
    if (isGuest && mode === "For You") {
      setMode("All");
    }
  }, [isGuest, mode]);

  const userCity = useMemo(() => pickCity(locationText), [locationText]);

  const filteredByTime = useMemo(() => {
    const list = Array.isArray(plans) ? plans : [];
    if (filter === "All") return list;

    if (filter === "Today") {
      return list.filter((p) => getDateLabel(p).startsWith("Today"));
    }

    const weekdayStarts = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return list.filter((p) => {
      const s = getDateLabel(p);
      if (s.startsWith("Today")) return true;
      if (s.startsWith("Tomorrow")) return true;
      return weekdayStarts.some((w) => s.startsWith(w));
    });
  }, [filter, plans]);

  const recommendedList = useMemo(() => {
    if (isGuest) return filteredByTime;

    const interestSet = new Set((interestIds ?? []).map(norm).filter(Boolean));
    const hasSignals = interestSet.size > 0 || norm(locationText).length > 0;

    if (!hasSignals) return filteredByTime;

    const scored = filteredByTime.map((p) => {
      let score = 0;

      const tags = getTags(p).map(norm);
      for (const t of tags) {
        if (interestSet.has(t)) score += 2;
      }

      const planLoc = safeText(p.location);
      const planCity = pickCity(planLoc);

      if (includesLoose(planLoc, locationText)) score += 0.75;
      if (userCity && (includesLoose(planLoc, userCity) || includesLoose(planCity, userCity))) {
        score += 1;
      }

      const dl = getDateLabel(p);
      if (dl.startsWith("Today")) score += 0.5;
      if (dl.startsWith("Tomorrow")) score += 0.25;

      return { plan: p, score };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return parseCreatedAt(b.plan) - parseCreatedAt(a.plan);
    });

    const meaningful = scored.filter((x) => x.score > 0).map((x) => x.plan);
    return meaningful.length ? meaningful : filteredByTime;
  }, [filteredByTime, interestIds, locationText, userCity, isGuest]);

  const list = useMemo(
    () => (mode === "For You" ? recommendedList : filteredByTime),
    [mode, recommendedList, filteredByTime]
  );

  const goDetails = useCallback((id: string) => {
    const safeId = safeText(id);
    if (!safeId) return;
    router.push({ pathname: "/plan/[id]", params: { id: safeId } });
  }, []);

  const goParticipants = useCallback((id: string) => {
    const safeId = safeText(id);
    if (!safeId) return;
    router.push({ pathname: "/plan/participants", params: { id: safeId } });
  }, []);

  const onToggleJoin = useCallback(
    (id: string) => {
      const safeId = safeText(id);
      if (!safeId) return;

      if (isGuest) {
        requireLogin();
        return;
      }

      toggleJoin(safeId);
    },
    [toggleJoin, isGuest, requireLogin]
  );

  const emptyText = useMemo(() => {
    if (mode === "For You") {
      if (loadingProfile) return "Loading plans for you…";
      if (isGuest) return "Login to see personalized plans.";
      return "No personalized plans yet. Add interests and location in Profile.";
    }

    return isGuest ? "No plans yet." : "No plans yet. Create the first one.";
  }, [mode, loadingProfile, isGuest]);

  const Empty = useMemo(() => <Text style={styles.empty}>{emptyText}</Text>, [emptyText]);

  const renderItem = useCallback(
    ({ item }: { item: Plan }) => {
      const id = safeText(item.id);
      const title = safeText(item.title) || "Untitled plan";
      const dateLabel = getDateLabel(item);
      const location = safeText(item.location) || "Unknown location";
      const host = getHost(item);
      const tags = getTags(item);

      const isJoined = !!item.joined;
      const peopleCount = Array.isArray(item.participants) ? item.participants.length : 0;
      const spotsLeft = getSpotsLeft(item);
      const canJoin = isJoined || spotsLeft > 0;

      const imageUri = getImageUri(item) || fallbackImageForTitle(title);

      const joinLabel = isGuest
        ? canJoin
          ? "Login to join"
          : "Full"
        : isJoined
        ? "Joined"
        : spotsLeft <= 0
        ? "Full"
        : "Join";

      const joinDisabled = !canJoin;

      const onJoinPress = () => {
        if (!canJoin) return;

        if (isGuest) {
          requireLogin();
          return;
        }

        onToggleJoin(id);
      };

      return (
        <Pressable onPress={() => goDetails(id)} style={styles.card}>
          <View style={styles.coverWrap}>
            <Image source={{ uri: imageUri }} style={styles.coverImg} resizeMode="cover" />

            <View style={styles.overlayTopRow}>
              <View style={styles.overlayBadge}>
                <Ionicons name="people-outline" size={14} color="#fff" />
                <Text style={styles.overlayBadgeText}>{peopleCount}</Text>
              </View>

              <View style={[styles.overlayBadge, spotsLeft <= 0 && styles.overlayBadgeDanger]}>
                <Text style={styles.overlayBadgeText}>
                  {spotsLeft > 0 ? `${spotsLeft} spots left` : "Full"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={styles.host} numberOfLines={1}>
                  Hosted by {host}
                </Text>
              </View>

              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  goParticipants(id);
                }}
                style={styles.peopleMini}
              >
                <Ionicons name="people-outline" size={15} color="rgba(255,255,255,0.88)" />
              </Pressable>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Ionicons name="calendar-outline" size={14} color="#fff" />
                <Text style={styles.metaChipText}>{dateLabel}</Text>
              </View>

              <View style={styles.metaChip}>
                <Ionicons name="location-outline" size={14} color="#fff" />
                <Text style={styles.metaChipText} numberOfLines={1}>
                  {location}
                </Text>
              </View>
            </View>

            {tags.length > 0 && (
              <View style={styles.tagsRow}>
                {tags.slice(0, 3).map((t, i) => (
                  <View key={`${t}-${i}`} style={styles.tag}>
                    <Text style={styles.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actionsRow}>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onJoinPress();
                }}
                disabled={joinDisabled}
                style={[
                  styles.joinBtn,
                  isJoined && styles.joinBtnOn,
                  joinDisabled && styles.btnDisabled,
                ]}
              >
                <Text style={[styles.joinBtnText, isJoined && styles.joinBtnTextOn]}>
                  {joinLabel}
                </Text>
              </Pressable>

              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  goDetails(id);
                }}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Details</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      );
    },
    [goDetails, goParticipants, isGuest, onToggleJoin, requireLogin]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />

      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>REAL</Text>
          </View>

          <Pressable
            onPress={loadProfile}
            style={[styles.refreshBtn, isGuest && styles.btnDisabled]}
            disabled={isGuest}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.modeRow}>
          {(["For You", "All"] as Mode[]).map((m) => {
            const active = m === mode;
            const disabled = isGuest && m === "For You";

            return (
              <Pressable
                key={m}
                onPress={() => !disabled && setMode(m)}
                style={[styles.modePill, active && styles.modePillOn, disabled && styles.btnDisabled]}
                disabled={disabled}
              >
                <Text style={[styles.modeText, active && styles.modeTextOn]}>{m}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.filtersRow}>
          {(["All", "Today", "This week"] as Filter[]).map((f) => {
            const active = f === filter;

            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filterPill, active && styles.filterPillOn]}
              >
                <Text style={[styles.filterText, active && styles.filterTextOn]}>{f}</Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={list}
          keyExtractor={(x, i) => stableKeyForPlan(x) || String(i)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={Empty}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={6}
          windowSize={10}
          maxToRenderPerBatch={8}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050505" },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: 4,
  },
  brand: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  modeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  modePill: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  modePillOn: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  modeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  modeTextOn: {
    color: "#000",
  },

  filtersRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    marginBottom: 6,
  },
  filterPill: {
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterPillOn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  filterText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: "700",
  },
  filterTextOn: {
    color: "#fff",
  },

  listContent: {
    paddingTop: 12,
    paddingBottom: 28,
  },

  card: {
    marginBottom: 18,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  coverWrap: {
    width: "100%",
    aspectRatio: 16 / 11,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  coverImg: {
    width: "100%",
    height: "100%",
  },

  overlayTopRow: {
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
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  overlayBadgeDanger: {
    backgroundColor: "rgba(90,20,20,0.72)",
    borderColor: "rgba(255,255,255,0.10)",
  },
  overlayBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },

  content: {
    padding: 14,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
  },
  host: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
  },
  peopleMini: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  metaRow: {
    marginTop: 14,
    gap: 10,
  },
  metaChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaChipText: {
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
    fontSize: 12,
    fontWeight: "700",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  joinBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  joinBtnOn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  joinBtnText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "900",
  },
  joinBtnTextOn: {
    color: "#fff",
  },

  secondaryBtn: {
    width: 112,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },

  btnDisabled: {
    opacity: 0.4,
  },

  empty: {
    marginTop: 42,
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
});
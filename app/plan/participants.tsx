// app/plan/participants.tsx
import React, { useMemo, useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { usePlans, type Plan } from "../../providers/PlansProvider";

function safeText(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s.length ? s : fallback;
}

function getIdParam(id: unknown): string | null {
  if (typeof id === "string" && id.trim()) return id.trim();
  if (Array.isArray(id) && typeof id[0] === "string" && id[0].trim()) return id[0].trim();
  return null;
}

function getInitial(name: string) {
  const n = safeText(name, "U");
  return (n[0] ?? "U").toUpperCase();
}

function normKey(v: unknown) {
  return safeText(v, "").toLowerCase();
}

function getHost(plan: Plan | null) {
  return safeText(plan?.host, "") || "Unknown";
}

function reorderParticipants(list: string[], hostName: string, meName: string) {
  const hostKey = normKey(hostName);
  const meKey = normKey(meName);

  const host: string[] = [];
  const me: string[] = [];
  const rest: string[] = [];

  for (const n of list) {
    const k = normKey(n);
    if (hostKey && k === hostKey) host.push(n);
    else if (meKey && k === meKey) me.push(n);
    else rest.push(n);
  }

  return [...host, ...me, ...rest];
}

export default function ParticipantsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const planId = getIdParam(params?.id);

  const { plans, meName } = usePlans();
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 900);
    return () => clearTimeout(t);
  }, []);

  const plan = useMemo<Plan | null>(() => {
    if (!planId) return null;
    const list = Array.isArray(plans) ? plans : [];
    return list.find((p) => String(p.id) === String(planId)) ?? null;
  }, [planId, plans]);

  const hostName = useMemo(() => getHost(plan), [plan]);
  const hostKey = useMemo(() => normKey(hostName), [hostName]);
  const meKey = useMemo(() => normKey(meName), [meName]);

  const participants = useMemo((): string[] => {
    const arr = Array.isArray(plan?.participants) ? plan.participants : [];

    const out: string[] = [];
    const seen = new Set<string>();

    for (const x of arr) {
      const name = safeText(x, "");
      const k = normKey(name);
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(name);
    }

    return reorderParticipants(out, hostName, meName);
  }, [plan, hostName, meName]);

  const onBack = useCallback(() => {
    const canGoBack = (router as any)?.canGoBack?.() ?? false;
    if (canGoBack) {
      router.back();
      return;
    }
    router.replace("/(tabs)/feed");
  }, [router]);

  const Header = useMemo(() => {
    return (
      <View style={styles.topRow}>
        <Pressable onPress={onBack} style={styles.iconBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </Pressable>

        <Text style={styles.header}>Participants</Text>

        <View style={{ width: 42 }} />
      </View>
    );
  }, [onBack]);

  if (!planId) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <View style={styles.container}>
          {Header}

          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Invalid link</Text>
            <Text style={styles.stateText}>This participants link is missing a plan id.</Text>

            <Pressable
              onPress={() => router.replace("/(tabs)/feed")}
              style={[styles.secondaryBtn, { marginTop: 16, width: "100%" }]}
            >
              <Text style={styles.secondaryText}>Back to Feed</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <View style={styles.container}>
          {Header}

          <View style={styles.stateCard}>
            {!waited ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <Text style={styles.stateTitle}>Loading…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.stateTitle}>Not found</Text>
                <Text style={styles.stateText}>
                  The plan may be deleted, unavailable, or not loaded yet.
                </Text>
              </>
            )}

            <Pressable
              onPress={() => router.replace("/(tabs)/feed")}
              style={[styles.secondaryBtn, { marginTop: 16, width: "100%" }]}
            >
              <Text style={styles.secondaryText}>Back to Feed</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const planTitle = safeText(plan.title, "Untitled plan");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />

      <View style={styles.container}>
        {Header}

        <View style={styles.summaryCard}>
          <Text style={styles.title}>{planTitle}</Text>
          <Text style={styles.subtitle}>
            {participants.length} {participants.length === 1 ? "person" : "people"} joined
          </Text>

          <View style={styles.summaryMetaRow}>
            <View style={styles.summaryMetaChip}>
              <Ionicons name="person-outline" size={14} color="#fff" />
              <Text style={styles.summaryMetaText}>Host: {safeText(hostName, "Unknown")}</Text>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {participants.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={22} color="rgba(255,255,255,0.72)" />
              <Text style={styles.emptyTitle}>No participants yet</Text>
              <Text style={styles.emptyText}>Be the first one to join this plan.</Text>
            </View>
          ) : (
            participants.map((name, idx) => {
              const key = normKey(name);
              const isMe = !!meKey && key === meKey;
              const isHost = !!hostKey && key === hostKey;

              const badge = isHost
                ? { label: "HOST", white: true }
                : isMe
                ? { label: "YOU", white: true }
                : { label: "REAL", white: false };

              return (
                <View key={`${String(plan.id)}-${key}-${idx}`} style={styles.personRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitial(name)}</Text>
                  </View>

                  <View style={styles.personBody}>
                    <Text style={styles.personName}>{name}</Text>
                    <Text style={styles.personMeta}>
                      {isHost ? "Hosting this plan" : isMe ? "That’s you" : "Joined the plan"}
                    </Text>
                  </View>

                  <View style={[styles.badge, badge.white && styles.badgeWhite]}>
                    <Text style={[styles.badgeText, badge.white && styles.badgeTextDark]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 10 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  header: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },

  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 14,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
  },
  subtitle: {
    color: "rgba(255,255,255,0.60)",
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  summaryMetaRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryMetaChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryMetaText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  scrollContent: {
    paddingBottom: 24,
  },

  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 20,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 17,
  },

  personBody: {
    flex: 1,
  },
  personName: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
  personMeta: {
    color: "rgba(255,255,255,0.56)",
    marginTop: 4,
    fontWeight: "600",
    fontSize: 12,
  },

  badge: {
    paddingHorizontal: 10,
    minWidth: 58,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "rgba(255,255,255,0.92)",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.8,
  },

  badgeWhite: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  badgeTextDark: {
    color: "#000",
  },

  emptyCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
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

  stateCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  stateTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  stateText: {
    color: "rgba(255,255,255,0.64)",
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  secondaryBtn: {
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: "rgba(255,255,255,0.92)",
    fontWeight: "800",
    fontSize: 14,
  },
});
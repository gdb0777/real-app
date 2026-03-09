// app/plan/[id].tsx
import React, { useMemo, useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { usePlans, type Plan } from "../../providers/PlansProvider";
import { getPlanImagePublicUrl } from "../../lib/planImages";

function safeText(v: unknown, fallback = "—") {
  const s = String(v ?? "").trim();
  return s.length ? s : fallback;
}

function safeTextOrEmpty(v: unknown) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function getIdParam(id: unknown): string | null {
  if (typeof id === "string" && id.trim()) return id.trim();
  if (Array.isArray(id) && typeof id[0] === "string" && id[0].trim()) return id[0].trim();
  return null;
}

function clampNonNegative(n: number) {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function getHost(plan: Plan) {
  return safeTextOrEmpty(plan.host) || "—";
}

function getDateLabel(plan: Plan) {
  return safeTextOrEmpty(plan.dateLabel) || "—";
}

function getSpotsLeft(plan: Plan) {
  return clampNonNegative(Number(plan.spotsLeft ?? 0));
}

function getImageRaw(plan: Plan) {
  return safeTextOrEmpty(plan.imageUri);
}

function normalizeImageUri(raw: string) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^(https?:\/\/|file:\/\/|content:\/\/)/i.test(s)) return s;

  try {
    const url = getPlanImagePublicUrl(s);
    return url ?? "";
  } catch {
    return "";
  }
}

export default function PlanDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const planId = getIdParam(params?.id);

  const { plans, toggleJoin, isGuest } = usePlans();
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

        <Text style={styles.header}>Plan details</Text>

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
            <Text style={styles.stateText}>This plan link is missing an id.</Text>

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

  const id = String(plan.id);
  const title = safeText(plan.title, "Untitled plan");
  const dateLabel = getDateLabel(plan);
  const location = safeText(plan.location);
  const host = getHost(plan);

  const imageRaw = getImageRaw(plan);
  const imageUri = normalizeImageUri(imageRaw);

  const isJoined = !!plan.joined;
  const participants = Array.isArray(plan.participants) ? plan.participants : [];
  const participantsCount = participants.length;
  const tags = Array.isArray(plan.tags) ? plan.tags : [];
  const spotsLeft = getSpotsLeft(plan);
  const canJoin = isJoined || spotsLeft > 0;

  const joinDisabled = !isGuest && !canJoin;

  const joinLabel = isGuest
    ? canJoin
      ? "Login to join"
      : "Full"
    : isJoined
    ? "Joined"
    : spotsLeft <= 0
    ? "Full"
    : "Join";

  const goParticipants = useCallback(() => {
    router.push({ pathname: "/plan/participants", params: { id } });
  }, [router, id]);

  const onJoinPress = useCallback(() => {
    if (!canJoin) return;

    if (isGuest) {
      router.push("/login");
      return;
    }

    toggleJoin(id);
  }, [canJoin, id, isGuest, router, toggleJoin]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />

      <View style={styles.container}>
        {Header}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {!!imageUri && (
            <View style={styles.heroWrap}>
              <Image
                source={{ uri: imageUri }}
                style={styles.hero}
                resizeMode="cover"
                onError={() => {
                  /* silent */
                }}
              />

              <View style={styles.heroOverlayTop}>
                <View style={styles.overlayBadge}>
                  <Ionicons name="people-outline" size={14} color="#fff" />
                  <Text style={styles.overlayBadgeText}>{participantsCount}</Text>
                </View>

                <View style={[styles.overlayBadge, spotsLeft <= 0 && styles.overlayBadgeDanger]}>
                  <Text style={styles.overlayBadgeText}>
                    {spotsLeft > 0 ? `${spotsLeft} spots left` : "Full"}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.mainCard}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.hostLine}>Hosted by {host}</Text>

            <View style={styles.infoStack}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="calendar-outline" size={16} color="#fff" />
                </View>
                <View style={styles.infoBody}>
                  <Text style={styles.infoLabel}>When</Text>
                  <Text style={styles.infoValue}>{dateLabel}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="location-outline" size={16} color="#fff" />
                </View>
                <View style={styles.infoBody}>
                  <Text style={styles.infoLabel}>Where</Text>
                  <Text style={styles.infoValue}>{location}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name="sparkles-outline" size={16} color="#fff" />
                </View>
                <View style={styles.infoBody}>
                  <Text style={styles.infoLabel}>Availability</Text>
                  <Text style={styles.infoValue}>
                    {spotsLeft > 0 ? `${spotsLeft} spots left` : "No spots left"}
                  </Text>
                </View>
              </View>
            </View>

            {tags.length > 0 && (
              <View style={styles.tagsRow}>
                {tags.map((t, idx) => {
                  const label = safeTextOrEmpty(t);
                  if (!label) return null;

                  return (
                    <View key={`${label}-${idx}`} style={styles.tag}>
                      <Text style={styles.tagText}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.actionsRow}>
              <Pressable
                onPress={onJoinPress}
                disabled={joinDisabled || !canJoin}
                style={[
                  styles.joinBtn,
                  !isGuest && isJoined && styles.joinBtnOn,
                  (joinDisabled || !canJoin) && styles.btnDisabled,
                ]}
              >
                <Text style={[styles.joinText, !isGuest && isJoined && styles.joinTextOn]}>
                  {joinLabel}
                </Text>
              </Pressable>

              <Pressable onPress={goParticipants} style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>Participants</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.aboutCard}>
            <Text style={styles.aboutTitle}>About this plan</Text>
            <Text style={styles.aboutText}>
              This is the event details screen for REAL. Next good upgrades here are share link,
              comments, and host chat.
            </Text>
          </View>
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

  scrollContent: {
    paddingBottom: 24,
  },

  heroWrap: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  hero: {
    width: "100%",
    height: "100%",
  },

  heroOverlayTop: {
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

  mainCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 14,
  },

  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32,
  },
  hostLine: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },

  infoStack: {
    marginTop: 16,
    gap: 10,
  },
  infoRow: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBody: {
    flex: 1,
  },
  infoLabel: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 12,
    fontWeight: "700",
  },
  infoValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },

  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  tag: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: {
    color: "rgba(255,255,255,0.88)",
    fontWeight: "800",
    fontSize: 12,
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },

  joinBtn: {
    flex: 1,
    height: 50,
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
  joinText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 15,
  },
  joinTextOn: {
    color: "#fff",
  },

  secondaryBtn: {
    width: 134,
    height: 50,
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

  aboutCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  aboutTitle: {
    color: "#fff",
    fontWeight: "900",
    marginBottom: 8,
    fontSize: 16,
  },
  aboutText: {
    color: "rgba(255,255,255,0.64)",
    fontSize: 13,
    lineHeight: 18,
  },

  stateCard: {
    borderRadius: 22,
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

  btnDisabled: {
    opacity: 0.35,
  },
});
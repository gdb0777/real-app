// app/(tabs)/profile.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { usePlans } from "../../providers/PlansProvider";
import { getOnboarding } from "../../lib/onboarding";
import { useAuth } from "../../providers/AuthProvider";

type Category =
  | "Sports"
  | "Outdoors"
  | "Social"
  | "Creative"
  | "Business"
  | "Games"
  | "Wellness";

type Interest = { id: string; label: string; category: Category };

type OnboardingData = {
  firstName?: string;
  lastName?: string;
  location?: string;
  occupation?: string;
  interests?: string[];
  photos?: string[];
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

function safeFullName(first?: string, last?: string) {
  const f = String(first ?? "").trim();
  const l = String(last ?? "").trim();
  const full = `${f} ${l}`.trim();
  return full.length ? full : "REAL User";
}

function safeHandleFromEmail(email?: string | null) {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return "@real";

  const base = e.split("@")[0] ?? "";
  const cleaned = base.replace(/[^a-z0-9._]/g, "");

  return cleaned ? `@${cleaned}` : "@real";
}

function safeHandleFromName(first?: string, last?: string, fallbackEmail?: string | null) {
  const base = `${String(first ?? "")}${String(last ?? "")}`.trim().toLowerCase();
  const cleaned = base.replace(/[^a-z0-9._]/g, "");
  return cleaned ? `@${cleaned}` : safeHandleFromEmail(fallbackEmail);
}

function pickCity(text?: string) {
  const t = String(text ?? "").trim();
  if (!t) return "";
  return (t.split(",")[0] ?? "").trim();
}

function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function safeId(v: unknown) {
  return String(v ?? "").trim();
}

function cleanUrlArray(raw: unknown, max = 12): string[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => String(x ?? "").trim())
    .filter((x) => x.length > 0)
    .slice(0, max);
}

export default function ProfileScreen() {
  const { plans, meName, isGuest } = usePlans();
  const { user, initializing, signOut } = useAuth();

  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [lastName, setLastName] = useState<string | undefined>(undefined);
  const [locationText, setLocationText] = useState<string | undefined>(undefined);
  const [occupation, setOccupation] = useState<string | undefined>(undefined);
  const [interestIds, setInterestIds] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const fullName = useMemo(() => safeFullName(firstName, lastName), [firstName, lastName]);

  const handle = useMemo(() => {
    const hasName = `${String(firstName ?? "")}${String(lastName ?? "")}`.trim().length > 0;
    return hasName
      ? safeHandleFromName(firstName, lastName, user?.email ?? null)
      : safeHandleFromEmail(user?.email ?? null);
  }, [firstName, lastName, user?.email]);

  const city = useMemo(() => {
    const t = String(locationText ?? "").trim();
    if (!t) return "Bulgaria";
    const c = pickCity(t);
    return c || t;
  }, [locationText]);

  const occ = useMemo(
    () => (occupation?.trim() ? occupation.trim() : "Add occupation"),
    [occupation]
  );

  const coverUrl = useMemo(() => {
    const u = photoUrls[0];
    return u && u.length ? u : null;
  }, [photoUrls]);

  const safePlans = useMemo(() => (Array.isArray(plans) ? plans : []), [plans]);

  const selectedInterests = useMemo(() => {
    const seen = new Set<string>();
    const knownMap = new Map(INTERESTS.map((i) => [i.id, i.label] as const));

    const labels: string[] = [];
    for (const rawId of Array.isArray(interestIds) ? interestIds : []) {
      const id = String(rawId);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      labels.push(knownMap.get(id) ?? id);
    }

    return labels;
  }, [interestIds]);

  const joinedCount = useMemo(
    () => safePlans.filter((p) => !!p.joined).length,
    [safePlans]
  );

  const createdCount = useMemo(() => {
    const myId = safeId(user?.id);
    if (myId) {
      return safePlans.filter((p) => safeId(p.hostId) === myId).length;
    }

    const candidates = new Set<string>(
      [norm(fullName), norm(meName), norm(firstName), norm(lastName)].filter(Boolean)
    );
    if (candidates.size === 0) return 0;

    return safePlans.filter((p) => {
      const host = norm(p.host);
      if (!host) return false;

      for (const c of candidates) {
        if (host === c) return true;
      }
      return false;
    }).length;
  }, [safePlans, firstName, lastName, fullName, meName, user?.id]);

  const resetLocalProfile = useCallback(() => {
    setFirstName(undefined);
    setLastName(undefined);
    setLocationText(undefined);
    setOccupation(undefined);
    setInterestIds([]);
    setPhotoUrls([]);
  }, []);

  const load = useCallback(async () => {
    if (isGuest || !user?.id) {
      resetLocalProfile();
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const data = (await getOnboarding()) as OnboardingData | null;

      setFirstName(data?.firstName ?? undefined);
      setLastName(data?.lastName ?? undefined);
      setLocationText(data?.location ?? undefined);
      setOccupation(data?.occupation ?? undefined);
      setInterestIds(Array.isArray(data?.interests) ? data!.interests.map(String) : []);
      setPhotoUrls(cleanUrlArray(data?.photos, 12));
    } catch {
      resetLocalProfile();
    } finally {
      setLoading(false);
    }
  }, [isGuest, user?.id, resetLocalProfile]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {};
    }, [load])
  );

  const onLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch (e: any) {
            Alert.alert("Logout failed", e?.message ?? "Unknown error");
          } finally {
            router.replace("/");
          }
        },
      },
    ]);
  };

  const goChangeName = () =>
    router.push({ pathname: "/onboarding/name", params: { from: "profile" } });
  const goChangePhotos = () =>
    router.push({ pathname: "/onboarding/photos", params: { from: "profile" } });
  const goChangeInterests = () =>
    router.push({ pathname: "/onboarding/interests", params: { from: "profile" } });
  const goChangeLocation = () =>
    router.push({ pathname: "/onboarding/location", params: { from: "profile" } });
  const goChangeOccupation = () =>
    router.push({ pathname: "/onboarding/occupation", params: { from: "profile" } });

  if (initializing) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <View style={styles.centerFill}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!user || isGuest) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <View style={[styles.container, { paddingTop: 26 }]}>
          <Text style={styles.h1}>Profile</Text>
          <Text style={styles.h2}>Login to manage your profile.</Text>

          <View style={styles.card}>
            <Text style={styles.sectionTitleSmall}>You’re browsing as guest</Text>
            <Text style={styles.sectionSub}>
              Create a free account to add interests, photos, and join plans.
            </Text>

            <Pressable onPress={() => router.push("/login")} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>Login</Text>
            </Pressable>

            <Pressable onPress={() => router.push("/register")} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>Create account</Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>REAL • MVP</Text>
        </View>
      </SafeAreaView>
    );
  }

  const eventsCount = createdCount + joinedCount;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screen}>
        <View style={styles.coverWrap}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverFallback} />
          )}

          <View pointerEvents="none" style={styles.coverOverlayTop} />
          <View pointerEvents="none" style={styles.coverOverlayBottom} />

          <View style={styles.coverActions}>
            <Pressable style={styles.iconBtn} onPress={goChangePhotos}>
              <Ionicons name="image-outline" size={18} color="#fff" />
            </Pressable>

            <Pressable
              style={styles.iconBtn}
              onPress={() => Alert.alert("Settings", "Settings later")}
            >
              <Ionicons name="settings-outline" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.profileCard}>
          <Text style={styles.profileName}>{fullName}</Text>

          <View style={styles.profileMetaRow}>
            <Text style={styles.metaText}>{occ}</Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>{city}</Text>
          </View>

          <Text style={styles.profileHandle}>{handle}</Text>

          <View style={styles.statsStrip}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{createdCount}</Text>
              <Text style={styles.statKey}>Created</Text>
            </View>

            <View style={styles.statSep} />

            <View style={styles.statItem}>
              <Text style={styles.statValue}>{joinedCount}</Text>
              <Text style={styles.statKey}>Joined</Text>
            </View>

            <View style={styles.statSep} />

            <View style={styles.statItem}>
              <Text style={styles.statValue}>{eventsCount}</Text>
              <Text style={styles.statKey}>Total</Text>
            </View>
          </View>

          <View style={styles.profileActionsRow}>
            <Pressable onPress={goChangeName} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>Edit profile</Text>
            </Pressable>

            <Pressable onPress={goChangePhotos} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>Photos</Text>
            </Pressable>
          </View>

          {!!user.email && <Text style={styles.signedInAs}>Signed in as {user.email}</Text>}

          {!coverUrl && (
            <Pressable onPress={goChangePhotos} style={styles.addCoverHintBtn}>
              <Text style={styles.addCoverHintText}>Add a cover photo</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleBig}>Interests</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={styles.chips}>
              {selectedInterests.map((t, idx) => (
                <View key={`${t}-${idx}`} style={styles.chip}>
                  <Text style={styles.chipText}>{t}</Text>
                </View>
              ))}
              {selectedInterests.length === 0 && (
                <Text style={styles.muted}>No interests yet.</Text>
              )}
            </View>
          )}

          <Pressable onPress={goChangeInterests} style={styles.secondaryBtnWide}>
            <Text style={styles.secondaryText}>Change interests</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleBig}>Details</Text>

          <View style={styles.cardDark}>
            <Pressable onPress={goChangeLocation} style={styles.rowBtn}>
              <View style={styles.rowBtnLeft}>
                <Ionicons name="location-outline" size={18} color="#fff" />
                <Text style={styles.rowBtnText}>Location</Text>
              </View>
              <Text style={styles.rowBtnValue}>{city}</Text>
            </Pressable>

            <Pressable onPress={goChangeOccupation} style={styles.rowBtn}>
              <View style={styles.rowBtnLeft}>
                <Ionicons name="briefcase-outline" size={18} color="#fff" />
                <Text style={styles.rowBtnText}>Occupation</Text>
              </View>
              <Text style={styles.rowBtnValue}>
                {occupation?.trim() ? occupation.trim() : "Add"}
              </Text>
            </Pressable>

            <Pressable onPress={goChangePhotos} style={styles.rowBtn}>
              <View style={styles.rowBtnLeft}>
                <Ionicons name="images-outline" size={18} color="#fff" />
                <Text style={styles.rowBtnText}>Photos</Text>
              </View>
              <Text style={styles.rowBtnValue}>{photoUrls.length}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitleBig}>Actions</Text>

          <Pressable style={styles.bigWhiteBtn} onPress={() => router.push("/create")}>
            <Text style={styles.bigWhiteBtnText}>Create Event</Text>
          </Pressable>

          <Pressable onPress={onLogout} style={styles.logoutBtnPremium}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>REAL • MVP</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },

  container: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26 },

  centerFill: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },

  screen: { paddingBottom: 30 },

  h1: { color: "#fff", fontSize: 30, fontWeight: "900", marginTop: 8 },
  h2: {
    color: "rgba(255,255,255,0.65)",
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
  },

  card: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    marginTop: 14,
  },

  sectionTitleSmall: { color: "#fff", fontWeight: "900", fontSize: 16 },
  sectionSub: {
    color: "rgba(255,255,255,0.6)",
    marginTop: 6,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 17,
  },

  primaryBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  primaryText: { color: "#000", fontWeight: "900" },

  secondaryBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  secondaryText: { color: "rgba(255,255,255,0.92)", fontWeight: "800" },

  secondaryBtnWide: {
    height: 50,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  coverWrap: { height: 300, position: "relative" },
  coverImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  coverFallback: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)" },

  coverOverlayTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  coverOverlayBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
    backgroundColor: "rgba(0,0,0,0.58)",
  },

  coverActions: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    gap: 10,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  profileCard: {
    marginTop: -74,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 16,
    backgroundColor: "rgba(18,18,18,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  profileName: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  profileMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  metaText: { color: "rgba(255,255,255,0.58)", fontWeight: "700" },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  profileHandle: {
    marginTop: 8,
    textAlign: "center",
    color: "rgba(255,255,255,0.38)",
    fontWeight: "800",
  },

  statsStrip: {
    marginTop: 18,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { color: "#fff", fontWeight: "900", fontSize: 18 },
  statKey: {
    marginTop: 6,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "700",
    fontSize: 12,
  },
  statSep: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.14)" },

  profileActionsRow: { marginTop: 14, flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  signedInAs: {
    marginTop: 12,
    textAlign: "center",
    color: "rgba(255,255,255,0.35)",
    fontWeight: "700",
    fontSize: 12,
  },

  addCoverHintBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  addCoverHintText: { color: "#000", fontWeight: "900" },

  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitleBig: { color: "#fff", fontSize: 24, fontWeight: "900" },

  chips: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  chipText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  muted: { marginTop: 8, color: "rgba(255,255,255,0.55)", fontWeight: "700" },
  loadingWrap: { paddingTop: 14 },

  cardDark: {
    marginTop: 12,
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    gap: 10,
  },

  rowBtn: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowBtnLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  rowBtnValue: {
    color: "rgba(255,255,255,0.56)",
    fontWeight: "700",
    fontSize: 13,
    flexShrink: 1,
    textAlign: "right",
  },

  bigWhiteBtn: {
    marginTop: 12,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  bigWhiteBtnText: { color: "#000", fontWeight: "900", fontSize: 17 },

  logoutBtnPremium: {
    marginTop: 12,
    height: 50,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { color: "rgba(255,120,120,0.95)", fontWeight: "900" },

  footer: {
    marginTop: 22,
    textAlign: "center",
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 10,
  },
});
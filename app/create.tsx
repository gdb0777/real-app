// app/create.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  Image,
  Alert,
  Platform,
  Linking,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import { usePlans } from "../providers/PlansProvider";

type TagRule = {
  match: (s: string) => boolean;
  tag: string;
};

function buildTagsFromTitle(title: string): string[] {
  const t = String(title ?? "").toLowerCase();

  const rules: TagRule[] = [
    { match: (s) => s.includes("football") || s.includes("soccer"), tag: "football" },
    { match: (s) => s.includes("basket"), tag: "basketball" },
    { match: (s) => s.includes("tennis"), tag: "tennis" },
    { match: (s) => s.includes("padel"), tag: "padel" },
    { match: (s) => s.includes("gym") || s.includes("workout"), tag: "gym" },
    { match: (s) => s.includes("run") || s.includes("running"), tag: "running" },
    { match: (s) => s.includes("hike") || s.includes("hiking"), tag: "hiking" },
    { match: (s) => s.includes("ski"), tag: "ski" },
    { match: (s) => s.includes("coffee") || s.includes("cafe"), tag: "coffee" },
    { match: (s) => s.includes("cinema") || s.includes("movie"), tag: "cinema" },
    { match: (s) => s.includes("bar") || s.includes("club") || s.includes("night"), tag: "nightlife" },
    { match: (s) => s.includes("restaurant") || s.includes("dinner") || s.includes("food"), tag: "restaurants" },
    { match: (s) => s.includes("photo") || s.includes("shoot"), tag: "photography" },
    { match: (s) => s.includes("music") || s.includes("concert"), tag: "music" },
    { match: (s) => s.includes("chess"), tag: "chess" },
    { match: (s) => s.includes("poker"), tag: "poker" },
  ];

  const tags = rules.filter((r) => r.match(t)).map((r) => r.tag);
  if (tags.length === 0) return ["events"];

  const sportsIds = new Set<string>(["football", "basketball", "tennis", "padel", "gym", "running", "ski"]);
  const hasSports = tags.some((x) => sportsIds.has(x));
  const final = hasSports ? ["sports", ...tags] : tags;

  return Array.from(new Set(final)).slice(0, 3);
}

function formatTimeInput(raw: string): string {
  const digits = String(raw ?? "").replace(/[^\d]/g, "").slice(0, 4);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;

  const hh = digits.slice(0, 2);
  const mm = digits.slice(2);

  return mm.length ? `${hh}:${mm}` : hh;
}

function normalizeToHHMM(value: string): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;

  if (/^\d{1,2}$/.test(v)) {
    const h = Number(v);
    if (Number.isNaN(h) || h < 0 || h > 23) return null;
    return `${String(h).padStart(2, "0")}:00`;
  }

  if (/^\d{1,2}:\d{1,2}$/.test(v)) {
    const [hStr, mStr] = v.split(":");
    const h = Number(hStr);
    const m = Number(mStr);

    if ([h, m].some((x) => Number.isNaN(x))) return null;
    if (h < 0 || h > 23) return null;
    if (m < 0 || m > 59) return null;

    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  return null;
}

function openSettings() {
  if (Platform.OS === "ios") {
    void Linking.openURL("app-settings:");
    return;
  }

  void Linking.openSettings();
}

async function requestPhotoPermission(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  const access = (perm as unknown as { accessPrivileges?: string }).accessPrivileges;
  const granted = perm.granted || (Platform.OS === "ios" && access === "limited");

  if (granted) return true;

  Alert.alert("Permission needed", "Please allow access to Photos to upload a picture.", [
    { text: "Cancel", style: "cancel" },
    { text: "Open Settings", onPress: openSettings },
  ]);

  return false;
}

export default function CreateModal() {
  const router = useRouter();
  const { addPlan, meName, isGuest } = usePlans();

  const redirectedRef = useRef(false);

  const [title, setTitle] = useState("");
  const [where, setWhere] = useState("");
  const [whenRaw, setWhenRaw] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const closeCreate = useCallback(() => {
    const canGoBack = (router as any)?.canGoBack?.() ?? false;

    if (canGoBack) {
      router.back();
      return;
    }

    router.replace("/(tabs)/feed");
  }, [router]);

  useEffect(() => {
    if (!isGuest) return;
    if (redirectedRef.current) return;

    redirectedRef.current = true;
    router.replace("/login");
  }, [isGuest, router]);

  const tags = useMemo(() => buildTagsFromTitle(title.trim()), [title]);
  const whenFormatted = useMemo(() => normalizeToHHMM(whenRaw), [whenRaw]);

  const canPost = useMemo(() => {
    const okTitle = title.trim().length >= 3;
    const okWhere = where.trim().length >= 2;
    const okWhen = whenFormatted !== null;

    return okTitle && okWhere && okWhen;
  }, [title, where, whenFormatted]);

  const dateLabel = useMemo(() => {
    if (!whenFormatted) return "Today";
    return `Today, ${whenFormatted}`;
  }, [whenFormatted]);

  const onChangeWhen = useCallback(
    (txt: string) => {
      if (posting) return;
      setWhenRaw(formatTimeInput(txt));
    },
    [posting]
  );

  const onBlurWhen = useCallback(() => {
    if (posting) return;

    const normalized = normalizeToHHMM(whenRaw);
    if (normalized) {
      setWhenRaw(normalized);
    }
  }, [posting, whenRaw]);

  const onPickImage = useCallback(async () => {
    if (posting) return;

    if (isGuest) {
      router.replace("/login");
      return;
    }

    const ok = await requestPhotoPermission();
    if (!ok) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: true,
        aspect: [16, 9],
        selectionLimit: 1,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setImageUri(uri);
    } catch {
      Alert.alert("Error", "Could not open photo library.");
    }
  }, [isGuest, router, posting]);

  const onRemoveImage = useCallback(() => {
    if (posting) return;
    setImageUri(null);
  }, [posting]);

  const doPost = useCallback(async () => {
    if (!canPost || posting) return;

    Keyboard.dismiss();
    setPosting(true);

    try {
      const hostName = String(meName ?? "").trim() || "REAL User";

      await addPlan({
        title: title.trim(),
        location: where.trim(),
        dateLabel,
        host: hostName,
        tags,
        spotsLeft: 3,
        imageUri: imageUri ?? undefined,
      });

      closeCreate();
    } catch (e: any) {
      Alert.alert("Could not post", String(e?.message ?? "Please try again."));
    } finally {
      setPosting(false);
    }
  }, [addPlan, canPost, closeCreate, dateLabel, imageUri, meName, posting, tags, title, where]);

  const onPost = useCallback(() => {
    if (isGuest) {
      router.replace("/login");
      return;
    }

    void doPost();
  }, [isGuest, router, doPost]);

  const showWhenError = whenRaw.trim().length > 0 && !whenFormatted;

  if (isGuest) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <View style={styles.container} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.topRow}>
            <Pressable onPress={closeCreate} style={styles.iconBtn} hitSlop={10} disabled={posting}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>

            <Text style={styles.header}>Create plan</Text>

            <Pressable
              onPress={onPost}
              disabled={!canPost || posting}
              style={[styles.postBtn, (!canPost || posting) && styles.postBtnDisabled]}
            >
              <Text style={styles.postText}>{posting ? "Posting..." : "Post"}</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>Bring people together</Text>
              <Text style={styles.heroText}>
                Create a real plan, add a photo, and let nearby people join.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>What’s the plan?</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Coffee at Kapana tonight"
                placeholderTextColor="rgba(255,255,255,0.42)"
                style={styles.input}
                returnKeyType="next"
                autoFocus
                autoCorrect={false}
                editable={!posting}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Where?</Text>
              <TextInput
                value={where}
                onChangeText={setWhere}
                placeholder="e.g. Kapana, Plovdiv"
                placeholderTextColor="rgba(255,255,255,0.42)"
                style={styles.input}
                returnKeyType="next"
                autoCorrect={false}
                editable={!posting}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>When?</Text>
              <TextInput
                value={whenRaw}
                onChangeText={onChangeWhen}
                onBlur={onBlurWhen}
                placeholder="e.g. 20:00 or 2000"
                placeholderTextColor="rgba(255,255,255,0.42)"
                style={[styles.input, showWhenError ? styles.inputError : null]}
                keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                returnKeyType="done"
                onSubmitEditing={onPost}
                editable={!posting}
              />
              <Text style={styles.fieldHint}>You can type 20, 2030, or 20:30.</Text>
            </View>

            <View style={styles.photoCard}>
              <View style={styles.photoHeader}>
                <View>
                  <Text style={styles.photoTitle}>Event photo</Text>
                  <Text style={styles.photoSubtitle}>Optional, but recommended</Text>
                </View>

                {imageUri ? (
                  <Pressable onPress={onRemoveImage} style={styles.photoGhostBtn} disabled={posting}>
                    <Text style={styles.photoGhostText}>Remove</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={onPickImage} style={styles.photoPrimaryBtn} disabled={posting}>
                    <Text style={styles.photoPrimaryText}>Add photo</Text>
                  </Pressable>
                )}
              </View>

              {imageUri ? (
                <View style={styles.photoPreviewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                  <Pressable onPress={onPickImage} style={styles.photoChangeBtn} disabled={posting}>
                    <Text style={styles.photoChangeText}>Change</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.photoEmpty}>
                  <Ionicons name="image-outline" size={24} color="rgba(255,255,255,0.72)" />
                  <Text style={styles.photoHint}>Add a cover photo to make your plan stand out.</Text>
                </View>
              )}
            </View>

            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Preview</Text>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Time</Text>
                <Text style={styles.previewValue}>{dateLabel}</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Tags</Text>
                <Text style={styles.previewValue}>{tags.join(" • ")}</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Spots</Text>
                <Text style={styles.previewValue}>3 available</Text>
              </View>
            </View>

            <Pressable
              onPress={onPost}
              disabled={!canPost || posting}
              style={[styles.bottomPostBtn, (!canPost || posting) && styles.postBtnDisabled]}
            >
              <Text style={styles.bottomPostText}>{posting ? "Posting..." : "Post plan"}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  flex: { flex: 1 },
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

  postBtn: {
    minWidth: 74,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  postBtnDisabled: { opacity: 0.38 },
  postText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 14,
  },

  scrollContent: {
    paddingBottom: 34,
  },

  heroCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 16,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  heroText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },

  section: {
    marginBottom: 14,
  },
  label: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
  },

  input: {
    height: 56,
    borderRadius: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  inputError: {
    borderColor: "rgba(255,90,90,0.75)",
  },
  fieldHint: {
    marginTop: 8,
    color: "rgba(255,255,255,0.46)",
    fontSize: 12,
    lineHeight: 16,
  },

  photoCard: {
    marginTop: 4,
    borderRadius: 22,
    padding: 14,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  photoTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
  },
  photoSubtitle: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  photoPrimaryBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPrimaryText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 12,
  },

  photoGhostBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,90,90,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoGhostText: {
    color: "rgba(255,130,130,0.95)",
    fontWeight: "900",
    fontSize: 12,
  },

  photoEmpty: {
    marginTop: 14,
    borderRadius: 18,
    minHeight: 120,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  photoHint: {
    marginTop: 10,
    color: "rgba(255,255,255,0.56)",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },

  photoPreviewWrap: {
    marginTop: 14,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  photoPreview: {
    width: "100%",
    height: 190,
  },
  photoChangeBtn: {
    position: "absolute",
    right: 10,
    bottom: 10,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoChangeText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },

  previewCard: {
    marginTop: 16,
    borderRadius: 22,
    padding: 14,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  previewTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
    marginBottom: 10,
  },
  previewRow: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  previewLabel: {
    color: "rgba(255,255,255,0.58)",
    fontWeight: "800",
    fontSize: 12,
  },
  previewValue: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    flexShrink: 1,
    textAlign: "right",
  },

  bottomPostBtn: {
    marginTop: 18,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomPostText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 15,
  },
});
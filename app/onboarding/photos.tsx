// app/onboarding/photos.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { useAuth } from "../../providers/AuthProvider";
import {
  getOnboarding,
  setOnboardingField,
  setOnboardingCompleted,
} from "../../lib/onboarding";
import {
  uploadProfilePhotoFromUri,
  getProfilePhotoPublicUrl,
} from "../../lib/profileStorage";

const MAX_PHOTOS = 6;

type Photo = { uri: string };
type OnboardingData = {
  photos?: string[] | null;
};

function getImageMediaType() {
  const pickerCompat = ImagePicker as unknown as {
    MediaType?: { Images?: unknown };
    MediaTypeOptions?: { Images?: unknown };
  };

  if (pickerCompat.MediaType?.Images) {
    return [pickerCompat.MediaType.Images];
  }

  return pickerCompat.MediaTypeOptions?.Images;
}

async function requestPhotoPermission(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  const access = (perm as { accessPrivileges?: string }).accessPrivileges;
  const granted = perm.granted || (Platform.OS === "ios" && access === "limited");

  if (granted) return true;

  Alert.alert("Permission needed", "Please allow access to Photos to upload pictures.", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Open Settings",
      onPress: () => {
        if (Platform.OS === "ios") {
          void Linking.openURL("app-settings:");
        } else {
          void Linking.openSettings();
        }
      },
    },
  ]);

  return false;
}

function pickNiceError(e: unknown) {
  const msg = String((e as { message?: string })?.message ?? e ?? "").trim();
  if (!msg) return "Upload failed. Please try again.";

  try {
    const obj = JSON.parse(msg) as {
      message?: string;
      error_description?: string;
      error?: string;
    };
    const parsed = String(obj?.message ?? obj?.error_description ?? obj?.error ?? "").trim();
    if (parsed) return parsed;
  } catch {
    // ignore
  }

  return msg;
}

export default function OnboardingPhotos() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const isEditMode = params?.from === "profile";

  const { user } = useAuth();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const mountedRef = useRef(true);
  const lockRef = useRef(false);

  const safeBack = useCallback(() => {
    if (uploading) return;

    const canGoBack = (router as any)?.canGoBack?.() ?? false;
    if (canGoBack) {
      router.back();
      return;
    }

    if (isEditMode) {
      router.replace("/(tabs)/profile");
    } else {
      router.replace("/onboarding/location");
    }
  }, [router, isEditMode, uploading]);

  const canContinue = useMemo(() => {
    if (loading || uploading) return false;
    return isEditMode ? true : photos.length >= 1;
  }, [isEditMode, photos.length, loading, uploading]);

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      try {
        setLoading(true);
        const data = (await getOnboarding()) as OnboardingData | null;
        if (!mountedRef.current) return;

        const raw = data?.photos;
        const saved = Array.isArray(raw) ? raw : [];

        const clean = saved
          .map((x) => String(x ?? "").trim())
          .filter((x) => x.length > 0)
          .slice(0, MAX_PHOTOS);

        setPhotos(clean.map((uri) => ({ uri })));
      } catch {
        // ignore
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persist = useCallback(async (next: Photo[]) => {
    const arr = next
      .map((p) => String(p.uri ?? "").trim())
      .filter(Boolean)
      .slice(0, MAX_PHOTOS);

    try {
      await setOnboardingField("photos", arr.length ? arr : null);
    } catch {
      // ignore
    }
  }, []);

  const addPhoto = useCallback(async () => {
    if (uploading || loading) return;
    if (lockRef.current) return;
    lockRef.current = true;

    try {
      if (photos.length >= MAX_PHOTOS) {
        Alert.alert("Max photos", `You can upload up to ${MAX_PHOTOS} photos.`);
        return;
      }

      const ok = await requestPhotoPermission();
      if (!ok) return;

      const remaining = MAX_PHOTOS - photos.length;
      const multi = remaining > 1;

      let result: ImagePicker.ImagePickerResult;

      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: getImageMediaType(),
          quality: 0.9,
          allowsMultipleSelection: multi,
          selectionLimit: multi ? Math.max(1, Math.min(remaining, 6)) : 1,
          allowsEditing: !multi,
          ...(multi ? {} : { aspect: [4, 5] as [number, number] }),
        } as never);
      } catch {
        Alert.alert("Error", "Could not open photo library.");
        return;
      }

      if (result.canceled) return;

      const pickedUris = (result.assets ?? [])
        .map((a) => String(a?.uri ?? "").trim())
        .filter(Boolean);

      if (pickedUris.length === 0) return;

      const userId = String(user?.id ?? "").trim();
      if (!userId) {
        Alert.alert("Not logged in", "Please log in again.");
        return;
      }

      setUploading(true);

      try {
        const uploads = await Promise.all(
          pickedUris.map(async (localUri) => {
            try {
              const path = await uploadProfilePhotoFromUri({ uri: localUri, userId });
              const url = getProfilePhotoPublicUrl(path);
              if (!url) {
                throw new Error("Could not generate public URL for uploaded photo.");
              }
              return { ok: true as const, url, err: null as string | null };
            } catch (e) {
              return { ok: false as const, url: null as string | null, err: pickNiceError(e) };
            }
          })
        );

        const uploadedUrls = uploads.map((x) => x.url).filter(Boolean) as string[];

        if (!mountedRef.current) return;

        if (uploadedUrls.length === 0) {
          const firstErr =
            uploads.find((x) => !x.ok)?.err ?? "Upload failed. Please try again.";
          Alert.alert("Upload failed", firstErr);
          return;
        }

        setPhotos((prev) => {
          const prevSet = new Set(prev.map((p) => p.uri));
          const unique = uploadedUrls.filter((u) => !prevSet.has(u));
          const next = [...prev, ...unique.map((uri) => ({ uri }))].slice(0, MAX_PHOTOS);
          void persist(next);
          return next;
        });
      } finally {
        if (mountedRef.current) {
          setUploading(false);
        }
      }
    } finally {
      lockRef.current = false;
    }
  }, [photos, uploading, loading, persist, user?.id]);

  const setAsMain = useCallback(
    (index: number) => {
      if (uploading) return;

      setPhotos((prev) => {
        if (index <= 0 || index >= prev.length) return prev;

        const copy = [...prev];
        const [picked] = copy.splice(index, 1);
        const next = [picked, ...copy];

        void persist(next);
        return next;
      });
    },
    [persist, uploading]
  );

  const removePhoto = useCallback(
    (index: number) => {
      if (uploading) return;

      setPhotos((prev) => {
        const next = prev.filter((_, i) => i !== index);
        void persist(next);
        return next;
      });
    },
    [persist, uploading]
  );

  const onPhotoPress = useCallback(
    (index: number) => {
      if (uploading) return;

      const isMain = index === 0;

      Alert.alert("Photo options", "", [
        ...(!isMain ? [{ text: "Set as main", onPress: () => setAsMain(index) }] : []),
        { text: "Remove", style: "destructive", onPress: () => removePhoto(index) },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [removePhoto, setAsMain, uploading]
  );

  const onNext = useCallback(async () => {
    if (!canContinue) return;

    await persist(photos);

    if (isEditMode) {
      safeBack();
      return;
    }

    try {
      await setOnboardingCompleted(true);
    } catch {
      // ignore
    }

    router.replace("/(tabs)/feed");
  }, [canContinue, persist, photos, isEditMode, safeBack, router]);

  const slots = useMemo(() => {
    const filled = photos.map((p, idx) => ({ type: "photo" as const, p, idx }));
    const emptyCount = Math.max(0, MAX_PHOTOS - photos.length);
    const empty = Array.from({ length: emptyCount }).map((_, i) => ({
      type: "empty" as const,
      key: `empty-${i}`,
    }));
    return [...filled, ...empty];
  }, [photos]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Pressable onPress={safeBack} style={styles.back} hitSlop={10} disabled={uploading}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Add photos</Text>
        <Text style={styles.subtitle}>
          Upload 1–{MAX_PHOTOS} photos. Tap a photo to set it as main.
        </Text>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Main photo</Text>
          <Text style={styles.tipText}>
            Your MAIN photo is used as your profile cover.
          </Text>
        </View>

        {(loading || uploading) && (
          <View style={styles.uploadRow}>
            <ActivityIndicator />
            <Text style={styles.uploadText}>{loading ? "Loading…" : "Uploading…"}</Text>
          </View>
        )}

        <View style={styles.grid}>
          {slots.map((item, i) => {
            if (item.type === "photo") {
              return (
                <Pressable
                  key={`${item.p.uri}-${i}`}
                  style={styles.tile}
                  onPress={() => onPhotoPress(item.idx)}
                  disabled={uploading || loading}
                >
                  <Image source={{ uri: item.p.uri }} style={styles.image} />
                  <View style={styles.imageShade} />
                  {item.idx === 0 && (
                    <View style={styles.mainBadge}>
                      <Text style={styles.mainBadgeText}>MAIN</Text>
                    </View>
                  )}
                </Pressable>
              );
            }

            return (
              <Pressable
                key={item.key}
                onPress={() => void addPhoto()}
                style={[styles.tile, styles.emptyTile]}
                disabled={uploading || loading}
              >
                <Text style={styles.plus}>＋</Text>
                <Text style={styles.addText}>Add</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[
            styles.primaryBtn,
            (!canContinue || uploading || loading) && styles.primaryBtnDisabled,
          ]}
          onPress={() => void onNext()}
          disabled={!canContinue || uploading || loading}
        >
          <Text style={styles.primaryText}>
            {isEditMode ? "Save" : canContinue ? "Finish" : "Add at least 1 photo"}
          </Text>
        </Pressable>

        <Text style={styles.helper}>Tip: Clear photos with good light work best.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 18 },

  back: { paddingVertical: 8, alignSelf: "flex-start" },
  backText: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "700" },

  title: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 6 },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    marginTop: 8,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: "700",
  },

  tipCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 12,
  },
  tipTitle: { color: "#fff", fontWeight: "900", fontSize: 13 },
  tipText: { color: "rgba(255,255,255,0.65)", marginTop: 4, fontWeight: "700", fontSize: 12 },

  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    opacity: 0.9,
  },
  uploadText: { color: "rgba(255,255,255,0.75)", fontWeight: "800" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },

  tile: {
    width: "31.5%",
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    position: "relative",
  },
  emptyTile: { alignItems: "center", justifyContent: "center" },

  image: { width: "100%", height: "100%" },
  imageShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 44,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  mainBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.70)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  mainBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  plus: { color: "#fff", fontSize: 22, fontWeight: "900" },
  addText: {
    color: "rgba(255,255,255,0.75)",
    marginTop: 6,
    fontSize: 12,
    fontWeight: "800",
  },

  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  primaryBtnDisabled: { opacity: 0.35 },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "900" },

  helper: {
    marginTop: 12,
    textAlign: "center",
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: "700",
  },
});
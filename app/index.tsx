// app/index.tsx
import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { useAuth } from "../providers/AuthProvider";

function friendlyAuthErrorMessage(message?: string) {
  const m = String(message ?? "").trim();
  const low = m.toLowerCase();

  if (low.includes("cancel")) return "Cancelled.";
  if (low.includes("network")) return "Network error. Check your connection and try again.";

  return m || "Unknown error";
}

export default function Index() {
  const router = useRouter();
  const { user, initializing, signInWithGoogle } = useAuth();

  const [loadingSocial, setLoadingSocial] = useState(false);

  const goGuest = useCallback(() => {
    router.replace({
      pathname: "/onboarding/name",
      params: { guest: "1" },
    });
  }, [router]);

  const goLogin = useCallback(() => {
    router.replace("/login");
  }, [router]);

  const goRegister = useCallback(() => {
    router.replace("/register");
  }, [router]);

  const onApple = useCallback(() => {
    Alert.alert(
      "Apple login",
      "Apple Sign-In needs a Dev Build (EAS) — it doesn't work in Expo Go."
    );
  }, []);

  const onGoogle = useCallback(async () => {
    if (loadingSocial) return;

    try {
      setLoadingSocial(true);
      await signInWithGoogle();
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : String(e ?? "");

      Alert.alert("Google login failed", friendlyAuthErrorMessage(message));
    } finally {
      setLoadingSocial(false);
    }
  }, [loadingSocial, signInWithGoogle]);

  if (initializing || user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.top}>
          <Text style={styles.brand}>REAL</Text>
          <Text style={styles.tagline}>Real people. Real plans.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.primaryBtn} onPress={goLogin} disabled={loadingSocial}>
            <Text style={styles.primaryText}>Login</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={goRegister} disabled={loadingSocial}>
            <Text style={styles.secondaryText}>Register</Text>
          </Pressable>

          <Pressable style={styles.ghostBtn} onPress={goGuest} disabled={loadingSocial}>
            <Text style={styles.ghostText}>Continue as guest</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialRow}>
            <Pressable style={styles.socialBtn} onPress={onApple} disabled={loadingSocial}>
              <Text style={styles.socialIcon}></Text>
              <Text style={styles.socialText}>Apple</Text>
            </Pressable>

            <Pressable style={styles.socialBtn} onPress={() => void onGoogle()} disabled={loadingSocial}>
              <Text style={styles.socialIcon}>G</Text>
              <Text style={styles.socialText}>{loadingSocial ? "..." : "Google"}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footer}>By continuing you agree to our Terms & Privacy Policy</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 18 },
  centered: { alignItems: "center", justifyContent: "center" },

  top: { flex: 1, justifyContent: "center", alignItems: "center" },
  brand: { color: "#fff", fontSize: 46, letterSpacing: 10, fontWeight: "700" },
  tagline: { color: "rgba(255,255,255,0.7)", marginTop: 10, fontSize: 14 },

  actions: { gap: 12 },

  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "700" },

  secondaryBtn: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  ghostBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "800" },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  divider: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.18)" },
  dividerText: { color: "rgba(255,255,255,0.6)", fontSize: 12 },

  socialRow: { flexDirection: "row", gap: 10 },
  socialBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  socialIcon: { color: "#fff", fontSize: 18, fontWeight: "700" },
  socialText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  footer: {
    marginTop: 14,
    textAlign: "center",
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    lineHeight: 16,
  },
});
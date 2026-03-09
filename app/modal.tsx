// app/modal.tsx
import React, { useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

export default function ModalScreen() {
  const router = useRouter();

  const close = useCallback(() => {
    const canGoBack = (router as any)?.canGoBack?.() ?? false;
    if (canGoBack) {
      router.back();
      return;
    }

    router.replace("/(tabs)/feed");
  }, [router]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />

      <View style={styles.container}>
        <View style={styles.topRow}>
          <Pressable onPress={close} style={styles.iconBtn} hitSlop={10}>
            <Text style={styles.iconText}>✕</Text>
          </Pressable>

          <Text style={styles.header}>Modal</Text>

          <View style={{ width: 42 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Coming soon</Text>
          <Text style={styles.subtitle}>
            This screen will be used for editing profile, settings, or other modal flows.
          </Text>

          <Pressable onPress={close} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Close</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>REAL • MVP</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 14 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  header: { color: "#fff", fontSize: 18, fontWeight: "900" },

  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  card: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    marginTop: 20,
  },

  title: { color: "#fff", fontSize: 22, fontWeight: "900" },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },

  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "900" },

  footer: {
    marginTop: 18,
    textAlign: "center",
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
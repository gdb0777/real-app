import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../providers/AuthProvider";
import { usePlans } from "../../providers/PlansProvider";

export default function ChatsScreen() {
  const { user, initializing } = useAuth();
  const { isGuest } = usePlans();

  if (initializing) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Text style={styles.h1}>Chats</Text>

          <View style={styles.centerCard}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color="rgba(255,255,255,0.72)" />
            <Text style={styles.title}>Loading…</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!user || isGuest) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Text style={styles.h1}>Chats</Text>
          <Text style={styles.h2}>Login to access your conversations.</Text>

          <View style={styles.centerCard}>
            <Ionicons name="lock-closed-outline" size={28} color="rgba(255,255,255,0.72)" />
            <Text style={styles.title}>Private chats are for members</Text>
            <Text style={styles.subtitle}>
              Join REAL to chat with people from plans you create or join.
            </Text>

            <Pressable onPress={() => router.push("/login")} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Login</Text>
            </Pressable>

            <Pressable onPress={() => router.push("/register")} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Create account</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Text style={styles.h1}>Chats</Text>
        <Text style={styles.h2}>Your conversations will appear here.</Text>

        <View style={styles.centerCard}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={30}
            color="rgba(255,255,255,0.72)"
          />
          <Text style={styles.title}>No chats yet</Text>
          <Text style={styles.subtitle}>
            When you join plans or message participants, your conversations will show up here.
          </Text>

          <Pressable onPress={() => router.push("/(tabs)/feed")} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Go to Feed</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Next step for REAL</Text>
          <Text style={styles.infoText}>
            Later we can connect this screen to Supabase with:
          </Text>
          <Text style={styles.infoBullet}>• conversations</Text>
          <Text style={styles.infoBullet}>• conversation_participants</Text>
          <Text style={styles.infoBullet}>• messages</Text>
          <Text style={styles.infoBullet}>• unread counts</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#000",
  },

  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
  },

  h1: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
    letterSpacing: -0.8,
  },

  h2: {
    color: "rgba(255,255,255,0.58)",
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
  },

  centerCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 20,
    minHeight: 260,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    marginTop: 14,
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    marginTop: 10,
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
  },

  primaryBtn: {
    marginTop: 18,
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtnText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "900",
  },

  secondaryBtn: {
    marginTop: 10,
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  infoCard: {
    marginTop: 16,
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  infoTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 8,
  },

  infoText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    lineHeight: 18,
  },

  infoBullet: {
    marginTop: 6,
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: "700",
  },
});
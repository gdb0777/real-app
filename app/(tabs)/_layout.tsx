// app/(tabs)/_layout.tsx
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const current = state.routes[state.index]?.name;

  const go = (name: string) => {
    navigation.navigate(name as never);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <View style={styles.leftSide}>
          <Pressable
            onPress={() => go("feed")}
            style={styles.sideTab}
            accessibilityRole="button"
          >
            <Ionicons
              name={current === "feed" ? "home" : "home-outline"}
              size={27}
              color={current === "feed" ? "#fff" : "rgba(255,255,255,0.34)"}
            />
          </Pressable>

          <Pressable
            onPress={() => go("explore")}
            style={styles.sideTab}
            accessibilityRole="button"
          >
            <Ionicons
              name={current === "explore" ? "search" : "search-outline"}
              size={27}
              color={current === "explore" ? "#fff" : "rgba(255,255,255,0.34)"}
            />
          </Pressable>
        </View>

        <View style={styles.rightSide}>
          <Pressable
            onPress={() => go("chats")}
            style={styles.sideTab}
            accessibilityRole="button"
          >
            <Ionicons
              name={current === "chats" ? "chatbubble" : "chatbubble-outline"}
              size={26}
              color={current === "chats" ? "#fff" : "rgba(255,255,255,0.34)"}
            />
          </Pressable>

          <Pressable
            onPress={() => go("profile")}
            style={styles.sideTab}
            accessibilityRole="button"
          >
            <Ionicons
              name={current === "profile" ? "person" : "person-outline"}
              size={27}
              color={current === "profile" ? "#fff" : "rgba(255,255,255,0.34)"}
            />
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push("/create")}
          hitSlop={12}
          style={styles.plusWrap}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={26} color="#000" />
        </Pressable>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: "#000" },
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="feed" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="chats" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#000",
  },

  bar: {
    height: 86,
    backgroundColor: "#070707",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 14,
    position: "relative",
  },

  leftSide: {
    width: "40%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  rightSide: {
    width: "40%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  sideTab: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  plusWrap: {
    position: "absolute",
    left: "50%",
    marginLeft: -29,
    top: -16,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 20,
  },
});
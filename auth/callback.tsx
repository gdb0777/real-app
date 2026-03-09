// app/auth/callback.tsx
import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import * as QueryParams from "expo-auth-session/build/QueryParams";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          const { params, errorCode } = QueryParams.getQueryParams(url);
          if (!errorCode && params?.access_token) {
            await supabase.auth.setSession({
              access_token: String(params.access_token),
              refresh_token: String(params.refresh_token ?? ""),
            });
          }
        }
      } finally {
        if (!mounted) return;
        router.replace("/");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}

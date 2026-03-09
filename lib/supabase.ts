// lib/supabase.ts
import "react-native-url-polyfill/auto";
import "react-native-get-random-values";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { decode as atob, encode as btoa } from "base-64";

const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const supabaseAnonKey = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl ? "EXPO_PUBLIC_SUPABASE_URL" : null,
    !supabaseAnonKey ? "EXPO_PUBLIC_SUPABASE_ANON_KEY" : null,
  ]
    .filter(Boolean)
    .join(" / ");

  throw new Error(`Missing Supabase env vars: ${missing}. Check your .env and restart Expo.`);
}

if (typeof (globalThis as any).atob !== "function") {
  (globalThis as any).atob = atob;
}

if (typeof (globalThis as any).btoa !== "function") {
  (globalThis as any).btoa = btoa;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    storageKey: "real-auth",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
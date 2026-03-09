// app/register.tsx
import React, { useMemo, useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

import { supabase } from "../lib/supabase";

function normalizeEmail(v: string) {
  return String(v ?? "").trim().toLowerCase();
}

function isValidEmail(v: string) {
  const s = normalizeEmail(v);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function friendlyAuthErrorMessage(message?: string) {
  const m = String(message ?? "").trim();
  const low = m.toLowerCase();

  if (low.includes("user already registered")) {
    return "This email is already registered. Try logging in.";
  }
  if (low.includes("already registered")) {
    return "This email is already registered. Try logging in.";
  }
  if (low.includes("invalid email")) {
    return "Please enter a valid email address.";
  }
  if (low.includes("password") && low.includes("should be at least")) {
    return "Password is too short. Please use at least 6 characters.";
  }
  if (low.includes("weak password")) {
    return "Password is too weak. Try a longer one.";
  }
  if (low.includes("rate limit")) {
    return "Too many attempts. Please wait a bit and try again.";
  }
  if (low.includes("network")) {
    return "Network error. Check your connection and try again.";
  }

  return m || "Unknown error";
}

export default function RegisterScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);

  const safeBack = useCallback(() => {
    if (loading) return;

    const canGoBack = (router as any)?.canGoBack?.() ?? false;
    if (canGoBack) {
      router.back();
      return;
    }

    router.replace("/");
  }, [router, loading]);

  const emailNorm = useMemo(() => normalizeEmail(email), [email]);

  const emailOk = useMemo(() => !!emailNorm && isValidEmail(emailNorm), [emailNorm]);
  const passOk = useMemo(() => password.length >= 6, [password]);
  const confirmOk = useMemo(() => confirm.length >= 6, [confirm]);

  const passwordsMatch = useMemo(() => {
    if (!password && !confirm) return true;
    return password === confirm;
  }, [password, confirm]);

  const canRegister = useMemo(() => {
    return emailOk && passOk && confirmOk && passwordsMatch && !loading;
  }, [emailOk, passOk, confirmOk, passwordsMatch, loading]);

  const onRegister = useCallback(async () => {
    if (loading || !canRegister) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: emailNorm,
        password,
      });

      if (error) throw error;

      const hasSession = !!data?.session;

      setEmail("");
      setPassword("");
      setConfirm("");

      if (hasSession) {
        return;
      }

      Alert.alert(
        "Check your email",
        "We sent you a confirmation email. After confirming, come back and login."
      );
      router.replace("/login");
    } catch (e: unknown) {
      const message =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : String(e ?? "");

      Alert.alert("Register failed", friendlyAuthErrorMessage(message));
    } finally {
      setLoading(false);
    }
  }, [loading, canRegister, emailNorm, password, router]);

  const goLogin = useCallback(() => {
    router.push("/login");
  }, [router]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Pressable onPress={safeBack} style={styles.iconBtn} hitSlop={10} disabled={loading}>
            <Text style={styles.iconText}>←</Text>
          </Pressable>

          <Text style={styles.header}>Register</Text>

          <View style={{ width: 42 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Sign up to continue to REAL.</Text>

          <Text style={[styles.label, { marginTop: 14 }]}>Email</Text>
          <TextInput
            placeholder="you@example.com"
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={[styles.input, email.length > 0 && !emailOk ? styles.inputError : null]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
            editable={!loading}
          />
          {email.length > 0 && !emailOk && (
            <Text style={styles.errorText}>Enter a valid email</Text>
          )}

          <Text style={[styles.label, { marginTop: 10 }]}>Password</Text>
          <View style={styles.passRow}>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={[styles.passInput, password.length > 0 && !passOk ? styles.inputError : null]}
              secureTextEntry={!showPass}
              autoComplete="password-new"
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
              returnKeyType="next"
              editable={!loading}
            />
            <Pressable
              onPress={() => setShowPass((v) => !v)}
              style={styles.eyeBtn}
              disabled={loading || password.length === 0}
            >
              <Text style={styles.eyeText}>{showPass ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>
          {password.length > 0 && !passOk && (
            <Text style={styles.errorText}>Password must be 6+ characters</Text>
          )}

          <Text style={[styles.label, { marginTop: 10 }]}>Confirm password</Text>
          <View style={styles.passRow}>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={[
                styles.passInput,
                confirm.length > 0 && (!confirmOk || !passwordsMatch) ? styles.inputError : null,
              ]}
              secureTextEntry={!showConfirm}
              autoComplete="password-new"
              textContentType="newPassword"
              value={confirm}
              onChangeText={setConfirm}
              returnKeyType="done"
              onSubmitEditing={() => void onRegister()}
              editable={!loading}
            />
            <Pressable
              onPress={() => setShowConfirm((v) => !v)}
              style={styles.eyeBtn}
              disabled={loading || confirm.length === 0}
            >
              <Text style={styles.eyeText}>{showConfirm ? "Hide" : "Show"}</Text>
            </Pressable>
          </View>

          {confirm.length > 0 && !confirmOk && (
            <Text style={styles.errorText}>Confirm password must be 6+ characters</Text>
          )}
          {confirm.length > 0 && password.length > 0 && !passwordsMatch && (
            <Text style={styles.errorText}>Passwords don’t match</Text>
          )}

          <Pressable
            style={[styles.primaryBtn, !canRegister && styles.btnDisabled]}
            onPress={() => void onRegister()}
            disabled={!canRegister}
          >
            <Text style={styles.primaryText}>{loading ? "..." : "Create account"}</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Pressable onPress={goLogin} style={styles.secondaryBtn} disabled={loading}>
            <Text style={styles.secondaryText}>Already have an account? Login</Text>
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
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  title: { color: "#fff", fontSize: 22, fontWeight: "900" },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
  },

  label: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "800" },

  input: {
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#fff",
    marginTop: 10,
  },

  passRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  passInput: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#fff",
  },
  eyeBtn: {
    width: 76,
    height: 54,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  eyeText: { color: "rgba(255,255,255,0.9)", fontWeight: "900" },

  inputError: { borderColor: "rgba(255,80,80,0.75)" },

  errorText: {
    marginTop: 8,
    color: "rgba(255,80,80,0.9)",
    fontSize: 12,
    fontWeight: "700",
  },

  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "900" },
  btnDisabled: { opacity: 0.35 },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  divider: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.14)" },
  dividerText: { color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "800" },

  secondaryBtn: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  secondaryText: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "900" },

  footer: {
    marginTop: 16,
    textAlign: "center",
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
// lib/_storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Local onboarding data stored on device (MVP / optional guest/offline).
 * Scoped per userId to avoid leaking between accounts.
 *
 * NOTE:
 * This is LOCAL storage. Server onboarding lives in lib/onboarding.ts (Supabase profiles).
 * Names are intentionally different to avoid wrong imports.
 */

export type LocalGender = "Male" | "Female" | "Other";

export type LocalOnboardingData = {
  firstName?: string;
  lastName?: string;
  birthdate?: string;
  gender?: LocalGender;
  location?: string;
  occupation?: string;
  photos?: string[];
  interests?: string[];
  completed?: boolean;
};

const ONBOARDING_VERSION = "v1";

function buildKey(userId?: string | null) {
  const scope = userId ?? "guest";
  return `real:onboarding:${ONBOARDING_VERSION}:${scope}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergePatch(
  current: LocalOnboardingData,
  patch: Partial<LocalOnboardingData>
): LocalOnboardingData {
  const next = {
    ...current,
  } as Record<
    keyof LocalOnboardingData,
    LocalOnboardingData[keyof LocalOnboardingData] | undefined
  >;

  for (const [k, v] of Object.entries(patch) as Array<
    [keyof LocalOnboardingData, LocalOnboardingData[keyof LocalOnboardingData] | null | undefined]
  >) {
    if (v === undefined) continue;

    if (v === null) {
      delete next[k];
      continue;
    }

    next[k] = v;
  }

  return next as LocalOnboardingData;
}

export async function getLocalOnboarding(
  userId?: string | null
): Promise<LocalOnboardingData> {
  const key = buildKey(userId);

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);

    if (!isPlainObject(parsed)) {
      await AsyncStorage.removeItem(key);
      return {};
    }

    return parsed as LocalOnboardingData;
  } catch {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
    return {};
  }
}

export async function setLocalOnboarding(
  patch: Partial<LocalOnboardingData>,
  userId?: string | null
): Promise<LocalOnboardingData> {
  const key = buildKey(userId);

  const current = await getLocalOnboarding(userId);
  const next = mergePatch(current, patch);

  await AsyncStorage.setItem(key, JSON.stringify(next));
  return next;
}

export async function markLocalOnboardingCompleted(userId?: string | null): Promise<void> {
  await setLocalOnboarding({ completed: true }, userId);
}

export async function isLocalOnboardingCompleted(
  userId?: string | null
): Promise<boolean> {
  const data = await getLocalOnboarding(userId);
  return data.completed === true;
}

export async function clearLocalOnboarding(userId?: string | null): Promise<void> {
  await AsyncStorage.removeItem(buildKey(userId));
}
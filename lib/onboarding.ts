// lib/onboarding.ts
import { supabase } from "./supabase";

export type Gender = "Male" | "Female" | "Other";
const GENDERS: readonly Gender[] = ["Male", "Female", "Other"] as const;

export type OnboardingData = {
  firstName: string | null;
  lastName: string | null;
  gender: Gender | null;
  birthdate: string | null; // YYYY-MM-DD
  location: string | null;
  interests: string[] | null;
  occupation: string | null;
  photos: string[] | null; // public urls
};

export type OnboardingPatch = Partial<{
  firstName: string | null;
  lastName: string | null;
  gender: Gender | null;
  birthdate: string | null;
  location: string | null;
  interests: string[] | null;
  occupation: string | null;
  photos: string[] | null;

  // legacy aliases
  first_name: string | null;
  last_name: string | null;
}>;

type ProfileOnboardingRow = {
  onboarding_completed?: boolean | null;
  first_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  location?: string | null;
  interests?: string[] | null;
  occupation?: string | null;
  photos?: string[] | null;
};

async function getAuthedUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

function normalizeText(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function normalizeStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const arr = v.map((x) => String(x ?? "").trim()).filter(Boolean);
  return arr.length ? Array.from(new Set(arr)) : null;
}

function sanitizeGender(v: unknown): Gender | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  const cap = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return (GENDERS as readonly string[]).includes(cap) ? (cap as Gender) : null;
}

function sanitizeArrayInput(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => String(x ?? "").trim()).filter(Boolean);
  return out.length ? Array.from(new Set(out)) : null;
}

function normalizePatch(patch: OnboardingPatch): OnboardingPatch {
  const next: OnboardingPatch = { ...patch };

  if ("first_name" in next && !("firstName" in next)) {
    next.firstName = next.first_name ?? null;
  }

  if ("last_name" in next && !("lastName" in next)) {
    next.lastName = next.last_name ?? null;
  }

  if ("firstName" in next) next.firstName = normalizeText(next.firstName);
  if ("lastName" in next) next.lastName = normalizeText(next.lastName);
  if ("gender" in next) next.gender = sanitizeGender(next.gender);
  if ("birthdate" in next) next.birthdate = normalizeText(next.birthdate);
  if ("location" in next) next.location = normalizeText(next.location);
  if ("occupation" in next) next.occupation = normalizeText(next.occupation);
  if ("interests" in next) next.interests = sanitizeArrayInput(next.interests);
  if ("photos" in next) next.photos = sanitizeArrayInput(next.photos);

  return next;
}

const CACHE_TTL_MS = 5000;

let cache:
  | {
      userId: string;
      ts: number;
      data: OnboardingData | null;
    }
  | null = null;

let statusCache:
  | {
      userId: string;
      ts: number;
      completed: boolean;
    }
  | null = null;

function setCache(userId: string, data: OnboardingData | null) {
  cache = { userId, ts: Date.now(), data };
}

function getCache(userId: string): OnboardingData | null | undefined {
  if (!cache) return undefined;
  if (cache.userId !== userId) return undefined;
  if (Date.now() - cache.ts > CACHE_TTL_MS) return undefined;
  return cache.data;
}

function setStatusCache(userId: string, completed: boolean) {
  statusCache = { userId, ts: Date.now(), completed };
}

function getStatusCache(userId: string): boolean | undefined {
  if (!statusCache) return undefined;
  if (statusCache.userId !== userId) return undefined;
  if (Date.now() - statusCache.ts > CACHE_TTL_MS) return undefined;
  return statusCache.completed;
}

function applyPatchToData(prev: OnboardingData | null, patch: OnboardingPatch): OnboardingData {
  const base: OnboardingData = prev ?? {
    firstName: null,
    lastName: null,
    gender: null,
    birthdate: null,
    location: null,
    interests: null,
    occupation: null,
    photos: null,
  };

  const p = normalizePatch(patch);
  const next: OnboardingData = { ...base };

  if ("firstName" in p) next.firstName = p.firstName ?? null;
  if ("lastName" in p) next.lastName = p.lastName ?? null;
  if ("gender" in p) next.gender = p.gender ?? null;
  if ("birthdate" in p) next.birthdate = p.birthdate ?? null;
  if ("location" in p) next.location = p.location ?? null;
  if ("occupation" in p) next.occupation = p.occupation ?? null;
  if ("interests" in p) next.interests = p.interests ?? null;
  if ("photos" in p) next.photos = p.photos ?? null;

  return next;
}

export async function getOnboardingStatus(
  opts?: { force?: boolean }
): Promise<{ completed: boolean } | null> {
  const userId = await getAuthedUserId();
  if (!userId) return null;

  if (!opts?.force) {
    const cached = getStatusCache(userId);
    if (cached !== undefined) return { completed: cached };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  const row = data as ProfileOnboardingRow | null;

  if (error || !row) {
    setStatusCache(userId, false);
    return { completed: false };
  }

  const completed = !!row.onboarding_completed;
  setStatusCache(userId, completed);
  return { completed };
}

export async function setOnboardingCompleted(completed: boolean) {
  const userId = await getAuthedUserId();
  if (!userId) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, onboarding_completed: completed }, { onConflict: "id" });

  if (error) throw error;

  setStatusCache(userId, completed);
  return true;
}

export async function getOnboarding(opts?: { force?: boolean }): Promise<OnboardingData | null> {
  const userId = await getAuthedUserId();
  if (!userId) return null;

  if (!opts?.force) {
    const cached = getCache(userId);
    if (cached !== undefined) return cached;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, gender, birthdate, location, interests, occupation, photos")
    .eq("id", userId)
    .maybeSingle();

  const row = data as ProfileOnboardingRow | null;

  if (error || !row) {
    setCache(userId, null);
    return null;
  }

  const mapped: OnboardingData = {
    firstName: normalizeText(row.first_name),
    lastName: normalizeText(row.last_name),
    gender: sanitizeGender(row.gender),
    birthdate: normalizeText(row.birthdate),
    location: normalizeText(row.location),
    interests: normalizeStringArray(row.interests),
    occupation: normalizeText(row.occupation),
    photos: normalizeStringArray(row.photos),
  };

  setCache(userId, mapped);
  return mapped;
}

export async function upsertOnboarding(patch: OnboardingPatch) {
  const userId = await getAuthedUserId();
  if (!userId) throw new Error("Not authenticated");

  const p = normalizePatch(patch);

  const payload: Record<string, unknown> = { id: userId };

  if ("firstName" in p) payload.first_name = p.firstName;
  if ("lastName" in p) payload.last_name = p.lastName;
  if ("gender" in p) payload.gender = p.gender;
  if ("birthdate" in p) payload.birthdate = p.birthdate;
  if ("location" in p) payload.location = p.location;
  if ("occupation" in p) payload.occupation = p.occupation;
  if ("interests" in p) payload.interests = p.interests;
  if ("photos" in p) payload.photos = p.photos;

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) throw error;

  const prev = getCache(userId);
  const prevData = prev === undefined ? null : prev;
  const merged = applyPatchToData(prevData, p);
  setCache(userId, merged);

  return true;
}

export async function setOnboardingField<K extends keyof OnboardingPatch>(
  key: K,
  value: OnboardingPatch[K]
) {
  const patch = { [key]: value } as Pick<OnboardingPatch, K>;
  return upsertOnboarding(patch);
}
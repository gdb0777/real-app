// providers/plansStorage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

// ⚠️ НЕ импортваме Plan от PlansProvider (за да няма circular import).
export type StoredPlan = {
  id: string;
  title: string;
  location: string;
  dateLabel: string;
  host: string;
  spotsLeft: number;
  tags: string[];
  createdAt: number;
  joined: boolean;

  // display names (for UI)
  participants: string[];

  // stable identifiers
  hostId?: string;
  participantIds?: string[];

  // optional event cover image (local uri or public url)
  imageUri?: string;
};

const STORAGE_VERSION = "v1";
const KEY = `@real:plans:${STORAGE_VERSION}`;

const MAX_SAVE = 200;
const MAX_STR = 240;
const MAX_URL = 1200;
const MAX_TAGS = 20;
const MAX_PARTICIPANTS = 200;

function clampString(value: string, max: number) {
  const v = String(value ?? "");
  return v.length > max ? v.slice(0, max) : v;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function uniqLowerKeepFirst(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const s of arr) {
    const key = s.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }

  return out;
}

function uniqKeepFirst(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const s of arr) {
    const key = s.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }

  return out;
}

function asStringArray(value: unknown, maxItems = 200, maxLen = MAX_STR): string[] {
  if (!Array.isArray(value)) return [];

  const raw = value
    .map((x) => asString(x, ""))
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((x) => clampString(x, maxLen));

  return uniqLowerKeepFirst(raw).slice(0, maxItems);
}

function asIdArray(value: unknown, maxItems = 200, maxLen = 120): string[] {
  if (!Array.isArray(value)) return [];

  const raw = value
    .map((x) => asString(x, ""))
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((x) => clampString(x, maxLen));

  return uniqKeepFirst(raw).slice(0, maxItems);
}

function normalizeStoredPlan(x: unknown): StoredPlan | null {
  if (!x || typeof x !== "object") return null;

  const obj = x as Record<string, unknown>;

  const id = clampString(asString(obj.id, "").trim(), 80);
  if (!id) return null;

  const title = clampString(asString(obj.title, "").trim(), MAX_STR);
  const location = clampString(asString(obj.location, "").trim(), MAX_STR);
  const dateLabel = clampString(asString(obj.dateLabel, "").trim(), MAX_STR);
  const host = clampString(asString(obj.host, "").trim(), MAX_STR);

  const createdAtRaw = asNumber(obj.createdAt, Date.now());
  const createdAt = Number.isFinite(createdAtRaw) ? createdAtRaw : Date.now();

  const spotsLeftRaw = asNumber(obj.spotsLeft, 0);
  const spotsLeft = Math.max(0, Number.isFinite(spotsLeftRaw) ? spotsLeftRaw : 0);

  const tags = asStringArray(obj.tags, MAX_TAGS, 48);
  const participants = asStringArray(obj.participants, MAX_PARTICIPANTS, 80);

  let participantIds = asIdArray(obj.participantIds, MAX_PARTICIPANTS, 120);
  if (participantIds.length > participants.length) {
    participantIds = participantIds.slice(0, participants.length);
  }

  const hostId = clampString(asString(obj.hostId, "").trim(), 120) || undefined;
  const joined = Boolean(obj.joined);

  const imageUriRaw = obj.imageUri;
  const imageUri =
    typeof imageUriRaw === "string" && imageUriRaw.trim().length > 0
      ? clampString(imageUriRaw.trim(), MAX_URL)
      : undefined;

  return {
    id,
    title,
    location,
    dateLabel,
    host,
    spotsLeft,
    tags,
    createdAt,
    joined,
    participants,
    participantIds,
    hostId,
    imageUri,
  };
}

function sanitizeBeforeSave(plans: StoredPlan[]) {
  const list = Array.isArray(plans) ? plans : [];
  const normalized = list.map(normalizeStoredPlan).filter(Boolean) as StoredPlan[];

  normalized.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return normalized.slice(0, MAX_SAVE);
}

export async function savePlans(plans: StoredPlan[]) {
  try {
    const safe = sanitizeBeforeSave(plans);
    await AsyncStorage.setItem(KEY, JSON.stringify(safe));
  } catch {
    // ignore (MVP)
  }
}

export async function loadPlans(): Promise<StoredPlan[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const normalized = parsed.map(normalizeStoredPlan).filter(Boolean) as StoredPlan[];
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

export async function clearPlans() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
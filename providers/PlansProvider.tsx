// providers/PlansProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";
import { router } from "expo-router";

import { loadPlans, savePlans, type StoredPlan } from "./plansStorage";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";
import { getPlanImagePublicUrl, uploadPlanImageFromUri } from "../lib/planImages";
import { getOnboarding } from "../lib/onboarding";

export type Plan = StoredPlan & {
  participantIds?: string[];
  hostId?: string;
};

export type NewPlanInput = Omit<Plan, "id" | "createdAt" | "joined" | "participants" | "participantIds" | "hostId">;

type PlansContextValue = {
  plans: Plan[];
  addPlan: (p: NewPlanInput) => Promise<void>;
  toggleJoin: (id: string) => void;
  meName: string;
  isGuest: boolean;
};

const PlansContext = createContext<PlansContextValue | null>(null);

const SEED: Plan[] = [
  {
    id: "seed-1",
    title: "Football tonight",
    dateLabel: "Today, 20:00",
    location: "Plovdiv Center",
    host: "Georgi",
    spotsLeft: 3,
    tags: ["football", "sports"],
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    joined: false,
    participants: [],
  },
  {
    id: "seed-2",
    title: "Coffee & walk",
    dateLabel: "Tomorrow, 11:30",
    location: "Kapana, Plovdiv",
    host: "Stefan",
    spotsLeft: 1,
    tags: ["coffee", "social"],
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
    joined: false,
    participants: [],
  },
];

function safeText(v: unknown) {
  return String(v ?? "").trim();
}

function normKey(v: unknown) {
  return safeText(v).toLowerCase();
}

function clampNonNegative(n: number) {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function sortByCreatedAtDesc(list: Plan[]) {
  return [...list].sort((a, b) => (Number(b.createdAt ?? 0) || 0) - (Number(a.createdAt ?? 0) || 0));
}

function uniqByKeyKeepOrder<T>(items: T[], keyFn: (x: T) => string) {
  const out: T[] = [];
  const seen = new Set<string>();

  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }

  return out;
}

function addNameFrontUnique(list: string[], name: string) {
  const k = normKey(name);
  if (!k) return list;
  const filtered = list.filter((x) => normKey(x) !== k);
  return [name, ...filtered];
}

function removeNameLoose(list: string[], name: string) {
  const k = normKey(name);
  if (!k) return list;
  return list.filter((x) => normKey(x) !== k);
}

function normalizeStoredPlanCompat(x: any): Plan | null {
  if (!x || typeof x !== "object") return null;

  const id = safeText(x.id);
  if (!id) return null;

  const title = safeText(x.title);
  const location = safeText(x.location);
  const dateLabel = safeText(x.dateLabel);
  const host = safeText(x.host);

  const createdAtNum = Number(x.createdAt);
  const createdAt = Number.isFinite(createdAtNum) ? createdAtNum : Date.now();

  const spotsLeftNum = Number(x.spotsLeft);
  const spotsLeft = Number.isFinite(spotsLeftNum) ? clampNonNegative(spotsLeftNum) : 0;

  const tags = Array.isArray(x.tags) ? x.tags.map(String).map(safeText).filter(Boolean) : [];
  const participants = Array.isArray(x.participants) ? x.participants.map(String).map(safeText).filter(Boolean) : [];

  const participantIds = Array.isArray(x.participantIds)
    ? x.participantIds.map(String).map(safeText).filter(Boolean)
    : undefined;

  const joined = Boolean(x.joined);

  const imageUriRaw = x.imageUri;
  const imageUri = typeof imageUriRaw === "string" && imageUriRaw.trim() ? imageUriRaw : undefined;

  const hostId = typeof x.hostId === "string" && x.hostId.trim() ? x.hostId.trim() : undefined;

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

type DbProfileMini = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type DbPlanRow = {
  id: string;
  owner_id: string | null;
  created_at: string;
  title: string | null;
  location: string | null;
  date_label: string | null;
  host_name: string | null;
  spots_left: number | null;
  tags: string[] | null;
  image_path: string | null;
  plan_participants?: Array<{
    user_id: string;
    profiles?: DbProfileMini | null;
  }> | null;
};

function buildName(first?: string | null, last?: string | null) {
  const f = safeText(first);
  const l = safeText(last);
  return `${f} ${l}`.trim();
}

function safeMeName(first?: string | null, last?: string | null) {
  return buildName(first, last) || "You";
}

function pickProfileName(p?: DbProfileMini | null) {
  if (!p) return "";
  const full = safeText(p.full_name);
  if (full) return full;

  return buildName(p.first_name, p.last_name);
}

function fallbackUserLabel(userId: string) {
  const short = safeText(userId).slice(0, 4);
  return short ? `User · ${short}` : "User";
}

function toPlanFromDb(row: DbPlanRow, myUserId: string): Plan {
  const parts = Array.isArray(row.plan_participants) ? row.plan_participants : [];

  const pairs = parts.map((pp) => {
    const id = safeText(pp?.user_id);
    const name = safeText(pickProfileName(pp?.profiles ?? null));
    return { id, name };
  });

  const uniqPairs = uniqByKeyKeepOrder(pairs, (x) => x.id);

  const participantIds = uniqPairs.map((x) => x.id);
  const participants = uniqPairs.map((x) => x.name || fallbackUserLabel(x.id));
  const joined = participantIds.some((id) => String(id) === String(myUserId));

  const createdAtParsed = Date.parse(String(row.created_at ?? ""));
  const createdAt = Number.isFinite(createdAtParsed) ? createdAtParsed : Date.now();

  return {
    id: safeText(row.id),
    hostId: safeText(row.owner_id) || undefined,
    title: safeText(row.title),
    location: safeText(row.location),
    dateLabel: safeText(row.date_label),
    host: safeText(row.host_name) || "Someone",
    spotsLeft: Number.isFinite(Number(row.spots_left)) ? clampNonNegative(Number(row.spots_left)) : 0,
    tags: Array.isArray(row.tags) ? row.tags.map(String).map(safeText).filter(Boolean) : [],
    createdAt,
    joined,
    participants,
    participantIds,
    imageUri: row.image_path ? getPlanImagePublicUrl(row.image_path) : undefined,
  };
}

function requireAuth(message: string) {
  Alert.alert("Login required", message, [
    { text: "Cancel", style: "cancel" },
    { text: "Login", onPress: () => router.push("/login") },
  ]);
}

async function ensureProfileRow(userId: string) {
  const { error } = await supabase.from("profiles").upsert({ id: userId }, { onConflict: "id" });
  if (error) throw error;
}

export function PlansProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const isGuest = !userId;

  const [plans, setPlans] = useState<Plan[]>(() => sortByCreatedAtDesc(SEED));
  const [meName, setMeName] = useState<string>("Guest");

  const plansRef = useRef<Plan[]>(plans);
  const hydratedRef = useRef(false);
  const modeRef = useRef<"supabase" | "local">("local");
  const aliveRef = useRef(true);

  const createInFlightRef = useRef(false);
  const joinInFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const loadMe = useCallback(async () => {
    if (!userId) {
      if (!aliveRef.current) return;
      setMeName("Guest");
      return;
    }

    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name")
        .eq("id", userId)
        .maybeSingle();

      if (!aliveRef.current) return;

      const full = safeText((prof as any)?.full_name);
      const rawBuilt = buildName((prof as any)?.first_name, (prof as any)?.last_name);

      if (full) {
        setMeName(full);
        return;
      }

      if (rawBuilt) {
        setMeName(rawBuilt);
        return;
      }
    } catch {}

    try {
      const onboard = await getOnboarding();
      if (!aliveRef.current) return;

      const candidate = safeMeName((onboard as any)?.firstName, (onboard as any)?.lastName);
      setMeName(candidate || "You");
    } catch {
      if (!aliveRef.current) return;
      setMeName("You");
    }
  }, [userId]);

  const loadLocalPlans = useCallback(async () => {
    const stored = await loadPlans();
    if (!aliveRef.current) return;

    if (stored && stored.length > 0) {
      const normalized = stored.map(normalizeStoredPlanCompat).filter(Boolean) as Plan[];
      setPlans(sortByCreatedAtDesc(normalized.length ? normalized : SEED));
      return;
    }

    setPlans(sortByCreatedAtDesc(SEED));
  }, []);

  const loadSupabasePlans = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("plans")
      .select(
        `
        id,
        owner_id,
        created_at,
        title,
        location,
        date_label,
        host_name,
        spots_left,
        tags,
        image_path,
        plan_participants (
          user_id,
          profiles (
            full_name,
            first_name,
            last_name
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!aliveRef.current) return;

    const rows = (data ?? []) as unknown as DbPlanRow[];
    const mapped = rows.map((r) => toPlanFromDb(r, userId));
    setPlans(sortByCreatedAtDesc(mapped));
  }, [userId]);

  const refreshPlans = useCallback(async () => {
    if (userId) {
      await loadSupabasePlans();
      return;
    }

    await loadLocalPlans();
  }, [userId, loadSupabasePlans, loadLocalPlans]);

  useEffect(() => {
    let alive = true;
    hydratedRef.current = false;
    modeRef.current = userId ? "supabase" : "local";

    (async () => {
      if (userId) {
        try {
          await ensureProfileRow(userId);
        } catch {}

        await loadMe();
        if (!alive || !aliveRef.current) return;

        try {
          await loadSupabasePlans();
        } catch (e: any) {
          if (!alive || !aliveRef.current) return;
          console.log("loadSupabasePlans error:", e);
          Alert.alert("Server error", String(e?.message ?? e ?? "Could not load plans."));
        }
      } else {
        await loadMe();
        if (!alive || !aliveRef.current) return;
        await loadLocalPlans();
      }

      if (!alive || !aliveRef.current) return;
      hydratedRef.current = true;
    })();

    return () => {
      alive = false;
    };
  }, [userId, loadMe, loadSupabasePlans, loadLocalPlans]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (modeRef.current !== "local") return;

    const t = setTimeout(() => {
      void savePlans(plans);
    }, 200);

    return () => clearTimeout(t);
  }, [plans]);

  const addPlanLocal = useCallback((p: NewPlanInput) => {
    const now = Date.now();

    const plan: Plan = {
      id: String(now),
      createdAt: now,
      joined: false,
      participants: [],
      ...p,
    };

    setPlans((prev) => sortByCreatedAtDesc([plan, ...prev]));
  }, []);

  const toggleJoinLocal = useCallback(
    (id: string) => {
      setPlans((prev) => {
        const idx = prev.findIndex((x) => x.id === id);
        if (idx === -1) return prev;

        const plan = prev[idx];
        const next = [...prev];

        const spots = clampNonNegative(Number(plan.spotsLeft ?? 0));
        const participants = Array.isArray(plan.participants) ? plan.participants : [];

        if (plan.joined) {
          next[idx] = {
            ...plan,
            joined: false,
            participants: removeNameLoose(participants, meName),
            spotsLeft: spots + 1,
          };
          return next;
        }

        if (spots <= 0) return prev;

        next[idx] = {
          ...plan,
          joined: true,
          participants: addNameFrontUnique(participants, meName),
          spotsLeft: spots - 1,
        };

        return next;
      });
    },
    [meName]
  );

  const addPlanSupabase = useCallback(
    async (p: NewPlanInput) => {
      if (!userId) return;
      if (createInFlightRef.current) return;

      createInFlightRef.current = true;

      try {
        await ensureProfileRow(userId);
      } catch {}

      const tempId = `temp-${Date.now()}`;
      const initialSpots = Number.isFinite(Number(p?.spotsLeft)) ? Number(p.spotsLeft) : 0;

      const optimistic: Plan = {
        id: tempId,
        hostId: userId,
        createdAt: Date.now(),
        joined: true,
        participants: meName ? [meName] : [],
        participantIds: [userId],
        title: safeText(p?.title),
        location: safeText(p?.location),
        dateLabel: safeText(p?.dateLabel),
        host: safeText(p?.host) || meName || "You",
        spotsLeft: clampNonNegative(initialSpots - 1),
        tags: Array.isArray(p?.tags) ? p.tags.map(String).map(safeText).filter(Boolean) : [],
        imageUri: safeText(p?.imageUri) || undefined,
      };

      setPlans((prev) => sortByCreatedAtDesc([optimistic, ...prev]));

      try {
        const { data: inserted, error } = await supabase
          .from("plans")
          .insert({
            owner_id: userId,
            title: safeText(p?.title),
            location: safeText(p?.location),
            date_label: safeText(p?.dateLabel),
            host_name: safeText(p?.host) || meName || "You",
            spots_left: clampNonNegative(initialSpots),
            tags: Array.isArray(p?.tags) ? p.tags.map(String).map(safeText).filter(Boolean) : [],
            image_path: null,
          })
          .select("id, created_at")
          .single();

        if (error) throw error;

        const realId = safeText((inserted as any)?.id);
        if (!realId) throw new Error("Insert failed (no id).");

        const { error: joinErr } = await supabase.rpc("join_plan", { p_plan_id: realId });
        if (joinErr) throw joinErr;

        if (p?.imageUri) {
          try {
            const imagePath = await uploadPlanImageFromUri({
              planId: realId,
              uri: p.imageUri,
            });

            const { error: imageUpdateErr } = await supabase
              .from("plans")
              .update({ image_path: imagePath })
              .eq("id", realId);

            if (imageUpdateErr) {
              console.log("image_path update error:", imageUpdateErr);
            }
          } catch (imgErr) {
            console.log("uploadPlanImageFromUri error:", imgErr);
          }
        }

        await refreshPlans();
      } catch (e: any) {
        setPlans((prev) => prev.filter((x) => x.id !== tempId));
        await refreshPlans().catch(() => null);
        throw new Error(String(e?.message ?? "Please try again."));
      } finally {
        createInFlightRef.current = false;
      }
    },
    [userId, meName, refreshPlans]
  );

  const toggleJoinSupabase = useCallback(
    async (planId: string) => {
      if (!userId) return;

      const safePlanId = safeText(planId);
      if (!safePlanId) return;

      if (joinInFlightRef.current.has(safePlanId)) return;
      joinInFlightRef.current.add(safePlanId);

      try {
        await ensureProfileRow(userId);
      } catch {}

      const current = plansRef.current.find((p) => String(p.id) === String(safePlanId));
      const isJoined = !!current?.joined;

      const currentSpots = clampNonNegative(Number(current?.spotsLeft ?? 0));
      if (!isJoined && currentSpots <= 0) {
        joinInFlightRef.current.delete(safePlanId);
        return;
      }

      setPlans((prev) => {
        const idx = prev.findIndex((x) => String(x.id) === String(safePlanId));
        if (idx === -1) return prev;

        const plan = prev[idx];
        const next = [...prev];

        const spots = clampNonNegative(Number(plan.spotsLeft ?? 0));
        const participants = Array.isArray(plan.participants) ? plan.participants : [];
        const participantIds = Array.isArray(plan.participantIds) ? plan.participantIds : [];

        if (plan.joined) {
          next[idx] = {
            ...plan,
            joined: false,
            participants: removeNameLoose(participants, meName),
            participantIds: participantIds.filter((pid) => safeText(pid) !== userId),
            spotsLeft: spots + 1,
          };
          return next;
        }

        if (spots <= 0) return prev;

        next[idx] = {
          ...plan,
          joined: true,
          participants: addNameFrontUnique(participants, meName),
          participantIds: uniqByKeyKeepOrder([userId, ...participantIds], (x) => safeText(x)).map((x) =>
            safeText(x)
          ),
          spotsLeft: spots - 1,
        };

        return next;
      });

      try {
        if (isJoined) {
          const { error } = await supabase.rpc("leave_plan", { p_plan_id: safePlanId });
          if (error) throw error;
        } else {
          const { error } = await supabase.rpc("join_plan", { p_plan_id: safePlanId });
          if (error) throw error;
        }

        await refreshPlans();
      } catch (e: any) {
        Alert.alert("Update failed", String(e?.message ?? "Please try again."));
        await refreshPlans().catch(() => null);
      } finally {
        joinInFlightRef.current.delete(safePlanId);
      }
    },
    [userId, meName, refreshPlans]
  );

  const addPlan = useCallback(
    async (p: NewPlanInput) => {
      if (!userId) {
        requireAuth("Creating a plan is available after login.");
        return;
      }

      if (modeRef.current === "supabase") {
        await addPlanSupabase(p);
        return;
      }

      addPlanLocal(p);
    },
    [userId, addPlanSupabase, addPlanLocal]
  );

  const toggleJoin = useCallback(
    (id: string) => {
      if (!userId) {
        requireAuth("Joining plans is available after login.");
        return;
      }

      if (modeRef.current === "supabase") {
        void toggleJoinSupabase(id);
        return;
      }

      toggleJoinLocal(id);
    },
    [userId, toggleJoinSupabase, toggleJoinLocal]
  );

  const value = useMemo<PlansContextValue>(() => {
    return { plans, addPlan, toggleJoin, meName, isGuest };
  }, [plans, addPlan, toggleJoin, meName, isGuest]);

  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>;
}

export function usePlans() {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error("usePlans must be used inside PlansProvider");
  return ctx;
}
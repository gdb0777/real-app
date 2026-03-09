// lib/profileStorage.ts
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabase";

export const PROFILE_PHOTOS_BUCKET = "profile-photos";

function requireEnv(name: string, value: string | undefined) {
  const v = String(value ?? "").trim();
  if (!v) {
    throw new Error(`Missing env: ${name}. Check EXPO_PUBLIC_* variables.`);
  }
  return v;
}

function getSupabaseEnv() {
  return {
    supabaseUrl: requireEnv("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: requireEnv(
      "EXPO_PUBLIC_SUPABASE_ANON_KEY",
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ),
  };
}

export function getProfilePhotoPublicUrl(path?: string | null) {
  const safePath = String(path ?? "").trim();
  if (!safePath) return undefined;

  const { data } = supabase.storage.from(PROFILE_PHOTOS_BUCKET).getPublicUrl(safePath);
  const url = data?.publicUrl;

  return typeof url === "string" && url.trim().length > 0 ? url : undefined;
}

export async function getProfilePhotoSignedUrl(path?: string | null, expiresIn = 60 * 60) {
  const safePath = String(path ?? "").trim();
  if (!safePath) return undefined;

  const { data, error } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .createSignedUrl(safePath, expiresIn);

  if (error) return undefined;
  return data?.signedUrl ?? undefined;
}

export async function getBestProfilePhotoUrl(
  path?: string | null,
  opts?: { preferSigned?: boolean; expiresIn?: number }
) {
  const safePath = String(path ?? "").trim();
  if (!safePath) return undefined;

  const preferSigned = !!opts?.preferSigned;
  const expiresIn = opts?.expiresIn ?? 60 * 60;

  if (!preferSigned) {
    const publicUrl = getProfilePhotoPublicUrl(safePath);
    if (publicUrl) return publicUrl;
  }

  return getProfilePhotoSignedUrl(safePath, expiresIn);
}

function getExtFromUri(uri: string) {
  const clean = String(uri ?? "").toLowerCase().split("?")[0].split("#")[0];

  if (clean.endsWith(".png")) return "png";
  if (clean.endsWith(".webp")) return "webp";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "jpg";

  return "jpg";
}

function guessContentTypeFromUri(uri: string) {
  const clean = String(uri ?? "").toLowerCase().split("?")[0].split("#")[0];

  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";

  return "image/jpeg";
}

function safeFileName() {
  try {
    const g: any = globalThis;
    const id = g?.crypto?.randomUUID?.();
    if (id) return id;
  } catch {
    // ignore
  }

  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function encodeStoragePath(path: string) {
  return String(path)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) {
    throw new Error("No active session (missing access token).");
  }

  return token;
}

async function assertFileExists(fileUri: string) {
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      throw new Error("File does not exist");
    }
  } catch {
    throw new Error("Image file not found. Please pick the photo again.");
  }
}

async function storageUploadViaFileSystem(params: {
  bucket: string;
  path: string;
  fileUri: string;
  contentType: string;
  upsert?: boolean;
}) {
  const { bucket, path, fileUri, contentType, upsert = true } = params;

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

  await assertFileExists(fileUri);

  const accessToken = await getAccessToken();

  const encodedBucket = encodeURIComponent(bucket);
  const encodedPath = encodeStoragePath(path);

  const url =
    `${supabaseUrl}/storage/v1/object/${encodedBucket}/${encodedPath}` +
    `?upsert=${upsert ? "true" : "false"}`;

  const httpMethod = upsert ? "PUT" : "POST";

  const result = await FileSystem.uploadAsync(url, fileUri, {
    httpMethod,
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
      "Content-Type": contentType,
      "x-upsert": upsert ? "true" : "false",
    },
  });

  if (result.status < 200 || result.status >= 300) {
    const body = String(result.body ?? "").trim();
    throw new Error(`Storage upload failed (${result.status})${body ? `: ${body}` : ""}`);
  }

  return path;
}

export async function uploadProfilePhotoFromUri(args: { uri: string; userId: string }) {
  const uri = String(args.uri ?? "").trim();
  const userId = String(args.userId ?? "").trim();

  if (!userId) throw new Error("Missing userId");
  if (!uri) throw new Error("Missing uri");

  const ext = getExtFromUri(uri);
  const fileName = `${safeFileName()}.${ext}`;
  const path = `${userId}/${fileName}`;
  const contentType = guessContentTypeFromUri(uri);

  await storageUploadViaFileSystem({
    bucket: PROFILE_PHOTOS_BUCKET,
    path,
    fileUri: uri,
    contentType,
    upsert: true,
  });

  return path;
}
import { getAdminDb } from "./firebase-admin";

let cached: Record<string, unknown> | null = null;
let lastFetched = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds cache

export async function fetchRuntimeConfig(force = false): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (!force && cached && now - lastFetched < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const db = await getAdminDb();
    const ref = db.collection("app_settings").doc("runtime");
    const doc = await ref.get();
    if (!doc.exists) {
      cached = {};
    } else {
      cached = doc.data() as Record<string, unknown>;
    }
    lastFetched = Date.now();
    return cached || {};
  } catch (error) {
    console.error("Failed to fetch runtime config:", error);
    return cached ?? {};
  }
}

export async function getRuntimeValue<T = unknown>(key: string, fallback?: T): Promise<T | undefined> {
  const cfg = await fetchRuntimeConfig();
  if (cfg && Object.prototype.hasOwnProperty.call(cfg, key)) {
    return cfg[key] as T;
  }
  return fallback;
}

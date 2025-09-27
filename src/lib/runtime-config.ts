let cached: Record<string, unknown> | null = null;
let lastFetched = 0;
let isInitializing = false;
const CACHE_TTL_MS = 30_000; // 30 seconds cache

export async function fetchRuntimeConfig(force = false): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (!force && cached && now - lastFetched < CACHE_TTL_MS) {
    return cached;
  }

  // Skip Firebase calls during build phase or if already initializing (prevents circular dependency)
  if (process.env.NEXT_PHASE === 'phase-production-build' || isInitializing) {
    return cached || {};
  }

  isInitializing = true;
  try {
    const { getAdminDb } = await import('./firebase-admin');
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
    console.warn("Runtime config unavailable, using environment variables:", error?.message || error);
    // Fallback to process.env for critical values
    cached = {
      BOT_SECRET_KEY: process.env.BOT_SECRET_KEY,
      DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      SESSION_SECRET: process.env.SESSION_SECRET
    };
    return cached;
  } finally {
    isInitializing = false;
  }
}

export async function getRuntimeValue<T = unknown>(key: string, fallback?: T): Promise<T | undefined> {
  // During initialization, use fallback immediately to prevent circular dependency
  if (isInitializing && fallback !== undefined) {
    return fallback;
  }
  
  const cfg = await fetchRuntimeConfig();
  if (cfg && Object.prototype.hasOwnProperty.call(cfg, key)) {
    return cfg[key] as T;
  }
  return fallback;
}

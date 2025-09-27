let cached: Record<string, unknown> | null = null;
let lastFetched = 0;
let isInitializing = false;
const CACHE_TTL_MS = 30_000; // 30 seconds cache

let missingCredentialWarningShown = false;

const ENV_FALLBACK_KEYS = [
  "BOT_SECRET_KEY",
  "DISCORD_BOT_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "FIREBASE_PROJECT_ID",
  "FREE_CONVERT_API_KEY",
  "NEXT_PUBLIC_BASE_URL",
  "NEXT_PUBLIC_DISCORD_CLIENT_ID",
  "SESSION_SECRET",
  "TWITCH_CLIENT_ID",
  "TWITCH_CLIENT_SECRET",
];

function buildEnvFallback(): Record<string, unknown> {
  const fallback: Record<string, unknown> = {};
  for (const key of ENV_FALLBACK_KEYS) {
    if (process.env[key] !== undefined) {
      fallback[key] = process.env[key];
    }
  }
  return fallback;
}

function hasFirebaseCredentials(): boolean {
  if (process.env.FIREBASE_RUNTIME_FORCE === "1") {
    return true;
  }

  if (process.env.FIREBASE_RUNTIME_DISABLED === "1") {
    return false;
  }

  const hasInlineCredentials = Boolean(
    process.env.FIREBASE_ADMIN_SDK_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.FIREBASE_ADMIN_SDK_JSON_BASE64 ||
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
  );

  if (hasInlineCredentials) {
    return true;
  }

  const hasCredentialPath = Boolean(
    process.env.FIREBASE_ADMIN_SDK_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );

  if (hasCredentialPath) {
    return true;
  }

  const runningOnGoogleCloud = Boolean(
    process.env.K_SERVICE ||
      process.env.FUNCTION_TARGET ||
      process.env.GAE_SERVICE ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.FIREBASE_CONFIG,
  );

  return runningOnGoogleCloud;
}

export async function fetchRuntimeConfig(force = false): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (!force && cached && now - lastFetched < CACHE_TTL_MS) {
    return cached;
  }

  // Skip Firebase calls during build phase or if already initializing (prevents circular dependency)
  if (process.env.NEXT_PHASE === 'phase-production-build' || isInitializing) {
    return cached || buildEnvFallback();
  }

  if (!hasFirebaseCredentials()) {
    if (!missingCredentialWarningShown) {
      console.info(
        "Firebase credentials not detected. Skipping runtime config fetch and using environment variables instead.",
      );
      missingCredentialWarningShown = true;
    }
    cached = buildEnvFallback();
    lastFetched = Date.now();
    return cached;
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
    cached = buildEnvFallback();
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

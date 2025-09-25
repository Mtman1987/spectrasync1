import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import admin from "firebase-admin";
import { getRuntimeValue } from "./runtime-config";
import type { App, AppOptions } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";

const globalForFirebase = globalThis as typeof globalThis & {
  __FIREBASE_ADMIN_DB__?: Firestore;
};

let db: Firestore | null = globalForFirebase.__FIREBASE_ADMIN_DB__ ?? null;

type ServiceAccountConfig = admin.ServiceAccount & {
  project_id?: string;
  private_key_id?: string;
  private_key?: string;
  client_email?: string;
  [key: string]: unknown;
};

function parseServiceAccount(json: string): ServiceAccountConfig | null {
  try {
    const parsed = JSON.parse(json) as ServiceAccountConfig;

    const projectId = parsed.projectId ?? parsed.project_id;
    const clientEmail = parsed.clientEmail ?? parsed.client_email;
    const privateKey = parsed.privateKey ?? parsed.private_key;

    if (!projectId || !clientEmail || !privateKey) {
      console.warn(
        "Firebase Admin service account JSON is missing required fields (project_id, client_email, private_key). Falling back to application default credentials.",
      );
      return null;
    }

    const normalized: ServiceAccountConfig = {
      ...parsed,
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };

    if (parsed.private_key !== undefined) {
      normalized.private_key = parsed.private_key;
    }

    if (parsed.project_id !== undefined) {
      normalized.project_id = parsed.project_id;
    }

    if (parsed.client_email !== undefined) {
      normalized.client_email = parsed.client_email;
    }

    return normalized;
  } catch (error) {
    console.error("Failed to parse Firebase Admin service account JSON. Falling back to application default credentials.", error);
    return null;
  }
}

function readServiceAccountFromFile(filePath: string): ServiceAccountConfig | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const contents = readFileSync(filePath, "utf8");
    return parseServiceAccount(contents);
  } catch (error) {
    console.error(`Failed to read Firebase Admin service account file at ${filePath}.`, error);
    return null;
  }
}

async function resolveServiceAccount(): Promise<ServiceAccountConfig | null> {
  const inlineJson = process.env.FIREBASE_ADMIN_SDK_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT ?? null;
  if (inlineJson) {
    const parsedInline = parseServiceAccount(inlineJson);
    if (parsedInline) {
      return parsedInline;
    }
  }

  const base64Json = process.env.FIREBASE_ADMIN_SDK_JSON_BASE64 ?? process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? null;
  if (base64Json) {
    try {
      const decoded = Buffer.from(base64Json, "base64").toString("utf8");
      const parsedDecoded = parseServiceAccount(decoded);
      if (parsedDecoded) {
        return parsedDecoded;
      }
    } catch (error) {
      console.error("Failed to decode base64 Firebase Admin credentials. Falling back to other options.", error);
    }
  }

  const explicitPath = process.env.FIREBASE_ADMIN_SDK_PATH ?? process.env.GOOGLE_APPLICATION_CREDENTIALS ?? null;
  if (explicitPath) {
    // First try the path as provided (may be absolute or relative to CWD)
    let parsedExplicit = readServiceAccountFromFile(explicitPath);
    if (parsedExplicit) {
      return parsedExplicit;
    }

    // If not found, attempt resolving relative to the process CWD (useful when a relative
    // path is provided in env like "firebase-service-account.json")
    try {
      const resolvedCwd = path.resolve(process.cwd(), explicitPath);
      if (resolvedCwd !== explicitPath) {
        parsedExplicit = readServiceAccountFromFile(resolvedCwd);
        if (parsedExplicit) {
          return parsedExplicit;
        }
      }
    } catch (err) {
      // ignore
    }

    // Also try resolving relative to the repo root based on this file's directory.
    try {
      const resolvedRepo = path.resolve(__dirname, '..', '..', explicitPath);
      parsedExplicit = readServiceAccountFromFile(resolvedRepo);
      if (parsedExplicit) {
        return parsedExplicit;
      }
    } catch (err) {
      // ignore
    }

    console.warn(`Service account file not found at provided path: ${explicitPath}. Tried CWD and repo-relative locations.`);
  }

  // Fallback 1: Try a hardcoded local path
  const localPath = path.resolve(process.cwd(), "firebase-service-account.json");
  const fromLocalFile = readServiceAccountFromFile(localPath);
  if (fromLocalFile) {
    return fromLocalFile;
  }

  // Fallback 2: Try to get it from the runtime config in Firestore.
  // This is how the deployed app will get its credentials.
  const b64FromRuntime = await getRuntimeValue<string>("FIREBASE_ADMIN_SDK_JSON_BASE64");
  if (b64FromRuntime) {
    const decoded = Buffer.from(b64FromRuntime, "base64").toString("utf8");
    const parsed = parseServiceAccount(decoded);
    if (parsed) return parsed;
  }

  return null;
}

async function ensureAdminApp(): Promise<void> {
  if (admin.apps.length > 0) {
    return;
  }

  const serviceAccount = await resolveServiceAccount();

  const appOptions: AppOptions = {};
  if (serviceAccount) {
    appOptions.credential = admin.credential.cert(serviceAccount);
    appOptions.projectId = serviceAccount.projectId ?? serviceAccount.project_id;
  }

  if (!appOptions.projectId) {
    appOptions.projectId =
      process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? undefined;
  }

  if (process.env.FIREBASE_STORAGE_BUCKET) {
    appOptions.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  }

  try {
    admin.initializeApp(appOptions);
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK.", error);
    throw error;
  }
}

export async function getAdminDb(): Promise<Firestore> {
  if (db) {
    return db;
  }

  await ensureAdminApp();

  db = admin.firestore();
  globalForFirebase.__FIREBASE_ADMIN_DB__ = db;
  return db;
}

export async function getAdminApp(): Promise<App> {
  await ensureAdminApp();
  return admin.app();
}

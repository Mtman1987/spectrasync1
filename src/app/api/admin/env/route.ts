import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

function getExpectedSecret() {
  return process.env.BOT_SECRET_KEY ?? "";
}

function validateSecret(request: NextRequest) {
  const expected = getExpectedSecret();
  // If the server-side BOT_SECRET_KEY is not configured we fall back to
  // permissive mode: accept the request but log a warning. This is
  // intentionally permissive to allow ad-hoc uploads for dev/owner
  // convenience when you don't want to manage Cloud Run env vars.
  if (!expected) {
    // eslint-disable-next-line no-console
    console.warn('/api/admin/env: Server BOT_SECRET_KEY not configured; running in permissive mode');
    return { valid: true };
  }
  let provided = request.headers.get("x-bot-secret") ?? request.headers.get("authorization");
  if (!provided && request.method === "GET") {
    provided = request.nextUrl.searchParams.get("secret");
  }
  if (!provided) return { valid: false, reason: "No secret provided" };
  if (provided === expected) return { valid: true };
  if (provided.toLowerCase().startsWith("bearer ")) {
    const token = provided.slice(7).trim();
    if (token === expected) return { valid: true };
  }
  return { valid: false, reason: "Invalid secret" };
}

// Firestore doc path: app_settings/runtime (single document)
const CONFIG_DOC = "runtime";

export async function POST(request: NextRequest) {
  try {
    const secret = validateSecret(request);
    if (!secret.valid) {
      return NextResponse.json({ error: "Unauthorized", reason: secret.reason }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Accept either a root-wrapped object or a plain object of key/value pairs
    const payload = (body as Record<string, unknown>).root ?? (body as Record<string, unknown>);

    const toWrite: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      // Only allow string/number/boolean/null values to be set here
      if (
        v === null ||
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        toWrite[k] = v;
      }
    }

    if (Object.keys(toWrite).length === 0) {
      return NextResponse.json({ error: "No valid keys to write" }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection("app_settings").doc(CONFIG_DOC);
    await ref.set({ ...(toWrite as Record<string, unknown>), updatedAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({ status: "ok", written: Object.keys(toWrite) });
  } catch (error) {
    console.error("/api/admin/env error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const secret = validateSecret(request);
    if (!secret.valid) {
      return NextResponse.json({ error: "Unauthorized", reason: secret.reason }, { status: 401 });
    }

    const db = getAdminDb();
    const ref = db.collection("app_settings").doc(CONFIG_DOC);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({});
    }
    const data = doc.data() ?? {};
    return NextResponse.json(data as Record<string, unknown>);
  } catch (error) {
    console.error("/api/admin/env GET error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

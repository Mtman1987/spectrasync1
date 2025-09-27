'use server';
import { NextResponse, type NextRequest } from "next/server";

async function validateSecret(request: NextRequest) {
  // Skip Firebase operations during build
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return { valid: false, reason: "Not available during build" };
  }
  
  // Allow basic auth without runtime config during initial deployment
  if (!process.env.BOT_SECRET_KEY) {
    const provided = request.headers.get("x-bot-secret") ?? request.headers.get("authorization");
    if (provided === "temp-deploy-key") {
      return { valid: true };
    }
  }
  
  const { getRuntimeValue } = await import("@/lib/runtime-config");
  const expected = await getRuntimeValue<string>("BOT_SECRET_KEY", process.env.BOT_SECRET_KEY);
  if (!expected) {
    return { valid: false, reason: "Server BOT_SECRET_KEY not configured" };
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

const CONFIG_DOC = "runtime";

export async function POST(request: NextRequest) {
  try {
    const secret = await validateSecret(request);
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

    const payload = (body as Record<string, unknown>).root ?? (body as Record<string, unknown>);

    const toWrite: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
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

    const { getAdminDb } = await import("@/lib/firebase-admin");
    const db = await getAdminDb();
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
    const secret = await validateSecret(request);
    if (!secret.valid) {
      return NextResponse.json({ error: "Unauthorized", reason: secret.reason }, { status: 401 });
    }

    const { getAdminDb } = await import("@/lib/firebase-admin");
    const db = await getAdminDb();
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
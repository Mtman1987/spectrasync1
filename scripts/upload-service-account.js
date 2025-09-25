#!/usr/bin/env node
// scripts/upload-service-account.js
// Usage: node scripts/upload-service-account.js <serviceAccountPath>
// Reads a service account JSON, base64-encodes it, and writes it to Firestore
// under app_settings/runtime as FIREBASE_ADMIN_SDK_JSON_BASE64 (merge).

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

async function main() {
  const saPath = process.argv[2] || path.join(process.cwd(), 'firebase-service-account.json');
  if (!fs.existsSync(saPath)) {
    console.error('Service account file not found at', saPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(saPath, 'utf8');
  // initialize admin using the same service account
  const serviceAccount = require(path.resolve(saPath));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const b64 = Buffer.from(raw, 'utf8').toString('base64');

  console.log('Writing FIREBASE_ADMIN_SDK_JSON_BASE64 to Firestore (app_settings/runtime)');
  await db.collection('app_settings').doc('runtime').set({ FIREBASE_ADMIN_SDK_JSON_BASE64: b64, updatedAt: new Date().toISOString() }, { merge: true });
  console.log('Write complete');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

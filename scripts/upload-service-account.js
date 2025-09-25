#!/usr/bin/env node
// scripts/upload-service-account.js
// Usage: node scripts/upload-service-account.js <serviceAccountPath>
// Reads a service account JSON, base64-encodes it, and writes it to Firestore
// under app_settings/runtime as FIREBASE_ADMIN_SDK_JSON_BASE64 (merge).

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function initializeFirebaseAdmin(saPath) {
  if (saPath && fs.existsSync(saPath)) {
    console.log('Initializing with service account from path:', saPath);
    const serviceAccount = require(path.resolve(saPath));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return fs.readFileSync(saPath, 'utf8');
  }

  const saPathFromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (saPathFromEnv && fs.existsSync(saPathFromEnv)) {
    console.log('Initializing with service account from GOOGLE_APPLICATION_CREDENTIALS:', saPathFromEnv);
    const serviceAccount = require(path.resolve(saPathFromEnv));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return fs.readFileSync(saPathFromEnv, 'utf8');
  }

  console.error('Service account file not found.');
  console.error('Please provide a path or set the GOOGLE_APPLICATION_CREDENTIALS environment variable.');
  process.exit(1);
}

async function main() {
  const saPathArg = process.argv[2];
  const rawJson = initializeFirebaseAdmin(saPathArg);
  const db = admin.firestore();

  const b64 = Buffer.from(rawJson, 'utf8').toString('base64');

  console.log('Writing FIREBASE_ADMIN_SDK_JSON_BASE64 to Firestore (app_settings/runtime)');
  await db.collection('app_settings').doc('runtime').set({ FIREBASE_ADMIN_SDK_JSON_BASE64: b64, updatedAt: new Date().toISOString() }, { merge: true });
  console.log('Write complete');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

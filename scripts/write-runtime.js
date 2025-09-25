#!/usr/bin/env node
// scripts/write-runtime.js
// Usage: node scripts/write-runtime.js [path/to/.env] [path/to/service-account.json]
// If envPath omitted, defaults to ./.env
// If service account omitted, uses GOOGLE_APPLICATION_CREDENTIALS env var

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

async function main() {
  const envPath = process.argv[2] || path.join(process.cwd(), '.env');
  const serviceAccountPath = process.argv[3] || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!fs.existsSync(envPath)) {
    console.error('Env file not found at', envPath);
    process.exit(1);
  }

  if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
    console.error('Service account file not found. Provide path as second arg or set GOOGLE_APPLICATION_CREDENTIALS');
    process.exit(1);
  }

  console.log('Using env:', envPath);
  console.log('Using service account:', serviceAccountPath);

  const raw = fs.readFileSync(envPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const obj = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([^=]+)=(.*)$/);
    if (!m) continue;
    let k = m[1].trim();
    let v = m[2].trim();
    if (v.length >= 2) {
      const f = v[0];
      const l = v[v.length - 1];
      if ((f === '"' && l === '"') || (f === "'" && l === "'")) v = v.slice(1, -1);
    }
    if (/^(true|false)$/i.test(v)) v = v.toLowerCase() === 'true';
    obj[k] = v;
  }

  const serviceAccount = require(path.resolve(serviceAccountPath));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const toWrite = {}; // only primitives
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || ['string','number','boolean'].includes(typeof v)) {
      toWrite[k] = v;
    }
  }

  if (Object.keys(toWrite).length === 0) {
    console.error('No valid keys found in env to write');
    process.exit(1);
  }

  console.log('Writing keys:', Object.keys(toWrite));
  await db.collection('app_settings').doc('runtime').set({ ...toWrite, updatedAt: new Date().toISOString() }, { merge: true });
  console.log('Write complete');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

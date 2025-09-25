#!/usr/bin/env node
// scripts/read-runtime.js
// Usage: node scripts/read-runtime.js
// Reads app_settings/runtime document and prints JSON.

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// prefer base64 in runtime doc or GOOGLE_APPLICATION_CREDENTIALS in cwd
async function main() {
  // initialize admin using local file if present
  const localSa = path.join(process.cwd(), 'firebase-service-account.json');
  if (fs.existsSync(localSa)) {
    const sa = require(localSa);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    const sa = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    console.error('No local service account found; attempt to initialize application default credentials.');
    admin.initializeApp();
  }

  const db = admin.firestore();
  const doc = await db.collection('app_settings').doc('runtime').get();
  if (!doc.exists) {
    console.log('{}');
    return;
  }
  console.log(JSON.stringify(doc.data(), null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });

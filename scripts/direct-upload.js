const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../cosmic-raid-app-firebase-adminsdk-fbsvc-8b3d3a610d.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Read .env file
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#][^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    value = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    envVars[key] = value;
  }
});

// Upload to Firestore
async function upload() {
  try {
    await db.collection('app_settings').doc('runtime').set({
      ...envVars,
      updatedAt: new Date().toISOString()
    });
    console.log('✅ All environment variables uploaded to runtime config!');
    console.log(`📊 Uploaded ${Object.keys(envVars).length} variables`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Upload failed:', error);
    process.exit(1);
  }
}

upload();
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function debugPaths() {
    console.log("--- Scanning artifacts collection ---");
    const artifactsRef = db.collection('artifacts');
    const snapshot = await artifactsRef.listDocuments();

    if (snapshot.length === 0) {
        console.log("No documents found in 'artifacts' collection.");
    }

    for (const doc of snapshot) {
        console.log("Found APP_ID:", doc.id);
        const usersSnap = await doc.collection('users').listDocuments();
        for (const userDoc of usersSnap) {
            console.log(`  -> User UID: ${userDoc.id}`);
            const momentsCount = await userDoc.collection('moments').count().get();
            console.log(`     (Total Moments: ${momentsCount.data().count})`);
        }
    }
    process.exit(0);
}

debugPaths().catch(err => {
    console.error(err);
    process.exit(1);
});

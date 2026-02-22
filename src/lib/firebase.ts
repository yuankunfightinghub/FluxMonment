import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// --- Read runtime config injected by the hosting environment ---
declare global {
    interface Window {
        __firebase_config?: string;
        __app_id?: string;
    }
}

let app: FirebaseApp | null = null;

const rawConfig = typeof window !== 'undefined' ? window.__firebase_config : undefined;

if (rawConfig) {
    try {
        const firebaseConfig = JSON.parse(rawConfig);
        app = initializeApp(firebaseConfig);
    } catch (e) {
        console.error('[Firebase] Failed to parse __firebase_config:', e);
    }
} else {
    console.warn('[Firebase] __firebase_config not found — running in local-only mode.');
}

// Use __app_id from the environment if available, otherwise fall back to a default
export const APP_ID: string =
    (typeof window !== 'undefined' && window.__app_id) || 'fluxmoment-default';

// Auth and Firestore are only initialised when the Firebase app exists
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

// Enable offline persistence (IndexedDB) so writes survive network loss
if (db) {
    enableIndexedDbPersistence(db).catch((err: { code: string }) => {
        if (err.code === 'failed-precondition') {
            // Multiple tabs open — persistence only works in one tab at a time
            console.warn(
                '[Firebase] IndexedDB persistence failed: multiple tabs open. ' +
                'Offline writes will not be cached in this tab.',
            );
        } else if (err.code === 'unimplemented') {
            // Browser doesn't support required APIs
            console.warn(
                '[Firebase] IndexedDB persistence is not supported in this browser.',
            );
        } else {
            console.error('[Firebase] enableIndexedDbPersistence error:', err);
        }
    });
}

import { useEffect, useRef, useState } from 'react';
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User,
} from 'firebase/auth';
import {
    collection,
    doc,
    setDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, APP_ID } from '../lib/firebase';
import type { EventThread } from '../types';

const googleProvider = new GoogleAuthProvider();

/**
 * Manages Firebase Google auth + real-time Firestore sync.
 *
 * Returns:
 *  - threads:         live, time-descending list of EventThreads
 *  - user:            current Firebase User (null = not signed in)
 *  - isAuthChecked:   true once the initial auth state check completes
 *  - signInWithGoogle: trigger Google sign-in popup
 *  - signOut:         sign out the current user
 *  - addMoment:       persist AI-aggregated threads to Firestore
 */
export function useFirestoreSync() {
    const [threads, setThreads] = useState<EventThread[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [isAuthChecked, setIsAuthChecked] = useState(false);

    const unsubSnapshotRef = useRef<Unsubscribe | null>(null);

    // ── Auth listener ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!auth) {
            // Firebase not configured — local-only mode
            setIsAuthChecked(true);
            return;
        }

        const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setIsAuthChecked(true);

            if (firebaseUser) {
                attachListener(firebaseUser.uid);
            } else {
                // User signed out — tear down listener and clear cards
                unsubSnapshotRef.current?.();
                unsubSnapshotRef.current = null;
                setThreads([]);
            }
        });

        return () => {
            unsubAuth();
            unsubSnapshotRef.current?.();
        };
    }, []);

    // ── Firestore real-time listener ─────────────────────────────────────────
    function attachListener(uid: string) {
        if (!db) return;

        unsubSnapshotRef.current?.();

        const momentsCol = collection(db, 'artifacts', APP_ID, 'users', uid, 'moments');
        const q = query(momentsCol, orderBy('lastUpdatedAt', 'desc'));

        const unsub = onSnapshot(
            q,
            (snapshot) => {
                const loaded: EventThread[] = snapshot.docs.map((d) => {
                    const data = d.data();
                    return {
                        id: d.id,
                        title: data.title ?? '',
                        category: data.category ?? { name: '', theme: 'neutral' },
                        tags: data.tags ?? [],
                        entries: data.entries ?? [],
                        lastUpdatedAt: data.lastUpdatedAt ?? 0,
                    } as EventThread;
                });
                setThreads(loaded);
            },
            (error) => {
                console.error('[Firebase] onSnapshot error:', error);
            },
        );

        unsubSnapshotRef.current = unsub;
    }

    // ── Auth actions ─────────────────────────────────────────────────────────
    async function signInWithGoogle() {
        if (!auth) return;
        try {
            await signInWithPopup(auth, googleProvider);
            // onAuthStateChanged fires automatically after sign-in
        } catch (e) {
            console.error('[Firebase] Google sign-in failed:', e);
        }
    }

    async function signOut() {
        if (!auth) return;
        try {
            await firebaseSignOut(auth);
        } catch (e) {
            console.error('[Firebase] Sign-out failed:', e);
        }
    }

    // ── Write ────────────────────────────────────────────────────────────────
    /**
     * 乐观更新策略：
     *  1. 立刻将 updatedThreads 写入本地 state（卡片立刻出现）
     *  2. 若已登录，异步写入 Firestore（onSnapshot 会二次确认）
     */
    async function addMoment(updatedThreads: EventThread[]) {
        // Optimistic UI — always update local state immediately
        const sorted = [...updatedThreads].sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
        setThreads(sorted);

        const uid = user?.uid;
        if (!db || !uid) return;

        const momentsCol = collection(db, 'artifacts', APP_ID, 'users', uid, 'moments');

        const writes = updatedThreads.map((thread) => {
            const ref = doc(momentsCol, thread.id);
            return setDoc(ref, {
                title: thread.title,
                category: thread.category,
                tags: thread.tags,
                entries: thread.entries,
                lastUpdatedAt: thread.lastUpdatedAt,
                _syncedAt: serverTimestamp(),
            }).catch((e) => {
                console.error(`[Firebase] setDoc failed for thread ${thread.id}:`, e);
            });
        });

        await Promise.all(writes);
    }

    return { threads, user, isAuthChecked, signInWithGoogle, signOut, addMoment };
}

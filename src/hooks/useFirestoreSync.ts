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
    getDocs,
    deleteDoc,
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
 *  - deleteMoment:    permanently delete a thread and its storage attachments
 *  - clearAllMoments: delete all moments from Firestore for the current user
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
                        mood: data.mood ?? 'calm',
                        avatarVariant: data.avatarVariant ?? 0,
                        // 这里的映射漏掉了 Embedding，导致前端拿不到云端向量
                        embedding: data.embedding ?? [],
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
            const dataToSave: any = {
                title: thread.title,
                category: thread.category,
                tags: thread.tags,
                entries: thread.entries,
                lastUpdatedAt: thread.lastUpdatedAt,
                mood: thread.mood ?? 'calm',
                avatarVariant: thread.avatarVariant ?? 0,
                _syncedAt: serverTimestamp(),
            };

            // 安全追加 Embedding 字段
            if (thread.embedding && thread.embedding.length > 0) {
                // 有些较新版的 Firebase SDK 推荐使用 vector(array)
                // 但目前直接存放 number 数组在大量场景下也是符合预期的。
                dataToSave.embedding = thread.embedding;
            }

            return setDoc(ref, dataToSave).catch((e) => {
                console.error(`[Firebase] setDoc failed for thread ${thread.id}:`, e);
            });
        });

        await Promise.all(writes);
    }

    async function deleteMoment(threadId: string, thread: EventThread) {
        const uid = user?.uid;
        if (!db || !uid) return;

        // Optimistic delete
        setThreads(prev => prev.filter(t => t.id !== threadId));

        try {
            // 1. Delete all attached media from Storage
            const { deleteMedia } = await import('../lib/storage');
            const mediaTasks = thread.entries.flatMap(e =>
                (e.attachments ?? []).map(att => deleteMedia(att.url))
            );
            if (mediaTasks.length > 0) {
                await Promise.all(mediaTasks);
            }

            // 2. Delete the Firestore document
            const momentsCol = collection(db, 'artifacts', APP_ID, 'users', uid, 'moments');
            await deleteDoc(doc(momentsCol, threadId));
        } catch (e) {
            console.error(`[Firebase] Failed to delete moment ${threadId}:`, e);
            // In a real app we might revert the optimistic update here.
        }
    }

    async function clearAllMoments() {
        const uid = user?.uid;
        if (!db || !uid) return;

        const momentsCol = collection(db, 'artifacts', APP_ID, 'users', uid, 'moments');
        try {
            const snap = await getDocs(momentsCol);
            const deletions = snap.docs.map((d) => deleteDoc(d.ref));
            await Promise.all(deletions);
            setThreads([]); // Optimistically clear local state
        } catch (e) {
            console.error('[Firebase] clearAllMoments failed:', e);
        }
    }

    return { threads, user, isAuthChecked, signInWithGoogle, signOut, addMoment, deleteMoment, clearAllMoments };
}

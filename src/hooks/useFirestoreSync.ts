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
const LOCAL_STORAGE_KEY = `fluxmoment_local_moments_${APP_ID}`;

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
            const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (localData) {
                try {
                    setThreads(JSON.parse(localData));
                } catch (e) {
                    console.error('[LocalStorage] Failed to parse:', e);
                }
            }
            setIsAuthChecked(true);
            return;
        }

        const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setIsAuthChecked(true);

            if (firebaseUser) {
                // 登录后，尝试将本地数据同步到云端
                const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (localData) {
                    try {
                        const localThreads: EventThread[] = JSON.parse(localData);
                        if (localThreads.length > 0) {
                            console.log('[Auth] Syncing local moments to cloud...');
                            syncLocalToCloud(firebaseUser.uid, localThreads);
                            // 同步后清除本地缓存，防止重复同步
                            localStorage.removeItem(LOCAL_STORAGE_KEY);
                        }
                    } catch (e) {
                        console.error('[Auth] Local sync failed:', e);
                    }
                }
                attachListener(firebaseUser.uid);
            } else {
                // User signed out — tear down listener and clear cards
                unsubSnapshotRef.current?.();
                unsubSnapshotRef.current = null;

                // 加载本地缓存数据
                const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (localData) {
                    try {
                        setThreads(JSON.parse(localData));
                    } catch (e) {
                        setThreads([]);
                    }
                } else {
                    setThreads([]);
                }
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

    // ── Internal Sync ────────────────────────────────────────────────────────
    async function syncLocalToCloud(uid: string, localThreads: EventThread[]) {
        if (!db) return;
        const momentsCol = collection(db, 'artifacts', APP_ID, 'users', uid, 'moments');

        // 遍历本地数据写入云端
        const writes = localThreads.map(thread => {
            const ref = doc(momentsCol, thread.id);
            return setDoc(ref, {
                ...thread,
                _syncedFromLocalAt: serverTimestamp()
            });
        });
        await Promise.all(writes);
        console.log(`[Auth] Sync completed: ${localThreads.length} moments moved.`);
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

    /**
     * 极简加固版存储：负责将最新的 threads 集合持久化。
     *  1. 保证 LocalStorage 绝对同步，优先于任何异步网络。
     *  2. 隔离 Firestore 写入，防止主流程受阻。
     */
    async function addMoment(updatedThreads: EventThread[]) {
        try {
            // 对齐数据
            const sorted = [...updatedThreads].sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
            
            // 1. 本地冷备 (最高优先级同步写入，防刷新)
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sorted));
            
            // 2. 内存更新
            setThreads(sorted);

            const uid = user?.uid;
            if (!uid || !db) return;

            // 3. 异步云端增量/全量同步
            const momentsCol = collection(db, 'artifacts', APP_ID, 'users', uid, 'moments');
            
            // 只写入受影响或全量，Firebase 本身具有离线支持，可以放心在 Promise.all 中跑
            const writes = updatedThreads.map(thread => {
                const ref = doc(momentsCol, thread.id);
                const { id, ...dataToSave } = thread; // 排除 ID 字段以防冲突
                return setDoc(ref, { 
                    ...dataToSave, 
                    _syncedAt: serverTimestamp() 
                }, { merge: true }); // 使用 merge 模式更加安全
            });

            await Promise.all(writes);
            console.info('[Storage] 数据库持久化成功');
        } catch (e) {
            console.error('[Storage] 持久化失败:', e);
            throw e; // 抛出异常让 handleSubmit 捕获
        }
    }

    async function deleteMoment(threadId: string, thread: EventThread) {
        const uid = user?.uid;

        // Optimistic delete
        const remainingThreads = threads.filter(t => t.id !== threadId);
        setThreads(remainingThreads);

        if (!uid) {
            // Not logged in — update local storage
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remainingThreads));
            return;
        }

        if (!db) return;

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

        if (!uid) {
            // Not logged in — clear local storage
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setThreads([]);
            return;
        }

        if (!db) return;

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

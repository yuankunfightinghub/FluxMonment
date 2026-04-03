import { useEffect, useRef, useState } from 'react';
import {
    GoogleAuthProvider,
    getRedirectResult,
    signInWithRedirect,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User,
} from 'firebase/auth';
import {
    doc,
    setDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    getDocs,
    deleteDoc,
} from 'firebase/firestore';
import { auth, db, APP_ID, LEGACY_APP_IDS, getCollectionRef } from '../lib/firebase';
import type { EventThread, EndOfDayTask } from '../types';
const LOCAL_STORAGE_KEY = `fluxmoment_local_moments_${APP_ID}`;

const googleProvider = new GoogleAuthProvider();

/**
 * Manages Firebase Google auth + real-time Firestore sync.
 */
export function useFirestoreSync() {
    const [threads, setThreads] = useState<EventThread[]>([]);
    const [dailyTasksMap, setDailyTasksMap] = useState<Record<string, EndOfDayTask[]>>({});
    const [user, setUser] = useState<User | null>(null);
    const [isAuthChecked, setIsAuthChecked] = useState(false);

    const unsubSnapshotRef = useRef<(() => void) | null>(null);
    const recoveredUsersRef = useRef<Set<string>>(new Set());

    // ── Auth listener ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!auth) {
            setIsAuthChecked(true);
            return;
        }

        // 处理重定向登录结果
        getRedirectResult(auth).catch(e => console.error('[Auth] Redirect result error:', e));

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
                            syncLocalToCloud(firebaseUser.uid, localThreads)
                                .then(() => {
                                    // 同步成功后清除本地缓存，防止丢失数据或重复同步
                                    localStorage.removeItem(LOCAL_STORAGE_KEY);
                                    console.log('[Auth] Local sync fully completed.');
                                })
                                .catch(err => {
                                    console.error('[Auth] Local sync failed during upload:', err);
                                });
                        }
                    } catch (e) {
                        console.error('[Auth] Local sync parse failed:', e);
                    }
                }
                void recoverLegacyMoments(firebaseUser.uid);
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

        const momentsCol = getCollectionRef(db, APP_ID, uid, 'moments');
        const tasksCol = getCollectionRef(db, APP_ID, uid, 'daily_tasks');

        const q = query(momentsCol, orderBy('lastUpdatedAt', 'desc'));

        const unsubMoments = onSnapshot(
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
                        embedding: data.embedding ?? [],
                    } as EventThread;
                });
                setThreads(loaded);
            },
            (error) => {
                console.error('[Firebase] Moments onSnapshot error:', error);
            },
        );

        const unsubTasks = onSnapshot(
            tasksCol,
            (snapshot) => {
                const tasksUpdate: Record<string, EndOfDayTask[]> = {};
                snapshot.docs.forEach(d => {
                    tasksUpdate[d.id] = d.data().tasks || [];
                });
                setDailyTasksMap(tasksUpdate);
                console.log('[Firebase] Daily tasks updated from cloud.');
            }
        );

        unsubSnapshotRef.current = () => {
            unsubMoments();
            unsubTasks();
        };
    }

    // ── Internal Sync ────────────────────────────────────────────────────────
    async function syncLocalToCloud(uid: string, localThreads: EventThread[]) {
        if (!db) return;
        const momentsCol = getCollectionRef(db, APP_ID, uid, 'moments');

        // 遍历本地数据写入云端
        const writes = localThreads.map(thread => {
            const ref = doc(momentsCol, thread.id);
            const { id, ...dataToSave } = thread; // Exclude id strictly
            return setDoc(ref, {
                ...dataToSave,
                _syncedFromLocalAt: serverTimestamp()
            }, { merge: true });
        });
        await Promise.all(writes);
        console.log(`[Auth] Sync completed: ${localThreads.length} moments moved.`);
    }

    async function recoverLegacyMoments(uid: string) {
        if (!db || recoveredUsersRef.current.has(uid)) return;

        recoveredUsersRef.current.add(uid);

        const canonicalMomentsCol = getCollectionRef(db, APP_ID, uid, 'moments');
        const aliases = LEGACY_APP_IDS.filter(candidate => candidate !== APP_ID);

        try {
            for (const legacyAppId of aliases) {
                const legacyMomentsCol = getCollectionRef(db, legacyAppId, uid, 'moments');
                const legacySnap = await getDocs(legacyMomentsCol);

                if (legacySnap.empty) continue;

                console.warn(
                    `[Recovery] Found ${legacySnap.size} legacy moments under APP_ID=${legacyAppId}. Migrating to ${APP_ID}.`,
                );

                const writes = legacySnap.docs.map((legacyDoc) =>
                    setDoc(doc(canonicalMomentsCol, legacyDoc.id), {
                        ...legacyDoc.data(),
                        _recoveredFromAppId: legacyAppId,
                        _recoveredAt: serverTimestamp(),
                    }, { merge: true }),
                );

                await Promise.all(writes);
            }
        } catch (e) {
            console.error('[Recovery] Legacy moments recovery failed:', e);
        }
    }

    // ── Auth actions ─────────────────────────────────────────────────────────
    async function signInWithGoogle() {
        if (!auth) return;
        try {
            await signInWithRedirect(auth, googleProvider);
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
     */
    async function addMoment(updatedThreads: EventThread[]) {
        try {
            const sorted = [...updatedThreads].sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sorted));
            setThreads(sorted);

            const uid = user?.uid;
            if (!uid || !db) return;

            const momentsCol = getCollectionRef(db, APP_ID, uid, 'moments');
            const writes = updatedThreads.map(thread => {
                const ref = doc(momentsCol, thread.id);
                const { id, ...dataToSave } = thread;
                return setDoc(ref, { 
                    ...dataToSave, 
                    _syncedAt: serverTimestamp() 
                }, { merge: true });
            });

            await Promise.all(writes);
            console.info('[Storage] moments saved to firestore');
        } catch (e) {
            console.error('[Storage] addMoment failed:', e);
        }
    }

    /**
     * 持久化某一天的 Task 集合
     */
    async function saveDailyTasks(dateStr: string, tasks: EndOfDayTask[]) {
        const uid = user?.uid;
        if (uid && db) {
            const docRef = doc(getCollectionRef(db, APP_ID, uid, 'daily_tasks'), dateStr);
            try {
                await setDoc(docRef, { tasks, updatedAt: serverTimestamp() }, { merge: true });
                console.info(`[Storage] 任务保存成功 (${dateStr})`);
            } catch (e) {
                console.error(`[Storage] 云端同步任务失败 (${dateStr}):`, e);
            }
        }
    }

    async function deleteMoment(threadId: string, thread: EventThread) {
        const uid = user?.uid;
        const remainingThreads = threads.filter(t => t.id !== threadId);
        setThreads(remainingThreads);

        if (!uid) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remainingThreads));
            return;
        }

        if (!db) return;

        try {
            const { deleteMedia } = await import('../lib/storage');
            const mediaTasks = thread.entries.flatMap(e =>
                (e.attachments ?? []).map(att => deleteMedia(att.url))
            );
            if (mediaTasks.length > 0) await Promise.all(mediaTasks);

            const momentsCol = getCollectionRef(db, APP_ID, uid, 'moments');
            await deleteDoc(doc(momentsCol, threadId));
        } catch (e) {
            console.error(`[Firebase] Failed to delete moment ${threadId}:`, e);
        }
    }

    async function clearAllMoments() {
        const uid = user?.uid;
        if (!uid) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setThreads([]);
            return;
        }

        if (!db) return;
        const momentsCol = getCollectionRef(db, APP_ID, uid, 'moments');
        try {
            const snap = await getDocs(momentsCol);
            const deletions = snap.docs.map((d) => deleteDoc(d.ref));
            await Promise.all(deletions);
            setThreads([]); // Optimistically clear local state
        } catch (e) {
            console.error('[Firebase] clearAllMoments failed:', e);
        }
    }

    return { threads, dailyTasksMap, user, isAuthChecked, signInWithGoogle, signOut, addMoment, saveDailyTasks, deleteMoment, clearAllMoments };
}

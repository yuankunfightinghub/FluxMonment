import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

import './App.css';
import { Greeting } from './components/Greeting';
import { InputCapsule, type PendingMedia } from './components/InputCapsule';
import { MomentStream } from './components/MomentStream';
import { ViewTabs, type TabValue } from './components/ViewTabs';
import { DailyMemory } from './components/DailyMemory';
import { ExampleCards } from './components/ExampleCards';
import { processAndAggregateInput, predictTopicTheme, detectUserIntent, generateEmbedding, generateDailySummary } from './utils/classificationEngine';
import { useFirestoreSync } from './hooks/useFirestoreSync';
import { uploadMedia } from './lib/storage';
import { isSameDay, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { EventCategory, MediaAttachment, EventThread } from './types';
import { Search, X } from 'lucide-react';

function App() {
  const { threads, user, isAuthChecked, signInWithGoogle, signOut, addMoment, deleteMoment, clearAllMoments } = useFirestoreSync();

  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<EventCategory['theme'] | 'neutral'>('neutral');
  const [submittedTheme, setSubmittedTheme] = useState<EventCategory['theme'] | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('moments');
  const [searchResults, setSearchResults] = useState<{ thread: EventThread; similarity: number }[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [memoryDate, setMemoryDate] = useState(new Date());

  // ── Media state ────────────────────────────────────────────────────────────
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);

  // Expose clear tool to the user console for dev purposes
  useEffect(() => {
    (window as any).clearTestData = async () => {
      console.log("Clearing all moments from Firestore...");
      await clearAllMoments();
      console.log("Database cleared! Happy testing. ✨");
    };

    (window as any).backfillEmbeddings = async () => {
      console.log("开始历史数据向量化（Backfill Embedding）...");
      const updated = [...threads];
      let i = 0;
      for (const thread of updated) {
        if (!thread.embedding || thread.embedding.length === 0) {
          console.log(`正在为卡片 [${thread.title}] 生成向量...`);
          const fullText = thread.entries.map(e => e.content).join('\n');
          const emb = await generateEmbedding(fullText);
          if (emb.length > 0) {
            thread.embedding = emb;
            i++;
          }
        }
      }
      if (i > 0) {
        console.log(`生成完毕，共新增 ${i} 条向量记录，正在写回 Firestore...`);
        await addMoment(updated);
        console.log("写回完成！");
      } else {
        console.log("所有的卡片都已经有向量，无需回填。");
      }
    };

    return () => {
      delete (window as any).clearTestData;
      delete (window as any).backfillEmbeddings;
    };
  }, [clearAllMoments, addMoment, threads]);

  useEffect(() => {
    if (inputValue.trim()) {
      setCurrentTheme(predictTopicTheme(inputValue));
    } else {
      setCurrentTheme('neutral');
    }
  }, [inputValue]);

  // ── Handle new files (paste or picker) ────────────────────────────────────
  const handleFilesAdded = useCallback((files: File[]) => {
    const newItems: PendingMedia[] = files.map(file => ({
      id: uuidv4(),
      file,
      localUrl: URL.createObjectURL(file),
      type: file.type.startsWith('image/') ? 'image' : 'video',
      uploading: true,
    }));

    setPendingMedia(prev => [...prev, ...newItems]);

    // Upload each file; update state when done
    newItems.forEach(async (pm) => {
      try {
        const uid = user?.uid;
        if (!uid) {
          // Not logged in — keep local preview only (no cloud upload)
          setPendingMedia(prev => prev.map(p =>
            p.id === pm.id ? { ...p, uploading: false } : p,
          ));
          return;
        }
        const attachment = await uploadMedia(pm.file, uid);
        setPendingMedia(prev => prev.map(p =>
          p.id === pm.id ? { ...p, uploading: false, uploaded: attachment } : p,
        ));
      } catch (e) {
        console.error('[App] uploadMedia failed:', e);
        setPendingMedia(prev => prev.map(p =>
          p.id === pm.id ? { ...p, uploading: false, error: String(e) } : p,
        ));
      }
    });
  }, [user]);

  const handleRemoveMedia = useCallback((id: string) => {
    setPendingMedia(prev => {
      const item = prev.find(p => p.id === id);
      if (item) URL.revokeObjectURL(item.localUrl);
      return prev.filter(p => p.id !== id);
    });
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const hasText = inputValue.trim();
    const hasMedia = pendingMedia.length > 0;
    if ((!hasText && !hasMedia) || isProcessing) return;

    // Wait for any in-flight uploads before submitting
    const stillUploading = pendingMedia.some(pm => pm.uploading);
    if (stillUploading) return;

    // --- 强制登录拦截逻辑 ---
    // 只要用户未登录，在提交时即刻弹出登录框
    if (!user) {
      console.log('Intercepting submit: User must log in.');
      await signInWithGoogle();
      return;
    }

    setIsProcessing(true);
    const content = inputValue.trim();

    // Collect finalised attachments (uploaded → use cloud URL, else local URL)
    const attachments: MediaAttachment[] = pendingMedia.map(pm => (
      pm.uploaded ?? { url: pm.localUrl, type: pm.type, name: pm.file.name }
    ));

    try {
      const tStart = performance.now();
      console.log('--- 🚀 提交流程开始 ---');

      // 1. 意图极速推断与属性提取合二为一
      const t0 = performance.now();
      const intentAnalysis = await detectUserIntent(content, threads);
      const t1 = performance.now();
      console.log(`[耗时分析] 1. detectUserIntent (合并判别+属性抽取): ${(t1 - t0).toFixed(2)} ms`);

      if (intentAnalysis.intent === 'SEARCH') {
        const { query: aiQuery, tags, keywords } = intentAnalysis;
        const query = aiQuery || content;

        console.log(`🎯 命中搜索意图！`);
        console.log(` - 语义查询: ${query}`);
        if (tags?.length) console.log(` - 标签过滤: ${tags.join(', ')}`);
        if (keywords?.length) console.log(` - 关键词匹配: ${keywords.join(', ')}`);

        setSearchQuery(query);

        // 获取语义向量
        const queryEmb = await (query.trim() ? generateEmbedding(query) : Promise.resolve([]));

        // 执行混合动力搜索
        const { performHybridSearch } = await import('./utils/classificationEngine');
        const matches = await performHybridSearch(
          queryEmb,
          threads,
          { query, tags, keywords },
          15 // maxResults
        );

        setSearchResults(matches);
        setIsSearchMode(true);
        setActiveTab('moments');
        setIsProcessing(false);
        return;
      }

      // 2. 如果不是搜索，继续跑生成卡片的流程 (RECORD)
      const t2 = performance.now();
      const { updatedThreads, highlightThreadId, fullTextToEmbed } = await processAndAggregateInput(
        content,
        threads,
        intentAnalysis as any,
        attachments.length > 0 ? attachments : undefined,
      );
      const t3 = performance.now();
      console.log(`[耗时分析] 2. processAndAggregateInput (包含归类分析 + 向量生成): ${(t3 - t2).toFixed(2)} ms`);

      const t4 = performance.now();
      await addMoment(updatedThreads);
      const t5 = performance.now();
      console.log(`[耗时分析] 3. addMoment (同步到 Firestore): ${(t5 - t4).toFixed(2)} ms`);

      const tEnd = performance.now();
      console.log(`[耗时分析] === 提交并完成预处理的总耗时: ${(tEnd - tStart).toFixed(2)} ms ===`);

      setInputValue('');
      // Release object URLs
      pendingMedia.forEach(pm => URL.revokeObjectURL(pm.localUrl));
      setPendingMedia([]);

      // 优化3: 针对当前插入的这条 Thread 后台异步提取 Embedding
      generateEmbedding(fullTextToEmbed).then(async (embedding) => {
          if (embedding && embedding.length > 0) {
              const finalThreads = updatedThreads.map(t => 
                  t.id === highlightThreadId ? { ...t, embedding } : t
              );
              await addMoment(finalThreads);
              console.log('[Perf] 后台异步生成、保存 Embedding 完毕');
          }
      }).catch(e => console.error('[Perf] Async embedding 失败:', e));

      // 优化1补充: 后台异步静默拉取 DailyMemory 的总结，使其缓存到本地。
      // 如此做到 2 个分开的异步事务，且当用户后面切过去时，可以直接读缓存秒开。
      const today = new Date();
      const dateContextStr = format(today, 'yyyy年MM月dd日', { locale: zhCN });
      const todayThreadsBg = updatedThreads.filter(t => isSameDay(t.lastUpdatedAt, today));
      
      const threadCount = todayThreadsBg.length;
      const latestUpdate = todayThreadsBg.length > 0 ? Math.max(...todayThreadsBg.map(t => t.lastUpdatedAt)) : 0;
      const cacheFingerprint = `${threadCount}_${latestUpdate}`;
      const cacheKey = `daily_memory_${dateContextStr}`;

      generateDailySummary(todayThreadsBg, dateContextStr).then(result => {
          localStorage.setItem(cacheKey, JSON.stringify({
              fingerprint: cacheFingerprint,
              data: result
          }));
          console.log('[Perf] 后台异步静默写入 DailyMemory 新缓存完毕');
      }).catch(e => console.error('[Perf] Background DailyMemory 预热失败:', e));

      // --- RECORD 成功后：强制退出搜索模式，切回主流 ---
      setIsSearchMode(false);
      setSearchQuery('');
      setSearchResults([]);
      setActiveTab('moments');

      const activeThread = updatedThreads.find(t => t.id === highlightThreadId);
      if (activeThread) setSubmittedTheme(activeThread.category.theme);

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSubmittedTheme(null);
      }, 2000);
    } catch (e) {
      console.error('[App] handleSubmit error:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteEntry = async (threadId: string, entryId: string) => {
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;

    // Filter out the specific entry
    const updatedEntries = thread.entries.filter(e => e.id !== entryId);

    if (updatedEntries.length === 0) {
      // If no entries left, delete the entire thread
      await deleteMoment(threadId, thread);
    } else {
      // Otherwise, update the thread with the remaining entries
      const updatedThread = { ...thread, entries: updatedEntries };
      const updatedThreads = threads.map(t => t.id === threadId ? updatedThread : t);

      // Optimistic upate the local state
      // useFirestoreSync's addMoment already handles optimistic update and syncing
      await addMoment(updatedThreads);

      // Clean up storage for the deleted entry's attachments
      const deletedEntry = thread.entries.find(e => e.id === entryId);
      if (deletedEntry && deletedEntry.attachments && deletedEntry.attachments.length > 0) {
        const { deleteMedia } = await import('./lib/storage');
        await Promise.all(deletedEntry.attachments.map(att => deleteMedia(att.url)));
      }
    }
  };

  const isHoliday = new Date().getMonth() === 11 && new Date().getDate() === 25;
  const activeCategory = showSuccess && submittedTheme ? submittedTheme : currentTheme;

  if (!isAuthChecked) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-page)',
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>正在连接…</span>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8vh 24px 60px',
      background: 'var(--bg-page)',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: '1px',
        background: 'var(--border-default)',
        zIndex: 100,
      }} />

      {/* Auth widget */}
      <div style={{
        position: 'fixed',
        top: '14px',
        right: '20px',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        {user ? (
          <>
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? '用户'}
                title={user.displayName ?? user.email ?? ''}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: '1.5px solid var(--border-default)',
                  objectFit: 'cover', cursor: 'default',
                }}
              />
            ) : (
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'var(--color-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', color: '#fff', fontWeight: 600,
              }}>
                {(user.displayName ?? user.email ?? '?')[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={signOut}
              style={{
                fontSize: '12px', color: 'var(--text-muted)',
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
              }}
            >退出</button>
          </>
        ) : (
          <button
            onClick={signInWithGoogle}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '6px 14px', borderRadius: '8px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-card)', color: 'var(--text-default)',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              transition: 'box-shadow 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)')}
          >
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
            </svg>
            使用 Google 登录
          </button>
        )}
      </div>

      {/* Content column */}
      <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Greeting
          isFocused={isFocused}
          category={activeCategory}
          isHoliday={isHoliday}
          showSuccess={showSuccess}
        />

        <div style={{ width: '100%', marginBottom: '24px' }}>
          <InputCapsule
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            isFocused={isFocused}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            category={activeCategory}
            showSuccess={showSuccess}
            isLoading={isProcessing}
            pendingMedia={pendingMedia}
            onFilesAdded={handleFilesAdded}
            onRemoveMedia={handleRemoveMedia}
          />
        </div>

        {/* 仅在登录后显示控制 Tabs */}
        {user && <ViewTabs activeTab={activeTab} onTabChange={setActiveTab} />}
      </div>

      {/* 未登录时展示精选示例卡片 */}
      {!user && <ExampleCards />}

      {/* Moment stream */}
      <div style={{ width: '100%', maxWidth: '1200px' }}>
        {!user && isAuthChecked ? (
          <div style={{
            width: '100%', maxWidth: '600px',
            margin: '48px auto 0', textAlign: 'center',
            color: 'var(--text-muted)',
          }}>
            <p style={{ fontSize: '14px', lineHeight: 1.6 }}>
              登录后你的瞬间将跨设备同步 ☁️
            </p>
          </div>
        ) : isSearchMode ? (
          <div style={{ padding: '0 20px' }}>
            {/* Search Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              maxWidth: '800px',
              margin: '0 auto 24px auto',
              padding: '16px 20px',
              background: 'rgba(var(--color-primary-rgb), 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(var(--color-primary-rgb), 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'var(--color-primary)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: 'white',
                  flexShrink: 0
                }}>
                  <Search size={18} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-strong)',
                    display: 'flex',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}>
                    <span>“</span>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '300px'
                    }}>
                      {searchQuery}
                    </span>
                    <span>” 的检索结果</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    找到 {searchResults.length} 条相关记忆
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsSearchMode(false);
                  setSearchResults([]);
                  setInputValue('');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: '1px solid var(--border-default)',
                  background: 'white',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--text-default)'
                }}
              >
                <X size={14} /> 退出搜索
              </button>
            </div>

            <MomentStream
              threads={searchResults.map(r => r.thread)}
              onDelete={deleteMoment}
              onDeleteEntry={deleteEntry}
              isSearchMode={true}
            />

            {searchResults.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)',
                fontSize: '14px'
              }}>
                没有搜到相关记忆，换个说法试试？
              </div>
            )}
          </div>
        ) : activeTab === 'moments' ? (
          <MomentStream
            threads={threads}
            onDelete={deleteMoment}
            onDeleteEntry={deleteEntry}
          />
        ) : (
          <DailyMemory
            selectedDate={memoryDate}
            onDateChange={setMemoryDate}
            todayThreads={threads.filter(t => isSameDay(t.lastUpdatedAt, memoryDate))}
            onDeleteEntry={deleteEntry}
          />
        )}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        paddingTop: '40px',
        paddingBottom: '10px',
        fontSize: '13px',
        color: 'var(--text-muted)',
        textAlign: 'center',
        fontFamily: 'Inter, sans-serif',
        opacity: 0.5,
      }}>
        ©️2026xxx
      </div>
    </div>
  );
}

export default App;

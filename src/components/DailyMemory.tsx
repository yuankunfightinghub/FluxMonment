import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Plus, RefreshCw } from 'lucide-react';
import type { EventThread, DailyMemoryData, TimelineEntry, EndOfDayTask } from '../types';
import { generateDailySummary } from '../utils/classificationEngine';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { MediaMosaic } from './MediaMosaic';

interface DailyMemoryProps {
    todayThreads: EventThread[];
}

export const DailyMemory: React.FC<DailyMemoryProps> = ({ todayThreads }) => {
    const [data, setData] = useState<DailyMemoryData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [tasks, setTasks] = useState<EndOfDayTask[]>([]);
    const [newTaskText, setNewTaskText] = useState('');

    const now = new Date();
    const bigDay = format(now, 'dd');
    const monthYear = format(now, 'MMM yyyy');
    const dateContext = format(now, 'yyyy年MM月dd日', { locale: zhCN });

    // Generate a fingerprint based on today's threads
    const threadCount = todayThreads.length;
    const latestUpdate = todayThreads.length > 0
        ? Math.max(...todayThreads.map(t => t.lastUpdatedAt))
        : 0;
    const cacheKey = `daily_memory_${dateContext}`;
    const cacheFingerprint = `${threadCount}_${latestUpdate}`;

    const fetchSummary = async (forceRefresh = false) => {
        setIsLoading(true);
        try {
            // Check cache
            if (!forceRefresh) {
                const cachedRaw = localStorage.getItem(cacheKey);
                if (cachedRaw) {
                    const parsedCache = JSON.parse(cachedRaw);
                    if (parsedCache.fingerprint === cacheFingerprint && parsedCache.data) {
                        setData(parsedCache.data);
                        setTasks(parsedCache.data.tasks || []);
                        setIsLoading(false);
                        return;
                    }
                }
            }

            // Fetch from LLM
            const result = await generateDailySummary(todayThreads, dateContext);

            // Save to cache
            localStorage.setItem(cacheKey, JSON.stringify({
                fingerprint: cacheFingerprint,
                data: result
            }));

            setData(result);
            setTasks(result.tasks || []);
        } catch (err) {
            console.error('Failed to load daily summary:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;

        async function load() {
            await fetchSummary();
        }

        if (isMounted) {
            load();
        }

        return () => { isMounted = false; };
    }, [todayThreads, dateContext, cacheFingerprint]);

    const handleManualRefresh = () => {
        fetchSummary(true);
    };

    // Flatten timeline for Part 3
    const timelineItems = useMemo(() => {
        const items: { entry: TimelineEntry; thread: EventThread }[] = [];
        todayThreads.forEach(t => {
            t.entries.forEach(e => items.push({ entry: e, thread: t }));
        });
        return items.sort((a, b) => a.entry.timestamp - b.entry.timestamp);
    }, [todayThreads]);

    const toggleTask = (id: string) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
    };

    const addTask = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && newTaskText.trim()) {
            setTasks(prev => [...prev, {
                id: Math.random().toString(36).slice(2),
                content: newTaskText.trim(),
                isCompleted: false
            }]);
            setNewTaskText('');
        }
    };

    // Vertical Node Component (Hover Expandable)
    const TimelineVerticalNode = ({ item }: { item: { entry: TimelineEntry; thread: EventThread } }) => {
        const [isHovered, setIsHovered] = useState(false);
        const timeStr = new Date(item.entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

        // Work = Black, Life = Orange
        const isWork = item.thread.category.theme === 'cyber-blue';
        const themeColor = isWork ? '#050505' : '#d35400';

        const hasMedia = item.entry.attachments && item.entry.attachments.length > 0;
        const mediaUrl = hasMedia ? item.entry.attachments![0].url : null;
        const isVideo = hasMedia ? item.entry.attachments![0].type === 'video' : false;

        return (
            <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                    position: 'relative',
                    marginBottom: '32px',
                    paddingLeft: '16px'
                }}
            >
                {/* Timeline Dot */}
                <div style={{
                    position: 'absolute',
                    left: '-20px',
                    top: '4px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: themeColor,
                    boxShadow: '0 0 0 4px #f6f5f4',
                    zIndex: 1,
                    transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                    transition: 'transform 0.3s'
                }} />

                {/* Card Container */}
                <div style={{
                    background: isHovered ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.6)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: '1px solid rgba(0,0,0,0.03)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.02)',
                    transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
                    transition: 'all 0.3s ease',
                    cursor: 'default',
                    overflow: 'hidden'
                }}>
                    {/* Header: Time + Title + Thumbnail */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: themeColor }}>
                                {timeStr}
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#050505', lineHeight: 1.3 }}>
                                {item.thread.title || '此刻印记'}
                            </div>
                        </div>

                        {/* Persistent Thumbnail (fades on hover) */}
                        {hasMedia && mediaUrl && (
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '6px', flexShrink: 0, marginLeft: '12px',
                                border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden',
                                opacity: isHovered ? 0.2 : 1, transition: 'opacity 0.3s ease'
                            }}>
                                {isVideo ? (
                                    <video src={mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                                ) : (
                                    <img src={mediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="thumb" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Expandable Details */}
                    <div style={{
                        maxHeight: isHovered ? '400px' : '0',
                        opacity: isHovered ? 1 : 0,
                        marginTop: isHovered ? '12px' : '0',
                        transition: 'max-height 0.3s ease, opacity 0.3s ease, margin-top 0.3s ease'
                    }}>
                        <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.5, marginBottom: hasMedia ? '8px' : 0 }}>
                            {item.entry.content}
                        </div>

                        {/* Media Mosaic on Expand */}
                        {hasMedia && (
                            <MediaMosaic attachments={item.entry.attachments!} forceExpanded={true} />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
                width: '100%',
                background: 'var(--bg-page)',
                minHeight: '100vh'
            }}
        >
            <div style={{
                display: 'flex',
                gap: '60px',
                maxWidth: '1100px',
                margin: '0 auto',
                padding: '40px 24px',
                justifyContent: 'center',
                alignItems: 'flex-start'
            }}>
                {/* Left Panel: Core Memories Column */}
                <div style={{
                    flex: 1,
                    maxWidth: '650px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '32px'
                }}>
                    {/* Part 1: Date & AI Header (Reverted to centered) */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', marginBottom: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
                            <h1 style={{
                                fontSize: '84px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0,
                                color: 'var(--text-strong)',
                                fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
                                lineHeight: 1, fontStyle: 'italic',
                            }}>
                                {bigDay}
                            </h1>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingBottom: '10px' }}>
                                <span style={{
                                    fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600,
                                    textTransform: 'uppercase', letterSpacing: '0.15em',
                                    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
                                    fontStyle: 'italic',
                                }}>
                                    {monthYear}
                                </span>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {isLoading ? (
                                        <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}
                                            style={{ height: '14px', width: '60px', background: 'var(--border-default)', borderRadius: '4px' }} />
                                    ) : (
                                        <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                                            {data?.weather || '今日天气数据加载中...'}
                                        </span>
                                    )}

                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleManualRefresh}
                                        disabled={isLoading}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: isLoading ? 'default' : 'pointer',
                                            color: 'var(--text-muted)',
                                            padding: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            opacity: isLoading ? 0.3 : 0.6,
                                            transition: 'opacity 0.2s',
                                            borderRadius: '50%',
                                        }}
                                        title="强制刷新 AI 总结"
                                    >
                                        <motion.div animate={isLoading ? { rotate: 360 } : {}} transition={isLoading ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}>
                                            <RefreshCw size={14} />
                                        </motion.div>
                                    </motion.button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Part 2: Daily Summary (Reverted to centered text) */}
                    <div style={{ margin: '0 0 40px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
                        {isLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%', paddingTop: '10px' }}>
                                <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }} style={{ height: '24px', width: '240px', background: 'var(--border-default)', borderRadius: '6px' }} />
                                <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.1, ease: "easeInOut" }} style={{ height: '16px', width: '380px', background: 'var(--border-default)', borderRadius: '4px' }} />
                                <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2, ease: "easeInOut" }} style={{ height: '16px', width: '260px', background: 'var(--border-default)', borderRadius: '4px' }} />
                            </div>
                        ) : (
                            <>
                                <div style={{
                                    fontSize: '18px', lineHeight: 1.6, color: 'var(--text-strong)', fontStyle: 'italic',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif', margin: 0, fontWeight: 500
                                }}>
                                    "{data?.poeticMessage}"
                                </div>
                                <div style={{ fontSize: '15px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                                    {data?.summary}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Part 3: Deep Memory Cards */}
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '60px' }}>
                        {isLoading ? (
                            // Skeleton for Deep Memory Card
                            <div style={{
                                position: 'relative',
                                background: '#fdfcf6',
                                border: '1px solid rgba(230, 150, 80, 0.3)',
                                borderRadius: '16px',
                                padding: '24px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '20px',
                            }}>
                                {/* Time + Core Summary Skeleton */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }} style={{ height: '20px', width: '40px', background: 'var(--border-default)', borderRadius: '4px' }} />
                                    <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.1, ease: "easeInOut" }} style={{ height: '14px', width: '120px', background: 'var(--border-default)', borderRadius: '4px' }} />
                                </div>
                                {/* Poetic Interpretation Skeleton */}
                                <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2, ease: "easeInOut" }} style={{ height: '26px', width: '80%', background: 'var(--border-default)', borderRadius: '6px' }} />
                                {/* Original Record Skeleton */}
                                <div style={{
                                    paddingLeft: '12px',
                                    borderLeft: '2px solid var(--border-default)',
                                    background: 'rgba(0, 0, 0, 0.02)',
                                    padding: '10px 12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3, ease: "easeInOut" }} style={{ height: '12px', width: '100%', background: 'var(--border-default)', borderRadius: '4px' }} />
                                    <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4, ease: "easeInOut" }} style={{ height: '12px', width: '60%', background: 'var(--border-default)', borderRadius: '4px' }} />
                                </div>
                                {/* Sign-off Skeleton */}
                                <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.5, ease: "easeInOut" }} style={{ height: '12px', width: '100px', background: 'var(--border-default)', borderRadius: '4px', alignSelf: 'flex-end' }} />
                            </div>
                        ) : (
                            data?.deepMemories && data.deepMemories.length > 0 && (
                                data.deepMemories.slice(0, 1).map((mem) => (
                                    <div key={mem.id} style={{
                                        position: 'relative',
                                        background: '#fdfcf6', // Always use beige base
                                        border: '1px solid rgba(230, 150, 80, 0.5)',
                                        borderRadius: '16px',
                                        padding: '24px',
                                        boxShadow: 'inset 0 0 40px rgba(220, 180, 140, 0.1), 0 4px 20px rgba(0,0,0,0.03)',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '16px',
                                        fontFamily: 'NotionInter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
                                    }}>
                                        {/* Stacked Photo Decorative Effect at Top Right */}
                                        {mem.bgMediaUrl && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '-10px', right: '-20px', // Pinned to top right, slightly bleeding off
                                                zIndex: 0,
                                                pointerEvents: 'none',
                                            }}>
                                                {/* Background simulated photo stack (underneath) */}
                                                <div style={{
                                                    position: 'absolute', top: '10px', right: '10px',
                                                    width: '240px', height: '180px',
                                                    transform: 'rotate(-4deg)',
                                                    borderRadius: '16px',
                                                    border: '1px solid rgba(255, 255, 255, 0.6)',
                                                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                                                    background: 'rgba(253, 252, 246, 0.95)', // Solid beige mimicking another card
                                                    zIndex: 0,
                                                }} />

                                                {/* Main Photo (top) */}
                                                <div style={{
                                                    position: 'relative',
                                                    width: '240px', height: '180px',
                                                    transform: 'rotate(6deg)',
                                                    borderRadius: '16px',
                                                    border: '1px solid rgba(255, 255, 255, 0.8)',
                                                    boxShadow: '-4px 10px 30px rgba(0,0,0,0.08)',
                                                    overflow: 'hidden',
                                                    zIndex: 1,
                                                }}>
                                                    <div style={{ position: 'absolute', inset: '-10px' }}>
                                                        {mem.bgMediaType === 'video' ? (
                                                            <video src={mem.bgMediaUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <img src={mem.bgMediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        )}
                                                    </div>
                                                    {/* Reduced blur frosted glass overlay directly on the photo */}
                                                    <div style={{
                                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                                        background: 'rgba(253, 252, 246, 0.25)', // Very light beige tint allowing original color check
                                                        backdropFilter: 'blur(3px) saturate(130%)',
                                                        WebkitBackdropFilter: 'blur(3px) saturate(130%)',
                                                        pointerEvents: 'none',
                                                        zIndex: 1,
                                                    }} />
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {/* Time + Core Summary */}
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-strong)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <motion.span
                                                    animate={{
                                                        textShadow: [
                                                            "0 0 4px rgba(255, 180, 100, 0.4)",
                                                            "0 0 12px rgba(255, 150, 50, 0.8)",
                                                            "0 0 4px rgba(255, 180, 100, 0.4)"
                                                        ],
                                                        color: [
                                                            "var(--text-strong)",
                                                            "#d35400", // warm orange
                                                            "var(--text-strong)"
                                                        ]
                                                    }}
                                                    transition={{
                                                        duration: 3,
                                                        repeat: Infinity,
                                                        ease: "easeInOut"
                                                    }}
                                                    style={{ display: 'inline-block' }}
                                                >
                                                    {mem.time}
                                                </motion.span>
                                                <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>· {mem.coreSummary}</span>
                                            </div>

                                            {/* Poetic Interpretation */}
                                            <div style={{ fontSize: '18px', color: 'var(--text-strong)', lineHeight: 1.6, fontWeight: 500 }}>
                                                {mem.poeticInterpretation}
                                            </div>

                                            {/* Original Record */}
                                            <div style={{
                                                fontSize: '13px',
                                                color: 'var(--text-default)',
                                                lineHeight: 1.5,
                                                paddingLeft: '12px',
                                                borderLeft: '2px solid var(--border-default)',
                                                background: mem.bgMediaUrl ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.03)',
                                                padding: '10px 12px',
                                                borderRadius: '0 8px 8px 0'
                                            }}>
                                                "{mem.originalRecord}"
                                            </div>

                                            {/* Emotional Feedback (Sign-off) */}
                                            <div style={{
                                                marginTop: '8px',
                                                fontSize: '13px',
                                                color: 'var(--text-muted)',
                                                fontWeight: 500,
                                                textAlign: 'right',
                                            }}>
                                                —— {mem.emotionalFeedback}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )
                        )}
                    </div>

                    {/* Part 4: End-of-day Check (Reverted to centered) */}
                    {!isLoading && (
                        <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto', marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <h3 style={{
                                fontSize: '13px',
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                                margin: '0 0 8px 0',
                                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                                fontWeight: 600
                            }}>
                                To Do's
                            </h3>
                            {!isLoading && tasks.length > 0 && (
                                <div style={{
                                    fontSize: '11px',
                                    color: 'var(--color-primary)',
                                    marginBottom: '20px',
                                    opacity: 0.8,
                                    fontWeight: 500,
                                    letterSpacing: '0.02em'
                                }}>
                                    {tasks.filter(t => t.isCompleted).length} COMPLETED · {tasks.filter(t => !t.isCompleted).length} REMAINING
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                <AnimatePresence>
                                    {tasks.map(task => (
                                        <motion.div
                                            key={task.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: task.isCompleted ? 0.6 : 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            whileTap={{ scale: 0.98 }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '12px 16px', background: 'var(--bg-card)',
                                                borderRadius: '12px', border: '1px solid var(--border-default)',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => toggleTask(task.id)}
                                        >
                                            <motion.div
                                                animate={task.isCompleted ? { rotate: 360, scale: [1, 1.2, 1] } : {}}
                                                transition={{ duration: 0.4 }}
                                            >
                                                {task.isCompleted ? (
                                                    <CheckCircle2 size={20} color="var(--color-primary)" />
                                                ) : (
                                                    <Circle size={20} color="var(--text-muted)" />
                                                )}
                                            </motion.div>
                                            <span style={{
                                                fontSize: '14px', color: task.isCompleted ? 'var(--text-muted)' : 'var(--text-default)',
                                                textDecoration: task.isCompleted ? 'line-through' : 'none',
                                                transition: 'color 0.3s'
                                            }}>
                                                {task.content}
                                            </span>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px 16px', background: 'transparent',
                                    borderRadius: '12px', border: '1px dashed var(--border-default)',
                                }}>
                                    <Plus size={20} color="var(--text-muted)" />
                                    <input
                                        value={newTaskText}
                                        onChange={e => setNewTaskText(e.target.value)}
                                        onKeyDown={addTask}
                                        placeholder="添加新任务，按 Enter 键录入..."
                                        style={{
                                            border: 'none', background: 'transparent', outline: 'none',
                                            fontSize: '14px', color: 'var(--text-default)', width: '100%',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel: Vertical Sticky Fluid Chronos */}
                {timelineItems.length > 0 && (
                    <div style={{
                        width: '320px',
                        flexShrink: 0,
                        position: 'sticky',
                        top: '40px',
                        height: 'calc(100vh - 80px)',
                        overflowY: 'auto',
                        paddingBottom: '40px',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                    }}
                        className="right-panel-scroll"
                    >
                        <style dangerouslySetInnerHTML={{
                            __html: `
                                .right-panel-scroll::-webkit-scrollbar {
                                    display: none;
                                }
                            `
                        }} />
                        <h3 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 24px 0' }}>
                            流光时间轴 / Fluid Chronos
                        </h3>

                        {/* Vertical Axis Line Container */}
                        <div style={{ position: 'relative', paddingLeft: '20px' }}>
                            <div style={{
                                position: 'absolute',
                                top: '10px',
                                bottom: '-50px',
                                left: '5px',
                                width: '1px',
                                background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.1) 10%, rgba(0,0,0,0.1) 90%, transparent)',
                                zIndex: 0
                            }} />

                            {timelineItems.map((item) => (
                                <TimelineVerticalNode key={item.entry.id} item={item} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

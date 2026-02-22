import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Plus } from 'lucide-react';
import type { EventThread, DailyMemoryData, TimelineEntry, EndOfDayTask } from '../types';
import { generateDailySummary } from '../utils/classificationEngine';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

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

    useEffect(() => {
        let isMounted = true;
        async function fetchData() {
            setIsLoading(true);
            try {
                const result = await generateDailySummary(todayThreads, dateContext);
                if (isMounted) {
                    setData(result);
                    setTasks(result.tasks || []);
                }
            } catch (err) {
                console.error('Failed to load daily summary:', err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }
        fetchData();
        return () => { isMounted = false; };
    }, [todayThreads, dateContext]);

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

    // Horizontal Node Component
    const TimelineHorizontalNode = ({ item, index }: { item: { entry: TimelineEntry; thread: EventThread }, index: number }) => {
        const [isHovered, setIsHovered] = useState(false);
        const timeStr = new Date(item.entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const themeColor = item.thread.category.theme === 'cyber-blue' ? '#2980b9' : '#d4c1a5';

        const isUp = index % 2 === 0;

        return (
            <motion.div
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1, width: isHovered ? 280 : 130 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{
                    position: 'relative',
                    height: '320px', // Compact height
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: isUp ? 'flex-end' : 'flex-start',
                    zIndex: isHovered ? 10 : 1,
                }}
            >
                {/* The glowing dot on the central river */}
                <motion.div
                    animate={{
                        scale: isHovered ? 1.4 : 1,
                        boxShadow: isHovered ? `0 0 12px ${themeColor}80` : `0 0 0px transparent`,
                        backgroundColor: isHovered ? themeColor : 'var(--bg-page)',
                        borderColor: themeColor
                    }}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        border: `2px solid`,
                        zIndex: 2,
                        transition: 'border-color 0.3s'
                    }}
                />

                {/* Connecting Stem */}
                <motion.div
                    animate={{ height: isHovered ? '24px' : '16px', opacity: isHovered ? 1 : 0.3 }}
                    style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '1px',
                        background: `linear-gradient(to ${isUp ? 'top' : 'bottom'}, ${themeColor}, transparent)`,
                        ...(isUp ? { bottom: '50%' } : { top: '50%' }),
                        zIndex: 1,
                    }}
                />

                {/* Card Envelope */}
                <motion.div
                    layout
                    style={{
                        position: 'absolute',
                        left: 0, right: 0,
                        ...(isUp ? { bottom: 'calc(50% + 24px)' } : { top: 'calc(50% + 24px)' }), // Grow outwards from stem
                        background: 'rgba(255, 255, 255, 0.75)',
                        backdropFilter: 'blur(24px) saturate(150%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(150%)',
                        borderRadius: '16px',
                        padding: '16px',
                        boxShadow: isHovered ? '0 12px 40px rgba(0,0,0,0.08)' : '0 4px 15px rgba(0,0,0,0.03)',
                        border: '1px solid rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: isHovered ? '12px' : '8px',
                        overflow: 'hidden',
                        fontFamily: 'NotionInter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
                        zIndex: 3,
                        transformOrigin: isUp ? 'bottom center' : 'top center'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '12px', color: themeColor, fontWeight: 500, letterSpacing: '0.05em' }}>{timeStr}</span>
                    </div>

                    <div style={{
                        fontSize: '14px', color: 'var(--text-strong)', fontWeight: 400, lineHeight: 1.4,
                        textAlign: 'center',
                        display: '-webkit-box', WebkitLineClamp: isHovered ? 'unset' : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                        {item.thread.title || '此刻印记'}
                    </div>

                    <AnimatePresence>
                        {isHovered && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}
                            >
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, WebkitFontSmoothing: 'antialiased' }}>
                                    {item.entry.content}
                                </div>

                                {/* Multi-media preview */}
                                {item.entry.attachments && item.entry.attachments.length > 0 && (
                                    <div style={{ borderRadius: '8px', overflow: 'hidden', height: '120px', background: '#f5f5f5', position: 'relative', marginTop: '4px' }}>
                                        {item.entry.attachments[0].type === 'image' ? (
                                            <img src={item.entry.attachments[0].url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <video src={item.entry.attachments[0].url} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
                width: '100%',
                maxWidth: '600px',
                margin: '0 auto',
                padding: '32px 24px 64px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'var(--bg-page)',
            }}
        >
            {/* Part 1: Date & AI Summary */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', marginBottom: '32px' }}>
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
                    {isLoading ? (
                        <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}
                            style={{ height: '14px', width: '60px', background: 'var(--border-default)', borderRadius: '4px' }} />
                    ) : (
                        <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                            {data?.weather || '今日天气'}
                        </span>
                    )}
                </div>
            </div>

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

            {/* Part 2: Deep Memory Cards */}
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
                        data.deepMemories.map((mem) => (
                            <div key={mem.id} style={{
                                position: 'relative',
                                background: mem.bgMediaUrl ? 'transparent' : '#fdfcf6', // Restored beige paper feel
                                border: '1px solid rgba(230, 150, 80, 0.5)', // Restored fine orange border
                                borderRadius: '16px',
                                padding: '24px',
                                boxShadow: mem.bgMediaUrl ? 'none' : 'inset 0 0 40px rgba(220, 180, 140, 0.1), 0 4px 20px rgba(0,0,0,0.03)', // Restored inner shadow for texture
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                                fontFamily: 'NotionInter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
                            }}>
                                {/* Background Image/Video with Apple-style frosted glass effect */}
                                {mem.bgMediaUrl && (
                                    <>
                                        <div style={{
                                            position: 'absolute',
                                            top: '-10px', left: '-10px', right: '-10px', bottom: '-10px', // expand slightly to hide blur edges
                                            zIndex: 0,
                                            pointerEvents: 'none',
                                        }}>
                                            {mem.bgMediaType === 'video' ? (
                                                <video src={mem.bgMediaUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <img src={mem.bgMediaUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            )}
                                        </div>
                                        <div style={{
                                            position: 'absolute',
                                            top: 0, left: 0, right: 0, bottom: 0,
                                            zIndex: 0,
                                            background: 'rgba(255, 255, 255, 0.65)',
                                            backdropFilter: 'blur(24px) saturate(180%)',
                                            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                                            pointerEvents: 'none',
                                        }} />
                                    </>
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
                                        color: 'var(--text-muted)',
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

            {/* Part 3: Fluid Chronos (Horizontal) */}
            {timelineItems.length > 0 && (
                <div style={{ width: '100%', marginBottom: '80px', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px 0', alignSelf: 'flex-start' }}>
                        流光时间轴
                    </h3>

                    {/* Horizontal Scroll Container */}
                    <div className="horizontal-scroll-container" style={{
                        width: '100vw',
                        position: 'relative',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        overflowX: 'auto',
                        padding: '20px calc(50vw - 300px) 40px', // Bottom padding for scrollbar
                        gap: '24px',
                        alignItems: 'center',
                        scrollBehavior: 'smooth',
                        WebkitOverflowScrolling: 'touch',
                    }}>
                        <style>{`
                            @keyframes flowRiver {
                                0% { background-position: 200vw 0; }
                                100% { background-position: -200vw 0; }
                            }
                            /* Elegant custom scrollbar */
                            .horizontal-scroll-container::-webkit-scrollbar {
                                height: 6px;
                                display: block;
                            }
                            .horizontal-scroll-container::-webkit-scrollbar-track {
                                background: rgba(0,0,0,0.03);
                                border-radius: 4px;
                                margin: 0 calc(50vw - 300px); /* Align track bounds with visual center column */
                            }
                            .horizontal-scroll-container::-webkit-scrollbar-thumb {
                                background: rgba(0,0,0,0.15);
                                border-radius: 4px;
                            }
                            .horizontal-scroll-container::-webkit-scrollbar-thumb:hover {
                                background: rgba(0,0,0,0.25);
                            }
                        `}</style>

                        {/* The Infinite Central River */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: 0,
                            right: 0,
                            minWidth: '100%',
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent 0%, rgba(200, 200, 200, 0.4) 20%, rgba(200, 200, 200, 0.4) 80%, transparent 100%)',
                            backgroundSize: '200vw 100%',
                            animation: 'flowRiver 15s linear infinite',
                            zIndex: 0,
                            pointerEvents: 'none',
                        }} />

                        {timelineItems.map((item, index) => (
                            <TimelineHorizontalNode key={item.entry.id} item={item} index={index} />
                        ))}

                        {/* Phantom padder at the end to ensure scroll area fully covers the last expanded item */}
                        <div style={{ width: '40px', flexShrink: 0 }} />
                    </div>
                </div>
            )}

            {/* Part 4: End-of-day Check */}
            {!isLoading && (
                <div style={{ width: '100%' }}>
                    <h3 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px 0', alignSelf: 'flex-start' }}>
                        任务持久化
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
        </motion.div>
    );
};

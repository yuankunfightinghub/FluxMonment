import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import type { EventThread } from '../types';
import MomentAvatar from './MomentAvatar';
import { MediaMosaic } from './MediaMosaic';

interface TimelineCardProps {
    thread: EventThread;
    index: number;
    onDelete?: () => void;
}

export const TimelineCard: React.FC<TimelineCardProps> = ({ thread, index, onDelete }) => {
    const isWork = thread.category.theme === 'cyber-blue';

    // Keep original icon / accent colors based on user feedback
    const accentColor = isWork ? 'var(--color-primary)' : '#e87533';
    const accentRaw = isWork ? '#006ebc' : '#e87533';
    const accentBg = isWork ? 'var(--color-primary-accent-strong)' : 'rgba(232, 117, 51, 0.1)';
    const dotClass = isWork ? 'dot-work' : 'dot-life';

    return (
        <motion.div
            layout
            key={thread.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            whileHover={{ y: -3 }}
            transition={{
                layout: { type: 'spring', stiffness: 450, damping: 40 },
                opacity: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                y: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                delay: Math.min(index * 0.04, 0.18),
            }}
            whileInView={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
            }}
            viewport={{ once: true, margin: "-40px" }}
            className="notion-card"
            style={{
                position: 'relative',
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                cursor: 'pointer',
                breakInside: 'avoid',
                marginBottom: '24px',
            }}
        >

            {/* Header — avatar + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* AI Avatar — 增大尺寸以清晰显示挂件和面部情绪 */}
                <MomentAvatar
                    variant={thread.avatarVariant ?? 0}
                    mood={thread.mood ?? (isWork ? 'focused' : 'calm')}
                    size={24}
                    accentColor={accentRaw}
                />

                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <h3 style={{
                        margin: 0,
                        fontSize: '18px',
                        fontFamily: 'NotionInter, sans-serif',
                        fontWeight: 600,
                        color: 'var(--text-strong)',
                        lineHeight: 1.3,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        letterSpacing: '0.01em',
                    }}>
                        {thread.title}
                    </h3>
                    {/* 情绪标签 */}
                    {thread.mood && (
                        <span style={{
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            letterSpacing: '0.02em',
                            fontWeight: 400,
                        }}>
                            {MOOD_LABEL[thread.mood]}
                        </span>
                    )}
                </div>

                {/* Delete button (shows on group hover) */}
                {onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="card-delete-btn"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-placeholder)',
                            transition: 'all 0.2s',
                            padding: 0,
                            flexShrink: 0,
                        }}
                        title="永久删除此瞬间"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>

            {/* Subtle Divider via space, no hard lines */}
            <div style={{ height: '4px' }} />

            {/* Entries timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
                {/* Timeline vertical line (hide if only 1 entry) */}
                {thread.entries.length > 1 && (
                    <div style={{
                        position: 'absolute',
                        left: '5px',
                        top: '12px',
                        bottom: '12px',
                        width: '1px',
                        background: 'var(--border-default)',
                        borderRadius: '1px',
                    }} />
                )}

                <AnimatePresence initial={false}>
                    {thread.entries.map((entry, idx) => {
                        const isSingle = thread.entries.length === 1;
                        return (
                            <motion.div
                                key={entry.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.06, duration: 0.25 }}
                                style={{
                                    display: 'flex',
                                    gap: isSingle ? '0px' : '14px',
                                    position: 'relative',
                                    zIndex: 1,
                                }}
                            >
                                {/* Timeline dot */}
                                {!isSingle && (
                                    <div
                                        className={dotClass}
                                        style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            marginTop: '6px',
                                            flexShrink: 0,
                                            border: '2px solid var(--bg-page)',
                                            boxShadow: `0 0 0 1px var(--border-focus)`,
                                        }}
                                    />
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                                    <span style={{
                                        fontSize: '11px',
                                        color: 'var(--text-muted)',
                                        fontVariantNumeric: 'tabular-nums',
                                        letterSpacing: '0.01em',
                                    }}>
                                        {new Date(entry.timestamp).toLocaleString([], {
                                            month: 'short', day: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </span>
                                    {entry.content && (
                                        <span style={{
                                            fontSize: '15px',
                                            lineHeight: '1.6',
                                            color: 'var(--text-default)',
                                            letterSpacing: '-0.01em',
                                            fontFamily: 'var(--font-body)',
                                            overflowWrap: 'anywhere',
                                            wordBreak: 'break-word',
                                        }}>
                                            {entry.content}
                                        </span>
                                    )}

                                    {/* Media Mosaic — Stacked & Expandable */}
                                    {entry.attachments && entry.attachments.length > 0 && (
                                        <MediaMosaic attachments={entry.attachments} />
                                    )}
                                </div>

                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* AI extracted keyword tags */}
            {
                thread.tags && thread.tags.length > 0 && (
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        paddingTop: '4px',
                    }}>
                        {thread.tags.map((tag, i) => (
                            <span
                                key={i}
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: accentColor,
                                    background: accentBg,
                                    padding: '4px 10px',
                                    borderRadius: '24px',
                                    letterSpacing: '0.01em',
                                }}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )
            }
        </motion.div >
    );
};

// ─── 情绪文案映射 ─────────────────────────────────────────────────────────────
const MOOD_LABEL: Record<string, string> = {
    happy: '✨ 心情愉快',
    excited: '🎉 激动兴奋',
    proud: '💪 自豪满足',
    playful: '🎮 俏皮好玩',
    curious: '🔍 好奇探索',
    focused: '🎯 专注投入',
    calm: '☕ 平静舒适',
    cozy: '😌 慵懒惬意',
    tired: '😴 有点疲倦',
    adventurous: '🌏 冒险出发',
};

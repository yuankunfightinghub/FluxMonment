import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EventThread, AvatarStatus } from '../types';
import MomentAvatar from './MomentAvatar';

interface TimelineCardProps {
    thread: EventThread;
    index: number;
}

export const TimelineCard: React.FC<TimelineCardProps> = ({ thread, index }) => {
    const isWork = thread.category.theme === 'cyber-blue';

    const accentColor = isWork ? 'var(--color-primary)' : '#e87533';
    const accentRaw = isWork ? '#006ebc' : '#e87533';
    const accentBg = isWork ? 'var(--color-primary-accent-strong)' : 'rgba(232, 117, 51, 0.1)';
    const dotClass = isWork ? 'dot-work' : 'dot-life';

    // 根据 entry 数量推断 status
    const avatarStatus: AvatarStatus =
        thread.entries.length >= 3 ? 'telling' :
            thread.entries.length === 2 ? 'summarizing' :
                'idle';

    return (
        <motion.div
            layout
            key={thread.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            whileHover={{ y: -3 }}
            transition={{
                layout: { type: 'spring', stiffness: 380, damping: 32 },
                opacity: { duration: 0.3 },
                y: { duration: 0.3 },
                delay: Math.min(index * 0.04, 0.18),
            }}
            className="notion-card"
            style={{
                position: 'relative',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                cursor: 'pointer',
            }}
        >
            {/* Left accent stripe */}
            <div style={{
                position: 'absolute',
                left: 0,
                top: '16px',
                bottom: '16px',
                width: '3px',
                borderRadius: '0 3px 3px 0',
                background: accentColor,
                opacity: 0.85,
            }} />

            {/* Header — avatar + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* AI Avatar — 精准 16px */}
                <MomentAvatar
                    variant={thread.avatarVariant ?? 0}
                    mood={thread.mood ?? (isWork ? 'focused' : 'calm')}
                    status={avatarStatus}
                    size={16}
                    accentColor={accentRaw}
                />

                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <h3 style={{
                        margin: 0,
                        fontSize: '15px',
                        fontWeight: 600,
                        color: 'var(--text-strong)',
                        lineHeight: 1.4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
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
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--border-default)', margin: '0 0 2px' }} />

            {/* Entries timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
                {/* Timeline vertical line */}
                <div style={{
                    position: 'absolute',
                    left: '5px',
                    top: '8px',
                    bottom: '8px',
                    width: '1px',
                    background: 'var(--border-default)',
                    borderRadius: '1px',
                }} />

                <AnimatePresence initial={false}>
                    {thread.entries.map((entry, idx) => (
                        <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.06, duration: 0.25 }}
                            style={{
                                display: 'flex',
                                gap: '14px',
                                position: 'relative',
                                zIndex: 1,
                            }}
                        >
                            {/* Timeline dot */}
                            <div
                                className={dotClass}
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    marginTop: '5px',
                                    flexShrink: 0,
                                    border: '2px solid var(--bg-page)',
                                    boxShadow: `0 0 0 1px ${accentRaw}40`,
                                }}
                            />

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
                                        fontSize: '14px',
                                        lineHeight: '1.6',
                                        color: 'var(--text-default)',
                                    }}>
                                        {entry.content}
                                    </span>
                                )}

                                {/* Media grid */}
                                {entry.attachments && entry.attachments.length > 0 && (() => {
                                    const visibleMedia = entry.attachments.slice(0, 4);
                                    const overflow = entry.attachments.length - 4;
                                    return (
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: visibleMedia.length === 1
                                                ? '1fr'
                                                : 'repeat(2, 1fr)',
                                            gap: '4px',
                                            marginTop: '6px',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                        }}>
                                            {visibleMedia.map((att, mi) => (
                                                <div key={mi} style={{
                                                    position: 'relative',
                                                    aspectRatio: visibleMedia.length === 1 ? '16/9' : '1/1',
                                                    borderRadius: '5px',
                                                    overflow: 'hidden',
                                                    background: 'var(--bg-surface)',
                                                }}>
                                                    {att.type === 'image' ? (
                                                        <img
                                                            src={att.url}
                                                            alt={att.name}
                                                            style={{
                                                                width: '100%', height: '100%',
                                                                objectFit: 'cover', display: 'block',
                                                            }}
                                                        />
                                                    ) : (
                                                        <video
                                                            src={att.url}
                                                            controls
                                                            preload="metadata"
                                                            style={{
                                                                width: '100%', height: '100%',
                                                                objectFit: 'cover', display: 'block',
                                                            }}
                                                        />
                                                    )}
                                                    {/* Overflow badge on last visible item */}
                                                    {overflow > 0 && mi === 3 && (
                                                        <div style={{
                                                            position: 'absolute', inset: 0,
                                                            background: 'rgba(0,0,0,0.5)',
                                                            display: 'flex', alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: '#fff', fontSize: '16px', fontWeight: 600,
                                                        }}>
                                                            +{overflow}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* AI extracted keyword tags */}
            {thread.tags && thread.tags.length > 0 && (
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
                                fontSize: '11px',
                                fontWeight: 500,
                                color: accentColor,
                                background: accentBg,
                                padding: '2px 8px',
                                borderRadius: '20px',
                                letterSpacing: '0.01em',
                            }}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </motion.div>
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

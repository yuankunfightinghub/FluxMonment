import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { EventThread } from '../types';
import { TimelineCard } from './TimelineCard';

interface MomentStreamProps {
    threads: EventThread[];
    onDelete?: (threadId: string, thread: EventThread) => void;
    isSearchMode?: boolean;
}

export const MomentStream: React.FC<MomentStreamProps> = ({ threads, onDelete }) => {
    const [displayLimit, setDisplayLimit] = useState(10);

    if (threads.length === 0) {
        return (
            <div style={{
                width: '100%',
                maxWidth: '600px',
                margin: '48px auto 0',
                textAlign: 'center',
                color: 'var(--text-muted)',
            }}>
                <p style={{ fontSize: '14px', lineHeight: 1.6 }}>
                    还没有任何记录，留下你的第一个流光瞬间 ↑
                </p>
            </div>
        );
    }

    const visibleThreads = threads.slice(0, displayLimit);
    const hasMore = threads.length > displayLimit;

    return (
        <div style={{
            width: '100%',
            maxWidth: '1000px',
            margin: '48px auto 64px',
        }}>
            {/* Masonry Layout Container */}
            <div style={{
                columnCount: window.innerWidth < 768 ? 1 : 2,
                columnGap: '24px',
            }}>
                <AnimatePresence>
                    {visibleThreads.map((thread, index) => (
                        <div key={thread.id} style={{ breakInside: 'avoid', marginBottom: '24px' }}>
                            <TimelineCard
                                thread={thread}
                                index={index}
                                onDelete={() => onDelete?.(thread.id, thread)}
                            />
                        </div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Load More Stacked UI */}
            {hasMore && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: '400px',
                        margin: '40px auto 0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                    }}
                    onClick={() => setDisplayLimit(prev => prev + 10)}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Background Stack Cards */}
                    <div style={{
                        position: 'absolute',
                        top: 8,
                        width: '90%',
                        height: '100%',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '12px',
                        zIndex: 0,
                        opacity: 0.5,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                    }} />
                    <div style={{
                        position: 'absolute',
                        top: 16,
                        width: '80%',
                        height: '100%',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '12px',
                        zIndex: -1,
                        opacity: 0.2,
                    }} />

                    {/* Main Button Card */}
                    <div className="notion-card" style={{
                        position: 'relative',
                        zIndex: 1,
                        width: '100%',
                        padding: '16px',
                        textAlign: 'center',
                        background: 'var(--bg-surface)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        border: '1px solid var(--border-focus)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
                    }}>
                        <span style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: 'var(--text-default)',
                            fontFamily: 'var(--font-serif)',
                        }}>
                            展开更多瞬间
                        </span>
                        <span style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                        }}>
                            还有 {threads.length - displayLimit} 条记录
                        </span>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

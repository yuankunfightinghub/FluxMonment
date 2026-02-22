import React from 'react';
import { AnimatePresence } from 'framer-motion';
import type { EventThread } from '../types';
import { TimelineCard } from './TimelineCard';

interface MomentStreamProps {
    threads: EventThread[];
}

export const MomentStream: React.FC<MomentStreamProps> = ({ threads }) => {
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
                    还没有任何记录，打出你的第一个瞬间 ↑
                </p>
            </div>
        );
    }

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
            width: '100%',
            maxWidth: '1200px',
            margin: '32px auto 0',
        }}>
            <AnimatePresence>
                {threads.map((thread, index) => (
                    <TimelineCard key={thread.id} thread={thread} index={index} />
                ))}
            </AnimatePresence>
        </div>
    );
};

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import type { MediaAttachment } from '../types';

interface MediaItemProps {
    att: MediaAttachment;
    isStack?: boolean;
    onClick?: () => void;
}

const MediaItem: React.FC<MediaItemProps> = ({ att, isStack = false, onClick }) => {
    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: '8px',
            overflow: 'hidden',
            background: 'var(--bg-surface)',
            border: isStack ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(0,0,0,0.03)',
            boxShadow: isStack ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
        }} onClick={onClick}>
            {att.type === 'image' ? (
                <div style={{ width: '100%', height: '100%', cursor: 'zoom-in' }} onClick={(e) => e.stopPropagation()}>
                    <Zoom zoomMargin={40}>
                        <img
                            src={att.url}
                            alt={att.name}
                            style={{
                                width: '100%', height: '100%',
                                objectFit: 'cover', display: 'block',
                            }}
                        />
                    </Zoom>
                </div>
            ) : (
                <video
                    src={att.url}
                    controls
                    preload="metadata"
                    style={{
                        width: '100%', height: '100%',
                        objectFit: 'cover', display: 'block',
                    }}
                    onClick={(e) => e.stopPropagation()}
                />
            )}
        </div>
    );
};

interface SingleStackProps {
    attachments: MediaAttachment[];
}

const SingleStack: React.FC<SingleStackProps> = ({ attachments }) => {
    const last = attachments[attachments.length - 1];
    const restCount = attachments.length - 1;

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Background stack layers */}
            {restCount > 0 && (
                <>
                    <div style={{
                        position: 'absolute', top: '4px', left: '4px', width: '100%', height: '100%',
                        background: '#fcfcfc', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px', zIndex: 0
                    }} />
                    <div style={{
                        position: 'absolute', top: '8px', left: '8px', width: '100%', height: '100%',
                        background: '#f9f9f9', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px', zIndex: -1
                    }} />
                </>
            )}
            <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
                <MediaItem att={last} isStack={true} />
                {attachments.length > 3 && (
                    <div style={{
                        position: 'absolute', bottom: '8px', right: '8px',
                        background: 'rgba(0,0,0,0.6)', color: '#fff',
                        padding: '2px 8px', borderRadius: '12px', fontSize: '11px',
                        fontWeight: 600, zIndex: 10, pointerEvents: 'none',
                        backdropFilter: 'blur(4px)'
                    }}>
                        +{attachments.length - 2}
                    </div>
                )}
            </div>
        </div>
    );
};

export interface MediaMosaicProps {
    attachments: MediaAttachment[];
    forceExpanded?: boolean;
}

export const MediaMosaic: React.FC<MediaMosaicProps> = ({ attachments, forceExpanded = false }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const count = attachments.length;
    const shouldExpand = isHovered || forceExpanded;

    const collapsedMedia = React.useMemo(() => {
        if (count <= 2) return attachments;
        // First two + the rest as a stack
        return [attachments[0], attachments[1], attachments.slice(2)];
    }, [attachments, count]);

    if (count === 0) return null;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ marginTop: '10px', width: '100%' }}
        >
            <motion.div
                layout
                style={{
                    display: 'grid',
                    gridTemplateColumns: shouldExpand
                        ? (count === 1 ? '1fr' : 'repeat(2, 1fr)')
                        : (count === 1 ? '1fr' : count === 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'),
                    gap: shouldExpand ? '8px' : '6px',
                    width: '100%',
                }}
            >
                <AnimatePresence mode="popLayout">
                    {(!shouldExpand ? collapsedMedia : attachments).map((item, idx) => {
                        const isStack = !shouldExpand && Array.isArray(item);
                        return (
                            <motion.div
                                key={isStack ? 'stack' : (attachments.indexOf(item as any) !== -1 ? (item as any).url : idx)}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                style={{
                                    aspectRatio: (count === 1) ? '16/10' : '1/1',
                                    width: '100%',
                                }}
                            >
                                {isStack ? (
                                    <SingleStack attachments={item as any[]} />
                                ) : (
                                    <MediaItem att={item as MediaAttachment} />
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </motion.div>

            {shouldExpand && count > 2 && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)',
                        marginTop: '8px', fontStyle: 'italic'
                    }}
                >
                    点击图片可查看原图
                </motion.div>
            )}
        </div>
    );
};

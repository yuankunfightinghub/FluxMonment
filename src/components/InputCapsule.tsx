import React, { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, Mic, Paperclip, X, Film } from 'lucide-react';

export interface PendingMedia {
    id: string;           // 本地唯一 id
    file: File;
    localUrl: string;     // URL.createObjectURL，用于即时预览
    type: 'image' | 'video';
    uploading: boolean;
    uploaded?: { url: string; type: 'image' | 'video'; name: string }; // 上传完成后填入
    error?: string;
}

interface InputCapsuleProps {
    value: string;
    onChange: (val: string) => void;
    onSubmit: () => void;
    isFocused: boolean;
    onFocus: () => void;
    onBlur: () => void;
    category: 'cyber-blue' | 'sunset-orange' | 'neutral';
    showSuccess?: boolean;
    isLoading?: boolean;
    pendingMedia?: PendingMedia[];
    onFilesAdded?: (files: File[]) => void;
    onRemoveMedia?: (id: string) => void;
}

export const InputCapsule: React.FC<InputCapsuleProps> = ({
    value,
    onChange,
    onSubmit,
    isFocused,
    onFocus,
    onBlur,
    category,
    showSuccess,
    isLoading,
    pendingMedia = [],
    onFilesAdded,
    onRemoveMedia,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-expanding textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.max(24, textareaRef.current.scrollHeight)}px`;
        }
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (value.trim() || pendingMedia.length > 0) {
                onSubmit();
                if (textareaRef.current) textareaRef.current.blur();
            }
        }
    };

    // ── Ctrl+V paste ────────────────────────────────────────────────────────
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = Array.from(e.clipboardData.items);
        const mediaFiles = items
            .filter(item => item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/')))
            .map(item => item.getAsFile())
            .filter((f): f is File => f !== null);

        if (mediaFiles.length > 0 && onFilesAdded) {
            e.preventDefault(); // don't paste as text
            onFilesAdded(mediaFiles);
        }
    }, [onFilesAdded]);

    // ── File picker ──────────────────────────────────────────────────────────
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length > 0 && onFilesAdded) {
            onFilesAdded(files);
        }
        // Reset so same file can be added again
        e.target.value = '';
    };

    // Styles
    const getBorderColor = (): string => {
        if (showSuccess) return 'var(--color-primary)';
        if (isFocused) return 'var(--border-focus)';
        return 'var(--border-default)';
    };

    const getBoxShadow = (): string => {
        if (showSuccess) return 'var(--shadow-focus), var(--shadow-sm)';
        if (isFocused) return 'var(--shadow-focus)';
        return 'var(--shadow-sm)';
    };

    const hasContent = value.trim() || pendingMedia.length > 0;

    const submitBg = hasContent
        ? (category === 'cyber-blue' ? 'var(--color-primary)' : category === 'sunset-orange' ? '#e87533' : 'var(--color-primary)')
        : 'var(--bg-surface)';
    const submitColor = hasContent ? '#ffffff' : 'var(--text-muted)';

    return (
        <motion.div
            animate={{
                borderColor: getBorderColor(),
                boxShadow: getBoxShadow(),
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="notion-card"
            style={{
                width: '100%',
                maxWidth: '600px',
                margin: '0 auto',
                padding: '16px 16px 12px',
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${getBorderColor()}`,
            }}
        >
            {/* ── Media preview strip ────────────────────────────────────── */}
            <AnimatePresence>
                {pendingMedia.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
                    >
                        {pendingMedia.map(pm => (
                            <motion.div
                                key={pm.id}
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.85 }}
                                style={{
                                    position: 'relative',
                                    width: '72px',
                                    height: '72px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: '1.5px solid var(--border-default)',
                                    background: 'var(--bg-surface)',
                                    flexShrink: 0,
                                }}
                            >
                                {pm.type === 'image' ? (
                                    <img
                                        src={pm.localUrl}
                                        alt={pm.file.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '100%', height: '100%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexDirection: 'column', gap: '4px',
                                    }}>
                                        <Film size={22} style={{ color: 'var(--text-muted)' }} />
                                        <span style={{
                                            fontSize: '9px', color: 'var(--text-muted)',
                                            maxWidth: '60px', overflow: 'hidden',
                                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            padding: '0 4px',
                                        }}>{pm.file.name}</span>
                                    </div>
                                )}

                                {/* Upload overlay */}
                                {pm.uploading && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'rgba(0,0,0,0.35)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <LoadingDots />
                                    </div>
                                )}

                                {/* Remove button */}
                                {!pm.uploading && (
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => onRemoveMedia?.(pm.id)}
                                        style={{
                                            position: 'absolute', top: '3px', right: '3px',
                                            width: '18px', height: '18px', borderRadius: '50%',
                                            background: 'rgba(0,0,0,0.55)', color: '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <X size={10} strokeWidth={2.5} />
                                    </motion.button>
                                )}
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Textarea ────────────────────────────────────────────────── */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={onFocus}
                onBlur={onBlur}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={isLoading ? 'AI 正在思考脉络...' : '随时随地，记下你的闪念...'}
                rows={1}
                disabled={isLoading}
                style={{
                    width: '100%',
                    fontSize: '16px',
                    lineHeight: '1.5',
                    resize: 'none',
                    minHeight: '24px',
                    overflow: 'hidden',
                    marginBottom: '12px',
                    color: 'var(--text-strong)',
                    opacity: isLoading ? 0.5 : 1,
                }}
            />

            {/* ── Toolbar row ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Left: attachment + mic */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleFileInputChange}
                    />
                    <IconBtn
                        icon={<Paperclip size={17} strokeWidth={1.8} />}
                        onClick={() => fileInputRef.current?.click()}
                        title="上传图片或视频"
                    />
                    <IconBtn icon={<Mic size={17} strokeWidth={1.8} />} />
                </div>

                {/* Right: category hint + submit */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AnimatePresence>
                        {category !== 'neutral' && (
                            <motion.span
                                key={category}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                style={{
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    color: category === 'cyber-blue' ? 'var(--color-primary)' : '#e87533',
                                    background: category === 'cyber-blue' ? 'var(--color-primary-accent-strong)' : 'rgba(232, 117, 51, 0.1)',
                                    padding: '2px 8px',
                                    borderRadius: '20px',
                                    letterSpacing: '0.02em',
                                }}
                            >
                                {category === 'cyber-blue' ? '工作' : '生活'}
                            </motion.span>
                        )}
                    </AnimatePresence>

                    <motion.button
                        whileHover={{ scale: hasContent ? 1.06 : 1 }}
                        whileTap={{ scale: hasContent ? 0.92 : 1 }}
                        onClick={onSubmit}
                        disabled={isLoading || !hasContent}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: submitBg,
                            color: submitColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: hasContent ? 'var(--shadow-xs)' : 'none',
                            transition: 'background 0.25s ease, color 0.25s ease',
                            cursor: hasContent ? 'pointer' : 'default',
                        }}
                    >
                        {isLoading
                            ? <LoadingDots />
                            : <ArrowUp size={16} strokeWidth={2.5} />}
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );
};

// ── Small helpers ─────────────────────────────────────────────────────────────

const IconBtn: React.FC<{ icon: React.ReactNode; onClick?: () => void; title?: string }> = ({ icon, onClick, title }) => (
    <motion.button
        whileHover={{ background: 'var(--bg-surface)' }}
        onClick={onClick}
        title={title}
        style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            transition: 'background 0.15s ease, color 0.15s ease',
            cursor: onClick ? 'pointer' : 'default',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-default)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
    >
        {icon}
    </motion.button>
);

const LoadingDots: React.FC = () => (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
            <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor' }}
            />
        ))}
    </div>
);

import React from 'react';
import { motion } from 'framer-motion';

interface GreetingProps {
    isFocused: boolean;
    category: 'cyber-blue' | 'sunset-orange' | 'neutral';
    isHoliday?: boolean;
    showSuccess?: boolean;
}

export const Greeting: React.FC<GreetingProps> = ({ isFocused, category, isHoliday, showSuccess }) => {
    // Map category to a Notion-brand accent color for the title
    const getTitleColor = (): string => {
        if (showSuccess) {
            if (category === 'cyber-blue') return 'var(--color-primary)';
            if (category === 'sunset-orange') return '#e87533';
        }
        return 'var(--text-strong)';
    };

    return (
        <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{
                opacity: isFocused && !showSuccess ? 0.35 : 1,
                y: isFocused && !showSuccess ? -6 : 0,
                scale: showSuccess ? [1, 1.04, 1] : isFocused ? 0.97 : 1,
            }}
            transition={{
                type: 'spring', stiffness: 400, damping: 30,
                scale: { duration: 0.6, times: [0, 0.3, 1] },
            }}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '2.5rem',
            }}
        >
            {/* Title row */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                {isHoliday && (
                    <motion.span
                        initial={{ rotate: -15, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        style={{
                            position: 'absolute',
                            top: '-12px',
                            left: '-32px',
                            fontSize: '22px',
                        }}
                    >
                        🎅
                    </motion.span>
                )}

                <motion.h1
                    animate={{ color: getTitleColor() }}
                    transition={{ duration: 0.4 }}
                    style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '28px',
                        fontWeight: 700,
                        lineHeight: 1.15,
                        letterSpacing: '-0.02em',
                        color: getTitleColor(),
                        cursor: 'default',
                        margin: 0,
                    }}
                >
                    Hi, Moment ✦
                </motion.h1>
            </div>

            {/* Sub-label */}
            <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: 400,
                color: 'var(--text-muted)',
                marginTop: '8px',
                letterSpacing: '0.01em',
                lineHeight: 1.5,
            }}>
                捕捉此刻灵感，留住属于你的瞬间
            </p>
        </motion.div>
    );
};

import React from 'react';
import { motion } from 'framer-motion';

export type TabValue = 'moments' | 'memory';

interface ViewTabsProps {
    activeTab: TabValue;
    onTabChange: (tab: TabValue) => void;
}

export const ViewTabs: React.FC<ViewTabsProps> = ({ activeTab, onTabChange }) => {
    const tabs: { value: TabValue; label: string }[] = [
        { value: 'moments', label: 'Moments' },
        { value: 'memory', label: 'Memory' },
    ];

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            marginBottom: '16px'
        }}>
            <div style={{
                display: 'inline-flex',
                background: 'rgba(0, 0, 0, 0.04)', // Very subtle gray background for the track
                borderRadius: '999px',
                padding: '3px',
                gap: '2px',
            }}>
                {tabs.map(tab => {
                    const isActive = activeTab === tab.value;
                    return (
                        <button
                            key={tab.value}
                            onClick={() => onTabChange(tab.value)}
                            style={{
                                position: 'relative',
                                padding: '6px 22px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: isActive ? 600 : 500,
                                color: isActive ? 'var(--text-strong)' : 'var(--text-muted)',
                                fontFamily: 'Inter, sans-serif',
                                outline: 'none',
                                transition: 'color 0.2s ease',
                                zIndex: 1,
                                WebkitTapHighlightColor: 'transparent',
                            }}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="capsuleIndicator"
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: '#ffffff', // Pure white pill
                                        borderRadius: '999px',
                                        zIndex: -1,
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)' // Notion's signature super light drop shadow
                                    }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                />
                            )}
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

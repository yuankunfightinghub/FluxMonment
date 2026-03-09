import React from 'react';
import { TimelineCard } from './TimelineCard';
import type { EventThread } from '../types';

export const ExampleCards: React.FC = () => {
    const examples: EventThread[] = [
        {
            id: 'ex1',
            title: '产品推进记录',
            category: { name: '产品与方案', theme: 'cyber-blue' },
            tags: ['#深夜代码', '#逻辑闭环', '#成就感'],
            lastUpdatedAt: Date.now() - 1000 * 60 * 60,
            mood: 'focused',
            avatarVariant: 12,
            entries: [
                {
                    id: 'entry1',
                    content: '凌晨两点，终于把这个复杂的异步状态机逻辑理顺了。全世界都安静了，只有键盘声和已经放凉的咖啡。这种“搞定”的感觉，真让人上瘾。☕️💻',
                    timestamp: Date.now() - 1000 * 60 * 60,
                    attachments: [{ url: '/examples/example1.png', type: 'image', name: 'coding.png' }]
                }
            ]
        },
        {
            id: 'ex2',
            title: '放松出游时刻',
            category: { name: '休闲出游', theme: 'sunset-orange' },
            tags: ['#精神快照', '#独处时光', '#自然治愈'],
            lastUpdatedAt: Date.now() - 1000 * 60 * 60 * 2,
            mood: 'calm',
            avatarVariant: 25,
            entries: [
                {
                    id: 'entry2',
                    content: '周二早上的公园，居然这么安静。阳光穿过树叶洒在咖啡杯上，突然觉得那些紧迫的待办事项也没那么重要了。这一刻，我只想给自己充点电。🍃✨',
                    timestamp: Date.now() - 1000 * 60 * 60 * 2,
                    attachments: [{ url: '/examples/example2.png', type: 'image', name: 'park.png' }]
                }
            ]
        },
        {
            id: 'ex3',
            title: '与孩子在一起',
            category: { name: '亲子时光', theme: 'sunset-orange' },
            tags: ['#育儿琐碎', '#微小幸福', '#生活底色'],
            lastUpdatedAt: Date.now() - 1000 * 60 * 60 * 24,
            mood: 'cozy',
            avatarVariant: 38,
            entries: [
                {
                    id: 'entry3',
                    content: '简单煮了碗面，孩子吃得满嘴都是酱油，还非要分我一口。以前觉得这些琐事麻烦，现在才明白，这就是生活最踏实的底色。 ❤️',
                    timestamp: Date.now() - 1000 * 60 * 60 * 24,
                    attachments: [{ url: '/examples/example3.png', type: 'image', name: 'dinner.png' }]
                }
            ]
        }
    ];

    return (
        <div style={{
            width: '100%',
            maxWidth: '1200px',
            margin: '24px auto 60px',
            padding: '0 20px'
        }}>
            <div style={{
                textAlign: 'center',
                marginBottom: '32px',
                opacity: 0.8
            }}>
                <span style={{
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                }}>
                    —— 探索 Moment 的无限可能 ——
                </span>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '24px'
            }}>
                {examples.map((ex, i) => (
                    <TimelineCard key={ex.id} thread={ex} index={i} />
                ))}
            </div>
        </div>
    );
};

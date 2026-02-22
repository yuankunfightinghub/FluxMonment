/**
 * MomentAvatar — Moment 品牌图形
 *
 * 设计语言：
 *   M 的字母骨架本身就是面部表情系统：
 *   · 两个竖笔画顶端的「点」= 左眼 + 右眼
 *   · 两段对角斜线从眼连向中谷
 *   · 中谷的曲率深度 = 嘴巴表情（深 U = 微笑，浅 = 平静，上翘 = 愁眉）
 *   · 无外框，纯线条浮空
 *
 * 动效系统：
 *   · pathLength 描边动画 = M 字符「书写」感
 *   · 眼点 scale 呼吸脉冲
 *   · 谷底 Y 参数 morph = 情绪切换时嘴型渐变
 *   · status 驱动节奏（idle / summarizing / telling）
 *
 * viewBox: 0 0 16 16（品牌图标精准 16px 设计）
 * size prop: 渲染尺寸（TimelineCard 中给 40）
 */

import React, { useId } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import type { MoodType, AvatarStatus } from '../types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MomentAvatarProps {
    variant?: number;         // 0–49 装饰变体
    mood?: MoodType;
    status?: AvatarStatus;
    size?: number;            // 渲染像素尺寸
    accentColor?: string;
    className?: string;
    style?: React.CSSProperties;
}

// ─── M 路径配置（每种情绪对应一套谷底参数） ──────────────────────────────────
// viewBox 0 0 16 16
// 左眼峰: (4, 2)   右眼峰: (12, 2)
// 谷底中心: (8, valleyY)
// left控制点: (6, leftCtrl)   right控制点: (10, rightCtrl)

interface MoodPath {
    valleyY: number;     // 谷底深度（越大=嘴越开）
    leftCtrl: number;    // 左斜线贝塞尔控制 Y
    rightCtrl: number;   // 右斜线贝塞尔控制 Y
    eyeRadius: number;   // 眼点半径
    eyeLeftShape: 'dot' | 'arc' | 'line';  // 左眼形态
    eyeRightShape: 'dot' | 'arc' | 'line'; // 右眼形态
    legBottom: number;   // 两竖腿底端 Y（14 = 全高）
}

const MOOD: Record<MoodType, MoodPath> = {
    calm: { valleyY: 6.8, leftCtrl: 6.2, rightCtrl: 6.2, eyeRadius: 0.95, eyeLeftShape: 'dot', eyeRightShape: 'dot', legBottom: 13.5 },
    happy: { valleyY: 7.8, leftCtrl: 8.5, rightCtrl: 8.5, eyeRadius: 1.1, eyeLeftShape: 'arc', eyeRightShape: 'arc', legBottom: 13.5 },
    excited: { valleyY: 8.5, leftCtrl: 9.5, rightCtrl: 9.5, eyeRadius: 1.3, eyeLeftShape: 'dot', eyeRightShape: 'dot', legBottom: 13.5 },
    proud: { valleyY: 7.2, leftCtrl: 7.0, rightCtrl: 7.0, eyeRadius: 1.0, eyeLeftShape: 'arc', eyeRightShape: 'arc', legBottom: 13.5 },
    playful: { valleyY: 7.5, leftCtrl: 8.0, rightCtrl: 6.5, eyeRadius: 1.0, eyeLeftShape: 'arc', eyeRightShape: 'line', legBottom: 13.5 }, // wink
    curious: { valleyY: 6.5, leftCtrl: 5.5, rightCtrl: 5.5, eyeRadius: 1.4, eyeLeftShape: 'dot', eyeRightShape: 'dot', legBottom: 13.5 }, // big eyes
    focused: { valleyY: 6.0, leftCtrl: 4.0, rightCtrl: 4.0, eyeRadius: 0.75, eyeLeftShape: 'line', eyeRightShape: 'line', legBottom: 13.5 }, // flat valley = 直线嘴
    cozy: { valleyY: 6.8, leftCtrl: 6.8, rightCtrl: 6.8, eyeRadius: 0.9, eyeLeftShape: 'arc', eyeRightShape: 'arc', legBottom: 13.0 }, // 微闭眼
    tired: { valleyY: 5.5, leftCtrl: 4.2, rightCtrl: 4.2, eyeRadius: 0.7, eyeLeftShape: 'line', eyeRightShape: 'line', legBottom: 12.5 }, // 浅谷=皱眉
    adventurous: { valleyY: 8.2, leftCtrl: 9.0, rightCtrl: 9.0, eyeRadius: 1.15, eyeLeftShape: 'dot', eyeRightShape: 'dot', legBottom: 14.0 },
};

/** 生成完整 M 路径字符串
 *  结构: 左竖腿 → 左对角 → 左谷曲线 → 右谷曲线 → 右对角 → 右竖腿
 */
function buildMPath(m: MoodPath): string {
    const lx = 2.0, rx = 14.0; // 两竖腿 x
    const lpx = 4.2, lpy = 1.9; // 左峰（左眼）
    const rpx = 11.8, rpy = 1.9; // 右峰（右眼）
    const vx = 8.0;

    return [
        `M ${lx} ${m.legBottom}`,
        `L ${lx} 4.5`,                      // 左腿上升
        `L ${lpx} ${lpy}`,                  // 左对角到左峰
        `Q 6.0 ${m.leftCtrl} ${vx} ${m.valleyY}`, // 左谷曲线
        `Q 10.0 ${m.rightCtrl} ${rpx} ${rpy}`,    // 右谷曲线
        `L ${rx} 4.5`,                      // 右峰到右对角
        `L ${rx} ${m.legBottom}`,           // 右腿下降
    ].join(' ');
}

/** 渲染单个眼睛（叠加在眼峰点上）*/
function EyeMark({
    cx, cy, shape, r, color,
}: { cx: number; cy: number; shape: 'dot' | 'arc' | 'line'; r: number; color: string }) {
    const sw = r * 1.4;
    if (shape === 'dot') {
        return <circle cx={cx} cy={cy} r={r} fill={color} />;
    }
    if (shape === 'line') {
        // 扁平闭眼横线
        return <line x1={cx - r * 1.1} y1={cy} x2={cx + r * 1.1} y2={cy}
            stroke={color} strokeWidth={sw} strokeLinecap="round" />;
    }
    // arc: 弯弯眼（弧线向上弯 = 开心眯眼）
    return <path
        d={`M ${cx - r * 1.1} ${cy + r * 0.3} Q ${cx} ${cy - r * 1.4} ${cx + r * 1.1} ${cy + r * 0.3}`}
        stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none"
    />;
}

// ─── ✦ Sparkles（右上角，M 外溢区域） ─────────────────────────────────────────

function StarShape({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
    const p = (a: number, rad: number) => ({
        x: cx + rad * Math.cos((a - 90) * Math.PI / 180),
        y: cy + rad * Math.sin((a - 90) * Math.PI / 180),
    });
    const pts = [0, 90, 180, 270].map(a => {
        const outer = p(a, r);
        const inner = p(a + 45, r * 0.42);
        return `${outer.x},${outer.y} ${inner.x},${inner.y}`;
    }).join(' ');
    return <polygon points={pts} fill={fill} />;
}

const SparklesOverlay: React.FC<{ status: AvatarStatus; accent: string }> = ({ status, accent }) => {
    const isActive = status !== 'idle';
    const stars = [
        { cx: 14.8, cy: -1.2, r: 0.9, delay: 0 },
        { cx: 16.2, cy: 0.8, r: 0.62, delay: 0.36 },
        { cx: 13.6, cy: 0.2, r: 0.48, delay: 0.68 },
    ];
    return (
        <g>
            {stars.map((s, i) => (
                <motion.g key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={isActive
                        ? { opacity: [0, 1, 0], scale: [0.2, 1, 0.2], rotate: [0, 20, 0] }
                        : { opacity: [0, 0.5, 0], scale: [0.1, 0.65, 0.1] }
                    }
                    transition={{ duration: isActive ? 1.0 : 2.6, delay: s.delay, repeat: Infinity, ease: 'easeInOut' as const }}
                    style={{ originX: `${s.cx}px`, originY: `${s.cy}px` }}
                >
                    <StarShape cx={s.cx} cy={s.cy} r={s.r} fill={accent} />
                </motion.g>
            ))}
        </g>
    );
};

// ─── 50 种装饰（纯浮空，不遮挡 M 主体） ─────────────────────────────────────
// 坐标系 0 0 16 16，装饰可 overflow 到 (-3, -5) ~ (19, 18) 区间

type DecoNode = React.ReactNode;

function buildDecals(accent: string): DecoNode[] {
    const lc: React.SVGProps<SVGPathElement> = { strokeLinecap: 'round', strokeLinejoin: 'round' };

    // 左峰 (4.2, 1.9)，右峰 (11.8, 1.9)，谷底约 (8, 7)，底 (2,14) (14,14)
    return [
        null, // 0 — 无装饰

        // ── 帽类 ──────────────────────────────────────────────────────────────
        // 1 贝雷帽（左峰上方）
        <g key="1"><ellipse cx="4.2" cy="-0.3" rx="3" ry="0.9" stroke="#555" strokeWidth="0.5" fill="none" />
            <path d="M 1.5 -0.3 Q 3 -3.5 4.2 -3 Q 5.4 -3.5 6.9 -0.3" stroke="#555" strokeWidth="0.5" fill="none" {...lc} /></g>,
        // 2 小皇冠（两峰正上方跨越）
        <g key="2"><path d="M 2.5 0.8 L 4.2 -2 L 8 0 L 11.8 -2 L 13.5 0.8" stroke="#D4A017" strokeWidth="0.6" fill="none" {...lc} /></g>,
        // 3 草帽（居中宽边）
        <g key="3"><ellipse cx="8" cy="-0.5" rx="7" ry="1.2" stroke="#8B6914" strokeWidth="0.5" fill="none" />
            <path d="M 3 -0.5 Q 5 -4 8 -4.5 Q 11 -4 13 -0.5" stroke="#8B6914" strokeWidth="0.5" fill="none" {...lc} /></g>,
        // 4 厨师帽（居中）
        <g key="4"><ellipse cx="8" cy="0.2" rx="4" ry="0.8" stroke="#CCC" strokeWidth="0.5" fill="none" />
            <path d="M 4.5 0.2 Q 4 -3.5 8 -4 Q 12 -3.5 11.5 0.2" stroke="#CCC" strokeWidth="0.5" fill="none" {...lc} /></g>,
        // 5 鸭舌帽（靠右）
        <g key="5"><path d="M 5 0.5 Q 8 -2.5 12 -1.5 Q 13 0 11 0.5 Z" stroke={accent} strokeWidth="0.5" fill={accent} fillOpacity="0.15" {...lc} />
            <path d="M 11 0.5 Q 14 0.8 15 1.5 Q 14 1.8 11 1" stroke={accent} strokeWidth="0.5" fill="none" {...lc} /></g>,
        // 6 牛仔帽（宽边）
        <g key="6"><ellipse cx="8" cy="-0.2" rx="7.5" ry="1.4" stroke="#8B6914" strokeWidth="0.5" fill="none" />
            <path d="M 3 -0.2 Q 5 -4.5 8 -5 Q 11 -4.5 13 -0.2" stroke="#8B6914" strokeWidth="0.5" fill="none" {...lc} /></g>,
        // 7 毕业帽
        <g key="7"><polygon points="8,-4 13,-2 8,0 3,-2" stroke="#333" strokeWidth="0.5" fill="#333" fillOpacity="0.15" />
            <line x1="8" y1="-2" x2="8" y2="1" stroke="#333" strokeWidth="0.4" />
            <line x1="8" y1="-4" x2="12" y2="0.5" stroke="#E87533" strokeWidth="0.4" strokeDasharray="0.6 0.8" /></g>,
        // 8 渔夫帽
        <g key="8"><path d="M 3.5 0.3 Q 5 -3 8 -3.5 Q 11 -3 12.5 0.3 Z" stroke="#4A7C59" strokeWidth="0.5" fill="#4A7C59" fillOpacity="0.1" {...lc} />
            <ellipse cx="8" cy="0.3" rx="5.5" ry="1" stroke="#4A7C59" strokeWidth="0.5" fill="none" /></g>,
        // 9 武侠发髻（中顶）
        <g key="9"><path d="M 7 0 L 8 -4 L 9 0" stroke="#444" strokeWidth="0.6" fill="none" {...lc} />
            <line x1="7.2" y1="-2" x2="8.8" y2="-2" stroke="#444" strokeWidth="0.4" /></g>,
        // 10 天使光环
        <g key="10"><ellipse cx="8" cy="-1.5" rx="5" ry="1.3" stroke="#F5C518" strokeWidth="0.6" fill="none" strokeDasharray="1 0.8" /></g>,

        // ── 头顶物件 ──────────────────────────────────────────────────────────
        // 11 小鸭子（左峰顶）
        <g key="11"><ellipse cx="4.2" cy="-2" rx="1.8" ry="1.4" stroke="#F5A623" strokeWidth="0.5" fill="#F5A623" fillOpacity="0.15" />
            <path d="M 5.2 -2.5 L 7 -2.5 L 6.5 -1.8 Z" stroke="#F5A623" strokeWidth="0.4" fill="#F5A623" />
            <circle cx="6" cy="-2.8" r="0.3" fill="#333" /></g>,
        // 12 小猫耳（两峰外侧）
        <g key="12"><path d="M 2.2 1.5 Q 1.5 -1.5 3 -2 Q 4 -1 3.5 1.5" stroke="#AAA" strokeWidth="0.5" fill="none" {...lc} />
            <path d="M 13.8 1.5 Q 14.5 -1.5 13 -2 Q 12 -1 12.5 1.5" stroke="#AAA" strokeWidth="0.5" fill="none" {...lc} /></g>,
        // 13 兔耳
        <g key="13"><path d="M 3.2 2 Q 2.5 -2 3.5 -4 Q 4.5 -2 4.2 2" stroke="#E0A0B8" strokeWidth="0.6" fill="none" {...lc} />
            <path d="M 12.8 2 Q 13.5 -2 12.5 -4 Q 11.5 -2 11.8 2" stroke="#E0A0B8" strokeWidth="0.6" fill="none" {...lc} /></g>,
        // 14 恶魔小角
        <g key="14"><path d="M 3.2 1.8 L 2 -1.5 L 4.5 0" stroke="#CC3333" strokeWidth="0.55" fill="#CC3333" fillOpacity="0.2" {...lc} />
            <path d="M 12.8 1.8 L 14 -1.5 L 11.5 0" stroke="#CC3333" strokeWidth="0.55" fill="#CC3333" fillOpacity="0.2" {...lc} /></g>,
        // 15 头顶气球（左峰）
        <g key="15"><ellipse cx="4.2" cy="-2.8" rx="1.5" ry="2" stroke="#E87533" strokeWidth="0.5" fill="#E87533" fillOpacity="0.15" />
            <line x1="4.2" y1="-0.8" x2="4.2" y2="0.8" stroke="#E87533" strokeWidth="0.4" strokeDasharray="0.5 0.4" />
            <path d="M 3.5 -0.8 Q 4.2 -0.2 4.9 -0.8" stroke="#E87533" strokeWidth="0.3" fill="none" {...lc} /></g>,
        // 16 小彩虹（顶弧）
        <g key="16">{[{ r: 6.5, c: '#E74C3C' }, { r: 5.2, c: '#F5A623' }, { r: 3.9, c: '#F5C518' }, { r: 2.6, c: '#2ECC71' }].map(({ r, c }, i) =>
            <path key={i} d={`M ${8 - r} 0 A ${r} ${r} 0 0 1 ${8 + r} 0`} stroke={c} strokeWidth="0.55" fill="none" strokeLinecap="round" />)}</g>,
        // 17 云朵（右侧顶）
        <g key="17"><circle cx="12.5" cy="-1.5" r="1.5" stroke="#AAD" strokeWidth="0.4" fill="#EEF" fillOpacity="0.4" />
            <circle cx="14.5" cy="-2" r="1.8" stroke="#AAD" strokeWidth="0.4" fill="#EEF" fillOpacity="0.4" />
            <circle cx="16.5" cy="-1" r="1.3" stroke="#AAD" strokeWidth="0.4" fill="#EEF" fillOpacity="0.4" /></g>,
        // 18 小花（右峰上）
        <g key="18">{[0, 60, 120, 180, 240, 300].map(a => { const x = 11.8 + 2.2 * Math.cos(a * Math.PI / 180), y = -2 + 2.2 * Math.sin(a * Math.PI / 180); return <circle key={a} cx={x} cy={y} r="0.9" stroke="#E87533" strokeWidth="0.4" fill="#E87533" fillOpacity="0.2" />; })}
            <circle cx="11.8" cy="-2" r="1" fill="#F5C518" fillOpacity="0.7" /></g>,
        // 19 蝴蝶（右峰右侧）
        <g key="19"><path d="M 12.5 -0.5 Q 10.5 -2.5 11 -4 Q 12.5 -2.5 12.5 -0.5 Z" stroke="#9B59B6" strokeWidth="0.4" fill="#9B59B6" fillOpacity="0.2" />
            <path d="M 12.5 -0.5 Q 14.5 -2.5 14 -4 Q 12.5 -2.5 12.5 -0.5 Z" stroke="#9B59B6" strokeWidth="0.4" fill="#9B59B6" fillOpacity="0.2" /></g>,
        // 20 小星星簇（左峰）
        <g key="20">{[[3, -3, 0.7], [1.5, -1.5, 0.45], [4.8, -0.5, 0.38]].map(([cx, cy, r], i) =>
            <StarShape key={i} cx={cx as number} cy={cy as number} r={r as number} fill="#F5C518" />)}</g>,
        // 21 小飞机（顶右飞过）
        <g key="21"><path d="M 9 -2.5 L 14 -1 L 15 0 L 11.5 0.5 L 15 1.5 L 14 2.5 L 10.5 1 L 9.5 2.5 L 8.5 2 L 9.8 0.5 Z" stroke="#555" strokeWidth="0.4" fill="#555" fillOpacity="0.15" /></g>,
        // 22 小火箭（顶）
        <g key="22"><path d="M 8 -4.5 Q 8.8 -5.5 9 -3 L 8 -0.5 L 7 -3 Q 7.2 -5.5 8 -4.5 Z" stroke="#555" strokeWidth="0.4" fill="#555" fillOpacity="0.12" />
            <path d="M 7 -1.5 Q 5.5 -0.5 5.5 0.5 L 7 -0.5" stroke="#555" strokeWidth="0.35" fill="none" />
            <path d="M 9 -1.5 Q 10.5 -0.5 10.5 0.5 L 9 -0.5" stroke="#555" strokeWidth="0.35" fill="none" />
            <circle cx="8" cy="-3.8" r="0.7" stroke={accent} strokeWidth="0.3" fill={accent} fillOpacity="0.3" /></g>,
        // 23 机器人天线（中顶）
        <g key="23"><line x1="8" y1="1.5" x2="8" y2="-2.5" stroke="#888" strokeWidth="0.55" />
            <circle cx="8" cy="-3" r="0.9" stroke="#888" strokeWidth="0.45" fill={accent} fillOpacity="0.35" /></g>,
        // 24 小蜗牛（右峰右）
        <g key="24"><path d="M 12 -0.5 Q 13 -3 15 -3 Q 17 -3 17 -1.5 Q 17 0 15 0 Q 14 0 14 -1 Q 14 -1.8 15 -1.8 Q 15.5 -1.8 15.5 -1.3" stroke="#8B6914" strokeWidth="0.45" fill="none" {...lc} />
            <line x1="12.5" y1="-2" x2="11.5" y2="-3.5" stroke="#8B6914" strokeWidth="0.35" /><circle cx="11.3" cy="-3.7" r="0.35" fill="#8B6914" /></g>,

        // ── 配饰类 ────────────────────────────────────────────────────────────
        // 25 领结（谷底下方）
        <g key="25"><path d="M 6.5 10 L 8 11.5 L 9.5 10 L 8 8.5 Z" stroke="#333" strokeWidth="0.5" fill="none" {...lc} /></g>,
        // 26 太阳眼镜（跨 M）
        <g key="26"><rect x="2" y="3.5" rx="1.2" width="4" height="2.8" stroke="#222" strokeWidth="0.5" fill="#000" fillOpacity="0.2" />
            <rect x="10" y="3.5" rx="1.2" width="4" height="2.8" stroke="#222" strokeWidth="0.5" fill="#000" fillOpacity="0.2" />
            <line x1="6" y1="4.9" x2="10" y2="4.9" stroke="#222" strokeWidth="0.5" />
            <line x1="1.2" y1="4.7" x2="2" y2="4.9" stroke="#222" strokeWidth="0.4" />
            <line x1="14" y1="4.9" x2="14.8" y2="4.7" stroke="#222" strokeWidth="0.4" /></g>,
        // 27 圆形书生眼镜（跨 M）
        <g key="27"><circle cx="4.2" cy="4.2" r="2.2" stroke="#555" strokeWidth="0.45" fill="none" />
            <circle cx="11.8" cy="4.2" r="2.2" stroke="#555" strokeWidth="0.45" fill="none" />
            <line x1="6.4" y1="4.2" x2="9.6" y2="4.2" stroke="#555" strokeWidth="0.45" />
            <line x1="1.3" y1="4" x2="2" y2="4.2" stroke="#555" strokeWidth="0.4" />
            <line x1="14" y1="4.2" x2="14.7" y2="4" stroke="#555" strokeWidth="0.4" /></g>,
        // 28 耳机（两侧）
        <g key="28"><path d="M 2 7 Q 0.2 4 0.2 8 L 0.2 10" stroke="#555" strokeWidth="0.5" fill="none" />
            <path d="M 14 7 Q 15.8 4 15.8 8 L 15.8 10" stroke="#555" strokeWidth="0.5" fill="none" />
            <rect x="-1" y="9" width="2.4" height="3" rx="0.6" stroke="#555" strokeWidth="0.45" fill="#555" fillOpacity="0.15" />
            <rect x="14.6" y="9" width="2.4" height="3" rx="0.6" stroke="#555" strokeWidth="0.45" fill="#555" fillOpacity="0.15" /></g>,
        // 29 单片眼镜（绅士）
        <g key="29"><circle cx="4.5" cy="4.5" r="2.5" stroke="#555" strokeWidth="0.5" fill="none" />
            <line x1="7" y1="4" x2="10" y2="3.5" stroke="#555" strokeWidth="0.4" />
            <line x1="0.8" y1="4.3" x2="2" y2="4.5" stroke="#555" strokeWidth="0.4" /></g>,
        // 30 护目镜（跨 M）
        <g key="30"><path d="M 0.5 4.5 Q 1 2.5 4.5 3 Q 6.5 3 7 5 Q 6.5 7 4.5 7 Q 1 7.5 0.5 4.5 Z" stroke={accent} strokeWidth="0.45" fill={accent} fillOpacity="0.08" />
            <path d="M 15.5 4.5 Q 15 2.5 11.5 3 Q 9.5 3 9 5 Q 9.5 7 11.5 7 Q 15 7.5 15.5 4.5 Z" stroke={accent} strokeWidth="0.45" fill={accent} fillOpacity="0.08" />
            <line x1="7" y1="4.8" x2="9" y2="4.8" stroke={accent} strokeWidth="0.5" /></g>,

        // ── 身侧/下方配件 ──────────────────────────────────────────────────────
        // 31 围巾（底部）
        <g key="31"><path d="M 2 13 Q 8 15.5 14 13 Q 12 17 10 16 L 11 19" stroke="#E87533" strokeWidth="0.6" fill="none" strokeLinecap="round" /></g>,
        // 32 领带（谷底下）
        <g key="32"><path d="M 7.2 9.5 L 8 11 L 8.8 9.5 L 8.4 14.5 L 8 15 L 7.6 14.5 Z" stroke={accent} strokeWidth="0.4" fill={accent} fillOpacity="0.2" {...lc} /></g>,
        // 33 斗篷（底部）
        <g key="33"><path d="M 2 14 Q 0 18 3 21 Q 8 23 13 21 Q 16 18 14 14" stroke="#6B21A8" strokeWidth="0.5" fill="#6B21A8" fillOpacity="0.08" {...lc} /></g>,
        // 34 小背包（右侧）
        <g key="34"><rect x="15.5" y="6" width="3.5" height="5" rx="0.8" stroke="#8B6914" strokeWidth="0.45" fill="none" />
            <line x1="15.5" y1="7.8" x2="19" y2="7.8" stroke="#8B6914" strokeWidth="0.35" />
            <path d="M 16.2 6 Q 16.2 4.5 17.2 4.5 Q 18.2 4.5 18.2 6" stroke="#8B6914" strokeWidth="0.4" fill="none" {...lc} /></g>,
        // 35 珍珠项链（底弧）
        <g key="35"><path d="M 2 12 Q 8 15 14 12" stroke="#CCC" strokeWidth="1" fill="none" strokeLinecap="round" />
            {[2.5, 4.5, 6.5, 8, 9.5, 11.5, 13.5].map((x, i) => { const y = 12 + Math.sin((i / 6) * Math.PI) * 2.5; return <circle key={i} cx={x} cy={y} r="0.65" stroke="#AAA" strokeWidth="0.3" fill="white" />; })}
        </g>,
        // 36 咖啡杯（右下角）
        <g key="36"><rect x="14.5" y="11" width="3.5" height="2.8" rx="0.5" stroke="#8B6914" strokeWidth="0.45" fill="none" />
            <path d="M 18 11.6 Q 19.5 11.6 19.5 12.4 Q 19.5 13.2 18 13.2" stroke="#8B6914" strokeWidth="0.4" fill="none" {...lc} />
            <path d="M 15.5 11 Q 15.5 9.5 16.5 9.5 Q 17.5 9.5 17.5 11" stroke="#8B6914" strokeWidth="0.35" fill="none" {...lc} /></g>,
        // 37 蛋糕（右侧底）
        <g key="37"><rect x="13" y="11.5" width="5" height="3.5" rx="0.5" stroke="#E0A0B8" strokeWidth="0.45" fill="#E0A0B8" fillOpacity="0.12" />
            <line x1="15.5" y1="11.5" x2="15.5" y2="9.5" stroke="#E87533" strokeWidth="0.4" />
            <ellipse cx="15.5" cy="9.3" rx="0.6" ry="0.4" fill="#F5C518" fillOpacity="0.7" /></g>,
        // 38 书本（左侧底）
        <g key="38"><rect x="-3" y="10" width="2.8" height="4" rx="0.5" stroke={accent} strokeWidth="0.45" fill={accent} fillOpacity="0.1" />
            <line x1="-2.5" y1="12" x2="-0.5" y2="12" stroke={accent} strokeWidth="0.3" />
            <line x1="-2.5" y1="13" x2="-0.5" y2="13" stroke={accent} strokeWidth="0.3" /></g>,

        // ── 氛围装饰 ──────────────────────────────────────────────────────────
        // 39 花环（顶弧路径）
        <g key="39">{[0, 25, 50, 75, 100, 125, 150, 175].map((deg, i) => { const a = (deg - 87) * Math.PI / 180; const x = 8 + 8.5 * Math.cos(a), y = 1 + 3.5 * Math.sin(a); const colors = ['#E74C3C', '#F5C518', '#2ECC71', '#E87533', '#9B59B6', accent, '#E0A0B8', '#60A5FA']; return <circle key={i} cx={x} cy={y} r="0.9" stroke={colors[i % 8]} strokeWidth="0.3" fill={colors[i % 8]} fillOpacity="0.3" />; })}</g>,
        // 40 彩色圆点雨（散落）
        <g key="40">{[[1, 3, '#F5C518'], [15, 2, '#E74C3C'], [13, 7, '#2ECC71'], [-1, 10, accent], [16, 12, '#E87533']].map(([x, y, c], i) =>
            <circle key={i} cx={x as number} cy={y as number} r="0.55" fill={c as string} fillOpacity="0.6" />)}</g>,
        // 41 心形（谷底）
        <g key="41"><path d="M 8 10.5 Q 6.5 9 7 7.8 Q 7.5 6.5 8 7.5 Q 8.5 6.5 9 7.8 Q 9.5 9 8 10.5 Z" stroke="#E74C3C" strokeWidth="0.4" fill="#E74C3C" fillOpacity="0.25" {...lc} /></g>,
        // 42 小下雨云（左上）
        <g key="42"><ellipse cx="3.5" cy="-2" rx="2.8" ry="1.5" stroke="#88B" strokeWidth="0.45" fill="#EEF" fillOpacity="0.4" />
            {[2, 3.5, 5].map((x, i) => <line key={i} x1={x} y1="-0.5" x2={x - 0.3} y2="1" stroke="#88B" strokeWidth="0.4" strokeDasharray="0.3 0.5" />)}</g>,
        // 43 小雪花（右上）
        <g key="43">{[0, 60, 120].map(a => { const r = 1.5, x = 14 + r * Math.cos(a * Math.PI / 180), y = -2 + r * Math.sin(a * Math.PI / 180); return <g key={a}><line x1="14" y1="-2" x2={x} y2={y} stroke="#AAD" strokeWidth="0.45" /><line x1="14" y1="-2" x2={14 - (x - 14)} y2={-2 - (y + 2)} stroke="#AAD" strokeWidth="0.45" /></g>; })}
            <circle cx="14" cy="-2" r="0.4" fill="#AAD" /></g>,
        // 44 小闪电（右峰右）
        <g key="44"><path d="M 13.5 -4 L 12 -1 L 13.5 -1 L 12 2" stroke="#F5C518" strokeWidth="0.6" fill="none" {...lc} /></g>,
        // 45 小月亮（左上）
        <g key="45"><path d="M 1 -3.5 Q -0.5 -1.5 1.5 0 Q -1.5 0 -1.5 -1.8 Q -1.5 -4 1 -3.5 Z" stroke="#F5C518" strokeWidth="0.4" fill="#F5C518" fillOpacity="0.2" {...lc} /></g>,
        // 46 钻石（左下侧）
        <g key="46"><polygon points="-1,9 1,7 3,9 1,13" stroke={accent} strokeWidth="0.45" fill={accent} fillOpacity="0.15" /></g>,
        // 47 小音符（右下侧）
        <g key="47"><path d="M 17 8 L 17 12 M 19 7.5 L 19 11.5" stroke="#555" strokeWidth="0.5" strokeLinecap="round" />
            <ellipse cx="16" cy="12.5" rx="1.2" ry="0.8" stroke="#555" strokeWidth="0.4" fill="#555" fillOpacity="0.2" />
            <ellipse cx="18" cy="12" rx="1.2" ry="0.8" stroke="#555" strokeWidth="0.4" fill="#555" fillOpacity="0.2" />
            <line x1="17" y1="8" x2="19" y2="7.5" stroke="#555" strokeWidth="0.4" /></g>,
        // 48 眼镜 + 贝雷帽（组合）
        <g key="48"><ellipse cx="4.2" cy="-0.3" rx="2.5" ry="0.8" stroke="#555" strokeWidth="0.5" fill="none" />
            <path d="M 1.7 -0.3 Q 3 -2.5 4.2 -2 Q 5.4 -2.5 6.7 -0.3" stroke="#555" strokeWidth="0.5" fill="none" {...lc} />
            <circle cx="4.2" cy="4.2" r="2" stroke="#555" strokeWidth="0.42" fill="none" />
            <circle cx="11.8" cy="4.2" r="2" stroke="#555" strokeWidth="0.42" fill="none" />
            <line x1="6.2" y1="4.2" x2="9.8" y2="4.2" stroke="#555" strokeWidth="0.42" /></g>,
        // 49 小宇宙（满天星）
        <g key="49">{[[-1.5, 5], [1, -4], [5.5, -5.5], [10.5, -5], [15.5, -3], [17, 4], [16.5, 12], [-.5, 12]].map(([x, y], i) =>
            <circle key={i} cx={x} cy={y} r={i % 2 === 0 ? 0.55 : 0.35} fill={i % 3 === 0 ? '#F5C518' : i % 3 === 1 ? accent : '#E74C3C'} fillOpacity="0.7" />)}</g>,
    ];
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

const MomentAvatar: React.FC<MomentAvatarProps> = ({
    variant = 0,
    mood = 'calm',
    status = 'idle',
    size = 40,
    accentColor = '#006ebc',
    className,
    style,
}) => {
    const uid = useId().replace(/:/g, '');
    const filterId = `msk-${uid}-${variant}`;

    const safeVariant = Math.max(0, Math.min(49, Math.round(variant)));
    const mCfg = MOOD[mood] ?? MOOD.calm;
    const mPath = buildMPath(mCfg);

    const decals = React.useMemo(() => buildDecals(accentColor), [accentColor]);
    const decoNode = decals[safeVariant] ?? null;

    // ── 整体容器的状态动画 ──
    const containerAnim = status === 'idle'
        ? { scale: [1, 1.02, 1], transition: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' as const } }
        : status === 'summarizing'
            ? { y: [0, -1, 0], transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const } }
            : { rotate: [-1.2, 1.2, -1.2], transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' as const } };

    // ── 眼点的 pulse 动画 ──
    const eyePulse = status === 'summarizing'
        ? { scale: [1, 1.5, 1], opacity: [0.8, 1, 0.8], transition: { duration: 0.7, repeat: Infinity, ease: 'easeInOut' as const } }
        : { scale: [1, 1.15, 1], transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' as const } };

    return (
        <motion.div
            className={className}
            style={{ width: size, height: size, display: 'inline-block', flexShrink: 0, ...style }}
            animate={containerAnim}
            whileHover={{ scale: 1.12, transition: { type: 'spring', stiffness: 380, damping: 18 } }}
        >
            <svg
                width={size}
                height={size}
                viewBox="-3 -6 22 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ overflow: 'visible' }}
                aria-label="Moment"
            >
                <defs>
                    {/* 极轻微手绘质感扰动（scale 小，不破坏识别度） */}
                    <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed={safeVariant + 1} result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.25" xChannelSelector="R" yChannelSelector="G" />
                    </filter>
                </defs>

                {/* ── 装饰层（overflow，不走 filter，保持清晰） ── */}
                <g opacity="0.9">
                    {decoNode}
                </g>

                <g filter={`url(#${filterId})`}>
                    {/* ── M 主体笔画 (draw-on entry + continuous) ── */}
                    <motion.path
                        d={mPath}
                        stroke="#1a1a1a"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        /* entry 动画：pathLength 0→1 = 书写感 */
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{
                            pathLength: status === 'summarizing'
                                ? [0, 1, 0]
                                : 1,
                            opacity: 1,
                        }}
                        transition={
                            status === 'summarizing'
                                ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' as const }
                                : { pathLength: { duration: 0.9, ease: 'easeOut' as const }, opacity: { duration: 0.3 } }
                        }
                    />

                    {/* ── 左眼（叠加在左峰 4.2, 1.9） ── */}
                    <motion.g animate={eyePulse} style={{ originX: '4.2px', originY: '1.9px' }}>
                        <EyeMark cx={4.2} cy={1.9} shape={mCfg.eyeLeftShape} r={mCfg.eyeRadius} color="#1a1a1a" />
                    </motion.g>

                    {/* ── 右眼（叠加在右峰 11.8, 1.9） ── */}
                    <motion.g animate={eyePulse} style={{ originX: '11.8px', originY: '1.9px' }}>
                        <EyeMark cx={11.8} cy={1.9} shape={mCfg.eyeRightShape} r={mCfg.eyeRadius} color="#1a1a1a" />
                    </motion.g>

                    {/* ── ✦ Sparkles（右上角外侧） ── */}
                    <SparklesOverlay status={status} accent={accentColor} />
                </g>
            </svg>
        </motion.div>
    );
};

export default MomentAvatar;

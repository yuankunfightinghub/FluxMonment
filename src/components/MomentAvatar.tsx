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

import React from 'react';
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

// ─── 几何纯粹的品牌 'M' 面部图形 (16x16 Grid) ─────────────────────────────────────────

const BaseLegs = () => (
    <>
        <path d="M 3.5 15 C 3.5 10 4.5 5 4.5 3.5" />
        <path d="M 12.5 15 C 12.5 10 11.5 5 11.5 3.5" />
    </>
);

const BaseDots = () => (
    <>
        <circle cx="4.5" cy="3.5" r="1.4" fill="#1a1a1a" stroke="none" />
        <circle cx="11.5" cy="3.5" r="1.4" fill="#1a1a1a" stroke="none" />
    </>
);

const BaseBridge = () => (
    <path d="M 4.5 3.5 C 4.5 14 11.5 14 11.5 3.5" />
);

// 为确保 M 字符（图标骨架）不被破坏，所有情绪基础必须包含 BaseLegs + BaseBridge
const StandardM = () => (
    <>
        <BaseLegs />
        <BaseDots />
        <BaseBridge />
    </>
);

const MOOD_SHAPES: Record<MoodType, React.ReactNode> = {
    calm: <StandardM />,
    happy: (
        <>
            <BaseLegs />
            <BaseBridge />
            {/* 眯着笑的眼睛 */}
            <path d="M 3.5 3.5 Q 4.5 2 5.5 3.5" />
            <path d="M 10.5 3.5 Q 11.5 2 12.5 3.5" />
        </>
    ),
    focused: (
        <>
            <BaseLegs />
            <BaseBridge />
            {/* 专注的圆点眼，并且加两道小汗滴或专注线 */}
            <BaseDots />
            <path d="M 3.5 0 L 3.5 1.5" strokeWidth="0.8" />
            <path d="M 12.5 0 L 12.5 1.5" strokeWidth="0.8" />
        </>
    ),
    excited: (
        <>
            <BaseLegs />
            <BaseBridge />
            {/* 兴奋的大眼睛 */}
            <circle cx="4.5" cy="3.5" r="1.8" fill="#1a1a1a" stroke="none" />
            <circle cx="11.5" cy="3.5" r="1.8" fill="#1a1a1a" stroke="none" />
            <path d="M 3 1 L 4.5 2" strokeWidth="0.8" />
            <path d="M 13 1 L 11.5 2" strokeWidth="0.8" />
        </>
    ),
    tired: (
        <>
            <BaseLegs />
            <BaseBridge />
            {/* 疲惫的平线眼 */}
            <line x1="3.5" y1="3.5" x2="5.5" y2="3.5" strokeWidth="1.2" />
            <line x1="10.5" y1="3.5" x2="12.5" y2="3.5" strokeWidth="1.2" />
        </>
    ),
    playful: (
        <>
            <BaseLegs />
            <BaseBridge />
            {/* 一大一小眼或眨眼 */}
            <circle cx="4.5" cy="3.5" r="1.6" fill="#1a1a1a" stroke="none" />
            <line x1="10.5" y1="3.5" x2="12.5" y2="3.5" strokeWidth="1.2" />
        </>
    ),
    proud: (
        <>
            <BaseLegs />
            <BaseBridge />
            <BaseDots />
            {/* 得意的小脸颊红晕 */}
            <circle cx="2.5" cy="5.5" r="0.8" fill="#FFA07A" stroke="none" fillOpacity="0.8" />
            <circle cx="13.5" cy="5.5" r="0.8" fill="#FFA07A" stroke="none" fillOpacity="0.8" />
        </>
    ),
    curious: (
        <>
            <BaseLegs />
            <BaseBridge />
            <BaseDots />
            {/* 好奇的问号特征（这里简化为眼睛稍大＋稍高） */}
            <circle cx="11.5" cy="2.5" r="1.4" fill="#1a1a1a" stroke="none" />
        </>
    ),
    cozy: (
        <>
            <BaseLegs />
            <BaseBridge />
            {/* 慵懒放松的弯眼（下弯） */}
            <path d="M 3.5 3.5 Q 4.5 4.5 5.5 3.5" />
            <path d="M 10.5 3.5 Q 11.5 4.5 12.5 3.5" />
        </>
    ),
    adventurous: <StandardM />
};

// ─── ✦ Sparkles（右上角，M 外溢区域，暂做静态处理） ───────────────────────

// ─── ✦ 装饰体系 (暂做纯粹偏移处理，保障尺寸正确) ─────────────────────────

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
        // 23 取消使用，暂留空槽
        null,
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

// ─── 50 种装饰（纯浮空，不遮挡主体） ─────────────────────────────────────
// 坐标系 0 0 16 16，装饰可 overflow 到 (-3, -5) ~ (19, 18) 区间
// 这里省略大量代码不修改，保持 buildDecals...
// ... (之前的 buildDecals 完全通过前一个修改块的上部保留了)

// ─── 主组件 ───────────────────────────────────────────────────────────────────

const MomentAvatar: React.FC<MomentAvatarProps> = ({
    variant = 0,
    mood = 'calm',
    size = 40,
    accentColor = '#006ebc',
    className,
    style,
}) => {
    const safeVariant = Math.max(0, Math.min(49, Math.round(variant)));
    const activeShapes = MOOD_SHAPES[mood] ?? MOOD_SHAPES.calm;

    const decals = React.useMemo(() => buildDecals(accentColor), [accentColor]);
    const decoNode = decals[safeVariant] ?? null;

    return (
        <div
            className={className}
            style={{ width: size, height: size, display: 'inline-block', flexShrink: 0, ...style }}
        >
            {/* Pure geometric rendering. Exact 16x16 grid space mapping properly to viewport. */}
            <svg
                width={size}
                height={size}
                viewBox="0 0 16 16"
                fill="none"
                stroke="#1a1a1a"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
                style={{ overflow: 'visible' }}
                aria-label="Moment"
            >
                {/* ── 主体面部图形 (16x16 Grid) ── */}
                {activeShapes}

                {/* ── 装饰层（偏移适配新的 4.5 锚点位） ── */}
                {decoNode && (
                    <g style={{ transform: 'translate(0.3px, 1.6px)' }}>
                        {decoNode}
                    </g>
                )}

                {/* ── 极简星（当无其它装饰时致敬图例 TINY SPARKLE 显示微弱的高光星位） ── */}
                {safeVariant === 0 && (
                    <path d="M 14.5 0.5 Q 14.5 1.5 15.5 1.5 Q 14.5 1.5 14.5 2.5 Q 14.5 1.5 13.5 1.5 Q 14.5 1.5 14.5 0.5 Z" fill={accentColor} stroke="none" />
                )}
            </svg>
        </div>
    );
};

export default MomentAvatar;

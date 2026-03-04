import type { EventThread, EventCategory, TimelineEntry, MoodType } from '../types.js';

/**
 * 核心 AI 逻辑配置文件 - 供 Web 前端与 MCP Server 共用
 * 确保龙虾输入与网页输入的分类、视觉方案完全一致
 */

export interface LLMAnalysisResult {
    matchedThreadId: string | null;
    title: string;
    category: EventCategory;
    tags: string[];
    mood: MoodType;
    avatarVariant: number;
}

/**
 * 构建与网页端完全一致的 Prompt
 */
export function buildSharedPrompt(content: string, existingThreads: EventThread[]): string {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();
    const recentThreads = existingThreads
        .filter(t => now - t.lastUpdatedAt <= ONE_HOUR_MS)
        .map(t => ({ id: t.id, title: t.title, category: t.category.name }));

    return `你是一个个人时刻记录助手，负责分析用户输入并返回严格的 JSON。请执行以下【输入分级策略】与【逻辑提取】：

### 第一步：判定输入评级 (Internal Grading)
- **Grade A (核心事实)**: 包含明确动作、对象或成果。如：“解决XX问题”、“完成XX部署”。
- **Grade B (碎碎念/情感)**: 描述心情、琐事或感悟。如：“今天好累”、“想去旅行”。
- **Grade C (无效/噪声)**: 极短、符号、乱码或测试词。如：“...”、“123”。

### 第二步：提取规则 (Strict Rule)
1. **Grade A 极简公式**: 标题 = [核心实体 + 状态]。必须剔除“问题”、“解决”、“任务”、“进行”、“完成”等冗余动向词。
   - 范例：“数据源付费墙豁免问题已解决” -> **“付费墙豁免”**
   - 范例：“完成商业化弹窗验收” -> **“弹窗验收”**
2. **Grade B 感性公式**: 标题使用具象描述短句，侧重情感表达。
3. **Grade C 兜底逻辑**: 标题统一返回“瞬时闪念”，标签统一为 ["碎片"]。

### 第三步：返回 JSON 结构
{
  "category": {
    "name": "分类(6字内，如：业务研发、亲子时光、生活杂记)",
    "theme": "cyber-blue 或 sunset-orange"
  },
  "title": "标题（严格按上述分级策略提炼）",
  "tags": ["核心标签1", "核心标签2"],
  "mood": "从以下选一：happy, excited, proud, playful, curious, focused, calm, cozy, tired, adventurous",
  "avatarVariant": 22,
  "matchedThreadId": "历史 id 或 null（极其严格：若当前输入与历史卡片的具体业务主体、功能点、特定对象发生任何偏移，必须返回 null。严禁仅因共享‘数据源’、‘AI’等通用关键词而合并！）"
}

【图标分发指南 (avatarVariant 小图标数字 0-49)】:
- 核心产出/成就/验收：22(火箭), 2(皇冠), 44(闪电)
- 沉浸工作/深度思考：28(耳机), 29(单片眼镜), 27(书生眼镜), 32(领带), 38(书本)
- 饮食/美食/休闲：36(咖啡杯), 37(蛋糕), 4(厨师帽)
- 娱乐/庆祝/艺术：47(音符), 40(彩色点阵), 26(墨镜), 16(彩虹)
- 出行/旅行/自然：21(小飞机), 34(小背包), 5(鸭舌帽), 17(白云), 42(雨云), 43(雪花)
- 日常/可爱/心情：11(小鸭子), 12(猫耳), 13(兔耳), 41(红心), 35(项链)

用户输入：
"${content}"

最近已有话题卡片：
${recentThreads.length > 0 ? JSON.stringify(recentThreads) : '（暂无）'}

请仅返回 JSON 文本。`;
}

/**
 * 确定性的小图标计算（根据分类和内容 hash，保证即便 AI 挂了图标也一致）
 */
export function pickAvatarVariant(text: string, categoryName: string): number {
    const combined = categoryName + text.slice(0, 30);
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = (hash * 31 + combined.charCodeAt(i)) >>> 0;
    }
    return hash % 50;
}

/**
 * 解析并标准化 LLM 的返回结果
 */
export function parseLLMResponse(raw: string, originalContent: string, existingThreads: EventThread[]): LLMAnalysisResult {
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(jsonText);

    const rawTheme = parsed.category?.theme || parsed.theme;
    const rawCategoryName = parsed.category?.name || parsed.categoryName || '工作学习';

    const category: EventCategory = {
        name: String(rawCategoryName),
        theme: rawTheme === 'sunset-orange' ? 'sunset-orange' : 'cyber-blue',
    };

    const title = String(parsed.title ?? '生活记录');
    const tags: string[] = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : [];
    const mood = (parsed.mood as MoodType) ?? 'calm';
    const matchedThreadId = typeof parsed.matchedThreadId === 'string' ? parsed.matchedThreadId : null;

    // 优先使用 AI 返回的图标，如果没有则根据分类哈希一个
    let avatarVariantNum = pickAvatarVariant(originalContent, category.name);
    if (parsed.avatarVariant !== undefined && parsed.avatarVariant !== null) {
        const match = String(parsed.avatarVariant).match(/\d+/);
        if (match) {
            const num = parseInt(match[0], 10);
            if (num >= 0 && num <= 49) avatarVariantNum = num;
        }
    }

    // 校验 matchedThreadId 是否真实存在
    const validMatchedId = existingThreads.some(t => t.id === matchedThreadId) ? matchedThreadId : null;
    const matchedTitle = existingThreads.find(t => t.id === validMatchedId)?.title ?? title;

    return {
        matchedThreadId: validMatchedId,
        title: matchedTitle,
        category,
        tags,
        mood,
        avatarVariant: avatarVariantNum,
    };
}

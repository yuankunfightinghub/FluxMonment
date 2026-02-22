import type { EventThread, EventCategory, TimelineEntry, MediaAttachment, MoodType } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock LLM Service Response Type
 */
interface LLMAnalysisResult {
    matchedThreadId: string | null;
    title: string;
    category: EventCategory;
    tags: string[];      // AI-extracted keyword tags, max 5
    mood: MoodType;      // emotional tone
    avatarVariant: number; // 0-49
}

/**
 * Mock tag extraction — simulates an LLM extracting topical keywords.
 * Priority: domain-specific work lines (商业化/AI助理/数据连接) → general work → life themes.
 * Max 5 tags per card.
 */
function extractTags(text: string, isWork: boolean): string[] {
    const tags: string[] = [];

    if (isWork) {
        // (a) Work product line detection
        if (/(商业化|变现|广告|营收|商务|客户|合同|报价)/.test(text)) tags.push('商业化');
        if (/(ai|人工智能|大模型|gpt|gemini|助理|智能体|agent)/.test(text)) tags.push('AI 助理');
        if (/(数据|连接|接口|api|数据源|pipeline|etl|集成)/.test(text)) tags.push('数据连接');

        // (b) Work action keywords
        if (/(需求|prd|文档|功能点)/.test(text)) tags.push('需求');
        if (/(方案|规划|设计|架构|路线图)/.test(text)) tags.push('方案设计');
        if (/(上线|发布|灰度|发版|部署)/.test(text)) tags.push('发布上线');
        if (/(评审|对齐|开会|汇报|讨论|同步)/.test(text)) tags.push('沟通协作');
        if (/(运营|增长|dau|留存|转化|活动)/.test(text)) tags.push('运营增长');
        if (/(bug|测试|qa|验证|修复)/.test(text)) tags.push('质量保障');
        if (/(用户|反馈|调研|访谈|nps)/.test(text)) tags.push('用户洞察');
    } else {
        // (c) Life theme keywords
        if (/(孩子|宝宝|带娃|亲子|陪伴|学校|幼儿|小朋友)/.test(text)) tags.push('亲子时光');
        if (/(电影|剧|看片|动漫|演出|concert|综艺)/.test(text)) tags.push('影视娱乐');
        if (/(吃|美食|餐厅|面|奶茶|咖啡|烧烤|火锅|甜品)/.test(text)) tags.push('美食探店');
        if (/(旅行|出游|景区|民宿|机票|酒店)/.test(text)) tags.push('旅行出游');
        if (/(运动|健身|跑步|骑行|游泳|球|锻炼)/.test(text)) tags.push('运动健康');
        if (/(读书|书|阅读|学习|课程|笔记)/.test(text)) tags.push('阅读学习');
        if (/(朋友|聚会|闺蜜|约|撸串|喝酒)/.test(text)) tags.push('社交聚会');
        if (/(周末|假期|放假|休息|养精蓄锐)/.test(text)) tags.push('休闲放松');
    }

    // Deduplicate and cap at 5
    return [...new Set(tags)].slice(0, 5);
}

/**
 * Detect emotional tone from text content.
 */
function detectMood(text: string, isWork: boolean): MoodType {
    if (/(疲惫|累|困|加班|熬夜|崩溃|焦虑|压力|好难|太难)/.test(text)) return 'tired';
    if (/(兴奋|太棒了|awesome|赞|惊喜|期待|发现|厉害|wow|牛|！！)/.test(text)) return 'excited';
    if (/(开心|快乐|哈哈|哈|😄|😊|🎉|好玩|好笑|搞笑|有趣)/.test(text)) return 'happy';
    if (/(旅行|出游|探索|冒险|骑行|爬山|攀登|户外|海边|远足)/.test(text)) return 'adventurous';
    if (/(孩子|宝宝|带娃|陪玩|玩游戏|躺平|摸鱼|懒|休息|睡)/.test(text)) return 'cozy';
    if (/(思考|想了很久|为什么|怎么|原来|学到|理解|领悟|好奇)/.test(text)) return 'curious';
    if (/(完成|收工|搞定|成功|上线|发布|达成|自豪|厉害|💪)/.test(text)) return 'proud';
    if (/(专注|在做|进行中|埋头|研究|攻克|盯着)/.test(text) || isWork) return 'focused';
    if (/(咖啡|下午茶|散步|惬意|舒服|享受|放松|慢|慵懒|静)/.test(text)) return 'calm';
    if (/(小朋友|玩|整活|有趣|逗|搞|玩梗|哈哈哈)/.test(text)) return 'playful';
    return isWork ? 'focused' : 'calm';
}

/**
 * Pick a deterministic avatar variant (0-49) from text content hash.
 * Same category + similar content stays visually consistent.
 */
function pickAvatarVariant(text: string, categoryName: string): number {
    const combined = categoryName + text.slice(0, 30);
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = (hash * 31 + combined.charCodeAt(i)) >>> 0;
    }
    return hash % 50;
}

// ─── SiliconFlow API ────────────────────────────────────────────────────────────
// 用户给定的硅基流动 Key，如果未在环境变量中配置则默认使用传入的 sk-xxxxxxxx
const SILICONFLOW_API_KEY = (import.meta.env.VITE_SILICONFLOW_API_KEY as string | undefined) || 'sk-xxxxxxxx';
const SILICONFLOW_ENDPOINT = 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL_NAME = 'deepseek-ai/DeepSeek-V3'; // 硅基流动支持的强大且便宜的模型

/**
 * Build the structured prompt for LLM.
 * We pass recent threads so LLM can decide whether to merge.
 */
function buildPrompt(content: string, existingThreads: EventThread[]): string {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const now = Date.now();
    const recentThreads = existingThreads
        .filter(t => now - t.lastUpdatedAt <= TWO_HOURS_MS)
        .map(t => ({ id: t.id, title: t.title, category: t.category.name }));

    return `你是一个个人时刻记录助手，分析用户输入的一条记录，返回严格的 JSON 格式分析结果。

用户输入：
"${content}"

最近 2 小时内已有的话题卡片（可能为空）：
${recentThreads.length > 0 ? JSON.stringify(recentThreads, null, 2) : '（暂无）'}

请返回以下 JSON（仅返回 JSON，不要 markdown 代码块，不要其他文字）：
{
  "category": {
    "name": "子分类名字（简洁提取输入内容中做的事项或讨论内容的总结主题，如：方案评审、接口开发、带娃玩耍、美食探店等，8字以内）",
    "theme": "cyber-blue 或 sunset-orange（工作/学习类用 cyber-blue，生活/休闲类用 sunset-orange）"
  },
  "title": "卡片标题（10字以内，简洁概括这条记录的核心事件，类似新闻标题）",
  "tags": ["关键词1", "关键词2"],
  "mood": "从以下选一个：happy、excited、proud、playful、curious、focused、calm、cozy、tired、adventurous",
  "matchedThreadId": "如果语义上应该合并到已有某个话题卡片，填其 id；否则填 null"
}

注意：
- tags 最多 5 个。
- 业务互斥逻辑：对于工作类（cyber-blue），“商业化”、“数据连接”、“AI 助理”是互斥的标签，每条记录只能在 tags 中包含其中【最多一个】。
- matchedThreadId 只能是上面已有卡片的 id，或 null。
- 仅返回 JSON，不含任何额外说明。`;
}


/**
 * Call SiliconFlow API (OpenAI format) and parse the response into LLMAnalysisResult.
 */
async function callSiliconFlow(content: string, existingThreads: EventThread[]): Promise<LLMAnalysisResult> {
    const prompt = buildPrompt(content, existingThreads);

    console.group('🤖 SiliconFlow AI 分析中...');
    console.log('%c[AI] Input Content:', 'color: #9b59b6; font-weight: bold;', content);
    console.log('%c[AI] Generated Prompt:', 'color: #3498db; font-weight: bold;', prompt);

    const res = await fetch(SILICONFLOW_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SILICONFLOW_API_KEY}`
        },
        body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
                { role: 'system', content: '你是一个严格输出 JSON 的 AI 助手。除了 JSON 数据之外不要输出任何 markdown 格式！' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 1024,
            response_format: { type: 'json_object' } // 要求强制 JSON 输出
        }),
        signal: AbortSignal.timeout(15000), // OpenAI format might be slower, give it 15s
    });

    if (!res.ok) {
        console.error('[AI] SiliconFlow 调用失败:', res.status);
        console.groupEnd();
        throw new Error(`SiliconFlow API 错误 ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '{}';

    console.log('%c[AI] SiliconFlow Response:', 'color: #2ecc71; font-weight: bold;', raw);
    console.groupEnd();

    // 解析 JSON
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(jsonText);

    // Normalise and validate
    const category: EventCategory = {
        name: String(parsed.category?.name ?? '生活杂记'),
        theme: parsed.category?.theme === 'cyber-blue' ? 'cyber-blue' : 'sunset-orange',
    };
    const title = String(parsed.title ?? '生活记录');
    const tags: string[] = Array.isArray(parsed.tags)
        ? parsed.tags.slice(0, 5).map(String)
        : [];
    const mood = (parsed.mood as MoodType) ?? 'calm';
    const matchedThreadId = typeof parsed.matchedThreadId === 'string'
        ? parsed.matchedThreadId
        : null;
    const avatarVariant = pickAvatarVariant(content, category.name);

    // Verify matchedThreadId actually exists in current threads
    const validMatchedId = existingThreads.some(t => t.id === matchedThreadId)
        ? matchedThreadId
        : null;
    const matchedTitle = existingThreads.find(t => t.id === validMatchedId)?.title ?? title;

    return {
        matchedThreadId: validMatchedId,
        title: matchedTitle,
        category,
        tags,
        mood,
        avatarVariant,
    };
}

/**
 * Regex-based fallback (the original mock logic, preserved verbatim).
 */
function regexFallback(content: string, existingThreads: EventThread[]): LLMAnalysisResult {
    const text = content.toLowerCase();
    let category: EventCategory = { name: '生活杂记', theme: 'sunset-orange' };
    let title = '生活记录';
    const isWork = /(需求|方案|产品|运营|互联网|开会|汇报|进度|工作|设计|评审|上线|迭代|测试|ai|大模型|商业化|数据|接口|增长|用户|发布)/.test(text);
    if (isWork) {
        category.theme = 'cyber-blue';
        if (/(开会|评审|汇报|对齐|讨论|同步)/.test(text)) { category.name = '会议与沟通'; title = '工作协同与会议'; }
        else if (/(需求|方案|设计|迭代|上线|产品|prd)/.test(text)) { category.name = '产品与方案'; title = '产品推进记录'; }
        else if (/(运营|增长|dau|留存|转化|活动)/.test(text)) { category.name = '运营增长'; title = '运营动作记录'; }
        else { category.name = '日常工作'; title = '日常事务办理'; }
    } else {
        if (/(电影|剧|院线|看片|动漫|演出|听歌|concert)/.test(text)) { category.name = '影视娱乐'; title = '文化娱乐时刻'; }
        else if (/(孩子|宝宝|带娃|亲子|幼儿|小朋友)/.test(text)) { category.name = '亲子时光'; title = '与孩子在一起'; }
        else if (/(吃|面|奶茶|饭|美食|餐厅|喝|咖啡)/.test(text)) { category.name = '饮食美食'; title = '美味探索小记'; }
        else if (/(旅行|周末去|风景|爬山|海边|游玩|散步)/.test(text)) { category.name = '休闲出游'; title = '放松出游时刻'; }
        else if (/(运动|健身|跑步|骑行|游泳)/.test(text)) { category.name = '运动健康'; title = '活力运动记录'; }
    }
    const tags = extractTags(text, isWork);
    const mood = detectMood(text, isWork);
    const avatarVariant = pickAvatarVariant(text, category.name);
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const now = Date.now();
    let matchedThreadId: string | null = null;
    let matchedThreadTitle = title;
    for (const thread of existingThreads) {
        if (thread.category.name === category.name && now - thread.lastUpdatedAt <= TWO_HOURS_MS) {
            matchedThreadId = thread.id;
            matchedThreadTitle = thread.title;
            break;
        }
    }
    return { matchedThreadId, title: matchedThreadTitle, category, tags, mood, avatarVariant };
}

/**
 * Main dispatcher: try SiliconFlow first, fall back to regex on any error.
 */
async function llmAnalysis(content: string, existingThreads: EventThread[]): Promise<LLMAnalysisResult> {
    if (SILICONFLOW_API_KEY) {
        try {
            const result = await callSiliconFlow(content, existingThreads);
            console.info('[AI] SiliconFlow 分析完成');
            return result;
        } catch (e) {
            console.warn('[AI] SiliconFlow 调用失败，降级为正则引擎：', e);
        }
    }
    return regexFallback(content, existingThreads);
}


/**
 * The main smart dispatcher called by App.tsx
 */
export async function processAndAggregateInput(
    content: string,
    currentThreads: EventThread[],
    attachments?: MediaAttachment[]
): Promise<{ updatedThreads: EventThread[], highlightThreadId: string }> {
    const analysis = await llmAnalysis(content, currentThreads);

    const newEntry: TimelineEntry = {
        id: uuidv4(),
        content: content,
        timestamp: Date.now(),
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };

    let updatedThreads = [...currentThreads];
    let highlightThreadId = '';

    if (analysis.matchedThreadId) {
        updatedThreads = updatedThreads.map(thread => {
            if (thread.id === analysis.matchedThreadId) {
                // Merge tags — keep parent tags + any new unique ones, cap at 5
                const mergedTags = [...new Set([...thread.tags, ...analysis.tags])].slice(0, 5);
                return {
                    ...thread,
                    entries: [...thread.entries, newEntry],
                    tags: mergedTags,
                    mood: analysis.mood,
                    lastUpdatedAt: Date.now()
                };
            }
            return thread;
        });
        highlightThreadId = analysis.matchedThreadId;
    } else {
        const newThread: EventThread = {
            id: uuidv4(),
            title: analysis.title,
            category: analysis.category,
            tags: analysis.tags,
            entries: [newEntry],
            lastUpdatedAt: Date.now(),
            mood: analysis.mood,
            avatarVariant: analysis.avatarVariant,
        };
        updatedThreads = [newThread, ...updatedThreads];
        highlightThreadId = newThread.id;
    }

    updatedThreads.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);

    return { updatedThreads, highlightThreadId };
}

// Fast sync classifier for live capsule glow
export function predictTopicTheme(text: string): EventCategory['theme'] | 'neutral' {
    if (!text) return 'neutral';
    if (/(需求|方案|产品|运营|互联网|开会|汇报|进度|工作|设计|评审|上线|迭代|测试|ai|大模型|商业化|数据|增长)/.test(text)) return 'cyber-blue';
    if (/(周末|休息|阳光|旅行|剧|玩|吃|风景|孩子|宝宝|健身)/.test(text)) return 'sunset-orange';
    return 'neutral';
}

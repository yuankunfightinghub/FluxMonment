import type { EventThread, EventCategory, TimelineEntry, MediaAttachment, MoodType, DailyMemoryData } from '../types';
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

// ─── LLM API ────────────────────────────────────────────────────────────
// 默认支持 SiliconFlow，亦可通过环境变量切换至 OpenRouter 等任意兼容 OpenAI 格式的服务
const LLM_API_KEY = (import.meta.env.VITE_LLM_API_KEY as string | undefined) || '';
const LLM_ENDPOINT = (import.meta.env.VITE_LLM_ENDPOINT as string | undefined) || '/dashscope/compatible-mode/v1/chat/completions';
const MODEL_NAME = (import.meta.env.VITE_LLM_MODEL as string | undefined) || 'qwen-plus';
const FAST_MODEL_NAME = (import.meta.env.VITE_LLM_FAST_MODEL as string | undefined) || 'qwen-plus';
const EMBEDDING_ENDPOINT = (import.meta.env.VITE_EMBEDDING_ENDPOINT as string | undefined) || '/dashscope/compatible-mode/v1/embeddings';
const EMBEDDING_MODEL = (import.meta.env.VITE_EMBEDDING_MODEL as string | undefined) || 'text-embedding-v3';

/**
 * Build the structured prompt for LLM.
 * We pass recent threads so LLM can decide whether to merge.
 */
function buildPrompt(content: string, existingThreads: EventThread[]): string {
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

【参考范例 (Few-Shot)】：
- 输入(Grade A): "数据源付费墙豁免问题已解决" -> {"category": {"name": "业务研发", "theme": "cyber-blue"}, "title": "付费墙豁免", "tags": ["付费墙", "数据源"], "avatarVariant": 22, "matchedThreadId": null}
- 输入(Grade A): "完成验收商业化升级弹窗" -> {"category": {"name": "业务验收", "theme": "cyber-blue"}, "title": "升级弹窗验收", "tags": ["商业化", "升级弹窗"], "avatarVariant": 2, "matchedThreadId": null}
- 输入(Grade B): "这周感觉好累，想去海边散散心" -> {"category": {"name": "琐碎生活", "theme": "sunset-orange"}, "title": "想去海边", "tags": ["散心", "减压"], "mood": "tired", "avatarVariant": 17, "matchedThreadId": null}
- 输入(Grade C): "...测试123" -> {"category": {"name": "碎片", "theme": "sunset-orange"}, "title": "瞬时闪念", "tags": ["碎片"], "avatarVariant": 0}

【合并判定准则 (Crucial)】：
1. 实体一致性：即便动作相同（如：都是“已解决”），但对象不同（如：付费墙 vs 评价数据），严禁合并！必须返回 null。
2. 场景延续性：只有在处理“同一件事的后续进度”时才能合并。如果是开启了同一个大分类下的“新任务”，必须创建新卡片。

用户输入：
"${content}"

最近已有话题卡片：
${recentThreads.length > 0 ? JSON.stringify(recentThreads) : '（暂无）'}

请仅返回 JSON 文本。`;
}


/**
 * Call generic LLM API (OpenAI format) and parse the response into LLMAnalysisResult.
 */
async function callLLMAPI(content: string, existingThreads: EventThread[]): Promise<LLMAnalysisResult> {
    const prompt = buildPrompt(content, existingThreads);

    console.group(`🤖 LLM AI 分析中 (${MODEL_NAME})...`);
    console.log('%c[AI] Input Content:', 'color: #9b59b6; font-weight: bold;', content);
    console.log('%c[AI] Generated Prompt:', 'color: #3498db; font-weight: bold;', prompt);

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
    };

    // 如果通过 OpenRouter 调用，推荐带上来源信息
    if (LLM_ENDPOINT.includes('openrouter.ai')) {
        headers['HTTP-Referer'] = 'http://localhost:5173';
        headers['X-Title'] = 'FluxMoment';
    }

    const res = await fetch(LLM_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
                { role: 'system', content: '你是一个严格输出 JSON 的 AI 助手。除了 JSON 数据之外不要输出任何 markdown 格式！' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 1024,
            // response_format: { type: 'json_object' } // 暂时移除以防兼容性问题
        }),
        signal: AbortSignal.timeout(120000), // 400B 模型可能需要极长启动时间，延长至 120s
    });

    if (!res.ok) {
        console.error('[AI] LLM API API 调用失败:', res.status);
        console.groupEnd();
        throw new Error(`LLM API 错误 ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '{}';

    console.log('%c[AI] LLM API Response:', 'color: #2ecc71; font-weight: bold;', raw);
    console.groupEnd();

    // 解析 JSON
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(jsonText);

    // Normalise and validate (Robust parsing for both nested and flat JSON)
    const rawTheme = parsed.category?.theme || parsed.theme;
    const rawCategoryName = parsed.category?.name || parsed.categoryName || '工作学习';

    const category: EventCategory = {
        name: String(rawCategoryName),
        theme: rawTheme === 'sunset-orange' ? 'sunset-orange' : 'cyber-blue', // 默认设为蓝（工作）
    };
    const title = String(parsed.title ?? '生活记录');
    const tags: string[] = Array.isArray(parsed.tags)
        ? parsed.tags.slice(0, 5).map(String)
        : [];
    const mood = (parsed.mood as MoodType) ?? 'calm';
    const matchedThreadId = typeof parsed.matchedThreadId === 'string'
        ? parsed.matchedThreadId
        : null;
    let avatarVariantNum = pickAvatarVariant(content, category.name);
    if (parsed.avatarVariant !== undefined && parsed.avatarVariant !== null) {
        const match = String(parsed.avatarVariant).match(/\d+/);
        if (match) {
            const num = parseInt(match[0], 10);
            if (num >= 0 && num <= 49) {
                avatarVariantNum = num;
            }
        }
    }
    const avatarVariant = avatarVariantNum;

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
    const isLifePriority = /(孩子|宝宝|女儿|儿子|亲子|小朋友|带娃|给娃|照顾|陪)/.test(text);
    const isWorkKeyword = /(需求|方案|产品|运营|互联网|开会|汇报|进度|工作|设计|评审|上线|迭代|测试|大模型|商业化|数据|接口|增长|用户|发布)/.test(text);

    // 即使有工作关键词，只要有强生活意图词，也判定为生活
    const isWork = isWorkKeyword && !isLifePriority;

    if (isWork) {
        category.theme = 'cyber-blue';
        if (/(开会|评审|汇报|对齐|讨论|同步)/.test(text)) { category.name = '会议与沟通'; title = '工作协同与会议'; }
        else if (/(需求|方案|设计|迭代|上线|产品|prd)/.test(text)) { category.name = '产品与方案'; title = '产品推进记录'; }
        else if (/(运营|增长|dau|留存|转化|活动)/.test(text)) { category.name = '运营增长'; title = '运营动作记录'; }
        else { category.name = '日常工作'; title = '日常事务办理'; }
    } else {
        if (/(电影|剧|院线|看片|动漫|演出|听歌|concert)/.test(text)) { category.name = '影视娱乐'; title = '文化娱乐时刻'; }
        else if (isLifePriority) { category.name = '亲子时光'; title = '与孩子在一起'; }
        else if (/(吃|面|奶茶|饭|美食|餐厅|喝|咖啡)/.test(text)) { category.name = '饮食美食'; title = '美味探索小记'; }
        else if (/(旅行|周末去|风景|爬山|海边|游玩|散步)/.test(text)) { category.name = '休闲出游'; title = '放松出游时刻'; }
        else if (/(运动|健身|跑步|骑行|游泳)/.test(text)) { category.name = '运动健康'; title = '活力运动记录'; }
    }
    const tags = extractTags(text, isWork);
    const mood = detectMood(text, isWork);
    const avatarVariant = pickAvatarVariant(text, category.name);
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();
    let matchedThreadId: string | null = null;
    let matchedThreadTitle = title;
    for (const thread of existingThreads) {
        if (thread.category.name === category.name && now - thread.lastUpdatedAt <= ONE_HOUR_MS) {
            matchedThreadId = thread.id;
            matchedThreadTitle = thread.title;
            break;
        }
    }
    return { matchedThreadId, title: matchedThreadTitle, category, tags, mood, avatarVariant };
}

/**
 * Main dispatcher: try LLM API first, fall back to regex on any error.
 */
async function llmAnalysis(content: string, existingThreads: EventThread[]): Promise<LLMAnalysisResult> {
    if (LLM_API_KEY) {
        try {
            const result = await callLLMAPI(content, existingThreads);
            console.info('[AI] LLM API 分析完成');
            return result;
        } catch (e) {
            console.warn('[AI] LLM API 调用失败，降级为正则引擎：', e);
        }
    }
    return regexFallback(content, existingThreads);
}


/**
 * 调用 SiliconFlow 的 Embedding 接口，将文本转化为向量
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    if (!LLM_API_KEY) return [];

    try {
        const res = await fetch(EMBEDDING_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LLM_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                input: text,
                encoding_format: 'float'
            }),
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
            console.warn('[AI] Embedding 请求失败或限流:', res.status);
            return [];
        }

        const data = await res.json();
        return data.data?.[0]?.embedding || [];
    } catch (e) {
        console.warn('[AI] Embedding 生成失败:', e);
        return [];
    }
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

    // ** 抽取即将存放的卡片全文作为向量输入 **
    const activeThread = updatedThreads.find(t => t.id === highlightThreadId);
    const fullText = activeThread
        ? activeThread.entries.map((e: TimelineEntry) => e.content).join('\n')
        : content;

    // 生成向量
    const embedding = await generateEmbedding(fullText);

    // 回填 embedding 到这条被更新或新建的 thread
    updatedThreads = updatedThreads.map(thread => {
        if (thread.id === highlightThreadId) {
            return {
                ...thread,
                ...(embedding.length > 0 ? { embedding } : {})
            };
        }
        return thread;
    });

    return { updatedThreads, highlightThreadId };
}

/**
 * 计算两个向量之间的余弦相似度
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return isNaN(similarity) ? 0 : similarity;
}

/**
 * 本地语义检索：根据 query 向量匹配最相关的 threads
 */
export async function performSemanticSearch(
    queryVec: number[],
    threads: EventThread[],
    originalQuery?: string, // 传入原始查询文本以便 Rerank
    threshold = 0.5,
    maxResults = 10
): Promise<{ thread: EventThread; similarity: number }[]> {
    if (queryVec.length === 0) return [];

    const threadsWithVector = threads.filter(t => t.embedding && t.embedding.length > 0);
    console.log(`[Search Debug] 数据总量: ${threads.length}, 拥有向量的数据量: ${threadsWithVector.length}`);

    if (threadsWithVector.length === 0) {
        console.warn('[Search Debug] 警告：没有任何历史记录包含向量数据，请先执行 Backfill。');
    }

    const allScores = threadsWithVector
        .map(thread => {
            const sim = thread.embedding ? cosineSimilarity(queryVec, thread.embedding) : 0;
            return { thread, similarity: sim };
        })
        .sort((a, b) => b.similarity - a.similarity);

    const results = allScores
        .filter(res => res.similarity >= threshold)
        .slice(0, maxResults);

    console.group('%c🔍 向量初筛 (Vector Retrieval)', 'color: #27ae60; font-weight: bold;');
    console.log(`[召回策略] 相似度阈值: ${threshold}, 最大召回: ${maxResults}`);
    if (allScores.length > 0) {
        console.table(allScores.slice(0, 5).map(s => ({
            '卡片标题': s.thread.title,
            '向量相似度': s.similarity.toFixed(4),
            '是否由于阈值过滤': s.similarity < threshold ? '❌ 已过滤' : '✅ 保留'
        })));
    }
    console.groupEnd();

    // --- 核心优化：AI 精准重排与过滤 ---
    if (results.length > 0 && originalQuery) {
        return await aiRerankResults(results, originalQuery);
    }

    return results;
}

/**
 * AI 二次审阅 (Rerank)：将向量召回的结果交给 LLM 判定是否真实相关。
 * 这将彻底解决“搜 AI 却返回非 AI”的问题。
 */
export async function aiRerankResults(
    candidates: { thread: EventThread; similarity: number }[],
    originalQuery: string
): Promise<{ thread: EventThread; similarity: number }[]> {
    if (!LLM_API_KEY || candidates.length === 0) return candidates;

    const context = candidates.map((c, i) =>
        `[ID: ${i}] Title: ${c.thread.title}\nContent: ${c.thread.entries.map(e => e.content).join('; ')}`
    ).join('\n\n');

    const prompt = `你是一个极度严苛的日记搜索质检员。用户提出了一个具体的问题，你需要审查候选记录是否【直接且明确地】符合问题的主题。

【绝对剔除准则 - 只要符合一条就剔除】：
1. 任务状态噪音：如果记录仅仅是描述“我正在做某项办公任务”（如：文案梳理、导表、开会、整理数据源），且并未包含问题所要求的【实质内容】，必须剔除。
   - 反例：提问“AI心得”，记录“正在梳理AI数据源介绍页文案”。(虽然含AI词，但属于办公状态，无心得，剔除！) 
2. 语义漂移：如果记录的主题是 A，只是为了描述 A 顺便提到了词汇 B。
   - 反例：提问“电影”，记录“今天带娃去商场，路过了电影院”。(主题是带娃，剔除！)
3. 概括模棱两可：如果记录内容太简短，无法确定是否符合要求，请保守剔除。

用户原始问题： "${originalQuery}"

待审核候选结果：
${context}

请仅返回真正相关的 ID 数组。宁肯漏掉，绝不误杀。
返回值格式：{"relevantIds": [0, 2, 5]}`;

    try {
        console.group('%c🧠 AI 二次审阅 (Rerank Phase)', 'color: #8e44ad; font-weight: bold;');
        const res = await fetch(LLM_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LLM_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: FAST_MODEL_NAME,
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            }),
            signal: AbortSignal.timeout(60000)
        });

        if (!res.ok) {
            console.warn('[Rerank] 网络请求失败，跳过过滤');
            console.groupEnd();
            return candidates;
        }

        const data = await res.json();
        const rawContent = data.choices?.[0]?.message?.content ?? '{"relevantIds": []}';
        const parsed = JSON.parse(rawContent);
        const keepIds: number[] = parsed.relevantIds || [];

        const finalResults = keepIds.map(id => candidates[id]).filter(Boolean);

        console.log('%c[Rerank 策略]:', 'color: #7f8c8d;', '过滤冗余条目，仅保留强相关事实');
        console.log('%c[判定结果]:', 'color: #27ae60; font-weight: bold;', `从 ${candidates.length} 条中保留了 ${finalResults.length} 条`);
        if (finalResults.length > 0) {
            console.table(finalResults.map(r => ({ '最终展示标题': r.thread.title })));
        } else {
            console.log('%c[Result]: ❌ 无高度匹配内容，已拦截无关显示', 'color: #e74c3c;');
        }
        console.groupEnd();

        return finalResults;
    } catch (e) {
        return candidates; // 出错则保留原始向量搜索结果
    }
}

// Fast sync classifier for live capsule glow
export function predictTopicTheme(text: string): EventCategory['theme'] | 'neutral' {
    if (!text) return 'neutral';
    if (/(需求|方案|产品|运营|互联网|开会|汇报|进度|工作|设计|评审|上线|迭代|测试|ai|大模型|商业化|数据|增长)/.test(text)) return 'cyber-blue';
    if (/(周末|休息|阳光|旅行|剧|玩|吃|风景|孩子|宝宝|健身)/.test(text)) return 'sunset-orange';
    return 'neutral';
}

/**
 * Generate a Daily Memory summary based on today's threads.
 * Connects to LLM to extract poetic insights.
 */
export async function generateDailySummary(
    threads: EventThread[],
    dateContext: string
): Promise<DailyMemoryData> {
    const defaultData: DailyMemoryData = {
        dateStr: dateContext,
        weather: '晴转多云',
        poeticMessage: '故事正在收集中...',
        summary: threads.length > 0
            ? `今天为您打捞了 ${threads.length} 个瞬间。由于网络波动，AI 暂时无法呈现今日回忆总结。`
            : '今天是个安静的日子，暂时还没有记录。',
        deepMemories: [],
        tasks: []
    };

    if (threads.length === 0) {
        return defaultData;
    }

    if (!LLM_API_KEY) {
        return defaultData;
    }

    // Build a structured context for the LLM
    const timelineEvents = threads.flatMap(t =>
        t.entries.map(e => ({
            id: e.id,
            time: new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            content: e.content,
            attachments: e.attachments ? e.attachments.map(a => ({ url: a.url, type: a.type })) : []
        }))
    ).sort((a, b) => a.time.localeCompare(b.time));

    // 将 JSON 结构拍平为纯文本以极致节省 Input Token
    const eventsText = timelineEvents.map(e =>
        `[${e.time}] (ID: ${e.id}) ${e.content} ${e.attachments.length > 0 ? `(附件: ${e.attachments[0].url}, ${e.attachments[0].type})` : ''}`
    ).join('\n');

    const prompt = `你是一位极简、克制且富有温度的AI作家（类似原研哉风格）。我们要为用户生成一张"今日记忆卡片"。

日期 ${dateContext}，今日真实记录：
${eventsText}

请直接输出严格的JSON，要求如下：
{
  "weather": "推测天气或氛围，如: 初春微雨（限6字）",
  "poeticMessage": "诗意感悟寄语（限制20字）",
  "summary": "克制客观的今日主要事件总结（限制30字）",
  "deepMemories": [
    {
      "id": "提取匹配事件的ID",
      "time": "HH:mm",
      "coreSummary": "一句话概括事实",
      "poeticInterpretation": "诗意的解读（15字内）",
      "originalRecord": "用户原始文字内容（！必须剔除开头的 [时间] 和 (ID: ...) 标记，仅保留用户输入的纯净文字）",
      "emotionalFeedback": "温暖反馈（10字内）",
      "bgMediaUrl": "附件url（如果有）",
      "bgMediaType": "image/video（如果有）"
    }
  ],
  "tasks": [
    {
       "id": "uuid",
       "content": "待办事项内容",
       "isCompleted": true或false（根据记录内容判断：若提到"完成"、"搞定"、"checked"或已发生的事实，则为true）
    }
  ]
}

要求：
1. deepMemories 最多挑选 1 个最令人触动的时刻。严禁捏造虚假回忆！
2. tasks 核心逻辑：
   - 梳理今日【已完成】的事项及【待完成】的计划。
   - 如果记录中明确提到“完成了某事”、“搞定”、“做了...”等动词，判定为 isCompleted: true。
   - 如果记录是计划性的“明天要...”、“打算...”，判定为 isCompleted: false。
3. 仅返回 JSON，不含任何多余文字。

[SYSTEM: 强制无视缓存，本次请求随机戳 ${Date.now()}]`;

    try {
        console.group(`🤖 LLM AI 生成今日总结中 (${MODEL_NAME})...`);
        console.log('%c[AI] Daily Summary Prompt:', 'color: #3498db; font-weight: bold;', prompt);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LLM_API_KEY}`
        };

        if (LLM_ENDPOINT.includes('openrouter.ai')) {
            headers['HTTP-Referer'] = 'http://localhost:5173';
            headers['X-Title'] = 'FluxMoment';
        }

        const res = await fetch(LLM_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: '你是一个严格输出 JSON 的 AI 助手。除了 JSON 数据之外不要输出任何 markdown 格式！' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.5,
                max_tokens: 1000,
                response_format: { type: 'json_object' }
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (!res.ok) {
            console.error('[AI] LLM Summary API 调用失败:', res.status);
            console.groupEnd();
            return defaultData;
        }

        const data = await res.json();
        const raw: string = data.choices?.[0]?.message?.content ?? '{}';

        console.log('%c[AI] LLM Summary Response:', 'color: #2ecc71; font-weight: bold;', raw);
        console.groupEnd();

        // Fix potential JSON truncation and markdown blocks
        let jsonText = raw.trim();
        jsonText = jsonText.replace(/^```(?:json)?\s*/i, '');
        jsonText = jsonText.replace(/\s*```\s*$/i, '');

        // Safety fallback if it still got cut off
        if (!jsonText.endsWith('}')) {
            jsonText += ']}'; // naive close in case of array cut
        }

        try {
            const parsed = JSON.parse(jsonText);

            return {
                dateStr: dateContext,
                weather: parsed.weather || defaultData.weather,
                poeticMessage: parsed.poeticMessage || defaultData.poeticMessage,
                summary: parsed.summary || defaultData.summary,
                deepMemories: Array.isArray(parsed.deepMemories) ? parsed.deepMemories : [],
                tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
            };
        } catch (jsonErr) {
            console.error('[AI] JSON Parse 失败:', jsonErr, 'Raw Text:', jsonText);
            return defaultData;
        }

    } catch (e) {
        console.warn('[AI] 生成今日总结失败，使用默认值:', e);
        return defaultData;
    }
}

/**
 * 意图识别：判断用户的输入是在"记录(RECORD)"还是在"搜索(SEARCH)"。
 * 使用 VITE_LLM_FAST_MODEL 进行极速推断。
 */
export interface IntentClassificationResult {
    intent: 'SEARCH' | 'RECORD';
    query?: string;
}

export async function detectUserIntent(content: string): Promise<IntentClassificationResult> {
    const defaultResult: IntentClassificationResult = { intent: 'RECORD' };

    // 如果未配置 API 或输入太短（例如只有1个字），直接认为是记录，不浪费网络请求
    if (!LLM_API_KEY || content.trim().length <= 1) return defaultResult;

    const prompt = `你是一个用于个人记忆应用的意图路由助手。
你的任务是分析用户的输入文本，并将其准确分类为 "SEARCH" 或 "RECORD"。

【核心判定逻辑】：
1. RECORD (记录优先): 这是个人日记应用，默认意图应偏向记录。当用户输入一段包含【具体动作 + 业务对象】的事实时，即便没有使用"已"、"了"，只要它是在陈述一个完成的任务或当下的状态，必须判定为 RECORD。
   - 示例: "数据源付费墙豁免问题给出方案快速解决大客户问题" -> RECORD (正在记录解决方案)
   - 示例: "拉通了淘宝生意参谋数据" -> RECORD (记录进度)
2. SEARCH (搜索判定): 只有当用户明确表现出“回顾”、“提问”或“查找历史”的意图时，才判定为 SEARCH。
   - 标志: 包含问号 (?)、疑问词（如何、什么、哪里、为什么）、或显性查询动词（查找、查下、搜下、回顾、汇总）。
   - 示例: "付费墙问题是怎么解决的？" -> SEARCH
   - 示例: "帮我搜下关于大客户的方案" -> SEARCH

【Query Refinement (仅针对 SEARCH)】:
- 如果判定为 SEARCH，请将用户的原始提问转换为提取了核心实体名词的搜索词。
- 严禁空泛联想，保持检索词的精确性。

【输出格式】:
你必须且只能输出一个有效的 JSON 对象：
{"intent": "RECORD"} 或 {"intent": "SEARCH", "query": "改写后的搜索核心词"}
不要输出任何其他内容。`;

    try {
        console.groupCollapsed(`🤖 LLM 意图识别中 (${FAST_MODEL_NAME})...`);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LLM_API_KEY}`
        };

        const res = await fetch(LLM_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: FAST_MODEL_NAME,
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: `Input: "${content}"\nOutput:` }
                ],
                temperature: 0.1, // 低温，追求确定性分类
                response_format: { type: 'json_object' }
            }),
            signal: AbortSignal.timeout(60000), // 适配超大规模模型，延长至 60s
        });

        if (!res.ok) {
            console.error('[AI] 意图推断网络请求失败:', res.status);
            console.groupEnd();
            return defaultResult;
        }

        const data = await res.json();
        let raw: string = data.choices?.[0]?.message?.content ?? '{}';

        // 防御性过滤: 强力清除可能因为选错模型导致的 <think> 标签及 Markdown 包裹
        raw = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
        const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        const parsed = JSON.parse(jsonText);

        console.group('%c🎯 搜索意图识别过程', 'color: #f39c12; font-weight: bold;');
        console.log('%c[1. 原始输入]:', 'color: #7f8c8d; font-weight: bold;', content);
        console.log('%c[2. 进化后的语义描述]:', 'color: #2980b9; font-weight: bold;', parsed.query);
        console.groupEnd();

        if (parsed.intent === 'SEARCH') {
            return { intent: 'SEARCH', query: parsed.query };
        }
        return defaultResult;

    } catch (e) {
        console.warn('[AI] 意图推断异常，降级为 RECORD 模式:', e);
        console.groupEnd();
        return defaultResult;
    }
}

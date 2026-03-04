import type { EventThread, EventCategory, TimelineEntry, MediaAttachment, MoodType, DailyMemoryData } from '../types.js';
import { v4 as uuidv4 } from 'uuid';
import { buildSharedPrompt, parseLLMResponse, pickAvatarVariant } from './aiLogicCore.js';

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

// 移除本地重复的 pickAvatarVariant，已从 aiLogicCore 导入

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
    return buildSharedPrompt(content, existingThreads);
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
    return parseLLMResponse(raw, content, existingThreads);
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
 * 混合动力检索：结合标签过滤、关键字强匹配与语义向量
 */
export async function performHybridSearch(
    queryVec: number[],
    threads: EventThread[],
    params: { query?: string; tags?: string[]; keywords?: string[] },
    maxResults = 15
): Promise<{ thread: EventThread; similarity: number }[]> {
    const { query = '', tags = [], keywords = [] } = params;

    // 1. 三层过滤
    const candidates = threads.map(thread => {
        // (A) 标签硬过滤
        if (tags.length > 0) {
            const hasTag = tags.some(t => {
                const lowerT = t.toLowerCase();
                const tagMatch = thread.tags.some(tag =>
                    tag.toLowerCase() === lowerT || tag.toLowerCase().includes(lowerT)
                );
                const categoryMatch = thread.category.name.toLowerCase().includes(lowerT);
                return tagMatch || categoryMatch;
            });
            if (!hasTag) return null;
        }

        // (B) 关键字 AND 门控（核心升级：不含关键字直接排除，非加分）
        const threadContent = (thread.title + ' ' + thread.entries.map(e => e.content).join(' ')).toLowerCase();
        if (keywords.length > 0) {
            const hasKeyword = keywords.some(kw => threadContent.includes(kw.toLowerCase()));
            if (!hasKeyword) return null;
        }

        // (C) 向量相似度（纯排序信号）
        const semanticSim = (thread.embedding && queryVec.length > 0)
            ? cosineSimilarity(queryVec, thread.embedding)
            : 0;

        // 已通过门控后小幅激励以影响排名
        let boost = 0;
        keywords.forEach(kw => {
            const lw = kw.toLowerCase();
            if (thread.title.toLowerCase().includes(lw)) boost += 0.15;
            else if (threadContent.includes(lw)) boost += 0.08;
        });

        return { thread, similarity: semanticSim + boost, baseSim: semanticSim };
    }).filter((c): c is { thread: EventThread; similarity: number; baseSim: number } => c !== null);

    candidates.sort((a, b) => b.similarity - a.similarity);

    // 三档阈值（全面上调，防止技术类向量聚集导致误召回）
    let minThreshold: number;
    if (keywords.length > 0) {
        minThreshold = -1; // FIX: 已通过字面门控，用负数彻底解除向量拦截机制（向量可能为负数），后续仅靠向量排序和 Rerank 把关
    } else if (tags.length > 0) {
        minThreshold = 0.45; // 标签已缩窄范围
    } else {
        minThreshold = 0.55; // 纯语义搜索，阈值最严
    }

    const filtered = candidates.filter(c => c.similarity >= minThreshold).slice(0, maxResults);

    console.group('%c🚀 混合动力检索 (Hybrid Engine)', 'color: #e67e22; font-weight: bold;');
    console.log(`[参数] Tags: ${tags.join(',')} | Keywords: ${keywords.join(',')} | threshold: ${minThreshold}`);
    if (filtered.length > 0) {
        console.table(filtered.slice(0, 8).map(s => ({
            '标题': s.thread.title,
            '分类': s.thread.category.name,
            '综合评分': s.similarity.toFixed(4),
            '向量基分': s.baseSim.toFixed(4),
        })));
    } else {
        console.log('%c[结果] 无符合条件的记录', 'color: #e74c3c;');
    }
    console.groupEnd();

    if (filtered.length > 0 && query) {
        return await aiRerankResults(filtered, query, tags, keywords);
    }
    return filtered;
}

export async function performSemanticSearch(
    queryVec: number[],
    threads: EventThread[],
    originalQuery?: string,
    maxResults = 10
): Promise<{ thread: EventThread; similarity: number }[]> {
    return performHybridSearch(queryVec, threads, { query: originalQuery }, maxResults);
}

/**
 * AI 二次审阅 (Rerank)：将向量召回的结果交给 LLM 判定是否真实相关。
 * 这将彻底解决“搜 AI 却返回非 AI”的问题。
 */
export async function aiRerankResults(
    candidates: { thread: EventThread; similarity: number }[],
    originalQuery: string,
    filterTags: string[] = [],
    filterKeywords: string[] = []
): Promise<{ thread: EventThread; similarity: number }[]> {
    if (!LLM_API_KEY || candidates.length === 0) return candidates;

    // 加入分类/标签/关键字信息，帮助 Rerank AI 做决策
    const context = candidates.map((c, i) =>
        `[ID: ${i}] 标题: ${c.thread.title} | 分类: ${c.thread.category.name} | 标签: [${c.thread.tags.join(', ')}]\n内容: ${c.thread.entries.map(e => e.content).join('; ')}`
    ).join('\n\n');

    const hasStrongConstraints = filterTags.length > 0 || filterKeywords.length > 0;

    // 配置不同的约束描述
    const tagConstraint = filterTags.length > 0
        ? `\n【范围约束】记录必须属于标签/分类 [${filterTags.join(', ')}]。主题不符则剔除。`
        : '';
    const keywordConstraint = filterKeywords.length > 0
        ? `\n【关键词验证】这批记录已由程序字面匹配确认包含 [${filterKeywords.join(', ')}]。请验证记录【确实以此为核心话题】而非只是顺带提到。`
        : '';

    // 模式切换
    const strictnessGuide = hasStrongConstraints
        ? `由于这列结果已经通过了关键词/标签的精确过滤，请采用【宽松留存】原则：只要大方向契合，尽量保留，不要因为内容简短就剔除。`
        : `由于这列结果仅通过语义向量匹配，请采用【严格质检】原则：只有主旨完全契合的才能留下，宁可错杀不可误留，模糊条目一律剔除。`;

    const prompt = `你是一位资深的日记搜索质检员，你的目标是在结果集中仅保留与用户提问高度契合的瞬间。

${strictnessGuide}${tagConstraint}${keywordConstraint}

【通用剔除判定】：
1. 记录主体是 A，由于描述 A 偶然带出了查询词 B。
2. 记录完全是"流水账式"的任务过程记录，不包含实质性的信息。

用户查询："${originalQuery}"

待审核候选结果：
${context}

请仅返回相关的记录 ID 数组。
输出 JSON 格式：{"relevantIds": [0, 1, 2]}`;

    try {
        console.group('%c🧠 AI 二次审阅 (Rerank Phase)', 'color: #8e44ad; font-weight: bold;');
        console.log('[Rerank 模式]:', hasStrongConstraints ? '宽松模式 (Keyword/Tag)' : '严格模式 (Semantic)');

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

        let finalResults = keepIds.map(id => candidates[id]).filter(Boolean);

        // EXTRA FALLBACK: 如果命中关键字但 Rerank 全给杀了，说明 AI 审阅尺度可能有误，保底恢复前 5 条结果。
        if (finalResults.length === 0 && hasStrongConstraints) {
            console.warn('[Rerank] 判定结果为空，但存在明确关键词要求。启用字面匹配优先级保底，恢复前 5 条。');
            finalResults = candidates.slice(0, 5);
        }

        console.log('%c[判定结果]:', 'color: #27ae60; font-weight: bold;', `从 ${candidates.length} 条中保留了 ${finalResults.length} 条`);
        if (finalResults.length > 0) {
            console.table(finalResults.map(r => ({ '最终展示标题': r.thread.title, '相似度': r.similarity.toFixed(4) })));
        } else {
            console.log('%c[Result]: ❌ 无匹配内容', 'color: #e74c3c;');
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
    tags?: string[];     // 显式提取的标签，如 #工作
    keywords?: string[]; // 显式提取的关键词
}

export async function detectUserIntent(content: string): Promise<IntentClassificationResult> {
    const defaultResult: IntentClassificationResult = { intent: 'RECORD' };

    // 如果未配置 API 或输入太短（例如只有1个字），直接认为是记录，不浪费网络请求
    if (!LLM_API_KEY || content.trim().length <= 1) return defaultResult;

    const prompt = `你是一个用于个人记忆应用的意图路由助手。
你的任务是分析用户的输入文本，将其准确分类为 "SEARCH" 或 "RECORD"。

【核心判定逻辑】：
1. RECORD (记录优先): 默认意图偏向记录。用户输入含【具体动作 + 业务对象】的事实陈述时，判定为 RECORD。
   - 示例: "数据源付费墙豁免问题已解决" -> RECORD
   - 示例: "拉通了淘宝生意参谋数据" -> RECORD
2. SEARCH: 只有用户明确表现出"回顾/查找历史"意图时，才判定为 SEARCH。
   - 标志: 包含问号(?)、疑问词（如何、什么、哪里）、或查询动词（查找、搜下、回顾、汇总）。
   - 示例: "付费墙问题是怎么解决的？" -> SEARCH
   - 示例: "关于 AI 的内容" -> SEARCH（"关于...的内容/记录"是典型搜索句式）

【keywords 提取规则 (仅针对 SEARCH，最关键步骤)】:
keywords 是用于【硬过滤】的词列表，只有包含这些词的记录才会出现在结果中。
必须做同义词扩展，避免漏召回：
- "关于 AI 的内容" -> keywords = ["AI", "大模型", "GPT", "人工智能", "LLM", "Gemini", "Claude", "deepseek"]
- "公园记录" -> keywords = ["公园", "广场", "户外"]
- "商业化" -> keywords = ["商业化", "变现", "营收", "付费"]

【tags 提取规则 (仅针对 SEARCH)】:
- 强烈警告：只有在用户的输入中出现了明确的带有 "#" 号的标签名（例如：用户输入了 "#亲子 关于公园的记录"），你才能将其提取为 tags（如 ["亲子"]）。
- 如果用户的输入中【没有明确包含 # 号】，即使你觉得它属于某个分类，也【绝对不允许】提取 tags，必须输出 tags: []！不听指令将导致系统崩溃。
【输出格式】:
你必须且只能输出一个有效的 JSON：
{"intent": "RECORD"} 或
{
  "intent": "SEARCH",
  "query": "语义搜索描述词（精确，不泛化）",
  "tags": ["标签1"],
  "keywords": ["关键词1", "同义词2", "同义词3"]
}
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
            return {
                intent: 'SEARCH',
                query: parsed.query,
                tags: parsed.tags || [],
                keywords: parsed.keywords || []
            };
        }
        return defaultResult;

    } catch (e) {
        console.warn('[AI] 意图推断异常，降级为 RECORD 模式:', e);
        console.groupEnd();
        return defaultResult;
    }
}

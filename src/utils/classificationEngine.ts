import type { EventThread, EventCategory, MoodType, DailyMemoryData, MediaAttachment, TimelineEntry } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

// ─── LLM API ────────────────────────────────────────────────────────────
// 默认支持 SiliconFlow，亦可通过环境变量切换至 OpenRouter 等任意兼容 OpenAI 格式的服务
const LLM_API_KEY = (import.meta.env.VITE_LLM_API_KEY as string | undefined) || '';
const LLM_ENDPOINT = (import.meta.env.VITE_LLM_ENDPOINT as string | undefined) || '/dashscope/compatible-mode/v1/chat/completions';
const MODEL_NAME = (import.meta.env.VITE_LLM_MODEL as string | undefined) || 'qwen-plus';
const FAST_MODEL_NAME = (import.meta.env.VITE_LLM_FAST_MODEL as string | undefined) || 'qwen-plus';
const EMBEDDING_ENDPOINT = (import.meta.env.VITE_EMBEDDING_ENDPOINT as string | undefined) || '/dashscope/compatible-mode/v1/embeddings';
const EMBEDDING_MODEL = (import.meta.env.VITE_EMBEDDING_MODEL as string | undefined) || 'text-embedding-v3';




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
    analysisArg: IntentClassificationResult,
    attachments?: MediaAttachment[]
): Promise<{ updatedThreads: EventThread[], highlightThreadId: string, fullTextToEmbed: string }> {
    // 保护性回退，若大模型未吐出必要字段，应用初始值
    const analysis = {
        matchedThreadId: analysisArg.matchedThreadId ?? null,
        title: analysisArg.title ?? '随手记',
        category: analysisArg.category ?? { name: '生活杂记', theme: 'sunset-orange' },
        tags: analysisArg.tags ?? [],
        mood: analysisArg.mood ?? 'calm',
        avatarVariant: typeof analysisArg.avatarVariant === 'number' ? analysisArg.avatarVariant : 0,
        inputNature: analysisArg.inputNature ?? 'MOOD'
    };

    const newEntry: TimelineEntry = {
        id: uuidv4(),
        content: content,
        timestamp: Date.now(),
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };

    let updatedThreads = [...currentThreads];
    let highlightThreadId = '';

    if (analysis.matchedThreadId) {
        // 进一步校验 matchedThreadId 的性质是否一致，防止异质记录误合并（AI 判定可能仍有漏网之鱼）
        const targetThread = updatedThreads.find(t => t.id === analysis.matchedThreadId);
        const threadNature = (targetThread?.category.theme === 'cyber-blue') ? 'FACT' : 'MOOD';

        const shouldMerge = (analysis.inputNature === 'NOISE') || (analysis.inputNature === threadNature);

        if (shouldMerge) {
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
            // 性质不符，强制创建新 Thread
            analysis.matchedThreadId = null;
        }
    }

    if (!analysis.matchedThreadId) {
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

    // ** 抽取即将存放的卡片全文作为向量输入 (准备异步生成) **
    const activeThread = updatedThreads.find(t => t.id === highlightThreadId);
    const fullTextToEmbed = activeThread
        ? activeThread.entries.map((e: TimelineEntry) => e.content).join('\n')
        : content;

    return { updatedThreads, highlightThreadId, fullTextToEmbed };
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
   - 需要梳理今日【已完成】的事项及【待完成】的计划。
   - 【关键规则】如果用户给出的输入类似“我的计划”、“打算”、“要去做...”等预期性动作，务必确保提取到的这些 todo 其状态必须为 isCompleted: false（未完成）。
   - 如果记录中明确提到“完成了某事”、“搞定”、“做了...”等动作事实，判定为 isCompleted: true。
   - 【无关联要求】这些生成的 todo 任务必须是完全独立、平行且扁平的待办项，彼此之间绝对不要存在任何嵌套、层级关联或前提依赖。
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
    tags?: string[];
    keywords?: string[];
    // RECORD 具体字段
    matchedThreadId?: string | null;
    title?: string;
    category?: EventCategory;
    mood?: MoodType;
    avatarVariant?: number;
    inputNature?: 'FACT' | 'MOOD' | 'NOISE';
}

export async function detectUserIntent(content: string, existingThreads: EventThread[]): Promise<IntentClassificationResult> {
    const defaultResult: IntentClassificationResult = { intent: 'RECORD' };

    // 如果未配置 API 或输入太短（例如只有1个字），直接认为是记录，不浪费网络请求
    if (!LLM_API_KEY || content.trim().length <= 1) return defaultResult;

    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();
    const recentThreads = existingThreads
        .filter(t => now - t.lastUpdatedAt <= ONE_HOUR_MS)
        .map(t => ({ id: t.id, title: t.title, category: t.category.name }));

    const prompt = `你是一个超级中枢大脑，负责在判定查询意图(SEARCH)或记录(RECORD)的同时完成信息提取。要求直接输出严格的JSON。

【步骤 1: 判定输入评级】
* Grade A: 包含明确动作/对象的纯事实陈述 ("解决XX问题", "完成验收") -> FACT
* Grade B: 描述心情、琐事、感性的生活片段 ("今天累", "打车真冷") -> MOOD
* Grade C: 极短/无意义乱码/标点符号 ("...", "123") -> NOISE
* SEARCH: 包含明确的回溯、查询动作 ("帮我找找", "什么情况？", "有关于XX的内容吗")

【步骤 2: 生成结果 (二选一)】
分支A：如果是 SEARCH，输出：
{
  "intent": "SEARCH",
  "query": "搜索核心主干描述",
  "keywords": ["同义词1", "发散词2"],  // 同义词必须极大丰富，以便字面匹配
  "tags": [] // 仅当用户手动输入 "#亲子" 这种明确tag标记时提取，否则必为空！
}

分支B：如果是 RECORD (Grade A, B, C)，输出：
{
  "intent": "RECORD",
  "category": { "name": "分类(6字内如业务研发/个人生活)", "theme": "cyber-blue或sunset-orange" },
  "title": "符合 [核心实体 + 状态] 的极简标题(剔除非实体虚词如解决/负责)",
  "tags": ["AI推荐的话题Tag", "最多5个"],
  "mood": "从(happy,excited,proud,playful,curious,focused,calm,cozy,tired,adventurous)选一",
  "avatarVariant": 22, // 0-49图标代码(22工作成就, 28深度思考, 36喝咖啡, 11可爱日常)
  "inputNature": "FACT 或 MOOD 或 NOISE",
  "matchedThreadId": "关联已有话题ID或填 null"
}
现有话题参考 (仅在强相关时填入 matchedThreadId，不要勉强)：
${recentThreads.length > 0 ? JSON.stringify(recentThreads) : '（暂无）'}
`;

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

        if (parsed.intent === 'SEARCH') {
            console.group('%c🎯 意图识别 (SEARCH)', 'color: #f39c12; font-weight: bold;');
            console.log(`[Input] ${content}`);
            console.log(`[Query] ${parsed.query}`);
            console.groupEnd();

            return {
                intent: 'SEARCH',
                query: parsed.query,
                tags: parsed.tags || [],
                keywords: parsed.keywords || []
            };
        }
        
        console.group('%c📝 意图识别 (RECORD)', 'color: #27ae60; font-weight: bold;');
        console.log(`[Input] ${content}`);
        console.log(`[Title] ${parsed.title}`);
        console.groupEnd();

        const rawTheme = parsed.category?.theme || parsed.theme || 'cyber-blue';
        const rawCategoryName = parsed.category?.name || parsed.categoryName || '工作学习';
        const matchedThreadId = typeof parsed.matchedThreadId === 'string' ? parsed.matchedThreadId : null;
        const validMatchedId = existingThreads.some(t => t.id === matchedThreadId) ? matchedThreadId : null;

        return { 
            intent: 'RECORD',
            matchedThreadId: validMatchedId,
            title: parsed.title ?? '生活记录',
            category: { name: String(rawCategoryName), theme: rawTheme.includes('orange') ? 'sunset-orange' : 'cyber-blue' },
            tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : [],
            mood: (parsed.mood as MoodType) ?? 'calm',
            avatarVariant: typeof parsed.avatarVariant === 'number' ? parsed.avatarVariant : 0,
            inputNature: (parsed.inputNature as 'FACT' | 'MOOD' | 'NOISE') ?? 'MOOD',
        };

    } catch (e) {
        console.warn('[AI] 意图推断异常，降级为 RECORD 模式:', e);
        console.groupEnd();
        return defaultResult;
    }
}
/**
 * Generate a professional Work Summary for Product Managers based on today's threads.
 */
export async function generateWorkSummary(
    threads: EventThread[],
    dateContext: string
): Promise<string> {
    if (threads.length === 0) {
        return '今日暂无工作记录。';
    }

    if (!LLM_API_KEY) {
        return '请配置 API 密钥以使用工作总结功能。';
    }

    const eventsText = threads.flatMap(t =>
        t.entries.map(e => `[${t.category.name}] ${e.content}`)
    ).join('\n');

    const prompt = `# Role
你是一位精通互联网大厂汇报艺术的资深产品经理。你擅长从细碎的日常记录中提炼出具有战略价值的信息，并能够精准捕捉老板关注的“进展、结果、成长、机会、风险”。

# Input Data
日期：${dateContext}
以下是用户今天的记录：
${eventsText}

# Task
请分析上述记录，按照以下结构生成一份今日工作总结汇报。

# Format Requirements (严格遵循此结构)

## 0. 核心综述 (Executive Summary)
用一句话总结今日最核心的进展或突破。

## 1. 产品线进展 (Product Line Progress)
请将所有的工作项映射到以下产品线（若记录中未提及某项，则不显示该项）：
- **商业化**: (关于收入、广告、付费转化等)
- **数据连接**: (关于接口、连接器、数据同步等)
- **表格**: (关于核心表格能力、性能、体验等)
- **插件**: (关于生态、第三方集成、扩展性等)
- **其他**: (上述分类之外的重要事项)

## 2. 关键结果 (Key Results)
列出今日达成的明确里程碑、产出物或关键数据指标。

## 3. 个人成长与复盘 (Growth & Reflection)
基于今日的工作过程，总结沉淀了什么经验、模型或对业务的新理解。

## 4. 机会与风险 (Opportunities & Risks)
- **机会**: 发现的潜在业务增长点、协同机会或效率提升点。
- **风险**: 识别出的潜在延期隐患、技术瓶颈或由于外部依赖导致的阻碍。

# Writing Style
- 专业、简炼、结果导向。
- 适当使用 bullet points 提高可读性。
- 角色代入：你的汇报对象是老板，请使用积极但客观的职场口吻。

请直接输出 markdown 内容。`;

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LLM_API_KEY}`
        };

        const res = await fetch(LLM_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: '你是一位资深产品经理总结助手，请直接输出 markdown 格式的汇报内容。' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 2000,
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const data = await res.json();
        return data.choices?.[0]?.message?.content ?? '总结生成失败。';
    } catch (e) {
        console.error('Failed to generate work summary:', e);
        return '工作总结生成失败，请稍后重试。';
    }
}

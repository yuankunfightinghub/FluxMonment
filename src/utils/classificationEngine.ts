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
const LLM_API_KEY = (import.meta.env.VITE_LLM_API_KEY as string | undefined) || (import.meta.env.VITE_SILICONFLOW_API_KEY as string | undefined) || '';
const LLM_ENDPOINT = (import.meta.env.VITE_LLM_ENDPOINT as string | undefined) || 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL_NAME = (import.meta.env.VITE_LLM_MODEL as string | undefined) || 'deepseek-ai/DeepSeek-V3';
const FAST_MODEL_NAME = (import.meta.env.VITE_LLM_FAST_MODEL as string | undefined) || 'Qwen/Qwen2.5-7B-Instruct';

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
  "avatarVariant": 28,
  "matchedThreadId": "如果语义上应该合并到已有某个话题卡片，填其 id；否则填 null"
}

关于 avatarVariant，请根据事件、人物、情感等，从以下数字（0-49）中选一个最符合语境的小图标装饰（只填数字）：
- 学习/工作/专注：27(书生眼镜), 28(耳机), 32(领带), 29(单片眼镜), 38(书本), 4(厨师帽)
- 饮食/美食：36(咖啡杯), 37(蛋糕)
- 娱乐/音乐/庆祝：47(音符), 2(皇冠), 40(彩色圆点雨), 26(太阳眼镜)
- 出行/旅行/户外：5(鸭舌帽), 6(牛仔帽), 8(渔夫帽), 21(小飞机), 22(小火箭), 34(小背包)
- 天气/自然：17(云朵), 42(下雨云), 43(雪花), 44(闪电)
- 日常心情/可爱：11(小鸭子), 12(小猫耳), 13(兔耳), 16(彩虹), 41(心形), 35(珍珠项链)
- ⚠️极度重要：如果是普通的工作、写代码、打卡等没有明显装饰倾向的输入，**绝不要**死板地返回 0！请发挥你的想象力，从以上列表中挑选一款能增加趣味性的挂饰（比如工作可以带 28耳机，或者是 40彩色圆点雨、36咖啡杯）。尽可能少返回 0，让每个瞬间都生动起来！
注意：
- tags 最多 5 个。
- 业务互斥逻辑：对于工作类（cyber-blue），“商业化”、“数据连接”、“AI 助理”是互斥的标签，每条记录只能在 tags 中包含其中【最多一个】。
- **深度场景判定逻辑（核心）**：请按以下顺序进行分类思考：
  1. **受益主体与目标**：判断该行为的最终受益人。如果行为是为了家人、亲情陪伴、个人爱好（如：给孩子做AI玩具、教家人写代码），即便使用了专业技术工具，其内核也是【生活/休闲类 (sunset-orange)】。
  2. **事实执行重心**：如果主动作是执行职场任务、处理业务逻辑、参加职业会议，即使提到了家人作为背景（如：本想陪女儿但不得不加班），其分类权重依然属于【工作/学习类 (cyber-blue)】。
  3. **关键词权重降级**：当“AI”、“编程”、“代码”、“方案”与“家人名称”同时出现。如果家人是动作的【对象】（为谁做），则技术词汇降级为生活工具，分类为生活；如果家人是【背景/干扰项】（因为工作没能...），分类为工作。

- **分类判定参考范例 (Few-Shot)**：
  - 输入："给女儿用 Python 写了个自动涂色卡" -> 分类：{"name": "亲子互动", "theme": "sunset-orange"} (原因：受益人是家人)
  - 输入："虽然原本想陪女儿，但临时的 Python 脚本出 Bug 必须处理" -> 分类：{"name": "Bug修复", "theme": "cyber-blue"} (原因：动作重心是处理任务)
  - 输入："今天教老婆怎么用 AI 助理帮她整理食谱" -> 分类：{"name": "生活百科", "theme": "sunset-orange"} (原因：场景是家庭社交)

- 关于 matchedThreadId：非常严格！只有当本次输入与列表中某张历史卡片在【人物】、【事件动作】、【环境/上下文】这三要素上具备高度一致性与场景延续性时，才能填入其 id（进行聚合归属于同一话题）。如果只是类别相同但具体讲的事情截然不同（比如之前在吃面，现在在喝奶茶），则必须返回 null 创建独立卡片！！
- 仅返回 JSON，不含任何额外说明。`;
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
            response_format: { type: 'json_object' } // 要求强制 JSON 输出
        }),
        signal: AbortSignal.timeout(15000), // OpenAI format might be slower, give it 15s
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
        const res = await fetch('https://api.siliconflow.cn/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LLM_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'BAAI/bge-m3', // SiliconFlow 免费的特征提取基座模型
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

    // 调试打印前 3 名，无论是否超过阈值
    if (allScores.length > 0) {
        console.group('🔍 语义匹配得分排名前 3:');
        allScores.slice(0, 3).forEach((s, i) => {
            console.log(`${i + 1}. [Score: ${s.similarity.toFixed(4)}] Title: ${s.thread.title}`);
        });
        console.groupEnd();
    }

    const results = allScores
        .filter(res => res.similarity >= threshold)
        .slice(0, maxResults);

    return results;
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
      "originalRecord": "原文一字不差复制",
      "emotionalFeedback": "温暖反馈（10字内）",
      "bgMediaUrl": "附件url（如果有）",
      "bgMediaType": "image/video（如果有）"
    }
  ],
  "tasks": [
    {
       "id": "uuid",
       "content": "待办事项内容",
       "isCompleted": true或false
    }
  ]
}

要求：
1. deepMemories 最多挑选 1 个最令人触动的时刻。严禁捏造虚假回忆！
2. tasks 仅梳理明确提到的待办，若无则留空数组 []，不要自己瞎编。
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

    const prompt = `你是一个用于个人记忆应用的上下文感知路由助手。
你唯一的任务是分析用户的输入文本，并将其“意图”(INTENT) 准确分类为以下两类之一：

1. "SEARCH"（搜索）：用户试图查找、检索或提问关于他们过去的记忆、事件或想法。
2. "RECORD"（记录）：用户正在创建一段新记忆、记录当前事件或想法。

对于 "SEARCH" 意图，你必须进行 "Query Refinement"（查询改写）：
- 不要只提取关键词。
- 请联想：如果用户确实记录过相关内容，那条记录可能会包含哪些【动作、工具名、细分场景、情绪或具体实体】？
- 将原始提问转化为一段具有丰富语义的“模拟描述文本”，用空格分隔，以利于向量匹配。
- 例如：输入“AI 使用心得” -> 输出“AI LLM 大模型 Claude ChatGPT 提示词工程 提效 使用体验 调优 心得体会”。

你必须且只能输出一个有效的 JSON 对象：
{"intent": "RECORD"} 或 {"intent": "SEARCH", "query": "改写后的语义描述文本"}

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
            signal: AbortSignal.timeout(5000), // 必须极快，5秒超时则强制 fallback 为记录模式
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

        console.log('%c[AI] Intent Result:', 'color: #f39c12; font-weight: bold;', parsed);
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

/**
 * FluxMoment — Gemini 分类引擎测试脚本
 * 运行：node test-gemini.mjs
 */

const GEMINI_API_KEY = 'AIzaSyClc8AQHYwaqM_jJH_0Alm1jjVGCTfeQQY';
const GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const TEST_CASES = [
    // ── 工作类 ──────────────────────────────────────────────────────────────
    {
        id: 1,
        input: '今天和产品团队完成了 Q2 路线图的评审，功能优先级基本对齐，下周开始迭代',
        expect: { theme: 'cyber-blue', moodHint: ['focused', 'proud'] },
    },
    {
        id: 2,
        input: '在研究 Gemini API 的调用方式，发现结构化输出比我想象的好用很多',
        expect: { theme: 'cyber-blue', moodHint: ['curious', 'excited'] },
    },
    {
        id: 3,
        input: '谈下来一个新客户合同，商业化部分又往前推了一步，很有成就感',
        expect: { theme: 'cyber-blue', moodHint: ['proud', 'excited'] },
    },
    {
        id: 4,
        input: '数据接口联调终于跑通了，pipeline 端到端全链路没有问题',
        expect: { theme: 'cyber-blue', moodHint: ['proud', 'focused'] },
    },
    {
        id: 5,
        input: '连续加班三天，今晚终于可以早点回家好好睡一觉了',
        expect: { theme: 'cyber-blue', moodHint: ['tired'] },
    },

    // ── 生活类 ──────────────────────────────────────────────────────────────
    {
        id: 6,
        input: '午饭吃了一碗超好喝的牛肉面，汤底鲜到爆，以后每周都要去',
        expect: { theme: 'sunset-orange', moodHint: ['happy', 'excited'] },
    },
    {
        id: 7,
        input: '下班陪女儿画了一个小时的画，她画了一只很可爱的大象',
        expect: { theme: 'sunset-orange', moodHint: ['happy', 'cozy'] },
    },
    {
        id: 8,
        input: '周末去爬了香山，秋天的红叶漫山遍野，拍了好多照片',
        expect: { theme: 'sunset-orange', moodHint: ['adventurous', 'happy'] },
    },
    {
        id: 9,
        input: '刚看完今年奥斯卡最佳影片，剧情很触动，结尾哭了',
        expect: { theme: 'sunset-orange', moodHint: ['happy', 'calm'] },
    },

    // ── 英文 / 混合 ──────────────────────────────────────────────────────────
    {
        id: 10,
        input: 'Had a great coffee chat with the team this afternoon, aligned on product strategy for next quarter',
        expect: { theme: 'cyber-blue', moodHint: ['focused', 'calm'] },
    },
];

function buildPrompt(content) {
    return `你是一个个人时刻记录助手，分析用户输入的一条记录，返回严格的 JSON 格式分析结果。

用户输入：
"${content}"

最近 2 小时内已有的话题卡片（可能为空）：
（暂无）

请返回以下 JSON（仅返回 JSON，不要 markdown 代码块，不要其他文字）：
{
  "category": {
    "name": "话题子分类名称（中文，8字以内）",
    "theme": "cyber-blue 或 sunset-orange"
  },
  "title": "卡片标题（中文，10字以内）",
  "tags": ["关键词1", "关键词2"],
  "mood": "从以下选一个：happy、excited、proud、playful、curious、focused、calm、cozy、tired、adventurous",
  "matchedThreadId": null
}

注意：tags 最多 5 个，仅返回 JSON。`;
}

async function runOne(tc) {
    let raw = '';
    try {
        const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: buildPrompt(tc.input) }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            category: {
                                type: "OBJECT",
                                properties: {
                                    name: { type: "STRING" },
                                    theme: { type: "STRING" }
                                }
                            },
                            title: { type: "STRING" },
                            tags: { type: "ARRAY", items: { type: "STRING" } },
                            mood: { type: "STRING" },
                            matchedThreadId: { type: "STRING", nullable: true }
                        }
                    }
                },
            }),
            signal: AbortSignal.timeout(20000), // increased timeout
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        return JSON.parse(jsonText);
    } catch (e) {
        if (!e.message.includes('429')) {
            console.error('\n[Parse Error debug] Raw output was:', raw);
        }
        throw e;
    }
}

const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️';

async function runWithRetry(tc, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await runOne(tc);
        } catch (e) {
            if (attempt < maxRetries && e.message.includes('429')) {
                console.log(`\n   ⏳ 限速，等 15s 后重试 (${attempt + 1}/${maxRetries})…`);
                await new Promise(r => setTimeout(r, 15000));
            } else {
                throw e;
            }
        }
    }
}

async function main() {
    console.log('\n🧪  FluxMoment — Gemini 分类引擎测试\n');
    console.log('⏳  等待 65 秒让之前的限速窗口重置…');
    await new Promise(r => setTimeout(r, 65000));
    console.log('✅  开始测试\n');
    console.log('='.repeat(90));

    let passed = 0, failed = 0;

    for (const tc of TEST_CASES) {
        process.stdout.write(`[${tc.id}/10] ${tc.input.slice(0, 40)}…`);
        try {
            const result = await runWithRetry(tc);
            const themeOk = result.category?.theme === tc.expect.theme;
            const moodOk = tc.expect.moodHint.includes(result.mood);

            const status = themeOk && moodOk ? PASS : themeOk ? WARN : FAIL;
            if (themeOk && moodOk) passed++; else failed++;

            console.log(` ${status}`);
            console.log(`   📌 分类: ${result.category?.name}  主题: ${result.category?.theme} ${themeOk ? '✓' : `✗(期望:${tc.expect.theme})`}`);
            console.log(`   📝 标题: ${result.title}`);
            console.log(`   🏷  Tags: ${(result.tags ?? []).join(' / ')}`);
            console.log(`   💬 情绪: ${result.mood} ${moodOk ? '✓' : `${WARN}(期望之一:${tc.expect.moodHint.join('|')})`}`);
        } catch (e) {
            failed++;
            console.log(` ${FAIL} 调用失败: ${e.message}`);
        }
        console.log('-'.repeat(90));
        // Rate limit buffer — free tier: 15 RPM → 8s interval = ~7.5 RPM, safe
        await new Promise(r => setTimeout(r, 8000));
    }

    console.log(`\n📊 结果：通过 ${passed}/10，失败 ${failed}/10\n`);
}

main();

const https = require('https');

const API_KEY = 'sk-3f14ce9f36b74b65952a0d64d5477b25';
const ENDPOINT = 'dashscope.aliyuncs.com';
const PATH = '/compatible-mode/v1/chat/completions';
const MODEL = 'qwen-plus';

function buildPrompt(content, recentThreads = []) {
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

async function callAPI(content, threads = []) {
    const prompt = buildPrompt(content, threads);
    const postData = JSON.stringify({
        model: MODEL,
        messages: [
            { role: 'system', content: '你是一个严格输出 JSON 的 AI 助手。' },
            { role: 'user', content: prompt }
        ],
        temperature: 0.1
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: ENDPOINT,
            path: PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

const testCases = [
    { name: "01-事实极简", text: "数据源付费墙豁免问题已解决", threads: [] },
    { name: "02-动作提取", text: "上午完成验收商业化升级弹窗", threads: [] },
    { name: "03-同词熔断", text: "淘宝生意参谋评价数据源同步拉通顺利", threads: [{ id: "th_01", title: "付费墙豁免", category: "业务研发" }] },
    { name: "04-感性随感", text: "这周好累啊，周末想去海边散散心", threads: [] },
    { name: "05-情感提取", text: "刚喝到一杯超级浓郁的澳白，瞬间治愈", threads: [] },
    { name: "06-噪声过滤", text: "......测试123", threads: [] },
    { name: "07-技术入生活", text: "刚教女儿用 Python 写了个自动涂色卡", threads: [] },
    { name: "08-深度合并", text: "刚才那个付费墙逻辑还有个边界 Case 要补", threads: [{ id: "th_01", title: "付费墙豁免", category: "业务研发" }] },
    { name: "09-长句压缩", text: "下午召集了增长团队和技术负责人，详细评审了 Q2 的拉新方案并最终定稿", threads: [] },
    { name: "10-状态提取", text: "终于搞定了！🚀", threads: [] }
];

async function runTests() {
    console.log("🚀 开始 AI 逻辑压力测试...\n");
    for (const test of testCases) {
        try {
            const resp = await callAPI(test.text, test.threads);
            const result = JSON.parse(resp.choices[0].message.content.replace(/```json|```/g, '').trim());
            console.log(`[${test.name}]`);
            console.log(`> 输入: ${test.text}`);
            console.log(`> 结果: 标题="${result.title}", 标签=[${result.tags}], 主题=${result.category.theme}, 图标=${result.avatarVariant}, 合并ID=${result.matchedThreadId}`);
            console.log("------------------------------------------");
        } catch (e) {
            console.error(`[${test.name}] 测试失败:`, e.message);
        }
    }
}

runTests();

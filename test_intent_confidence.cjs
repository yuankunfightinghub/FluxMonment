const https = require('https');

const API_KEY = 'sk-3f14ce9f36b74b65952a0d64d5477b25';
const ENDPOINT = 'dashscope.aliyuncs.com';
const PATH = '/compatible-mode/v1/chat/completions';
const MODEL = 'qwen-plus';

const content = "数据源付费墙豁免问题给出方案快速解决大客户问题";

async function testIntentConfidence(content) {
    const prompt = `你是一个用于个人记忆应用的意图路由助手。
你的任务是分析用户的输入文本，并将其准确分类为 "SEARCH" 或 "RECORD"。

【核心判定逻辑】：
1. RECORD (记录优先): 这是个人日记应用，默认意图应偏向记录。当用户输入一段包含【具体动作 + 业务对象】的事实时，即便没有使用"已"、"了"，只要它是在陈述一个完成的任务或当下的状态，必须判定为 RECORD。
   - 示例: "数据源付费墙豁免问题给出方案快速解决大客户问题" -> RECORD (正在记录解决方案)
2. SEARCH (搜索判定): 只有当用户明确表现出“回顾”、“提问”或“查找历史”的意图时，才判定为 SEARCH。
   - 标志: 包含问号 (?)、疑问词（如何、什么、哪里、为什么）、或显性查询动词（查找、查下、搜下、回顾、汇总）。

对于输入: "${content}"

请返回 JSON 格式：
{
  "intent": "SEARCH" 或 "RECORD",
  "confidence": 0.0 到 1.0 之间的数值,
  "reason": "判断依据"
}`;

    console.log(`🚀 正在测试输入: "${content}"\n`);

    for (let i = 1; i <= 5; i++) {
        const postData = JSON.stringify({
            model: MODEL,
            messages: [
                { role: 'system', content: '你是一个严格输出 JSON 的分析助手。' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7 // 稍微提高温度看分类的波动性
        });

        const result = await new Promise((resolve, reject) => {
            const options = {
                hostname: ENDPOINT,
                path: PATH,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        const output = JSON.parse(result.choices[0].message.content.replace(/```json|```/g, '').trim());
        console.log(`[测试 ${i}] 意图: ${output.intent}, 置信度: ${output.confidence}`);
        console.log(`   原因: ${output.reason}`);
        console.log("------------------------------------------");
    }
}

testIntentConfidence(content);


const https = require('https');

const LLM_API_KEY = 'sk-3f14ce9f36b74b65952a0d64d5477b25';
const LLM_ENDPOINT = 'dashscope.aliyuncs.com';
const LLM_PATH = '/compatible-mode/v1/chat/completions';
const MODEL_NAME = 'qwen3.5-397b-a17b';

const postData = JSON.stringify({
    model: MODEL_NAME,
    messages: [
        { role: 'user', content: '你好，请回复“连接成功”四个字。' }
    ],
    max_tokens: 50
});

const options = {
    hostname: LLM_ENDPOINT,
    port: 443,
    path: LLM_PATH,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${LLM_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log(`🚀 开始测试大模型连接 (原生 HTTPS 模式)...`);
console.log(`📍 Endpoint: https://${LLM_ENDPOINT}${LLM_PATH}`);
console.log(`🤖 Model: ${MODEL_NAME}`);

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode === 200) {
            try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.message?.content;
                console.log(`✅ 调用成功！`);
                console.log(`📝 AI 回复: ${content}`);
            } catch (e) {
                console.error(`❌ 解析回复 JSON 失败: ${e.message}`);
                console.log(`Raw: ${data}`);
            }
        } else {
            console.error(`❌ 调用失败，状态码: ${res.statusCode}`);
            console.error(`🔴 错误信息: ${data}`);
        }
    });
});

req.on('error', (e) => {
    console.error(`❌ 网络请求发生错误: ${e.message}`);
});

req.write(postData);
req.end();

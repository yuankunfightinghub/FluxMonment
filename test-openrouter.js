process.loadEnvFile('.env.local');

const LLM_API_KEY = process.env.VITE_LLM_API_KEY;
const LLM_ENDPOINT = process.env.VITE_LLM_ENDPOINT;
const LLM_MODEL = process.env.VITE_LLM_MODEL;



console.log('🔄 准备测试 OpenRouter 接口...');
console.log('配置信息：');
console.log(`- Endpoint: ${LLM_ENDPOINT}`);
console.log(`- Model: ${LLM_MODEL}`);
console.log(`- API Key 长度: ${LLM_API_KEY?.length || 0} (首尾: ${LLM_API_KEY?.substring(0, 10)}...${LLM_API_KEY?.substring(LLM_API_KEY.length - 4)})\n`);

async function testLLM() {
    try {
        console.log('⏳ 正在发送请求，这可能需要几秒钟...');
        const startTime = Date.now();

        const response = await fetch(LLM_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LLM_API_KEY}`,
                // OpenRouter 建议携带的信息，防止被认为是机器滥用
                'HTTP-Referer': 'http://localhost:5173',
                'X-Title': 'FluxMoment Test'
            },
            body: JSON.stringify({
                model: LLM_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "你是一个测试助手，请回复一句简短的话证明你收到了消息，格式必须是严格的 JSON，如: {'status': 'success', 'message': '...'}"
                    },
                    {
                        role: "user",
                        content: "你好，请确认服务连通性。"
                    }
                ],
                // OpenRouter 支持开启 JSON 模式来约束模型输出
                response_format: { type: "json_object" },
                max_tokens: 150
            })
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (!response.ok) {
            console.error(`❌ HTTP 请求失败！状态码: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('错误详情:', errorText);
            return;
        }

        const data = await response.json();
        console.log(`\n✅ 接口连通成功！(耗时 ${duration}s)`);

        const content = data.choices?.[0]?.message?.content;
        console.log('📦 模型返回的原始 content 字段：\n');
        console.log('\x1b[36m%s\x1b[0m', content); // 以青色高亮打印出来

    } catch (error) {
        console.error('❌ 测试过程中发生网络异常或代码错误:', error);
    }
}

testLLM();

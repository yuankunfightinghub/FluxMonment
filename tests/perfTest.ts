import { detectUserIntent, processAndAggregateInput } from '../src/utils/classificationEngine';

// Mock performance if not available
const now = () => Date.now();

async function runTest() {
    const input = '这是一个十个字的性能测试数据';
    console.log('--- 🚀 开始后端链路裸测 ---');
    console.log(`输入内容 (${input.length} 字): "${input}"`);

    const tStart = now();

    console.log('1. 测试 detectUserIntent...');
    const t0 = now();
    const intentResult = await detectUserIntent(input);
    const t1 = now();
    console.log(`[耗时分析] 1. detectUserIntent (意图推断): ${t1 - t0} ms`, intentResult);

    console.log('\n2. 测试 processAndAggregateInput (包含 llmAnalysis 与 generateEmbedding)...');
    const t2 = now();
    // mock an empty threads array
    const { updatedThreads } = await processAndAggregateInput(input, []);
    const t3 = now();
    console.log(`[耗时分析] 2. processAndAggregateInput (归类+向量生成): ${t3 - t2} ms`);

    const tEnd = now();
    console.log(`\n[耗时分析] === 核心 AI 处理总耗时: ${tEnd - tStart} ms ===`);
    
    // Dump thread
    console.log('生成的 Thread 样例:', JSON.stringify(updatedThreads[0], null, 2));
}

runTest().catch(console.error);

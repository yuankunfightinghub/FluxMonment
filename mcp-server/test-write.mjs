import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { buildSharedPrompt, parseLLMResponse } from './dist/src/utils/aiLogicCore.js';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const APP_ID = process.env.APP_ID;
const USER_UID = process.env.USER_UID;

const LLM_API_KEY = process.env.VITE_LLM_API_KEY || '';
const LLM_ENDPOINT = process.env.VITE_LLM_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const MODEL_NAME = process.env.VITE_LLM_MODEL || 'qwen-plus';

async function analyzeWithAI(content, existingThreads) {
    const prompt = buildSharedPrompt(content, existingThreads);
    const res = await fetch(LLM_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LLM_API_KEY}`
        },
        body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
                { role: 'system', content: '你是一个严格输出 JSON 的 AI 助手。除了 JSON 数据之外不要输出任何 markdown 格式！' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3
        })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    return parseLLMResponse(raw, content, existingThreads);
}

async function runTest(content) {
    const timestamp = Date.now();
    const momentsPath = `artifacts/${APP_ID}/users/${USER_UID}/moments`;

    console.log('Testing write with path:', momentsPath);
    console.log('Using APP_ID:', APP_ID);
    console.log('Using USER_UID:', USER_UID);

    const snapshot = await db.collection(momentsPath).orderBy('lastUpdatedAt', 'desc').limit(10).get();
    const existingThreads = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const classification = await analyzeWithAI(content, existingThreads);
    const momentId = uuidv4();

    const threadData = {
        title: classification.title,
        category: classification.category,
        tags: classification.tags,
        mood: classification.mood,
        avatarVariant: classification.avatarVariant,
        lastUpdatedAt: timestamp,
        _syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        entries: [
            {
                id: uuidv4(),
                content: content,
                timestamp: timestamp,
            }
        ]
    };

    await db.doc(`${momentsPath}/${momentId}`).set(threadData);
    console.log('Write successful! Document ID:', momentId);
    process.exit(0);
}

runTest("测试测试").catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});

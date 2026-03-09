import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import admin from 'firebase-admin';
import { readFileSync, appendFileSync } from 'fs';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { buildSharedPrompt, parseLLMResponse } from '../../src/utils/aiLogicCore.js';
import type { EventThread } from '../../src/types.js';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 强制调试日志函数：将关键信息写入物理文件，防止 Stdio 无法直接观察的问题
function debugLog(message: string) {
    const logPath = join('/tmp/mcp_debug.log');
    const time = new Date().toISOString();
    try {
        appendFileSync(logPath, `[${time}] ${message}\n`);
    } catch (e) {
        // ignore
    }
}

// 尝试在不同层级寻找 .env
const possibleEnvPaths = [
    join(__dirname, '../../../.env'), // 从 dist/mcp-server/src 向上 3 级（推荐）
    join(__dirname, '../../.env'),    // 向上 2 级
    join(process.cwd(), '.env'),      // 当前执行目录
    join(process.cwd(), 'mcp-server/.env') // 父执行目录
];

for (const p of possibleEnvPaths) {
    const result = dotenv.config({ path: p });
    if (result.parsed) {
        debugLog(`Environment loaded from: ${p}`);
        break;
    }
}

debugLog(`MCP Startup: APP_ID=${process.env.APP_ID}, USER_UID=${process.env.USER_UID}`);
if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    debugLog("FATAL: FIREBASE_SERVICE_ACCOUNT_PATH is missing from env!");
}

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
    process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const APP_ID = process.env.APP_ID || "flux-moment"; // Make sure to match this with your frontend APP_ID
const USER_UID = process.env.USER_UID;

if (!USER_UID) {
    console.error("USER_UID is not set in .env. The MCP server needs a user UID to write to Firestore.");
    process.exit(1);
}

// ------ 核心 AI 处理逻辑：调用与网页端相同的 LLM 配置 ------

const LLM_API_KEY = process.env.VITE_LLM_API_KEY || '';
const LLM_ENDPOINT = process.env.VITE_LLM_ENDPOINT || 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL_NAME = process.env.VITE_LLM_MODEL || 'qwen-plus';

async function analyzeWithAI(content: string, existingThreads: any[]) {
    const prompt = buildSharedPrompt(content, existingThreads);

    // @ts-ignore
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

    if (!res.ok) {
        throw new Error(`LLM API error: ${res.status}`);
    }

    const data: any = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';

    return parseLLMResponse(raw, content, existingThreads);
}


// --- MCP Server Setup ---

const server = new Server(
    {
        name: "flux-moment-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "add_moment",
                description: "Record a new moment/thought/event to FluxMoment system. The system will automatically classify and assign tags.",
                inputSchema: {
                    type: "object",
                    properties: {
                        content: {
                            type: "string",
                            description: "The complete original text of what the user wants to record."
                        }
                    },
                    required: ["content"],
                },
            }
        ],
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "add_moment") {
        const { content } = request.params.arguments as { content: string };
        const timestamp = Date.now();
        debugLog(`Tool add_moment invoked. Content length: ${content.length}`);

        try {
            // 0. Get context
            const currentAppId = process.env.APP_ID || APP_ID;
            const currentUserUid = process.env.USER_UID || USER_UID;
            const momentsPath = `artifacts/${currentAppId}/users/${currentUserUid}/moments`;

            debugLog(`Paths: APP_ID=${currentAppId}, User=${currentUserUid}`);
            debugLog(`Firestore target: ${momentsPath}`);

            const snapshot = await db.collection(momentsPath).orderBy('lastUpdatedAt', 'desc').limit(10).get();
            const existingThreads = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
            debugLog(`Retrieved ${existingThreads.length} existing threads.`);

            // 1. Process via AI
            debugLog(`Analyzing with AI... (Endpoint: ${process.env.VITE_LLM_ENDPOINT || 'default'})`);
            const classification = await analyzeWithAI(content, existingThreads);
            debugLog(`AI Analysis result: Title=[${classification.title}], MatchedID=[${classification.matchedThreadId}]`);

            // Handle merging if matched
            if (classification.matchedThreadId) {
                const threadRef = db.doc(`${momentsPath}/${classification.matchedThreadId}`);
                const threadDoc = await threadRef.get();
                if (threadDoc.exists) {
                    const data = threadDoc.data()!;
                    const mergedTags = [...new Set([...(data.tags || []), ...classification.tags])].slice(0, 5);

                    await threadRef.update({
                        entries: admin.firestore.FieldValue.arrayUnion({
                            id: uuidv4(),
                            content: content,
                            timestamp: timestamp,
                        }),
                        tags: mergedTags,
                        mood: classification.mood,
                        lastUpdatedAt: timestamp,
                        _syncedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    return {
                        content: [{ type: "text", text: `Successfully appended to existing thread: [${data.title}]` }],
                    };
                }
            }

            // Normal new thread creation
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

            debugLog(`Writing new moment to Firestore doc: ${momentId}`);
            await db.doc(`${momentsPath}/${momentId}`).set(threadData);
            debugLog(`Write to Firestore SUCCESS.`);

            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully added new moment: [${classification.title}] in [${classification.category.name}].`,
                    },
                ],
            };
        } catch (error: any) {
            debugLog(`CRITICAL ERROR in add_moment: ${error?.message || error}`);
            if (error?.stack) debugLog(`Stack: ${error.stack}`);
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Failed to add moment to Firestore: ${error?.message || error}`,
                    },
                ],
            };
        }
    }

    throw new Error(`Tool not found: ${request.params.name}`);
});

// Run server
async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("FluxMoment MCP Server is running!");
}

run().catch(console.error);

#!/usr/bin/env node

import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取配置
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// 解析 .env 文件
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim().replace(/"/g, '');
    }
});

console.log('📋 配置信息:');
console.log('  APP_ID:', env.APP_ID);
console.log('  USER_UID:', env.USER_UID);

// 初始化 Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// APP_ID 格式为 "orgId/appId"，需要拆分
const [orgId, appId] = env.APP_ID.split('/');
const USER_UID = env.USER_UID;

console.log('  orgId:', orgId);
console.log('  appId:', appId);

// 要录入的内容
const content = "我今天的小龙虾可以和 FluxMoment 打通啦😄";
const timestamp = Date.now();
const momentId = uuidv4();

async function addMoment() {
    try {
        // 正确的路径：artifacts/{orgId}/{appId}/users/{userId}/moments
        // 路径结构：collection -> doc -> collection -> doc -> collection -> doc
        const momentsCol = db.collection('artifacts')
            .doc(orgId)
            .collection(appId)
            .doc('users')
            .collection(USER_UID)
            .doc('moments')
            .collection('threads');

        const threadData = {
            title: "小龙虾与 FluxMoment 打通",
            category: { name: "技术成就", icon: "🎉" },
            tags: ["FluxMoment", "MCP", "集成"],
            mood: "happy",
            avatarVariant: "default",
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

        await momentsCol.doc(momentId).set(threadData);

        console.log('✅ 录入成功!');
        console.log('  标题:', threadData.title);
        console.log('  分类:', threadData.category.name);
        console.log('  内容:', content);
        console.log('  ID:', momentId);

        process.exit(0);
    } catch (error) {
        console.error('❌ 录入失败:', error.message);
        console.error('  Stack:', error.stack);
        process.exit(1);
    }
}

addMoment();

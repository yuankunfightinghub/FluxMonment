# FluxMoment | 流光瞬息 🌌

> **采样级碎片信息捕捉工具** — 用 AI 让闪念流动成诗。

FluxMoment 是一款专为高效捕捉碎片化信息设计的个人记忆引擎。它融合了极简的 Notion 审美与 Arc 浏览器的灵动交互，通过 AI 深度嵌入技术，将杂乱的日常碎片转化为结构化的生命流。

## ✨ 核心特性

### 1. 极致录入体验 (`InputCapsule`)
- **多模态捕捉**：支持纯文字、高清图片及视频上传。
- **意图极速推断**：AI 自动识别输入意图（记录 vs 搜索），无需手动切换模式。
- **动态主题感应**：根据录入内容实时改变 UI 色彩方案（Cyber Blue / Sunset Orange）。

### 2. AI 智能驱动引擎 (`ClassificationEngine`)
- **语义深度检索**：基于向量嵌入（Embeddings）技术，支持“按意思搜索”而非简单的关键词匹配。
- **情绪面部系统**：独特的 `MomentAvatar` M-字母骨架面部表情系统，随心情自动变换表情与装饰变体（50+ 种变体）。
- **每日记忆结晶**：自动化聚合当日卡片，生成深度记忆摘要与待办列表。

### 3. 高级视觉交互
- **Notion Style & Arc Aesthetic**：基于精心设计的 Ink Hierarchy（墨水等级）视觉系统，追求极致的留白与灵敏。
- **瀑布流记忆流**：采用 Masonry 布局，配合 Framer Motion 物理动效，打造如流水般的浏览感。
- **流光时间轴**：创新的纵向 Fluid Chronos 时间轴，支持节点 Hover 展开深度细节。

### 4. 生产力级底层架构
- **Firebase 全栈支持**：集成 Firestore 实时数据库、Cloud Storage 及 Google Auth。
- **采样级离线优先**：极致优化的加载性能，毫秒级响应用户输入。

## 🛠️ 技术栈

- **核心**: React 18, TypeScript, Vite
- **动效**: Framer Motion
- **数据库/鉴权**: Firebase (Auth / Firestore / Storage)
- **样式**: Vanilla CSS (Global Design System Tokens)
- **图标**: Lucide React

## 📂 项目结构

```bash
src/
├── components/           # UI 组件 (InputCapsule, TimelineCard, MomentAvatar 等)
├── utils/                # 核心逻辑 (分类引擎、向量化工具)
├── hooks/                # 状态钩子 (Firestore 实时同步)
├── lib/                  # 外部集成 (Firebase、存储配置)
├── types.ts              # 强类型定义
└── index.css             # 全局设计系统 Token 和基础样式
```

## 🚀 快速开始

1. **克隆并安装**
   ```bash
   npm install
   ```

2. **配置环境变量**
   在 `.env.local` 文件中填入你的 Firebase 配置。

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

---
*“捕捉那些不被察觉的光影，它们皆是流动的诗。”*

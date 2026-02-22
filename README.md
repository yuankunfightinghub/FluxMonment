# FluxMoment (流光瞬息) ✦

FluxMoment 是一款面向白领与创意工作者的「采样级」碎片信息捕捉工具。它融合了 Notion 极简克制的美学体系和优雅的物理动效，并在后台接入了真正的大语言模型（LLM）与 Firebase 实时云端架构。让你随时随地抛出的每一丝闪念、图片与视频，都能被智能归类、精准聚合与跨端同步，在工作效率与生活仪式感之间取得完美平衡。

---

## ✨ 核心特性 (Key Features)

### 1. 极致双模宇宙 (Work vs Life)
基于大语言模型的深度理解，FluxMoment 自动将你的泛输入流分频至不同的视觉与语义结界：
- **工作宇宙 (cyber-blue)**：专注于职场推进。精准识别需求设计、商业化、数据连接、会议协同等专业语境，展现为带有专注标识和蓝色光晕的卡片。
- **生活宇宙 (sunset-orange)**：安放日常情绪与碎片体验。敏锐感知旅行、饮食、娱乐、亲子陪伴等要素，呈现为慵懒/活泼表情和橙色暖光的感悟卡槽。

### 2. 严苛的高维语义聚合 (1-Hour Smart Aggregation)
抛弃了粗糙的“同词相聚”与“强行合并”，系统采用了极其智能的连贯性判定：
- **三要素强制校验**：当你在 **1 小时** 内连续输入时，只有当 AI 判定你的历代记录在「人物」、「事件动作」、「环境上下文」上高度一致时，新记录才会被合并进之前 Timeline 卡片，沉淀为故事线。
- **极简降噪呈现**：如果事件发生偏移（比如前一秒在开会，后一秒在喝咖啡），系统立即阻断聚合，拆分为独立卡片；并且，若卡片内仅有 1 条独立记录，所有冗余的时间轴线与圆点将被完全隐藏，还你一张纯粹的原子级闪念卡。

### 3. 多模态云端持久化与秒级同步 (Firebase & Cloud Storage)
彻底告别单机时代。
- **Firebase Firestore**：接入 Google Firebase 提供毫秒级的数据上星，利用统一的 `APP_ID` 结构自动为你同步多端工作状态，刷新绝不丢失。
- **Firebase Storage 图床**：支持将高分辨率图片和本地视频直传云端，以缩略瀑布流形态原生渲染在时间轴内。

### 4. 深度物理级媒体剥离 (Deep Deletion Engine)
在极简排版下，当你的鼠标精准悬停至卡片时，将会显露一抹隐秘的删除按钮。
不留任何赛博垃圾——点击删除不仅会在 Firestore 文档层进行数据秒删与 DOM 乐观卸载；更会并发触发底层 Storage 清理流，彻底回溯并铲除这通对话下所挂载的所有云端图像与视频，帮你的云容量“减负”。

### 5. 情绪头像生成 (Dynamic AI Avatars)
根据你所描述的场景，大模型不仅会分析并打上核心标签（Tags），还会实时在 50+ 种几何变体中（如皇冠、外星人天线、咖啡杯、花环、专注眼镜等）挑选最应景的「情绪头图」，赋予每次记录独一无二的心情铭牌。

---

## 🛠 技术栈 (Tech Stack)

* **核心框架**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **构建生态**: [Vite](https://vitejs.dev/)
* **美学动效**: Vanilla CSS + [Framer Motion](https://www.framer.com/motion/) (物理弹簧体系)
* **矢量图标**: [Lucide React](https://lucide.dev/)
* **服务端架构**: [Firebase](https://firebase.google.com/) (Auth / Firestore / Storage)
* **AI 大脑**: [SiliconFlow API](https://siliconflow.cn/) / OpenAI Schema (通过 `classificationEngine.ts` 接入)

---

## 🚀 快速运行 (Getting Started)

1. **环境准备**
   确保你安装了 Node.js (v18+) 并在本地准备或注册好了相关的 Firebase 配置。

2. **环境变量注入**
   在根目录下创建 `.env`，按照需求填充属于你的云端与 AI 密钥：
   ```env
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_firebase_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   # AI 引擎 (SiliconFlow)
   VITE_SILICONFLOW_API_KEY=your_secret_key
   ```

3. **启动引擎**
   ```bash
   npm install
   npm run dev
   ```

---

*“让想法在时间轴上悬浮，在云端永生。”*

# FluxMoment (流光瞬息) ✦

FluxMoment 是一个极简且富有生命力的「碎片记录」与「灵感捕捉」 Web 应用。它融合了 Notion 极简克制的美学体系和优雅的物理动效，并通过模拟大模型 (Mock LLM) 引擎，让你随时随地抛出的每一丝闪念都能被智能归类、聚合与提取。

---

## ✨ 核心特性 (Key Features)

### 1. 极致双模宇宙 (Work vs Life)
FluxMoment 能够根据输入的语义信息，自动将你的想法分流至完全不同的色彩结界：
- **工作模式 (科技蓝, cyber-blue)**：专注于职场效率与进度。它能精准识别产品推进、需求设计、运营增长与沟通协同等专业语境。
- **生活模式 (落日橙, sunset-orange)**：安放你的日常与情绪体验。它对旅行、影视、美食、运动与亲子陪伴等生活要素保持敏感。

### 2. 高维时空聚合引擎 (Smart Topic & Time-Window Aggregation)
抛弃了粗糙的流水账，系统采用了创新的“隐式主题 + 2小时时间折叠”算法：
- **主题对齐**：当新记录与历史记录归属同一深层子分类（即使它们没有相同的字眼）。
- **时间保鲜**：如果记录发生在同一主题的 **2 个小时之内**，系统会自动将片段聚合并接驳进同一张时间轴卡片 (Timeline Card) 中，确保信息结构的整洁。

### 3. AI 实体标签抽取 (AI Keyword Tagging)
为了使得回顾与扫视更加直观，分类引擎会从每段零散的话语中智能提取出核心议题标签，并以药丸 (Pills) 形式附着在卡片底部（上限 5 个）。
*目前支持的专有名词包括但不限于：*
* **业务线提取**：`商业化`、`AI 助理`、`数据连接` 
* **动作意图提取**：`需求`、`方案设计`、`发布上线`、`沟通协作`、`运营增长`
* **生活方式提取**：`亲子时光`、`影视娱乐`、`美食探店`、`运动健康`

### 4. 沉浸拟态动效 (AntiGravity Aesthetics)
基于纯粹的 React 与 Framer Motion 打造：
- **弹性胶囊输入框**: 自适应多行延伸，拥有环境感知能力，输入有效字符时高亮指示系统就绪。
- **灵动流转**: Bento 瀑布流布局支持元素的错位弹射入场，Hover 时会模拟光影交互产生物理 Z 轴悬浮。
- **极简视觉**: 告别冗杂的界面与文本，核心界面无任何多余边框、标记位或扰人的控件，享受如同白纸一般的输入心流。

### 5. 阅后即焚式本地储存 (Offline Local Persistence)
采用 `localStorage` 拦截并序列化你的心流状态。所有的灵感记录完完全全存储在你的本地浏览器中，彻底杜绝隐私外泄（你可以随时通过清除本地缓存清空整个宇宙）。

---

## 🛠 技术栈 (Tech Stack)

* **核心框架**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **构建生态**: [Vite](https://vitejs.dev/) - 次世代超极速前端构建工具
* **美学与动效**: Vanilla CSS + [Framer Motion](https://www.framer.com/motion/) (物理弹簧与高级交互)
* **矢量图标**: [Lucide React](https://lucide.dev/) (清晰干练的无边框图标库)
* **状态持久性**: Native DOM `localStorage`

---

## 🚀 快速开始 (Getting Started)

确保你的开发环境已经安装了 `Node.js` (建议 v18 及以上版本)。

1. **安装依赖**
   ```bash
   npm install
   ```

2. **启动本地开发服务器**
   ```bash
   npm run dev
   ```
   随后打开浏览器访问 `http://localhost:5173` 即可开始记录。

3. **构建生产版本**
   ```bash
   npm run build
   ```
   *产物将生成在 `/dist` 目录中。本项目亦经过特殊验证，可直接将打包后的目录作为 Chrome 浏览器未打包扩展程序 (Manifest / Popup) 接入使用。*

---

## 📂 核心目录结构指南

```text
📦 antigravity
 ┣ 📂 src
 ┃ ┣ 📂 components
 ┃ ┃ ┣ 📜 Greeting.tsx        # 顶部动态欢迎语与 Notion 标题排版
 ┃ ┃ ┣ 📜 InputCapsule.tsx    # 核心输入胶囊交互层
 ┃ ┃ ┣ 📜 MomentStream.tsx    # 展示层框架，承载所有的瀑布流卡片
 ┃ ┃ ┗ 📜 TimelineCard.tsx    # 含有 AI 标签以及 2 小时收束时间轴的主体展示卡槽
 ┃ ┣ 📂 utils
 ┃ ┃ ┣ 📜 classificationEngine.ts # 🚨 核心: Mock LLM 主题推断引擎、时间聚合逻辑与标签提取
 ┃ ┃ ┗ 📜 store.ts            # 本地数据层的增删改查
 ┃ ┣ 📜 App.tsx               # 路由顶层控制与状态调度
 ┃ ┣ 📜 index.css             # 统一抛出的 Notion Brand 等设计令牌 (Tokens) 和 CSS
 ┃ ┗ 📜 types.ts              # 应用状态契约定义 (EventThread, EventCategory)
 ┗ 📜 README.md
```

---
*Created in a transient moment. Build the future, simply.*

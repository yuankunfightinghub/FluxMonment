# Notion Brand Kit

基于从 https://www.notion.com 提取的样式数据，整理的品牌规范文档。

## 1. 核心元素预计算样式 (Computed Styles)

| 元素 | Font Family | Font Size | Font Weight | Line Height | Color | Background Color | Border Radius | Box Shadow |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Header (导航栏)** | NotionInter, sans-serif | 14px | 500 | 1.2 | `#050505` | Transparent | 0 | None |
| **Hero (主标题)** | NotionInter, sans-serif | ~64px | 700 | 1.1 | `#050505` | Transparent | 0 | None |
| **主 CTA 按钮** | NotionInter, sans-serif | 16px | 600 | 1.0 | `#ffffff` | `#006ebc` | 12px | `0 1px 2px rgba(0,0,0,0.05)` |
| **正文段落 (Body)**| NotionInter, sans-serif | 20px | 400 | 1.5 | `#050505` | Transparent | 0 | None |
| **Footer (页脚)** | NotionInter, sans-serif | 14px | 400 | 1.5 | `#050505` | Transparent | 0 | None |

## 2. 品牌色板 (Color Palette)

体系化整理的 8 种基础色彩规范：

**主色/辅色 (Primary & Secondary)**
*   **Primary (品牌主蓝)**: `#006ebc` —— 用于主 CTA 按钮和核心高亮链接。
*   **Primary Hover (交互深蓝)**: `#0037cd` —— 用于主色按钮的 Hover/Active 状态。
*   **Background (大面积纯白)**: `#ffffff` —— 主页面的默认背景色，保持干净整洁的视觉基调。

**强调色/灰阶 (Accent & Grayscale)**
*   **Text Strong (主文本/标题黑)**: `#050505` —— 用于各级标题（Hero、Header）确保极高辨识度与对比度。
*   **Text Default (正文深灰)**: `#37352f` —— 用于大段正文和次要描述文本，降低纯黑带来的视觉疲劳。
*   **Neutral Surface (中性浅灰底色)**: `#f6f5f4` —— 用于卡片背景、次要区块容器。
*   **Border (分割线/边框浅灰)**: `#e1e1e1` 或 `rgba(0,0,0,0.1)` —— 用于输入框边框、区域分割线，提供微弱但不突兀的边界感。
*   **Accent (悬浮浅蓝底色)**: `rgba(0, 110, 188, 0.05)` —— 用于次要按钮或链接的 Hover 背景。

> [!WARNING]
> **不确定 (Uncertain): 品牌蓝色的实际来源和准确性**
> 在部分宣传插画或图标中，使用的蓝色值可能与 UI 中使用的 CSS Hex 值 `#006ebc` 存在微妙差异。这些颜色可能直接嵌入在 SVG 或者图片切片中，并未由全局 CSS 控制。
> 
> *替代验证方式*: 
> 1. 下载对应的 SVG/WebP 素材，在 Figma 或设计软件中直接对插图吸色对比。
> 2. 检查 Notion 是否在代码中注入了内联的 `<style>` 标签覆盖了外链 CSS。

## 3. 组件样式规范 (UI Components Guidelines)

### 3.1 字体层级 (Typography Hierarchy)
全局均采用专门优化的无衬线字体栈：`font-family: NotionInter, sans-serif;`
*   **Hero / Display (展示级标题)**: Size: `~64px` | Weight: `700 (Bold)` | Line-height: `1.1` | Color: `#050505`
*   **Body (正文段落)**: Size: `20px` | Weight: `400 (Regular)` | Line-height: `1.5` | Color: `#050505` (部分辅助文本可能使用 `#37352f`)
*   **Label / Link (导航与小字)**: Size: `14px` | Weight: `500 (Medium)` | Line-height: `1.2/1.5` | Color: `#050505`

### 3.2 按钮与交互 (Buttons & CTAs)
*   **主按钮 (Primary Button)**
    *   **背景色**: `#006ebc`
    *   **文字**: 16px, Weight 600, Color `#ffffff`
    *   **圆角 (Border Radius)**: `12px` (较为圆润现代的设计风格)
    *   **阴影 (Box Shadow)**: 非常克制的微重力阴影 `0 1px 2px rgba(0,0,0,0.05)`

### 3.3 卡片与输入框 (Cards & Inputs)
*   **卡片容器 (Card)**: 背景多使用纯白或浅灰 `#f6f5f4`，极少使用明显的投影分割边界，更多依赖留白和极浅色边框 `#e1e1e1` 来区隔。
*   **输入框 (Inputs)**: 边框通常为 1px 的 `#e1e1e1`，获取焦点时通常会有系统级蓝色的 focus 扩散光效。

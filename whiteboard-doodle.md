# 🎨 Whiteboard Doodle（白板涂鸦）

## 风格名称
**Whiteboard Doodle** / 白板涂鸦风

## 参考样图
`image-styles/whiteboard-doodle-sample.png`

## 风格描述

像演讲者在白板上边讲边画的手绘涂鸦风格。轻松、直观、有温度，适合演讲配图、概念展示、流程说明。

## 核心特征

### 背景
- **纯白 #FFFFFF**，完全平坦
- 无白板边框、无阴影、无反光、无任何照片质感
- 纯平面 2D 插画画布

### 笔触
- 手写体，线条**不均匀、略微歪斜**，有粗细变化
- 像真人用粗头记号笔（felt-tip marker）画的
- 不要数字字体，不要工整排版

### 配色（三色为主）
| 颜色 | 用途 |
|------|------|
| **黑色** | 正文、主要文字 |
| **蓝色** | 箭头、框线、装饰元素、次要标注 |
| **红色** | 重点数字、强调词、关键结论 |
| 黄/金色 | 少量用于分隔线、高亮（可选） |
| 灰色 | 次要信息（可选） |

### 插图
- **火柴人 / 简笔画**级别的涂鸦
- 小图标：灯泡💡、时钟⏰、箭头→、星星⭐、信封✉️、火箭🚀
- 对话气泡、思维泡泡
- 蓝色手绘箭头串联内容流

### 排版
- 标题大、正文小，层次分明
- 内容用手绘方框分区
- 留白充足，不要塞满

## Prompt 模板

```
Hand-drawn doodle illustration on a perfectly plain #FFFFFF white background. NO whiteboard, NO board frame, NO border, NO shadows, NO reflections, NO photographic elements. Pure flat white canvas.

Drawing style: sketchy marker doodles - wobbly hand-drawn lines, visible ink strokes with thickness variation, imperfect handwriting like someone drawing live during a presentation. Colors: mainly blue marker (arrows, boxes, decorative elements), red marker (key words, emphasis, important numbers), black marker (main text, titles). Simple stick-figure level doodles and icons.

Flat 2D illustration only. No 3D, no shadows, no texture, no photorealism.

Content:
[在这里填写具体内容]
```

## 推荐参数
- **模型：** `google/gemini-3-pro-image-preview`（Nano Banana Pro）
- **比例：** `16:9`（演示稿）/ `1:1`（社交媒体）
- **输出：** PNG

## 适用场景
- 演讲 / 演示稿配图
- 概念解释图
- 流程图 / 对比图
- 数据可视化（简单图表）
- 教学 / 培训材料

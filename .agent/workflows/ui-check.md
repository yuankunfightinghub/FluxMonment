---
description: 检查项目 UI 风格的一致性
---

# /ui-check 命令

当用户输入此命令时，请执行以下风格自检：

1. **字体栈检查**：扫描 `index.css` 和主要组件，确认 `font-family` 是否统一使用了 `NotionInter`。
2. **变量一致性**：检查是否所有卡片都正确使用了 `.notion-card` 类名。
3. **颜色基准**：验证关键的颜色变量（如 `cyber-blue` 和 `sunset-orange`）是否符合 `brand-kit.md` 的规范。
4. **报告结果**：汇总发现的不一致点，如果全部通过，则告知用户“UI 风格与 Notion 体系完美契合”。

# 视觉设计系统指南：重构标准，定义卓越

## 1. 设计概述与创意北极星 (Creative North Star)

本设计系统不仅是对 Element Plus 框架的延续，更是一次对“精准”与“深度”的重构。我们的创意北极星被定义为 **“数智策展人 (The Digital Curator)”**。

在标准化的 Vue 框架之上，我们要打破平庸的“模板感”。通过**意图明确的非对称布局**、**极简的影调层次**以及**权威的排版比例**，我们将原本机械的后台界面转化为具有社论感、专业感且富有呼吸感的数字化空间。虽然保留了 4px 的经典圆角，但通过剔除繁杂的边框线，我们赋予了界面一种“流动的秩序”。

---

## 2. 色彩系统 (Colors)

色彩不仅是状态的表达，更是空间的构建工具。

### 核心调色板
- **Primary (核心蓝):** `#0060a9` (用于关键行动)，对应的容器色为 `#409eff`。
- **Success (成功):** `#67C23A` (对应 `tertiary`)。
- **Warning (警告):** `#E6A23C`。
- **Error (危险):** `#ba1a1a`。

### 关键原则
1.  **“无边界”准则 (The No-Line Rule):** **严禁**使用传统的 1px 实线边框进行大面积区域分割。所有的容器边界必须通过背景色的明度转换来实现。例如，使用 `surface-container-low` (#f1f4fb) 的区块坐落在 `background` (#f8f9ff) 之上。
2.  **表面层级嵌套 (Surface Hierarchy):** 界面被视为一系列堆叠的精密纸张或磨砂玻璃。
    *   **底层:** `surface` (#f8f9ff)
    *   **中层:** `surface-container` (#ebeef5)
    *   **顶层 (卡片/浮窗):** `surface-container-lowest` (#ffffff)
3.  **毛玻璃与渐变 (Glass & Gradient):** 在悬浮元素或全局导航中，引入 `backdrop-blur`（背景模糊）结合半透明的 `surface` 色彩。主要的 CTA 按钮允许使用从 `primary` 到 `primary_container` 的微弱线性渐变，以增加视觉的“灵魂”与厚度。

---

## 3. 字体排印 (Typography)

我们采用 Inter 结合系统原生字体，旨在通过极端的字阶对比建立“权威感”。

| 类别 | 标记 | 字体 | 字号 | 意图 |
| :--- | :--- | :--- | :--- | :--- |
| **展示** | `display-lg` | Inter / Sans-serif | 3.5rem | 用于大屏数据或艺术化封面 |
| **标题** | `headline-md` | Inter / Sans-serif | 1.75rem | 页面主入口，强调层级 |
| **正文** | `body-md` | Inter / Sans-serif | 0.875rem | 标准阅读流，确保清晰 |
| **标签** | `label-sm` | Inter / Sans-serif | 0.6875rem | 辅助信息，采用更高灰度值 |

**排版逻辑：** 标题与正文之间应保持充足的垂直间距。利用 `display` 级别的字体进行意图明显的留白，使界面呈现出一种“数字杂志”的质感。

---

## 4. 高度与深度 (Elevation & Depth)

我们摒弃物理结构的线条，转而使用**调色 layering (Tonal Layering)**。

*   **层级堆叠原则:** 深度是通过 `surface-container` 梯度的叠加实现的。一个 `#ffffff` 的卡片放置在 `#f1f4fb` 的容器上，会产生自然的浮现感。
*   **环境阴影 (Ambient Shadows):** 仅在需要“漂浮”时使用阴影。阴影必须是超扩散的（Blur > 20px），不透明度控制在 4%-8% 之间。阴影色应包含 `on-surface` 的色调，而非纯灰色，以模拟自然环境光。
*   **“幽灵边框” (Ghost Border):** 若因无障碍需求必须使用边框，请使用 `outline-variant` 并将透明度降至 10%-20%。严禁使用高对比度的完全不透明边框。

---

## 5. 组件规范 (Components)

### 按钮 (Buttons)
*   **Primary:** 使用 `primary` 色彩，在悬停时通过 `surface_tint` 增加深度。
*   **Tertiary (三级按钮):** 仅保留文字，取消背景，通过 `label-md` 的字重强调。

### 输入框 (Input Fields)
*   取消 1px 环绕边框，仅保留底部的 `outline-variant` 弱化线，或使用 `surface-container-high` 作为填充色。聚焦状态下使用 `primary` 色的微光过渡。

### 列表与表格 (Lists & Tables)
*   **禁止使用分割线:** 每一行数据通过 hover 时的 `surface-container-low` 变色来区分。利用纵向留白代替横向线条。
*   **表头:** 使用 `label-md` 辅以 `secondary` 色彩，全大写或加重字重以示区别。

### 导航体系 (Navigation)
*   **侧边栏:** 采用 `surface-container-lowest` 背景，利用 `surface-dim` 建立微小的调性区别。
*   **面包屑:** 作为辅助引导，应弱化其视觉重量，使用 `on-surface-variant`。

---

## 6. 做与不做 (Do's and Don'ts)

### ✅ 建议做的 (Do's)
*   **使用非对称留白:** 在页面右侧或底部保留较大的空白区域，引导视线流动。
*   **色彩感知一致性:** 确保 `success`、`warning`、`danger` 的使用仅限于反馈，而非装饰。
*   **微动效:** 所有的容器展开和状态切换应有 200ms-300ms 的平滑过渡。

### ❌ 严禁做的 (Don'ts)
*   **严禁使用 `#DCDFE6` 100% 不透明度边框:** 这会破坏“数智策展人”的轻盈感。
*   **严禁在同一个视图中使用超过三种阴影级别:** 这会导致界面混乱。
*   **严禁压缩文本间距:** 宁可增加滚动高度，也不要牺牲易读性。

---

通过这套系统，我们不再是简单地实现功能，而是在构建一个**有温度、有权威、有呼吸感**的专业工具。请记住：好的设计不仅在于你看到了什么，更在于你感受到了什么样的秩序。
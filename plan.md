# 21st Century Schizoid Ad — Project Plan

跳过 B 站视频中由 UP 主自行嵌入的“中插/口播/软广”。当检测到广告片段时，在播放器上方显示提示：“前方有广告。要跳过吗？”，直到广告结束才自动消失；若用户点击“跳过”，立即跳转到广告结束时间点。

本项目面向 Chromium 内核浏览器（Chrome/Edge/Brave/Opera 等），采用 Manifest V3 架构。


## 1) 目标与用户故事

- 目标
  - 尽量准确地检测并定位视频中的“创作者自插广告”区间。
  - 在广告期间提示用户，并提供一键跳过到广告末尾的交互。
  - 尊重用户隐私，保证可解释与可控，避免误杀正片。
- 核心用户故事
  - 作为观众，当 B 站视频播放到广告时，我会在画面上看到“前方有广告。要跳过吗？”的提示。
  - 我可以点击“跳过”直接跳到正片；或选择“不要跳过”，提示会一直显示到广告结束。
  - 我可以配置策略：只使用“社区时间轴”、只使用“AI 检测”、或“两者融合”，并设置不同广告类型的处理方式（跳过/提示/不处理）。


## 2) 覆盖范围与页面类型

- 初期：`https://www.bilibili.com/video/*`（BV 视频页，含多 P），优先支持普通视频。
- 后续：`https://www.bilibili.com/bangumi/play/*`（番剧/纪录片等），视复杂度逐步覆盖。
- 多 P 视频通过 `?p=` 参数区分分 P；需要在识别数据结构中存储/使用该维度。


## 3) 高层架构（MV3）

- `manifest.json`（MV3）
  - `content_scripts`: 注入到 B 站视频页面；负责 DOM 监听、视频时间线跟踪、UI 覆盖层注入、提示/跳转。
  - `background`（Service Worker）: 处理网络请求、缓存、与“Epitaph”数据交互、长生命周期任务（例如节流/退避、更新轮询）。
  - `options_page`: 配置页（开关、策略、广告类型过滤、内容价值阈值、隐私选项）。
  - `action`（popup 可选）: 快速查看当前视频的检测来源、已知广告段、手动标注入口。
  - 权限：`storage`、`scripting`、`activeTab`、`declarativeNetRequest`（如需）、匹配域名 `*://www.bilibili.com/*`。
- 通信
  - `content_script` 与 `background` 通过 `chrome.runtime.sendMessage`/`onMessage` 通信。
- 存储
  - `chrome.storage.local`（缓存 Epitaph 片段、AI 模型缓存/版本号、用户设置）。
  - `chrome.storage.sync`（轻量用户偏好）。


## 4) 广告检测两大战略（可并行、可切换）

A. 社区时间轴（Epitaph）
- 方案概述
  - 通过独立开源仓库“Epitaph”收集、合并、分发各视频广告时间段（start/end）。
  - 浏览器扩展根据视频 ID（BVID）与分 P（p）查询远端或本地缓存的时间轴片段。
  - 若命中，`content_script` 在时间线进入片段时弹提示，并支持一键跳过到 `end`。
- 数据模型（建议）
  - 键：`BVID`（必须）、`p`（可选，默认 1）、`duration`（冗余校验）。
  - 片段：`{ start: number, end: number, type: "hard_ad" | "soft_ad" | "sponsor_segment" | "self_promo" | "product_showcase", source: "community", confidence: 0~1, content_value: 0~1, disruptiveness: 0~1, submitted_by, submitted_at }`
  - 版本：`schema_version`
- 仓库结构（Epitaph 建议）
  - `epitaph/index.toml`：索引（BVID -> 文件路径/摘要/etag）。
  - `epitaph/BVxx/xxxxx.toml`：单视频数据，包含多 P 结构，例如：
    ```toml
    bvid = "BV1xxxxxxx"
    duration = 1234.56
    updated_at = "2025-09-07T00:00:00Z"
    schema_version = 2

    [parts.1]
    
    [[parts.1.segments]]
    start = 35.1
    end = 82.7
    type = "soft_ad"
    confidence = 0.97
    content_value = 0.7
    disruptiveness = 0.3
    product_name = "Bambu Lab X1"
    product_category = "3D打印机"

    [parts.2]
    segments = []
    ```
- 分发与缓存
  - 纯静态分发（GitHub Pages 原始 TOML / CDN 缓存）。
  - 扩展侧：
    - 首次请求按 `index.toml` -> 视频 TOML。
    - 使用 `etag/last-modified` 做增量/过期控制。
    - 本地缓存 TTL（例如 7 天），命中直接使用；失效再校验。
- 贡献与审核流程
  - MVP：用户在扩展内生成片段草案，点击“提交”打开 GitHub 预填的 Issue（带 JSON 片段、BVID、p、duration、截图/说明）。
  - 进阶：提供最简后端（Cloudflare Workers/Serverless）代理 GitHub PR 创建（用户 OAuth 可选），或采用 GitHub Discussions/Issues 流程 + 维护者合并。
  - 合并策略：多用户共识（投票/重叠时间段合并），置信度提升；冲突时保留多候选片段并打分。
- 客户端 UI/交互
  - 在播放器加两个按钮：“标记广告开始”“标记广告结束”（热键，如 Alt+[、Alt+]）。
  - 自动填入当前 `currentTime`，用户可微调毫秒级；提交时生成 JSON。
  - 在 Popup/Options 显示当前视频的已知片段列表，包含类型、置信度和内容价值；允许本地覆盖（临时忽略/修正/调整类型）。

B. AI 检测（本地优先，可选远程）
- 目标
  - 在没有社区时间轴时，尽量自动推断“赞助口播/植入广告”的开始与结束时间点。
- 分层策略
  1) 轻量启发式（极速 MVP，CPU 友好）
     - 时间先验：大量口播广告集中在视频开头 5~120 秒或中段章节切换点，先在这些窗口重点采样。
     - 画面突变：使用 `OpenCV.js` 或自实现直方图比较，检测强烈镜头/风格切换（广告往往与正片风格差异大）。
     - OSR/OCR 关键词：在关键帧（例如每秒 1 帧）运行 `Tesseract.js` 轻量模式识别“广告/推广/赞助/合作/口播/本期视频由...支持”等关键词；仅在启发式触发时运行，降低成本。
     - 字幕/弹幕特征：若能读取官方字幕/CC，检索关键词；或监控弹幕中“广告/口播”等高频词的爆发（仅作为弱信号）。
  2) 端侧小模型（TF.js/ONNX Runtime Web）
     - 视觉分类：对采样帧做二分类（ad vs non-ad），模型体积 < 5MB；输出逐帧分数，经过时序滤波（HMM/滑动窗口）得到时段。
     - 声学特征：用 WebAudio 提取 MFCC/梅尔谱，输入轻量网络判断“口播/广告风格”概率；与视觉分数 late fusion。
  3) 云端推理（可选，默认关闭，需显式同意）
     - 上传特征而非原帧（如 32x32 直方图+低维音频嵌入）以保护隐私。
     - 限速+匿名化；提供清晰隐私声明与总开关。
- 片段生成与置信度
  - 将多源信号融合成若干候选片段，打分 `confidence`。
  - 低于阈值仅提示“疑似广告”；高于阈值按普通广告处理。
  - 与 Epitaph 结果做优先级合并：社区 > 高置信 AI > 低置信 AI。

## 5) 广告类型与内容价值评估

### 广告类型（type）
- `hard_ad` - 硬广：直接的产品推销或读稿，内容价值低（如“点击下方链接购买”）。
- `soft_ad` - 软广：将产品融入内容，有一定信息量（如“这期视频用Bambu Lab X1打印”）。
- `sponsor_segment` - 赞助商指定片段：明确标注的赞助内容。
- `product_showcase` - 产品展示：以展示产品为主的片段，但包含实用信息（如3D打印作品展示）。
- `self_promo` - 自推内容：UP主推广自己的其他内容。

### 内容评估维度
1. **内容价值 (content_value: 0-1)**
   - 0.8-1.0：高价值（教程、深度评测）
   - 0.5-0.8：中等价值（产品展示+实用技巧）
   - 0.2-0.5：低价值（简单展示）
   - 0-0.2：纯广告

2. **干扰度 (disruptiveness: 0-1)**
   - 0.8-1.0：强烈打断（突然插入、音量骤增）
   - 0.5-0.8：明显但合理
   - 0-0.5：自然过渡

### 用户设置建议
```toml
# 全局开关
enabled = true

# 处理策略
[strategies]
community = true
ai = true
fallbackToAI = true  # 社区无数据时使用AI

# 广告类型处理
[adTypeHandling]
hard_ad = "skip"     # skip/ask/ignore
soft_ad = "ask"
sponsor_segment = "ask"
product_showcase = "ignore"
self_promo = "ignore"

# 内容价值阈值 (0-1，低于此值的内容将被跳过)
minContentValue = 0.3

# 高级设置
[advanced]
confidenceThreshold = 0.7  # 0.5-1.0
showDebugInfo = false

[advanced.hotkeys]
markStart = "Alt+["  # 标记广告开始
markEnd = "Alt+]"    # 标记广告结束
```
- 性能与能耗
  - 仅在视频可见、标签页激活时运行；空闲/后台暂停。
  - 启发式先行，模型推理按需触发；限频、降采样、早停。


## 5) 提示与跳转交互（内容脚本）

- 监听 `HTMLVideoElement`：`timeupdate`、`seeking`、`play/pause`。
- 当 `currentTime` 进入任何“广告片段”窗口：
  - 在播放器容器内显示覆盖层 Prompt：
    - 文案：`前方有广告。要跳过吗？`
    - 行为：
      - “跳过”：将 `video.currentTime = segment.end`，并在 UI 上短暂显示“已跳过 x.xx 秒”。
      - “不要跳过”：隐藏按钮，仅保留提示条或透明小角标，直到片段结束自动消失。
    - 设置项：
      - 自动跳过（静默，无提示）。
      - 仅提示不跳（保守）。
      - 仅社区/仅 AI/混合。
    - 可拖拽/可移动；夜间模式样式；z-index 安全，避免挡字幕；无障碍（焦点/读屏可用）。
- 多片段处理：
  - 相邻片段合并（<2s gap）；重复提示合并退避。
  - 允许“撤销”（回跳到 `segment.start`）。


## 6) B 站页面适配细节

- 选择器与容器
  - 首选 `document.querySelector('video')` 或 B 站播放器容器（如 `.bpx-player-container` 等，需在实现期探查）。
  - 使用 `MutationObserver` 监听路由切换与播放器重建（B 站为 SPA 行为较多）。
- 视频标识提取
  - 从 URL 中解析 `BV` 号与 `?p=`；必要时 fallback 读取页面脚本变量。
  - 获取 `duration` 做 Epitaph 数据一致性校验（避免错配到不同版本/剪辑）。


## 7) Options（设置）与 Popup

- 设置项
  - 开关：启用/停用本扩展。
  - 策略：社区 / AI / 混合；当冲突时的优先级策略。
  - 自动跳过 / 询问再跳 / 从不跳过（仅标注）。
  - AI：是否启用 OCR/视觉/声学；性能模式（低/中/高）。
  - 隐私：是否允许上传特征做云端推理（默认关闭）。
  - UI：提示样式/位置/透明度/快捷键。
- Popup
  - 展示当前视频识别到的广告片段列表与来源（社区/AI）。
  - 一键“忽略此视频的广告”或“总是自动跳过”。


## 8) Epitaph 仓库（独立）设计草案

- 仓库：`epitaph`（独立 Git 仓库）
- 目录结构
  - `data/index.json`：维护 BV -> 文件路径、更新时间、etag、摘要。
  - `data/BVxx/xxxxx.json`：单视频数据（含多 P）。
  - `schema/epitaph.schema.json`：JSON Schema，便于校验 PR。
  - `tools/`：合并/去重/质量检查脚本（CI）。
- 贡献流程
  - Issue 模板 + PR 模板，自动 CI 校验数据格式、时间边界、重叠片段、与 `duration` 的一致性。
  - 将多用户上报合并为“共识片段”，计算 `confidence`。
- 分发
  - GitHub Pages/Raw + CDN；提供 `index.json` 与 ETag 支持。


## 9) 实施里程碑（建议 4 周）

- 里程碑 0（Day 0-1）
  - 初始化扩展骨架（MV3）：manifest/content/background/options。
  - B 站视频页注入 + 抓取 `video`、`BVID`、`p`、`duration`。
  - 基础覆盖层 UI（手动触发调试）。
- 里程碑 1（Week 1）— MVP with Epitaph 读取
  - 接入静态假的 Epitaph JSON（本地 mock）。
  - 命中片段时提示+跳转；选项页支持“询问/自动跳过”。
  - 本地缓存结构与失效策略。
- 里程碑 2（Week 2）— Epitaph 提交链路
  - 扩展内“标记开始/结束”工具与时间微调。
  - 一键生成 GitHub Issue（预填 JSON）；CI 模板与 Schema。
  - 真实远端获取（GH Pages），加上 ETag/TTL。
- 里程碑 3（Week 3）— 轻量 AI/启发式
  - 画面突变直方图 + 关键词 OCR（采样频率可调）。
  - 时序滤波生成候选片段；与 Epitaph 融合。
  - 性能守护（仅前台运行、限频、降采样）。
- 里程碑 4（Week 4）— 打磨与发布
  - 选项页完善、快捷键、视觉主题（King Crimson/绯红风格）。
  - 隐私政策/说明文档；打包并提交 Chrome Web Store。


## 10) 风险与对策

- 误报/漏报：优先使用社区数据；AI 仅作补充并提供阈值/解释与一键纠错。
- 性能消耗：首选启发式与低频 OCR；仅在窗口激活时运行；可完全关闭 AI。
- 页面变更：封装选择器与行为为适配层；通过 `MutationObserver` 与路由监听自愈。
- 法律与平台策略：不修改视频源，不屏蔽平台广告，仅在本地“寻址并跳转时间点”；附隐私与使用说明。


## 11) 成功指标（可选、需用户同意收集或仅本地统计）

- 跳过广告节省的总时长。
- 用户点击“跳过”的次数与撤销率（衡量误报）。
- Epitaph 覆盖率（带有社区时间轴的视频占比）。


## 12) 开放问题与后续方向

- 是否支持番剧/课程等长视频的章节级精确识别？
- 是否支持“自动加速播放广告段”（例如 4x）而非直接跳转？
- 是否支持导入/导出本地自定义时间轴（分享给他人）？
- 是否提供多语言 UI（中/英切换）？


## 13) 清单（交付物）

- 扩展目录结构（MV3）：`manifest.json`、`src/content/`、`src/background/`、`src/options/`、`assets/`。
- Epitaph 仓库：`schema`、`data`、`tools`、`CI`、`README`、`CONTRIBUTING`。
- 文档：隐私说明、使用指南、性能建议、开发者指南。


---

命名灵感：King Crimson（乐队）与《JOJO 的奇妙冒险：黄金之风》替身“King Crimson”及其技能“Epitaph”。本扩展聚焦“预测并删去广告的时间片段”，让观看更连贯。

# B-004 实跑验证记录

## 环境

- LLM_MODEL_DETAIL=qwen-turbo（OpenAI 兼容接口）
- 地图生成走 qwen-plus（来自 B-003）

## 验证流程

1. 启动 server，POST `/api/terrain/map` 生成「Docker 基础」地图：
   返回 5 个节点，topic / userPositionLabel / nodes / edges 结构正常。
2. POST `/api/terrain/node-detail` 跑两个不同领域 topic 各一节点：
   - topic="Docker 基础" / nodeId="node-2" / nodeTitle="镜像怎么来的"
   - topic="速读训练" / nodeId="node-3" / nodeTitle="扫读和精读的差别"

## 输出抽样

### Docker / node-2 / 镜像怎么来的

- **explanation**：「Docker 镜像是怎么被创建出来的。你可以把它想象成一个装好所有工具和文件的盒子，但这个盒子不是凭空出现的，而是通过一系列步骤慢慢构建起来的…」
- **whyThisMatters**：「了解这个过程能帮你更直观地理解如何定制自己的镜像，也能避免在出问题时无从下手。」
- **reflectionPrompt**：「你有没有试过自己动手做一件事，却发现结果和预期完全不一样？」

### 速读训练 / node-3 / 扫读和精读的差别

- **explanation**：「扫读就像快速翻书时看到的关键词，只抓大意；而精读是慢慢看每一个字…两者像是开车时的两种视角——扫读是快速浏览路况，精读是仔细看每一个路标。」
- **whyThisMatters**：「了解它们的区别能让你更灵活地选择阅读方式，不用每次都把时间浪费在不必要的细节上。这会让你的阅读效率更高，也更轻松。」
- **reflectionPrompt**：「你有没有过一边扫读一边突然发现关键信息的时候？当时是怎么反应的？」

## 评估

- **画面感**：两条都有清楚画面或类比（"装好工具的盒子"、"开车时的两种视角"）。
- **反思小语**：都是引子句式，没出现"X 是什么？"考查题。
- **example 复制检查**：两条 detail 都没出现示例 prompt 里的「盲打」「键盘」字样。
- **schema 合规**：nodeId 原样回填、explanation 字数充足、suggestedNextNodeIds 是 `[]`。

## 小瑕疵（不阻塞 B-004，作为后续 prompt 微调备注）

Docker / whyThisMatters 出现「避免在出问题时无从下手」——略有危机感措辞。
后续 v2 可以在 prompt 里加一句：

> 不要写「如果你不弄清，可能会出问题」这类风险句。
> 钩子要正向：「弄清后回头看 X 会变简单」。

目前未触发，先不改 prompt。

## 验收对照（backlog B-004）

- [x] 编写 `node-detail.v1` prompt
- [x] 实现 `POST /api/terrain/node-detail`
- [x] 前端节点详情面板（NodeDetailPanel）
- [x] 详情失败重试（reducer error 态 + 面板重试按钮）
- [x] 点击节点后可看到详情（App onNodeClick → fetchNodeDetail → panel）
- [x] 失败时页面不崩溃（reducer 兜底，HTTP 500/502 → error 态）

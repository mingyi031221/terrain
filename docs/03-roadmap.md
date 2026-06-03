# Roadmap

## 1. 里程碑总览

第一版交互 demo 分 5 个阶段推进，每个阶段都要形成可运行增量，优先保证“输入 -> 生成 -> 展示 -> 完成”主链路闭环。

## 2. 阶段拆分

### Phase 1: Project Scaffold

目标：

- 建立前端和本地代理骨架。
- 跑通本地开发环境。
- 建立基础类型和全局样式。

交付物：

- `Vite + React + TypeScript`
- `server/` 基础目录
- lint 和 typecheck
- 页面基础布局

完成定义：

- 本地一条命令能启动前后端。
- 页面和 server 都能正常响应。

### Phase 2: Shared Contracts and Prompts

目标：

- 定义地图与节点详情的结构契约。
- 建立提示词模板。

交付物：

- 地图和详情类型
- schema 校验
- `map.v1`
- `node-detail.v1`

完成定义：

- 前后端共用同一套结构定义。
- prompt 文件已落地并可被服务引用。

### Phase 3: Map Generation

目标：

- 跑通主题输入到地图生成。
- 完成地图渲染和错误处理。

交付物：

- `POST /api/terrain/map`
- TopicInputPanel
- TerrainMapCanvas
- 地图生成加载态、失败态、重试

完成定义：

- 输入真实主题后可生成并渲染地图。
- 结构非法时不会把脏数据渲染到页面。

### Phase 4: Node Detail and Progress

目标：

- 跑通节点详情生成。
- 完成节点标记和本地存储。

交付物：

- `POST /api/terrain/node-detail`
- NodeDetailPanel
- ProgressSummary
- 本地持久化

完成定义：

- 点击节点可查看详情。
- 标记完成后状态刷新仍在。

### Phase 5: Demo Polish

目标：

- 清理占位内容。
- 补齐最小测试和运行说明。

交付物：

- 空状态与异常恢复
- README
- 基础测试
- 演示主题建议

完成定义：

- 陌生人打开页面能完成一次完整演示。
- 主链路无明显阻断错误。

## 3. 阶段顺序约束

- `Phase 2` 必须在 `Phase 1` 之后，因为接口和 prompt 需要基础骨架。
- `Phase 3` 必须在 `Phase 2` 之后，因为地图生成依赖稳定契约。
- `Phase 4` 必须在 `Phase 3` 之后，因为详情依赖真实地图上下文。
- `Phase 5` 只在前 4 阶段闭环后开始。

## 4. 风险点

### 风险 1: 模型输出不稳定

应对：

- schema 校验。
- 一次自动重试。
- 收窄 prompt 输出范围。

### 风险 2: 地图结构合理但视觉不清晰

应对：

- 先把布局算法做稳定。
- 节点数控制在 5 到 8。
- 第一版不做拖拽缩放。

### 风险 3: server 逐渐膨胀

应对：

- server 只做转发、校验和最小清洗。
- 不引入数据库和业务编排。

## 5. 演示前 checklist

- 环境变量已配置。
- 3 个建议主题都试过。
- 刷新恢复正常。
- 地图失败态和详情失败态都点过。
- 页面没有残留开发态占位文案。

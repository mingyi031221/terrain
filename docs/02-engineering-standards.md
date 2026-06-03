# Engineering Standards

## 1. 总原则

- 这版要做真实交互 demo，不做静态样机。
- 后端存在，但只能薄，不能演化成大而全服务。
- 先把数据契约和状态流做对，再做视觉细节。
- 所有模型输出必须先校验，再进入前端状态。
- 本地可演示优先于“未来可能扩展”的抽象。

## 2. 数据结构规范

### 地图结构

建议统一为：

```ts
type TerrainMap = {
  version: string;
  topic: string;
  generatedAt: string;
  userPositionLabel: string;
  nodes: TerrainNode[];
  edges: TerrainEdge[];
};

type TerrainNode = {
  id: string;
  title: string;
  summary: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes: number;
  required: boolean;
  x?: number;
  y?: number;
};

type TerrainEdge = {
  from: string;
  to: string;
  kind: "prerequisite";
};
```

### 节点详情结构

```ts
type TerrainNodeDetail = {
  nodeId: string;
  title: string;
  explanation: string;
  whyThisMatters: string;
  reflectionPrompt: string;
  suggestedNextNodeIds?: string[];
};
```

## 3. API 规范

### `POST /api/terrain/map`

输入：

```json
{
  "topic": "我想搞懂 Docker"
}
```

输出：

```json
{
  "map": {}
}
```

### `POST /api/terrain/node-detail`

输入：

```json
{
  "topic": "我想搞懂 Docker",
  "nodeId": "node-1",
  "nodeTitle": "容器与镜像"
}
```

输出：

```json
{
  "detail": {}
}
```

### 错误响应

统一结构：

```json
{
  "error": {
    "code": "MAP_GENERATION_FAILED",
    "message": "地图生成失败，请重试"
  }
}
```

## 4. 前端实现规范

### 状态模型

前端最少维护这些状态：

- `topicInput`
- `currentTopic`
- `mapStatus`
- `currentMap`
- `selectedNodeId`
- `nodeDetailStatus`
- `nodeDetailsCache`
- `completedNodeIds`
- `history`

不要把“地图生成中”“详情生成中”“完成状态”“本地恢复状态”都塞进一个对象里不加约束。

### 组件边界

- `TopicInputPanel`: 只负责输入与提交。
- `TerrainMapCanvas`: 只负责地图渲染与节点点击事件。
- `NodeDetailPanel`: 只负责详情展示、重试与完成操作。
- `ProgressSummary`: 只负责完成状态反馈。

### 可视化要求

- 使用 `SVG` 绘制节点和连线。
- 难度映射要在同一页面中保持可比较性。
- 必经节点要有独立视觉标识，不能只靠颜色。
- 已完成节点要有明确状态变化。
- 地图生成时要有清楚的加载反馈，但不要堆砌假的动画。

## 5. Prompt 管理规范

- 每条 prompt 必须放独立文件。
- 每条 prompt 必须有版本号，例如 `map.v1.md`。
- prompt 文件至少包含：
  - 目标
  - 输入变量
  - 输出结构要求
  - 失败时的降级约束

## 6. 模型调用规范

- 地图生成与节点详情分两次调用。
- 地图生成优先结构稳定，节点详情优先可读性。
- 结构校验失败时允许自动重试一次。
- 超过重试上限后返回可解释错误，不把原始 provider 报错直接给前端。

## 7. 本地存储规范

推荐 key：

- `terrain.demo.current-topic`
- `terrain.demo.current-map`
- `terrain.demo.completed-by-topic`
- `terrain.demo.history`

规则：

- 只保存演示必要数据。
- 缓存结构带 `version` 字段。
- 如果恢复失败，允许回退到默认空状态，不要让页面报错。

## 8. 测试规范

### 必做

- schema 单测。
- 地图 API 路由测试。
- 前端主题提交和地图渲染测试。
- 节点完成状态持久化测试。

### 可以后补

- 节点详情流式输出测试。
- 移动端布局测试。

## 9. Definition of Done

一个任务只有满足以下条件才算完成：

1. 代码或文档已更新。
2. 本任务相关验收点已自测。
3. 没有遗留明显占位内容、未说明的假交互或无主错误分支。
4. 如果改了接口结构，前后端调用方已同步检查。

## 10. 禁止事项

- 把 API key 暴露到浏览器。
- 用纯静态数据伪装成实时生成。
- 为了未来扩展过度拆包、过度抽象。
- 把登录、数据库、分享、打包发布混进主链路。

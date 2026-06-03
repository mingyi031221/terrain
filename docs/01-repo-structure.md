# Repository Structure

## 1. 组织原则

第一版做“前端 + 本地最薄代理”的双层结构，不做复杂 monorepo（单仓多包），但也不把 `LLM API` 直接暴露到浏览器。原因很直接：

- 真实演示必须有生成能力。
- 纯前端直连会暴露 API key（密钥）。
- 当前范围又不需要完整后端架构。

所以这里采用一个轻量单仓结构：

- `web`: 页面与交互。
- `server`: 本地代理、提示词、结构校验。

推荐使用：

- `Vite`
- `React`
- `TypeScript`
- `Node.js`
- `Fastify` 或 `Express`
- `Zod`
- `SVG`

## 2. 目标目录

```text
.
├─ src/
│  ├─ app/                    # 应用入口、全局布局
│  ├─ components/             # 通用组件
│  ├─ features/
│  │  ├─ topic-input/         # 主题输入
│  │  ├─ terrain-map/         # 地图渲染
│  │  ├─ node-detail/         # 节点详情面板
│  │  └─ progress/            # 完成状态与历史
│  ├─ lib/                    # HTTP、存储、工具函数
│  ├─ store/                  # 前端状态
│  ├─ styles/                 # 全局样式、变量
│  ├─ types/                  # 前后端共享类型入口
│  └─ main.tsx
├─ server/
│  ├─ prompts/                # prompt 模板
│  ├─ routes/                 # API 路由
│  ├─ services/               # 模型调用与数据转换
│  ├─ schemas/                # Zod schema
│  ├─ utils/
│  └─ index.ts
├─ docs/
├─ public/
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ README.md
```

## 3. 模块边界

### `src/features/topic-input`

负责：

- 输入主题。
- 提交生成请求。
- 展示输入校验和基础错误。

不负责：

- 直接拼 prompt。
- 调用外部模型服务。

### `src/features/terrain-map`

负责：

- 用 `SVG` 渲染节点和依赖线。
- 根据完成状态改变视觉。
- 抛出节点点击事件。

不负责：

- 生成地图。
- 生成节点详情。

### `src/features/node-detail`

负责：

- 展示节点解释、为什么爬、反思小语。
- 触发完成标记。
- 处理详情加载和失败状态。

### `server/routes`

负责：

- 暴露最小 API。
- 接收 topic 和 node context。
- 返回结构化结果。

建议仅保留：

- `POST /api/terrain/map`
- `POST /api/terrain/node-detail`

### `server/prompts`

放：

- 地图生成 prompt
- 节点详情 prompt

要求：

- 独立文件管理。
- 带版本号。

## 4. 配置文件建议

首版建议补齐：

- `.editorconfig`
- `.gitignore`
- `.env.example`
- `eslint.config.js`
- `prettier.config.js`
- `README.md`

## 5. 环境变量

第一版只保留必要配置：

```bash
LLM_API_BASE_URL=
LLM_API_KEY=
LLM_MODEL_MAP=
LLM_MODEL_DETAIL=
PORT=3001
VITE_API_BASE_URL=http://localhost:3001
```

## 6. 为什么不是完整后端工程

因为当前最小交付不是“做一个可部署系统”，而是“做一个本地可用的真实交互 demo”。

现在需要的 server 只有三件事：

- 保护 API key。
- 调模型。
- 校验结构。

超出这三件事的能力，默认都不进当前范围。

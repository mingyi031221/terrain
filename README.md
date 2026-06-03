# Terrain Demo

ADHD 友好的"先看见地图，再走进去"学习工具的本地交互 demo。

输入一句"我想搞懂 X"——后台用 LLM 把它拆成 5–8 个山头节点，连成一张前置依赖图。点任一个山头，得到一段不教材腔的"走进去"内容：

- **是什么**（不预设你已经懂）
- **为什么爬**（因果钩，不是「应该」）
- **挂个钩子**（一句反思引子，不是测验）

爬过的节点会自己变绿存在本地，刷新页面继续。

完整规划见 [docs/](./docs/)。

## 前置

- Node.js ≥ 20
- npm

## 安装

```bash
cp .env.example .env
npm install
```

`.env` 里需要的变量：

| 变量 | 说明 |
| ---- | ---- |
| `LLM_API_BASE_URL` | OpenAI 兼容接口的 base URL（例：DashScope `https://dashscope.aliyuncs.com/compatible-mode/v1`） |
| `LLM_API_KEY` | API key |
| `LLM_MODEL_MAP` | 生成地图用的模型（推荐 `qwen-plus`） |
| `LLM_MODEL_DETAIL` | 生成节点详情用的模型（推荐 `qwen-turbo`，更快更便宜） |

## 启动

```bash
npm run dev
```

会同时启动：

- 前端：<http://localhost:5173>（Vite dev server）
- 本地 LLM 代理：<http://localhost:3001>

## 推荐演示主题

| 主题 | 看点 |
| ---- | ---- |
| `我想搞懂 Docker` | 编程类，节点层级清楚（镜像/容器/Dockerfile/Volume） |
| `我想搞懂回归分析` | 数学/统计类，看 LLM 怎么不写成教材 |
| `我想自己冲一杯不难喝的咖啡` | 非编程主题，看地图是否仍然合理 |
| `今天的天气` | 非学习主题，看 fallback 是否守住 |

## 部署成可分享的 PWA

生产环境是**单服务**：一个 Node 进程同时托管打包后的前端（`dist/`）和 `/api/*`，可免费部署、可"添加到主屏"。完整步骤见 **[DEPLOY.md](./DEPLOY.md)**。本地预览生产形态：

```bash
npm run build:web
SERVE_STATIC=1 PORT=4100 npm run preview:prod   # 打开 http://localhost:4100
```

## 可用脚本

| 命令                 | 作用                                   |
| -------------------- | -------------------------------------- |
| `npm run dev`        | 并行启动前端和 server                  |
| `npm run dev:web`    | 只启动前端                             |
| `npm run dev:server` | 只启动 server                          |
| `npm run build:web`  | 打包前端到 `dist/`                     |
| `npm run start`      | 生产模式：单服务托管 `dist/` + API     |
| `npm run preview:prod` | 本地预览生产单服务形态               |
| `npm run typecheck`  | 对前端、Vite 配置、server 三处分别 tsc |
| `npm test`           | 跑 vitest                              |
| `npm run lint`       | ESLint 检查                            |
| `npm run format`     | Prettier 自动格式化                    |

## 目录结构

```text
src/        前端（React + Vite + TS）
server/     本地 LLM 代理（Fastify + Zod + OpenAI 兼容 client）
docs/       规划文档
```

模块边界见 [docs/01-repo-structure.md](./docs/01-repo-structure.md)。

## 已实现 / 未实现

✅ 已实现（B-001 到 B-008 的 P0+P1 范围）：

- 输入主题 → LLM 生成地图 → 渲染山头
- 点节点 → LLM 生成节点详情（解释 / 为什么爬 / 反思小语）
- 标记节点完成（绿色山头），刷新后保留
- 损坏的本地数据会自动回退
- 失败态、加载态、空态文案都不带教材腔

- 世界地图视图：水彩背景 + 散布的小山 + 虚线小路；走路的小猫沿路走到点击的山再开面板；未访问的山上有睡觉的猫
- 可部署为单服务 PWA、可"添加到主屏"（见 [DEPLOY.md](./DEPLOY.md)）；移动端响应式 + 详情面板底部抽屉
- 后端加固：地图/详情内存缓存（省 LLM 额度）、按 IP/全站限流、输入长度上限

🚫 当前不在 demo 范围（参见 [docs/04-backlog.md](./docs/04-backlog.md)）：

- 登录、跨设备云同步（进度仍存本地 localStorage）
- 节点详情流式输出（B-009，后置）
- 导出图片（B-010，后置）

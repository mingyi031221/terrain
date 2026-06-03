# 部署：把 Terrain 发成一个可分享、可"添加到主屏"的 PWA

目标：一个**免费托管**上的单服务（前端 + 后端同源），生成一条链接发给别人；在手机上可"添加到主屏"，像 App 一样全屏打开。后端继续用你的**阿里云百炼（DashScope）免费额度**。

> 架构：生产环境只跑**一个 Node 服务**——它既托管打包好的前端（`dist/`），又提供 `/api/*`。所以没有跨域、只需部署一次、只填一个服务的环境变量。

---

## 你需要准备的（都不花钱）

1. 一个 **GitHub** 账号（把代码推上去）。
2. 一个 **Render** 账号（免费 Web Service **不需要信用卡**）。
3. 你本地 `.env` 里那套已经能用的 LLM 配置（下一步会原样粘到 Render）。

---

## 推荐路线：Render（免费、无需信用卡）

### 第 1 步 · 把代码推到 GitHub
本仓库已经在一个分支上提交好了改动（见底部"我留下的状态"）。把它推上去：

```bash
git push -u origin <你的分支或 main>
# 若还没有远程仓库：先在 GitHub 新建一个空仓库，再
# git remote add origin git@github.com:<你>/<仓库>.git && git push -u origin main
```

### 第 2 步 · 在 Render 用 Blueprint 一键创建
1. 登录 [dashboard.render.com](https://dashboard.render.com) →  **New** → **Blueprint**。
2. 连接刚才那个 GitHub 仓库。Render 会自动读取根目录的 [`render.yaml`](render.yaml)，识别出一个名为 `terrain` 的免费 Web 服务（用 [`Dockerfile`](Dockerfile) 构建）。
3. 点 **Apply**。

### 第 3 步 · 填 4 个 LLM 环境变量
Render 会提示这几个标了 `sync:false` 的变量需要你填（它们不在代码里、不会被提交）。把**本地 `.env` 里的同名值**粘进去：

```bash
# 在本地仓库执行，照抄输出里的值（注意别把 key 发给任何人）
grep -E '^LLM_' .env
```

| 变量 | 填什么 |
|---|---|
| `LLM_API_BASE_URL` | 例如 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `LLM_API_KEY` | 你的百炼 API Key |
| `LLM_MODEL_MAP` | 生成地图用的模型名（照抄本地 .env） |
| `LLM_MODEL_DETAIL` | 生成节点详情用的模型名（照抄本地 .env） |

`NODE_ENV=production` 和两个限流变量 `render.yaml` 里已经预设好了，可不动。

### 第 4 步 · 部署 & 拿链接
点部署，第一次构建约 3–5 分钟。完成后 Render 给你一个网址，形如：

```
https://terrain-xxxx.onrender.com
```

这就是你发给别人的链接。

### 第 5 步 · 添加到主屏（这就是"像 App"那一步）
- **iPhone / Safari**：打开链接 → 分享按钮 → "添加到主屏幕"。
- **安卓 / Chrome**：打开链接 → 右上菜单 → "安装应用 / 添加到主屏幕"（满足条件时还会自动弹安装提示）。

打开后是独立全屏窗口、有我们做的山顶小旗图标。

---

## 关于免费额度和"睡眠"，先知道这些

- **Render 免费服务会在闲置约 15 分钟后休眠**，下次有人访问要冷启动 ~30–60 秒（转一下圈才出来）。对"发给朋友看看"完全够用；要常驻不睡得升级或换平台。
- **省额度的两道保护已内置**：
  - **缓存**：同一个主题（或同一节点）只会真正调一次 LLM，之后直接返回缓存，**重复访问不烧额度**。
  - **限流**：默认每 IP 每分钟 20 次、全站每分钟 120 次，超了返回"有点挤，稍后再试"。可用 `RATE_LIMIT_PER_MIN` / `RATE_LIMIT_GLOBAL_PER_MIN` 调。
- 公开链接意味着**陌生人也会花你的额度**。额度快用完时，把限流调小，或先把链接只发给信得过的人。用多了真要钱时我们再聊持久方案。

---

## 本地先验证生产形态（可选，建议做一次）

```bash
npm run build:web                 # 打包前端到 dist/
SERVE_STATIC=1 PORT=4100 npm run preview:prod
# 打开 http://localhost:4100 —— 这就是线上同源单服务的样子
# （生成功能需要本地 .env 里有 LLM_* 配置）
```

---

## 换个平台也行（都能用同一个 Dockerfile）

| 平台 | 免费 | 是否要绑卡 | 备注 |
|---|---|---|---|
| **Render** | ✅ Web Service | ❌ 不用 | 本文主推；会休眠 |
| **Koyeb** | ✅ | ❌ 不用 | 也支持 Dockerfile，不易休眠 |
| **Fly.io** | ✅ 有免费额度 | ⚠️ 需绑卡（额度内不扣） | `fly launch` 读 Dockerfile |
| **Railway** | 试用额度 | ⚠️ 额度用完要付费 | 简单 |

任意平台只要"用 Dockerfile 构建 + 设置那 4 个 LLM_* 环境变量"即可。

---

## 环境变量总表

| 变量 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `LLM_API_BASE_URL` | ✅ | — | 百炼 OpenAI 兼容端点 |
| `LLM_API_KEY` | ✅ | — | 你的 API Key（只放在托管平台，别提交） |
| `LLM_MODEL_MAP` | ✅ | — | 生成地图的模型 |
| `LLM_MODEL_DETAIL` | ✅ | — | 生成节点详情的模型 |
| `NODE_ENV` | — | `production`（render.yaml 已设） | 设为 production 才会托管静态前端 |
| `PORT` | — | 平台注入 | 平台会自动给，无需手填 |
| `CORS_ORIGIN` | — | 同源无需 | 仅当前后端分开部署时才用，逗号分隔 |
| `RATE_LIMIT_PER_MIN` | — | `20` | 每 IP 每分钟上限 |
| `RATE_LIMIT_GLOBAL_PER_MIN` | — | `120` | 全站每分钟上限 |

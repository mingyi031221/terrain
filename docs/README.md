# Terrain Interactive Demo Planning Docs

这组文档面向第一版“本地可运行、实时交互”的 demo。

边界很明确：

- 要有真实的主题输入和实时生成。
- 要有前端界面可演示完整使用过程。
- 不做登录、账号、云同步、打包发布。
- 允许存在一个最薄的本地 server（服务端）代理层，只负责转发和校验 `LLM API`（大语言模型接口）调用。

## 文档索引

1. [00-demo-scope.md](./00-demo-scope.md)
   定义 demo 的目标、边界、展示方式和成功标准。

2. [01-repo-structure.md](./01-repo-structure.md)
   定义前端加本地代理的目录结构、模块边界和推荐技术栈。

3. [02-engineering-standards.md](./02-engineering-standards.md)
   规定数据结构、前后端边界、交互实现、提示词管理、测试与验收要求。

4. [03-roadmap.md](./03-roadmap.md)
   拆分交互 demo 的阶段目标、交付物和完成定义。

5. [04-backlog.md](./04-backlog.md)
   以可执行 todo 的形式列出任务列表、依赖关系、优先级和验收点。

6. [05-agent-handoff.md](./05-agent-handoff.md)
   约束后续 agent 的工作方式、提交粒度和推进顺序。

## 当前前提

- 当前仓库还没有业务代码，只有项目书 PDF。
- 第一版是本地运行的交互 demo，不是静态样机。
- 页面需要真实响应用户输入并生成地图与节点详情。
- 数据可保存在本地，生成能力通过本地代理层调用外部 `LLM API`。

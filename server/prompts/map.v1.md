# map.v1

## Purpose

为 ADHD 用户生成一张"先看见地图，再走进去"的学习地形图。
把"我想搞懂 X"转化为 5–8 个可点击的山头节点 + 它们之间的前置依赖。

## Inputs

- topic：用户的一句话学习愿望（例："我想搞懂 Docker"）

## Output

只输出一个 JSON 对象。不要 markdown 代码块标记、不要解释文字、不要尾随文本。

结构：

```json
{
  "topic": "对用户输入的简短复述，如「Docker」「回归分析」",
  "userPositionLabel": "用户当前所在位置的口语描述",
  "nodes": [
    {
      "id": "node-1",
      "title": "名词短语，不超过 12 字",
      "summary": "一句话说这个山头是关于什么的，不超过 30 字",
      "difficulty": 1,
      "estimatedMinutes": 30,
      "required": true
    }
  ],
  "edges": [{ "from": "node-1", "to": "node-2", "kind": "prerequisite" }]
}
```

## Constraints

- nodes 数量：5–8 个（含两端）。
- node.id：node-1、node-2 … 按数组顺序编号，不重复。
- node.difficulty：整数 1–5。1 = 一眼明白，5 = 需要反复消化。
- node.estimatedMinutes：整数，10–120 分钟之间。
- node.required：true 表示绕不开的主干；false 表示想深入再爬。
  主干（required=true）应在 3–5 个之间。
- edges：仅当 B 真的需要先理解 A 才能进入时，连一条 from:A, to:B。
  不要造环。不要自环。from/to 必须是已有 node.id。
- **连通性（重要）**：整张依赖图必须连成一片，不能有孤立的节点。
  - 每个节点都至少出现在一条边里（要么是某条边的 from，要么是 to）。
  - 从入门根节点出发，顺着边应当能间接走到所有其它节点（无向意义上连通）。
  - 通常只有一个根节点（没有任何前置、最基础的入门点）；其余节点都挂在它的下游。
  - 仍然是有向无环图（DAG）：不要为了连通而造环。
  - 对于"并列的几个方面"（常见于选购/对比/清单类主题，比如挑投影仪要看亮度、
    分辨率、投射比、生态…），不要把它们留成孤立节点——让每一个都从那个最基础的
    入门根节点引一条边过来（root → 该方面），这样它们既都连进了图、也表达了
    "先搞懂入门，再分头看这些方面"的建议顺序。
  - 自查：输出前数一遍，确认没有任何 node.id 是从未在 edges 里出现过的。
- topic、title、summary、userPositionLabel 用中文。
- 不要输出 version、generatedAt——服务端会补。

## Tone（核心）

这套地图是给 ADHD 用户看的。语言准则：

- 不说「你应该」、「你必须」、「先学好 X 再学 Y」。
- 说「想看 X，先扫一眼 Y 会顺一些」、「如果你只想直接钻进 X，可以先放着 Y」。
- summary 不要写成「学习目标」或「知识要点」。
  写成一句让人想点进去的描述：动机感 > 教材感。
- userPositionLabel 不是「完成度百分比」，是「你现在站在哪儿」。
  可以是「零基础」、「听过术语但没串起来」、「会用但想搞懂为什么」。
- 主干 vs 支线的语义：required=true 不是「必须爬」，
  是「绕过这个山，后面的路你会困惑」。

## Fallback

- 如果 topic 含混（"我想搞懂数学"、"AI"），自行收窄到一个具体子领域，
  在 userPositionLabel 里说明按哪个角度切。
- 如果 topic 不像学习问题（"今天的天气"），仍按 schema 输出 5–8 个 nodes，
  把这个主题拆成 5–8 个可学习角度。不要拒绝、不要返回空。

## Example output

**注意：以下示例仅用于演示语气与 JSON 结构。你必须根据当前用户的 topic 重新生成内容，
绝不可照抄示例里的 topic / titles / summaries / edges。**

(示例 topic = "速冲咖啡入门"，这只是给你看格式，不是真实输入)

```json
{
  "topic": "速冲咖啡入门",
  "userPositionLabel": "用过挂耳，想自己冲一杯不难喝的",
  "nodes": [
    {
      "id": "node-1",
      "title": "什么是萃取",
      "summary": "热水从咖啡粉里把味道拽出来的过程——拽得太轻没味，拽过头会苦",
      "difficulty": 1,
      "estimatedMinutes": 15,
      "required": true
    },
    {
      "id": "node-2",
      "title": "三个最大的变量",
      "summary": "水温、研磨度、粉水比——这三个一起决定你这一杯的命运",
      "difficulty": 2,
      "estimatedMinutes": 20,
      "required": true
    },
    {
      "id": "node-3",
      "title": "怎么选豆和磨豆机",
      "summary": "新鲜烘焙的豆 + 一个能磨均匀的磨——比换器具重要十倍",
      "difficulty": 2,
      "estimatedMinutes": 25,
      "required": true
    },
    {
      "id": "node-4",
      "title": "冲煮的几步动作",
      "summary": "闷蒸 → 分段注水 → 控时——背后都在做同一件事：让萃取均匀",
      "difficulty": 3,
      "estimatedMinutes": 30,
      "required": true
    },
    {
      "id": "node-5",
      "title": "尝出来酸 / 苦 / 平的差别",
      "summary": "酸往往是萃取不足，苦多半是萃取过度——舌头比仪器更诚实",
      "difficulty": 3,
      "estimatedMinutes": 35,
      "required": false
    },
    {
      "id": "node-6",
      "title": "不同滤杯的影响",
      "summary": "V60、Kalita、Origami——形状决定水怎么流，进而影响最终味道",
      "difficulty": 3,
      "estimatedMinutes": 30,
      "required": false
    }
  ],
  "edges": [
    { "from": "node-1", "to": "node-2", "kind": "prerequisite" },
    { "from": "node-2", "to": "node-3", "kind": "prerequisite" },
    { "from": "node-2", "to": "node-4", "kind": "prerequisite" },
    { "from": "node-4", "to": "node-5", "kind": "prerequisite" },
    { "from": "node-4", "to": "node-6", "kind": "prerequisite" }
  ]
}
```

## Input

请基于下面的 topic 生成**全新**内容。绝不要使用示例里的 titles / summaries / edges。
即使下面的 topic 恰好和示例同主题，也要从头重写。

topic: {{topic}}

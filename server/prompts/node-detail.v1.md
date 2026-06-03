# node-detail.v1

## Purpose

地图上有一个山头节点，用户决定点进去看看。
为这个节点写出 ADHD 友好的「走进去」内容：

- 这是什么（不预设你已经懂）
- 为什么值得现在爬它（动机感，不是任务感）
- 一个能帮你「在脑子里挂一个钩子」的反思小语

## Inputs

- topic：用户原本的学习主题（例："Docker"）
- nodeTitle：地图上这个节点的标题（例："镜像和容器的区别"）
- nodeId：节点 id，必须原样回填

## Output

只输出一个 JSON 对象。不要 markdown 代码块标记、不要解释文字、不要尾随文本。

结构：

```json
{
  "nodeId": "请原样填入输入中的 nodeId",
  "title": "保留 nodeTitle 的语义；可以微调更口语化，不要换成完全不同的术语",
  "explanation": "这一段在讲什么的口语化解释。不少于 50 字，建议 80–180 字。",
  "whyThisMatters": "为什么现在花时间爬这个山头是值得的。一到三句话，给钩不给压力。",
  "reflectionPrompt": "一个让人能停下来挂钩的小问题。一句话，问号结尾。",
  "suggestedNextNodeIds": []
}
```

## Constraints

- explanation：≥ 50 字，建议 80–180 字，中文。
- whyThisMatters：1–3 句，中文。
- reflectionPrompt：单句，以「？」结尾，中文。
- nodeId：必须与输入完全一致（包括 `node-3` 这种前缀格式）。
- title：保留输入 nodeTitle 的核心语义，不要替换成完全不同的术语；可微调更口语化。
- suggestedNextNodeIds：本版本一律输出空数组 `[]`。不要凭空编造 id（外部没把完整地图给你）。
- 全部字段都是自然语言句子，不要用 markdown 符号、列表、子标题。

## Tone（核心）

这一段是给 ADHD 用户看的「走进山头」页面。语言准则：

- explanation：
  - 不要写成「知识点：xxx」「学习目标是…」。
  - 用「这一段在讲的是…」「你可以先这样理解…」这种轻引导口吻。
  - 避免「掌握」「应当」「必须」「重点是」「请回顾」。
  - 允许一个具体画面或小类比，但别硬塞——能让人想象出场景的写法优先于抽象定义。

- whyThisMatters（「为什么爬」）：
  - 不是「你需要掌握 X」，而是「跳过它，后面 Y 你会卡」或「弄清它之后，回头看 Z 会突然变简单」。
  - 给一个清楚的因果钩，不给空泛的「很重要」。
  - 不要带威胁感（「不学会就…」）；ADHD 用户对压力句很敏感，会直接关页面。

- reflectionPrompt（「反思小语」）：
  - 不是测验题（不要问「X 是什么？」这种考查式问题）。
  - 是引子：让人想停下来回忆自己已有经验中的某一刻。
  - 句式像「上次你 ___ 的时候，是不是其实就遇到过这个？」「如果让你用一句话向朋友解释 X，你会先说什么？」
  - 一句话即可。

## Fallback

- 如果 nodeTitle 含义不太明确，按 topic 的上下文做最合理解读，并在 explanation 第一句点明按哪个角度理解。
- 如果 nodeTitle 跨度过大，仍按 schema 输出，不要拒绝、不要返回空。

## Example output

**注意：以下示例仅用于演示语气与 JSON 结构。你必须根据当前输入的 topic / nodeTitle / nodeId 重新生成内容，绝不可照抄示例里的字段值。**

(示例输入：topic = "盲打入门"、nodeTitle = "为什么不能看键盘"、nodeId = "node-2"，这只是给你看格式，不是真实输入)

```json
{
  "nodeId": "node-2",
  "title": "为什么不能看键盘",
  "explanation": "这一段在讲的是：盲打的关键不是手快，而是手指有没有学会自己回家。一旦你的眼睛在键盘和屏幕之间反复跳，大脑就要花成本去对齐位置，速度永远封顶。先把眼睛锁在屏幕上，是给手指腾出独立工作的空间——刚开始会比看着键盘还慢，这很正常。",
  "whyThisMatters": "如果跳过这一步，你以后会一直在「打字时眼睛该看哪儿」上反复纠结，越练越累。先把这件事讲清楚，后面练指法时你会知道自己在练什么。",
  "reflectionPrompt": "回想上一次你打字打到一半要回头改的时候，你的眼睛是先扫了键盘还是屏幕？",
  "suggestedNextNodeIds": []
}
```

## Input

请基于下面的输入生成**全新**内容。绝不要使用示例里的 title / explanation / whyThisMatters / reflectionPrompt。
即使下面的 nodeTitle 恰好和示例相近，也要从头重写。

topic: {{topic}}
nodeTitle: {{nodeTitle}}
nodeId: {{nodeId}}

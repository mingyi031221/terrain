/* Build the Terrain defense deck with pptxgenjs, embedding the real watercolor
 * assets so the slides look like the product. Run: node scripts/build-deck.cjs */
const path = require('path');
const pptxgen = require('/tmp/pptxtest/node_modules/pptxgenjs');

const REPO = path.resolve(__dirname, '..');
const OUT = path.resolve(REPO, '..', 'Terrain答辩.pptx');
const A = (p) => path.join(REPO, p);

// — palette (from the app) —
const INK = '2D281D',
  INKSOFT = '6B6453',
  GOLD = 'B48A3A',
  GOLDDK = '4C3B15',
  BLUE = '3E6E92',
  GREEN = '4F7D5E',
  ROSE = 'B05A72',
  CARD = 'FFFFFF',
  LINE = 'E8DFC4';
const FONT = 'PingFang SC';

// — asset dims (w x h) for aspect-correct placement —
const DIM = {
  bg: [1920, 814],
  blue: [560, 498],
  green: [551, 560],
  pink: [552, 560],
  purple: [551, 560],
  yellow: [551, 560],
  walk: [560, 446],
  sleep: [560, 434],
  sit: [467, 560],
  play: [448, 560],
  signpost: [535, 560],
  tree: [443, 560],
  icon: [512, 512],
};
const IMG = {
  bg: A('src/assets/bg/landscape.jpg'),
  blue: A('src/assets/mountains/mountain_blue.png'),
  green: A('src/assets/mountains/mountain_green.png'),
  pink: A('src/assets/mountains/mountain_pink.png'),
  purple: A('src/assets/mountains/mountain_purple.png'),
  yellow: A('src/assets/mountains/mountain_yellow.png'),
  walk: A('src/assets/cats/cat_walk.png'),
  sleep: A('src/assets/cats/cat_sleep.png'),
  sit: A('src/assets/cats/cat_sit.png'),
  play: A('src/assets/cats/cat_play.png'),
  signpost: A('src/assets/props/signpost.png'),
  tree: A('src/assets/props/tree.png'),
  icon: A('public/icon-512.png'),
};
// image sized by height, aspect-correct
const byH = (k, h, x, y, extra = {}) => ({
  path: IMG[k],
  h,
  w: +((h * DIM[k][0]) / DIM[k][1]).toFixed(3),
  x,
  y,
  ...extra,
});
const byW = (k, w, x, y, extra = {}) => ({
  path: IMG[k],
  w,
  h: +((w * DIM[k][1]) / DIM[k][0]).toFixed(3),
  x,
  y,
  ...extra,
});
const shadow = () => ({ type: 'outer', color: '3C321E', blur: 7, offset: 3, angle: 135, opacity: 0.16 });

const pres = new pptxgen();
pres.defineLayout({ name: 'W', width: 10, height: 5.625 });
pres.layout = 'W';
pres.author = 'Terrain';
pres.title = 'Terrain · 学习地图 — 项目答辩';

const W = 10,
  H = 5.625;

function slideTitle(s, t) {
  s.addText(t, { x: 0.55, y: 0.32, w: 8.9, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: INK, margin: 0 });
}
function wordmark(s) {
  s.addText('Terrain · 学习地图', { x: 0.55, y: 5.24, w: 4, h: 0.3, fontFace: FONT, fontSize: 9, color: INKSOFT, margin: 0 });
}
function card(s, x, y, w, h, fill = CARD) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: LINE, width: 1 }, shadow: shadow() });
}
function numDot(s, n, x, y, color = GOLD) {
  s.addShape(pres.shapes.OVAL, { x, y, w: 0.5, h: 0.5, fill: { color } });
  s.addText(String(n), { x, y, w: 0.5, h: 0.5, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 18, bold: true, color: 'FFFFFF', margin: 0 });
}
function dot(s, x, y, color) {
  s.addShape(pres.shapes.OVAL, { x, y, w: 0.17, h: 0.17, fill: { color } });
}

/* ───────────── Slide 1 · 封面 ───────────── */
{
  const s = pres.addSlide();
  s.background = { path: IMG.bg };
  // soft card for legibility
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 1.35, w: 6.5, h: 2.95, rectRadius: 0.12, fill: { color: 'FFFDF6', transparency: 12 }, line: { color: 'FFFFFF', width: 1 }, shadow: shadow() });
  s.addText('Terrain', { x: 1.0, y: 1.55, w: 5.9, h: 0.95, fontFace: FONT, fontSize: 50, bold: true, color: GOLDDK, margin: 0 });
  s.addText('学习地图', { x: 1.02, y: 2.5, w: 5.9, h: 0.6, fontFace: FONT, fontSize: 26, bold: true, color: INK, margin: 0 });
  s.addText('先看见地图，再走进去。', { x: 1.02, y: 3.12, w: 5.9, h: 0.5, fontFace: FONT, fontSize: 16, italic: true, color: INKSOFT, margin: 0 });
  s.addText('项目答辩 ·〔你的名字 / 团队〕', { x: 1.02, y: 3.66, w: 5.9, h: 0.4, fontFace: FONT, fontSize: 13, color: INKSOFT, margin: 0 });
  s.addImage(byH('icon', 1.15, 8.2, 0.55, { rounding: true, shadow: shadow() }));
  s.addImage(byH('sit', 1.5, 7.35, 3.65));
}

/* ───────────── Slide 2 · 为什么做 ───────────── */
{
  const s = pres.addSlide();
  s.background = { color: 'FFFFFF' };
  slideTitle(s, '为什么做这个？');
  s.addText('学新东西，最难的常常不是学不会，而是——', { x: 0.6, y: 1.2, w: 5.6, h: 0.5, fontFace: FONT, fontSize: 16, color: INK, margin: 0 });
  const pains = [
    ['不知道从哪开始', '开头就被劝退，迟迟动不了第一步'],
    ['听过一堆术语', '却串不起来，不知道它们什么关系'],
    ['路径一关一关锁住', '没学完前面，后面是灰的、点都点不开'],
  ];
  let y = 1.95;
  pains.forEach(([h, d], i) => {
    numDot(s, i + 1, 0.62, y + 0.05, GOLD);
    s.addText([{ text: h + '   ', options: { bold: true, color: INK } }, { text: d, options: { color: INKSOFT } }], { x: 1.25, y, w: 4.95, h: 0.7, fontFace: FONT, fontSize: 14.5, valign: 'middle', margin: 0 });
    y += 0.92;
  });
  // dim, "locked" mountain on the right
  s.addImage(byH('purple', 2.5, 6.95, 1.7, { transparency: 42 }));
  s.addText('🔒 锁住', { x: 6.95, y: 1.45, w: 2.5, h: 0.4, align: 'center', fontFace: FONT, fontSize: 15, bold: true, color: ROSE, margin: 0 });
  s.addText('传统学习路径：没爬到就是灰的、进不去', { x: 6.5, y: 4.25, w: 3.0, h: 0.7, align: 'center', fontFace: FONT, fontSize: 12, italic: true, color: INKSOFT });
  wordmark(s);
}

/* ───────────── Slide 3 · 核心理念 ───────────── */
{
  const s = pres.addSlide();
  s.background = { color: 'FFFFFF' };
  s.addText([
    { text: '所有的山，一开始就都能点。', options: { bold: true, color: GOLDDK, breakLine: true } },
    { text: '我们不上锁，只用「样子」区分状态。', options: { bold: true, color: INK } },
  ], { x: 0.6, y: 0.55, w: 8.8, h: 1.2, fontFace: FONT, fontSize: 27, align: 'center', lineSpacingMultiple: 1.1, margin: 0 });

  const cols = [
    { k: 'green', cap: '已完成', sub: '正常颜色 + 山顶小旗', x: 1.05, flag: true, glow: false, dim: false },
    { k: 'blue', cap: '当前', sub: '轻微发光 + 星星', x: 4.1, flag: false, glow: true, dim: false },
    { k: 'yellow', cap: '还没爬', sub: '灰扑扑半透明 · 仍可点', x: 7.05, flag: false, glow: false, dim: true },
  ];
  cols.forEach((c) => {
    const mw = 1.9;
    const cx = c.x;
    if (c.glow) s.addShape(pres.shapes.OVAL, { x: cx - 0.25, y: 2.35, w: mw + 0.5, h: mw + 0.5, fill: { color: 'F0C95A', transparency: 55 }, line: { type: 'none' } });
    s.addImage(byW(c.k, mw, cx, 2.4, c.dim ? { transparency: 45 } : {}));
    if (c.flag) s.addText('🚩', { x: cx + mw / 2 - 0.1, y: 2.15, w: 0.6, h: 0.5, fontSize: 20, margin: 0 });
    if (c.glow) s.addText('✦', { x: cx + mw - 0.1, y: 2.3, w: 0.5, h: 0.4, fontSize: 16, color: 'D9A441', margin: 0 });
    const mh = (mw * DIM[c.k][1]) / DIM[c.k][0];
    s.addText([
      { text: c.cap + '\n', options: { bold: true, fontSize: 17, color: INK } },
      { text: c.sub, options: { fontSize: 12, color: INKSOFT } },
    ], { x: cx - 0.45, y: 2.45 + mh + 0.15, w: mw + 0.9, h: 0.85, align: 'center', fontFace: FONT, lineSpacingMultiple: 1.05, margin: 0 });
  });
  wordmark(s);
}

/* ───────────── Slide 4 · 怎么用 ───────────── */
{
  const s = pres.addSlide();
  s.background = { color: 'FFFFFF' };
  slideTitle(s, '它怎么用');
  const steps = [
    ['输入一个主题', '一句「我想搞懂 X」就够，不用想结构'],
    ['大模型拆成地图', '5–8 个知识点 = 山头，按先后依赖连成图'],
    ['点任意山，走进去', '是什么 · 为什么爬 · 一句留给你的钩子'],
  ];
  const xs = [0.55, 3.5, 6.45],
    cw = 2.78;
  steps.forEach(([h, d], i) => {
    const x = xs[i];
    card(s, x, 1.55, cw, 2.95);
    numDot(s, i + 1, x + 0.32, 1.85, GOLD);
    s.addText(h, { x: x + 0.95, y: 1.9, w: cw - 1.1, h: 0.5, fontFace: FONT, fontSize: 17, bold: true, color: INK, valign: 'middle', margin: 0 });
    s.addText(d, { x: x + 0.3, y: 2.5, w: cw - 0.6, h: 1.15, fontFace: FONT, fontSize: 13.5, color: INKSOFT, valign: 'top', lineSpacingMultiple: 1.15, margin: 0 });
  });
  s.addText('→', { x: 3.28, y: 2.7, w: 0.35, h: 0.6, align: 'center', fontSize: 26, bold: true, color: GOLD, margin: 0 });
  s.addText('→', { x: 6.23, y: 2.7, w: 0.35, h: 0.6, align: 'center', fontSize: 26, bold: true, color: GOLD, margin: 0 });
  // small mountain motif near the bottom of each card (kept clear of the text)
  s.addImage(byH('blue', 0.6, 1.6, 3.85));
  s.addImage(byH('green', 0.6, 4.6, 3.85));
  s.addImage(byH('pink', 0.6, 7.55, 3.85));
  wordmark(s);
}

/* ───────────── Slide 5 · 演示（mock 世界地图）───────────── */
{
  const s = pres.addSlide();
  s.background = { color: 'FFFFFF' };
  slideTitle(s, '现场演示 · 世界地图');
  // map frame (landscape, aspect 2.359)
  const mx = 0.55,
    my = 1.2,
    mw = 6.6,
    mh = +(mw / (DIM.bg[0] / DIM.bg[1])).toFixed(3); // ≈2.8
  s.addImage({ path: IMG.bg, x: mx, y: my, w: mw, h: mh });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mx - 0.04, y: my - 0.04, w: mw + 0.08, h: mh + 0.08, rectRadius: 0.06, fill: { type: 'none' }, line: { color: GOLD, width: 1.5 } });

  // dashed trails
  const dash = (x1, y1, x2, y2) => {
    const x = Math.min(x1, x2),
      y = Math.min(y1, y2),
      w = Math.abs(x2 - x1),
      h = Math.abs(y2 - y1);
    const down = (x2 >= x1) === (y2 >= y1);
    s.addShape(pres.shapes.LINE, { x, y, w, h, line: { color: 'C2A35A', width: 2, dashType: 'dash' }, flipV: !down });
  };
  dash(1.95, 3.35, 3.7, 2.55);
  dash(4.35, 2.6, 5.55, 3.25);

  s.addImage(byH('green', 1.0, 1.25, 2.75));
  s.addText('🚩', { x: 1.6, y: 2.5, w: 0.4, h: 0.35, fontSize: 13, margin: 0 });
  s.addImage(byH('blue', 1.2, 3.15, 1.95)); // current
  s.addImage(byH('walk', 0.62, 3.55, 1.55)); // cat = you are here
  s.addImage(byH('purple', 1.0, 5.05, 2.75, { transparency: 42 })); // todo
  s.addImage(byH('sleep', 0.55, 5.25, 2.5)); // sleeping cat

  // callouts
  const calls = [
    ['山错落散布，像游戏地图', GOLD],
    ['虚线小路 = 先后顺序', 'C2A35A'],
    ['走路的猫 = 你在这里', BLUE],
    ['睡觉的猫 = 还没去的山', INKSOFT],
    ['点哪座，猫走过去再开面板', GREEN],
  ];
  let cy = 1.35;
  calls.forEach(([t, c]) => {
    dot(s, 7.45, cy + 0.06, c);
    s.addText(t, { x: 7.72, y: cy, w: 2.05, h: 0.6, fontFace: FONT, fontSize: 13, color: INK, valign: 'top', lineSpacingMultiple: 1.0, margin: 0 });
    cy += 0.72;
  });
  wordmark(s);
}

/* ───────────── Slide 6 · 技术特点 ───────────── */
{
  const s = pres.addSlide();
  s.background = { color: 'FFFFFF' };
  slideTitle(s, '技术特点');
  const boxes = [
    ['前端', 'React + TypeScript', BLUE],
    ['后端', 'Fastify + Zod', GREEN],
    ['大模型', '阿里云百炼', GOLD],
  ];
  const bx = [0.55, 3.62, 6.7],
    bw = 2.75;
  boxes.forEach(([h, d], i) => {
    card(s, bx[i], 1.5, bw, 1.1);
    s.addText([
      { text: h + '\n', options: { fontSize: 12, color: INKSOFT } },
      { text: d, options: { fontSize: 16, bold: true, color: INK } },
    ], { x: bx[i] + 0.15, y: 1.5, w: bw - 0.3, h: 1.1, align: 'center', valign: 'middle', fontFace: FONT, lineSpacingMultiple: 1.1, margin: 0 });
  });
  s.addText('→', { x: 3.3, y: 1.75, w: 0.32, h: 0.6, align: 'center', fontSize: 24, bold: true, color: GOLD, margin: 0 });
  s.addText('→', { x: 6.38, y: 1.75, w: 0.32, h: 0.6, align: 'center', fontSize: 24, bold: true, color: GOLD, margin: 0 });

  const badges = [
    'Zod 结构化校验 + 失败重试，保证输出可用',
    '单服务同源 · Docker / Render 一键部署',
    'PWA · 手机可「添加到主屏」',
    '缓存 + 限流 · 同主题只生成一次，省额度',
  ];
  const px = [0.55, 5.15],
    py = [3.1, 4.22],
    pw = 4.3;
  badges.forEach((t, i) => {
    const x = px[i % 2],
      y = py[Math.floor(i / 2)];
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: pw, h: 0.95, rectRadius: 0.1, fill: { color: 'FAF4E4' }, line: { color: 'E6D6A8', width: 1 } });
    s.addText('✦', { x: x + 0.18, y, w: 0.4, h: 0.95, align: 'center', valign: 'middle', fontSize: 15, color: GOLD, margin: 0 });
    s.addText(t, { x: x + 0.62, y, w: pw - 0.8, h: 0.95, valign: 'middle', fontFace: FONT, fontSize: 13.5, color: INK, lineSpacingMultiple: 1.05, margin: 0 });
  });
  wordmark(s);
}

/* ───────────── Slide 7 · 开发难点 ───────────── */
{
  const s = pres.addSlide();
  s.background = { color: 'FFFFFF' };
  slideTitle(s, '开发难点');
  // card A
  card(s, 0.55, 1.5, 4.3, 3.4);
  s.addText('① 素材是「假透明」贴纸表', { x: 0.8, y: 1.7, w: 3.8, h: 0.5, fontFace: FONT, fontSize: 16.5, bold: true, color: BLUE, margin: 0 });
  s.addText('AI 给的猫是一整张图，背景其实是灰色棋盘格（假透明）。手头没有现成图像库——于是用纯 Node 手写了 PNG 解码 + 连通块切分，自动识别背景、把每只猫抠成单独的透明图。', { x: 0.8, y: 2.25, w: 3.8, h: 1.7, fontFace: FONT, fontSize: 13.5, color: INKSOFT, valign: 'top', lineSpacingMultiple: 1.2, margin: 0 });
  s.addImage(byH('play', 0.85, 1.0, 3.95));
  s.addImage(byH('sit', 0.85, 1.95, 3.95));
  s.addImage(byH('sleep', 0.7, 3.0, 4.05));
  // card B
  card(s, 5.15, 1.5, 4.3, 3.4);
  s.addText('② 走路的猫要「走到了再开面板」', { x: 5.4, y: 1.7, w: 3.8, h: 0.5, fontFace: FONT, fontSize: 16.5, bold: true, color: GREEN, margin: 0 });
  s.addText('既要动画顺、又不能因为动画卡顿就打不开面板。做法：让动画只负责画面，用定时器稳稳地负责「收尾打开」；并为偏好减少动态的用户做了降级。', { x: 5.4, y: 2.25, w: 3.8, h: 1.6, fontFace: FONT, fontSize: 13.5, color: INKSOFT, valign: 'top', lineSpacingMultiple: 1.2, margin: 0 });
  s.addImage(byH('walk', 0.95, 8.05, 3.85));
  wordmark(s);
}

/* ───────────── Slide 8 · 做到什么程度 ───────────── */
{
  const s = pres.addSlide();
  s.background = { color: 'FFFFFF' };
  slideTitle(s, '做到了什么程度');
  const stats = [
    ['146', '测试全部通过'],
    ['1', '个服务同源部署'],
    ['PWA', '可加到手机主屏'],
    ['免费', '托管即可上线'],
  ];
  const sx = [0.55, 2.85, 5.15, 7.45],
    sw = 2.2;
  stats.forEach(([n, l], i) => {
    s.addText(n, { x: sx[i], y: 1.45, w: sw, h: 1.0, align: 'center', fontFace: FONT, fontSize: n.length > 2 ? 38 : 50, bold: true, color: GOLD, margin: 0 });
    s.addText(l, { x: sx[i], y: 2.5, w: sw, h: 0.5, align: 'center', fontFace: FONT, fontSize: 13.5, color: INK, margin: 0 });
  });
  s.addText('typecheck + ESLint 全绿 · 进度本地保存、刷新仍在 · 已写好部署文档 DEPLOY.md', { x: 0.6, y: 3.25, w: 8.8, h: 0.5, align: 'center', fontFace: FONT, fontSize: 13, italic: true, color: INKSOFT, margin: 0 });
  s.addText('一个主题 → 拆成 5–8 座山', { x: 0.6, y: 3.95, w: 8.8, h: 0.4, align: 'center', fontFace: FONT, fontSize: 12, color: INKSOFT, margin: 0 });
  const ms = ['blue', 'green', 'pink', 'yellow', 'purple'];
  const startX = 2.0,
    step = 1.22;
  ms.forEach((k, i) => s.addImage(byH(k, 0.8, startX + i * step, 4.45)));
  wordmark(s);
}

/* ───────────── Slide 9 · 收尾 ───────────── */
{
  const s = pres.addSlide();
  s.background = { path: IMG.bg };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: '241E12', transparency: 32 } });
  s.addText([
    { text: '先把焦虑放下——\n', options: { color: 'FFFFFF', bold: true } },
    { text: '先看见地图，再走进去。', options: { color: 'FCEFC9', bold: true } },
  ], { x: 0.8, y: 1.7, w: 8.4, h: 1.7, align: 'center', fontFace: FONT, fontSize: 33, lineSpacingMultiple: 1.15, margin: 0 });
  s.addText('谢谢各位老师 🙌', { x: 0.8, y: 3.55, w: 8.4, h: 0.6, align: 'center', fontFace: FONT, fontSize: 18, color: 'FFFFFF', margin: 0 });
  s.addImage(byH('walk', 1.1, 4.45, 4.2));
}

pres.writeFile({ fileName: OUT }).then((f) => console.log('wrote', f));

const SVG_NS = "http://www.w3.org/2000/svg";
const gallery = document.querySelector("#gallery");
const viewerModal = document.querySelector("#viewer-modal");
const viewerBackdrop = document.querySelector("#viewer-backdrop");
const viewer = document.querySelector("#viewer");
const viewerGroup = document.querySelector("#viewer-group");
const viewerPath = document.querySelector("#viewer-path");
const viewerTitle = document.querySelector("#viewer-title");
const viewerTag = document.querySelector("#viewer-tag");
const viewerDesc = document.querySelector("#viewer-desc");
const viewerCode = document.querySelector("#viewer-code");
const viewerTrading = document.querySelector("#viewer-trading");
const viewerChecklist = document.querySelector("#viewer-checklist");
const viewerNotes = document.querySelector("#viewer-notes");
const viewerClose = document.querySelector("#viewer-close");
const langEnButton = document.querySelector("#lang-en");
const langZhButton = document.querySelector("#lang-zh");
const heroEyebrow = document.querySelector("#hero-eyebrow");
const heroTitle = document.querySelector("#hero-title");
const viewerTradingLabel = document.querySelector("#viewer-trading-label");
const viewerChecklistLabel = document.querySelector("#viewer-checklist-label");
const viewerNotesLabel = document.querySelector("#viewer-notes-label");
const viewerCodeLabel = document.querySelector("#viewer-code-label");
let openAnimationFrame = 0;
let currentLanguage = "en";

const UI_TEXT = {
  en: {
    heroEyebrow: "Peter Brandt Chart Patterns",
    heroTitle: "A Gallery of Classic Chart Pattern Animations",
    galleryLabel: "Chart pattern animation gallery",
    tradingPoints: "Trading Points",
    checklist: "Checklist",
    notes: "Brandt's Notes",
    code: "Wisdom",
    close: "Close",
    ariaOpen: "Open enlarged preview for",
  },
  zh: {
    heroEyebrow: "彼得·布兰特 经典K线形态",
    heroTitle: "经典K线形态动画图鉴",
    galleryLabel: "K线形态动画画廊",
    tradingPoints: "交易要点",
    checklist: "识别清单",
    notes: "布兰特笔记",
    code: "交易智慧",
    close: "关闭",
    ariaOpen: "查看放大预览：",
  },
};

const TRADING_POINT_LABELS = {
  direction: { en: "Direction", zh: "方向" },
  entry: { en: "Entry", zh: "入场" },
  stop: { en: "Stop Loss", zh: "止损" },
  target: { en: "Target", zh: "目标" },
  volume: { en: "Volume", zh: "量能" },
  reliability: { en: "Reliability", zh: "可靠度" },
};

const RISK_RULES_HEADING = {
  en: "Stop & Target Rules",
  zh: "止损止盈要点",
};

const BRANDT_RISK_RULES = [
  {
    en: "Place stop just beyond the pattern's invalidation point (never inside the structure).",
    zh: "止损放在形态失效点之外（永不放入形态内部）。",
  },
  {
    en: "Risk only 0.5–1% of account equity per trade (Brandt's core risk rule).",
    zh: "单笔风险控制在账户权益的0.5-1%（布兰特核心风控法则）。",
  },
  {
    en: "Target = classical measured move (pattern height projected from breakout).",
    zh: "止盈目标 = 经典测量目标（突破点向外投影形态高度）。",
  },
  {
    en: "Take 50% profit at first measured target, trail the remainder with pattern-based stops.",
    zh: "第一目标处出50%仓位，剩余部分以形态止损线跟踪。",
  },
  {
    en: "Minimum R:R of 3:1; skip any setup that doesn't meet this threshold.",
    zh: "最小盈亏比3:1，未达标的形态一律放弃。",
  },
  {
    en: "Only tighten stops toward breakeven; never widen a stop against the trade.",
    zh: "止损只向保本方向收紧，绝不逆势外扩。",
  },
];

// Helper: parse polyline string "x1,y1 x2,y2 ..." into normalized points (500x300 -> 0-100 viewBox)
function parsePolyline(polylineStr, padX = 5, padY = 10) {
  const pairs = polylineStr.trim().split(/\s+/).map(pair => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  });
  const xRange = 100 - 2 * padX;
  const yRange = 100 - 2 * padY;
  return pairs.map(p => ({
    x: padX + (p.x / 500) * xRange,
    y: padY + (p.y / 300) * yRange,
  }));
}

// Shared point function for all K-line chart patterns
function klinePoint(progress, detailScale, config) {
  const pts = config.points;
  const totalSegments = pts.length - 1;
  const pos = progress * totalSegments;
  const idx = Math.min(Math.floor(pos), totalSegments - 1);
  const frac = pos - idx;
  const x = pts[idx].x + (pts[idx + 1].x - pts[idx].x) * frac;
  const baseY = pts[idx].y + (pts[idx + 1].y - pts[idx].y) * frac;
  const breathScale = 0.95 + detailScale * 0.1;
  const y = 50 + (baseY - 50) * breathScale * config.curveScale;
  const xScaled = 50 + (x - 50) * config.curveScale;
  return { x: xScaled, y };
}

const curves = [
  {
    name: "Head & Shoulders Top",
    nameZh: "头肩顶",
    tag: "Reversal",
    tagZh: "反转",
    descriptionEn: "A classic bearish reversal: the left shoulder, head, and right shoulder form three peaks with the head being the highest. A break below the neckline confirms the pattern.",
    descriptionZh: "经典看跌反转形态：左肩、头部、右肩形成三个峰值，头部最高。跌破颈线确认形态成立。",
    curveScale: 1.0,
    tradingPoints: {
      direction: { en: "Bearish", zh: "看跌", kind: "bear" },
      entry: { en: "Short on close below the neckline", zh: "收盘价跌破颈线后做空" },
      stop: { en: "Above the right shoulder high", zh: "右肩高点上方" },
      target: { en: "Head-to-neckline distance projected downward", zh: "头部到颈线距离向下投影" },
      volume: { en: "Declines through the head, surges on neckline break", zh: "头部后量能递减，突破颈线放量" },
      reliability: "★★★★★",
    },
    checklist: [
      { en: "Clear uptrend lasting 4+ months prior", zh: "前期存在4个月以上明确上升趋势" },
      { en: "Right shoulder peak lower than the head", zh: "右肩高点低于头部" },
      { en: "Volume contracts from head to right shoulder", zh: "头部到右肩量能持续萎缩" },
      { en: "Decisive daily close below the neckline", zh: "日线收盘决定性跌破颈线" },
      { en: "Neckline retest (optional) rejects the level", zh: "颈线回抽（可选）受阻即确认" },
    ],
    brandtNotes: [
      { en: "Highest-probability reversal pattern—Brandt's go-to top structure.", zh: "最高胜率的反转形态——布兰特的首选顶部结构。" },
      { en: "Wait for neckline close, not just an intraday wick.", zh: "等待颈线收盘确认，不要凭盘中插针进场。" },
      { en: "Failed H&S tops often signal explosive trend continuation.", zh: "失败的头肩顶往往预示原趋势加速延续。" },
    ],
    rotate: false,
    particleCount: 60,
    trailSpan: 0.35,
    durationMs: 4000,
    rotationDurationMs: 30000,
    pulseDurationMs: 4500,
    strokeWidth: 4,
    points: parsePolyline("30,220 70,180 110,120 130,160 180,70 230,160 260,160 300,110 340,170 380,200 440,245"),
    quotes: [
      { en: "The most important thing I can teach is the discipline to wait for a pattern to complete. — Peter Brandt", zh: "我能教的最重要的事，就是等待形态完成的纪律。 — 彼得·布兰特" },
      { en: "The market is never wrong — opinions often are. — Jesse Livermore", zh: "市场永远不会错——错的是人的看法。 — 杰西·利弗莫尔" },
      { en: "The tape tells its own story, and that story is always right. — Richard Wyckoff", zh: "盘面自己会说话，而它说的永远是对的。 — 理查德·威科夫" },
      { en: "Win or lose, everybody gets what they want out of the market. — Ed Seykota", zh: "无论输赢，每个人都从市场中得到了自己想要的东西。 — 艾德·斯科塔" },
      { en: "Trading is a probability game, not a certainty game. — Mark Douglas", zh: "交易是概率游戏，不是确定性游戏。 — 马克·道格拉斯" },
    ],
    point: klinePoint,
  },
  {
    name: "Inverse Head & Shoulders",
    nameZh: "头肩底",
    tag: "Reversal",
    tagZh: "反转",
    descriptionEn: "A bullish reversal mirror of Head & Shoulders: three troughs with the deepest in the middle. A breakout above the neckline signals a trend change.",
    descriptionZh: "头肩顶的镜像看涨反转形态：三个谷底，中间最深。突破颈线信号趋势转变。",
    curveScale: 1.0,
    tradingPoints: {
      direction: { en: "Bullish", zh: "看涨", kind: "bull" },
      entry: { en: "Long on close above the neckline", zh: "收盘价突破颈线后做多" },
      stop: { en: "Below the right shoulder low", zh: "右肩低点下方" },
      target: { en: "Head-to-neckline distance projected upward", zh: "头部到颈线距离向上投影" },
      volume: { en: "Requires explosive volume on neckline breakout", zh: "突破颈线必须伴随爆量" },
      reliability: "★★★★☆",
    },
    checklist: [
      { en: "Prior downtrend of 3+ months", zh: "前期存在3个月以上下降趋势" },
      { en: "Right shoulder trough higher than the head", zh: "右肩低点高于头部" },
      { en: "Volume expansion on the breakout above neckline", zh: "突破颈线时量能放大" },
      { en: "Daily close above the neckline", zh: "日线收盘突破颈线" },
      { en: "Neckline retest often offers a better entry", zh: "回抽颈线常提供更佳入场点" },
    ],
    brandtNotes: [
      { en: "Bottoms build slowly, tops form quickly—be patient here.", zh: "底部缓慢构筑，顶部快速形成——此处需耐心。" },
      { en: "Best combined with a prior decline of 20%+.", zh: "最佳配合是前期下跌20%以上。" },
      { en: "Needs heavier volume confirmation than a top.", zh: "比顶部形态需要更强的量能确认。" },
    ],
    rotate: false,
    particleCount: 60,
    trailSpan: 0.35,
    durationMs: 4000,
    rotationDurationMs: 30000,
    pulseDurationMs: 4500,
    strokeWidth: 4,
    points: parsePolyline("30,60 70,100 110,160 130,120 180,215 230,120 260,120 300,175 340,110 380,80 440,40"),
    quotes: [
      { en: "In 40 years of trading, the lesson that screams the loudest is the importance of risk management. — Peter Brandt", zh: "40年交易生涯中，最响亮的教训就是风险管理的重要性。 — 彼得·布兰特" },
      { en: "It was never my thinking that made the big money. It was the sitting. — Jesse Livermore", zh: "给我赚大钱的从来不是我的判断，而是我的坐功。 — 杰西·利弗莫尔" },
      { en: "The elements of good trading are: cutting losses, cutting losses, and cutting losses. — Ed Seykota", zh: "好交易的要素就是：止损、止损、还是止损。 — 艾德·斯科塔" },
      { en: "The whole secret to winning in the stock market is to lose the least amount possible when you're not right. — William O'Neil", zh: "股市获胜的全部秘密是：在你犯错时尽可能少亏。 — 威廉·欧奈尔" },
      { en: "The best traders have evolved to the point where they believe that anything can happen. — Mark Douglas", zh: "最优秀的交易者已进化到相信任何事都可能发生的境界。 — 马克·道格拉斯" },
    ],
    point: klinePoint,
  },
  {
    name: "Rectangle",
    nameZh: "矩形",
    tag: "Continuation",
    tagZh: "延续",
    descriptionEn: "Price oscillates between horizontal support and resistance, forming a rectangle. A breakout in either direction resolves the consolidation.",
    descriptionZh: "价格在水平支撑和阻力之间震荡，形成矩形整理。向任一方向突破结束盘整。",
    curveScale: 1.0,
    tradingPoints: {
      direction: { en: "Follows prior trend", zh: "顺原趋势", kind: "neutral" },
      entry: { en: "Trade the close beyond either horizontal boundary", zh: "收盘突破任一水平边界后入场" },
      stop: { en: "Opposite boundary of the rectangle", zh: "矩形对侧边界" },
      target: { en: "Rectangle height projected from breakout point", zh: "矩形高度从突破点投影" },
      volume: { en: "Contracts inside the range, expands on breakout", zh: "区间内量能收缩，突破放量" },
      reliability: "★★★☆☆",
    },
    checklist: [
      { en: "At least 4 boundary touches (2 tops + 2 bottoms)", zh: "至少4次触碰边界（2顶2底）" },
      { en: "Consolidation duration ≥ 4 weeks", zh: "盘整持续4周以上" },
      { en: "Parallel horizontal boundaries", zh: "上下边界水平平行" },
      { en: "Volume dries up while inside the range", zh: "区间内量能持续萎缩" },
      { en: "Decisive close beyond the boundary", zh: "收盘强势突破边界" },
    ],
    brandtNotes: [
      { en: "Direction is uncertain—always trade the breakout, never anticipate.", zh: "方向不确定——永远交易突破，不要预测。" },
      { en: "Failed rectangles often produce violent opposite moves.", zh: "失败的矩形常引发反向剧烈走势。" },
      { en: "One of Brandt's favorite continuation structures.", zh: "布兰特最青睐的延续形态之一。" },
    ],
    rotate: false,
    particleCount: 65,
    trailSpan: 0.38,
    durationMs: 4200,
    rotationDurationMs: 30000,
    pulseDurationMs: 4800,
    strokeWidth: 4,
    points: parsePolyline("30,230 60,200 90,100 120,195 150,105 180,190 210,105 240,195 270,110 300,195 330,110 360,195 390,75 440,50"),
    quotes: [
      { en: "A chart pattern is just a picture of a battle between buyers and sellers. — Peter Brandt", zh: "图表形态只是买方和卖方战斗的画面。 — 彼得·布兰特" },
      { en: "I keep my losses small and let my profits run. — Nicolas Darvas", zh: "我保持小亏损，让利润奔跑。 — 尼古拉斯·达瓦斯" },
      { en: "I always say you could publish trading rules in the newspaper and no one would follow them. — Richard Dennis", zh: "我总说你把交易规则登在报纸上也没人会遵守。 — 理查德·丹尼斯" },
      { en: "Good trading is about process, not prediction. — Linda Raschke", zh: "好的交易关乎过程，而非预测。 — 琳达·拉施克" },
      { en: "It's not whether you're right or wrong, it's how much money you make when you're right. — Stanley Druckenmiller", zh: "重要的不是你对错，而是你对的时候赚多少。 — 斯坦利·德鲁肯米勒" },
    ],
    point: klinePoint,
  },
  {
    name: "Symmetrical Triangle",
    nameZh: "对称三角形",
    tag: "Continuation",
    tagZh: "延续",
    descriptionEn: "Converging trendlines form a symmetrical triangle as highs get lower and lows get higher. The breakout direction decides the next move.",
    descriptionZh: "收敛的趋势线形成对称三角形，高点递降、低点递升。突破方向决定下一步走势。",
    curveScale: 1.0,
    tradingPoints: {
      direction: { en: "Follows prior trend", zh: "顺原趋势", kind: "neutral" },
      entry: { en: "Close beyond either converging trendline", zh: "收盘突破任一收敛趋势线" },
      stop: { en: "Inside the triangle, near opposite trendline", zh: "三角形内部，靠对侧趋势线" },
      target: { en: "Triangle base width projected from breakout", zh: "三角形底宽从突破点投影" },
      volume: { en: "Converges with price, expands on breakout", zh: "量价同步收敛，突破放量" },
      reliability: "★★★☆☆",
    },
    checklist: [
      { en: "Lower highs and higher lows forming convergence", zh: "高点递降、低点递升形成收敛" },
      { en: "At least 2 touches on each trendline", zh: "每条趋势线至少2次触碰" },
      { en: "Breakout occurs at 60–75% of triangle length", zh: "在三角形60-75%处发生突破" },
      { en: "Volume dries up near the apex", zh: "接近顶点时量能明显萎缩" },
      { en: "Post-breakout volume surge confirms direction", zh: "突破后量能激增确认方向" },
    ],
    brandtNotes: [
      { en: "~60% continuation rate—bias toward prior trend direction.", zh: "约60%延续概率——偏向原趋势方向。" },
      { en: "False breakouts near apex are common; avoid late breaks.", zh: "接近顶点的假突破频繁——远离末端突破。" },
      { en: "Apex often becomes future support or resistance.", zh: "三角形顶点常成为后续支撑或阻力。" },
    ],
    rotate: false,
    particleCount: 60,
    trailSpan: 0.36,
    durationMs: 4000,
    rotationDurationMs: 30000,
    pulseDurationMs: 4500,
    strokeWidth: 4,
    points: parsePolyline("30,210 60,170 90,60 130,220 170,90 210,205 250,115 290,190 330,140 360,178 395,155 440,55"),
    quotes: [
      { en: "I look for a pattern, I check the risk, and if the risk is small, I take the trade. — Peter Brandt", zh: "我寻找形态，检查风险，如果风险小，我就交易。 — 彼得·布兰特" },
      { en: "The goal of a successful trader is to make the best trades. Money is secondary. — Alexander Elder", zh: "成功交易者的目标是做最好的交易。赚钱是次要的。 — 亚历山大·埃尔德" },
      { en: "It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong. — George Soros", zh: "重要的不是对错，而是对的时候赚多少、错的时候亏多少。 — 乔治·索罗斯" },
      { en: "The trend is your friend until the end when it bends. — Ed Seykota", zh: "趋势是你的朋友，直到它拐弯的那一刻。 — 艾德·斯科塔" },
      { en: "Money management is the true cornerstone of speculative profits. — Larry Williams", zh: "资金管理是投机盈利的真正基石。 — 拉里·威廉姆斯" },
    ],
    point: klinePoint,
  },
  {
    name: "Ascending Triangle",
    nameZh: "上升三角形",
    tag: "Continuation",
    tagZh: "延续",
    descriptionEn: "A flat resistance line meets rising support, compressing price into higher lows. Typically breaks upward with momentum.",
    descriptionZh: "水平阻力线与上升支撑线汇合，价格被压缩为更高的低点。通常向上突破并带有动能。",
    curveScale: 1.0,
    tradingPoints: {
      direction: { en: "Bullish", zh: "看涨", kind: "bull" },
      entry: { en: "Close above the flat horizontal resistance", zh: "收盘突破水平阻力线" },
      stop: { en: "Below the rising support trendline", zh: "上升支撑线下方" },
      target: { en: "Triangle height projected upward from breakout", zh: "三角形高度从突破点向上投影" },
      volume: { en: "Shrinks during formation, surges on breakout", zh: "形成中萎缩，突破时激增" },
      reliability: "★★★★☆",
    },
    checklist: [
      { en: "Flat resistance touched at least 2 times", zh: "水平阻力至少2次触碰" },
      { en: "Rising support trendline with higher lows", zh: "上升支撑线构成递增低点" },
      { en: "Volume contracts toward the apex", zh: "接近顶点时量能萎缩" },
      { en: "Decisive close above horizontal resistance", zh: "决定性收盘突破水平阻力" },
      { en: "Retest of resistance (now support) holds", zh: "回测阻力（已转支撑）获得守稳" },
    ],
    brandtNotes: [
      { en: "Among the most reliable continuation patterns in bull markets.", zh: "牛市中最可靠的延续形态之一。" },
      { en: "The flatter the resistance, the more powerful the breakout.", zh: "阻力越平，突破越有力。" },
      { en: "~75% success rate when prior trend is bullish.", zh: "前期趋势看涨时约75%成功率。" },
    ],
    rotate: false,
    particleCount: 58,
    trailSpan: 0.34,
    durationMs: 3800,
    rotationDurationMs: 30000,
    pulseDurationMs: 4200,
    strokeWidth: 4,
    points: parsePolyline("30,220 60,180 100,80 140,200 190,82 240,175 290,85 340,150 380,90 415,125 440,40"),
    quotes: [
      { en: "Markets can remain irrational longer than you can remain solvent. — John Maynard Keynes", zh: "市场保持非理性的时间，可以比你保持偿付能力的时间更长。 — 约翰·梅纳德·凯恩斯" },
      { en: "The secret to being successful from a trading perspective is to have an indefatigable and undying thirst for information and knowledge. — Paul Tudor Jones", zh: "交易成功的秘诀是对信息和知识永不疲倦的渴求。 — 保罗·都铎·琼斯" },
      { en: "Risk comes from not knowing what you are doing. — Warren Buffett", zh: "风险来自于你不知道自己在做什么。 — 沃伦·巴菲特" },
      { en: "The market does not beat them. They beat themselves, because though they have brains they cannot sit tight. — Jesse Livermore", zh: "市场没有打败他们，是他们打败了自己——虽然有头脑，却坐不住。 — 杰西·利弗莫尔" },
      { en: "Every battle is won before it is fought. — Sun Tzu", zh: "胜兵先胜而后求战。 — 孙子" },
    ],
    point: klinePoint,
  },
  {
    name: "Descending Triangle",
    nameZh: "下降三角形",
    tag: "Continuation",
    tagZh: "延续",
    descriptionEn: "Flat support meets declining resistance, forming lower highs. Typically resolves with a bearish breakdown below support.",
    descriptionZh: "水平支撑线与下降阻力线汇合，形成更低的高点。通常以跌破支撑的看跌突破结束。",
    curveScale: 1.0,
    tradingPoints: {
      direction: { en: "Bearish", zh: "看跌", kind: "bear" },
      entry: { en: "Close below the flat horizontal support", zh: "收盘跌破水平支撑线" },
      stop: { en: "Above the descending resistance line", zh: "下降阻力线上方" },
      target: { en: "Triangle height projected downward from breakdown", zh: "三角形高度从破位点向下投影" },
      volume: { en: "Declines in the range, expands on breakdown", zh: "区间内递减，破位时放量" },
      reliability: "★★★★☆",
    },
    checklist: [
      { en: "Flat support touched at least 2 times", zh: "水平支撑至少2次触碰" },
      { en: "Descending resistance trendline with lower highs", zh: "下降阻力线构成递减高点" },
      { en: "Volume dries up during consolidation", zh: "盘整过程量能萎缩" },
      { en: "Daily close below the horizontal support", zh: "日线收盘跌破水平支撑" },
      { en: "Retest of support (now resistance) fails", zh: "回测支撑（已转阻力）受阻" },
    ],
    brandtNotes: [
      { en: "Works best in established downtrends; less reliable in uptrends.", zh: "已确立的下跌趋势中最有效；上涨中可靠度下降。" },
      { en: "Trust the pattern, not your hopes of a bottom.", zh: "相信形态，而不是抄底的期望。" },
      { en: "Flat support breaking often triggers waterfall decline.", zh: "水平支撑破位常引发瀑布式下跌。" },
    ],
    rotate: false,
    particleCount: 58,
    trailSpan: 0.34,
    durationMs: 3800,
    rotationDurationMs: 30000,
    pulseDurationMs: 4200,
    strokeWidth: 4,
    points: parsePolyline("30,60 60,110 100,215 140,70 190,215 240,100 290,215 340,130 380,215 415,170 440,255"),
    quotes: [
      { en: "There is nothing new on Wall Street. Whatever happens in the stock market today has happened before and will happen again. — Jesse Livermore", zh: "华尔街没有新鲜事。今天股市发生的一切以前发生过，将来也会再发生。 — 杰西·利弗莫尔" },
      { en: "Cut short your losses; let your profits run on. — David Ricardo", zh: "截断亏损，让利润奔跑。 — 大卫·李嘉图" },
      { en: "Amateurs think about how much money they can make. Professionals think about how much money they could lose. — Jack Schwager", zh: "业余者想着能赚多少，专业者想着可能亏多少。 — 杰克·施瓦格" },
      { en: "The hard work in trading comes in the preparation. The actual process of trading should be effortless. — Jack Schwager", zh: "交易的苦功在于准备。真正的交易过程应该毫不费力。 — 杰克·施瓦格" },
      { en: "Plan your trade and trade your plan. — Richard Rhodes", zh: "计划你的交易，交易你的计划。 — 理查德·罗兹" },
    ],
    point: klinePoint,
  },
  {
    name: "Flag",
    nameZh: "旗形",
    tag: "Continuation",
    tagZh: "延续",
    descriptionEn: "A sharp price move (the pole) followed by a tight, counter-trend channel (the flag). The breakout continues the prior trend direction.",
    descriptionZh: "一波急涨（旗杆）后形成窄幅逆势通道（旗面）。突破后延续之前的趋势方向。",
    curveScale: 1.0,
    tradingPoints: {
      direction: { en: "Follows flagpole direction", zh: "顺旗杆方向", kind: "neutral" },
      entry: { en: "Close beyond the flag channel in pole direction", zh: "沿旗杆方向收盘突破旗面通道" },
      stop: { en: "Opposite side of the flag channel", zh: "旗面通道另一侧" },
      target: { en: "Flagpole length projected from breakout point", zh: "旗杆长度从突破点投影" },
      volume: { en: "Heavy on pole, light on flag, heavy on breakout", zh: "旗杆放量、旗面缩量、突破放量" },
      reliability: "★★★★☆",
    },
    checklist: [
      { en: "Sharp, near-vertical prior move (the pole)", zh: "前期存在近乎垂直的急速走势（旗杆）" },
      { en: "Counter-trend consolidation lasting ≤ 3 weeks", zh: "逆势整理持续时间≤3周" },
      { en: "Parallel channel lines forming the flag", zh: "平行通道线构成旗面" },
      { en: "Volume contracts steadily through the flag", zh: "旗面中量能稳步萎缩" },
      { en: "Breakout resumes in the pole's direction", zh: "突破延续旗杆方向" },
    ],
    brandtNotes: [
      { en: "Flags fly at half-mast—target equals the pole length.", zh: "旗形半旗规则——目标等于旗杆长度。" },
      { en: "Short duration is key; flags older than 3 weeks lose edge.", zh: "持续时间是关键；超过3周的旗形优势衰减。" },
      { en: "Among Brandt's highest-probability setups.", zh: "布兰特胜率最高的入场形态之一。" },
    ],
    rotate: false,
    particleCount: 65,
    trailSpan: 0.40,
    durationMs: 4500,
    rotationDurationMs: 30000,
    pulseDurationMs: 5000,
    strokeWidth: 3.5,
    points: parsePolyline("30,240 50,220 70,185 90,150 110,115 130,80 150,55 175,90 200,65 225,105 250,80 275,120 300,95 325,135 355,95 385,55 415,25 440,10"),
    quotes: [
      { en: "Trends are not destiny. Trends can change, and you need to be prepared. — Nouriel Roubini", zh: "趋势不是命运。趋势会改变，你需要做好准备。 — 鲁里埃尔·鲁比尼" },
      { en: "The four most dangerous words in investing are: this time it's different. — Sir John Templeton", zh: "投资中最危险的四个字是：这次不同。 — 约翰·邓普顿爵士" },
      { en: "In trading, the impossible happens about twice a year. — Henri M. Simoes", zh: "在交易中，不可能的事大约每年发生两次。 — 亨利·西莫斯" },
      { en: "You don't need to know what is going to happen next to make money. — Mark Douglas", zh: "你不需要知道接下来会发生什么也能赚钱。 — 马克·道格拉斯" },
      { en: "The stock market is a device for transferring money from the impatient to the patient. — Warren Buffett", zh: "股市是一个把钱从没耐心的人转移到有耐心的人手里的工具。 — 沃伦·巴菲特" },
    ],
    point: klinePoint,
  },
  {
    name: "Double Top",
    nameZh: "双顶",
    tag: "Reversal",
    tagZh: "反转",
    descriptionEn: "An M-shaped pattern with two peaks at roughly the same price level. A break below the valley between the peaks confirms the bearish reversal.",
    descriptionZh: "M 形双峰形态，两个高点大致在同一价位。跌破两峰之间的谷底确认看跌反转。",
    curveScale: 1.0,
    tradingPoints: {
      direction: { en: "Bearish", zh: "看跌", kind: "bear" },
      entry: { en: "Close below the neckline (middle valley)", zh: "收盘跌破颈线（中间谷底）" },
      stop: { en: "Above the second peak", zh: "第二峰顶部上方" },
      target: { en: "Peak-to-neckline distance projected downward", zh: "峰顶到颈线距离向下投影" },
      volume: { en: "Lower on the second peak, expands on breakdown", zh: "第二峰量能减弱，破位时放量" },
      reliability: "★★★★☆",
    },
    checklist: [
      { en: "Two peaks at similar levels (< 5% apart)", zh: "两峰价位接近（相差<5%）" },
      { en: "At least 3 weeks between the two peaks", zh: "两峰间隔至少3周" },
      { en: "Volume lighter on the second peak", zh: "第二峰量能明显减弱" },
      { en: "Clear valley (neckline) between the peaks", zh: "两峰间存在明确的颈线低谷" },
      { en: "Decisive close below the neckline", zh: "决定性收盘跌破颈线" },
    ],
    brandtNotes: [
      { en: "Don't short the first decline—wait for the neckline break.", zh: "不要在第一次下跌就做空——等待颈线破位。" },
      { en: "Second peak failing new high = bearish divergence signal.", zh: "第二峰未能创新高 = 看跌背离信号。" },
      { en: "Most common reversal pattern in liquid markets.", zh: "流动性市场中最常见的反转形态。" },
    ],
    rotate: false,
    particleCount: 55,
    trailSpan: 0.32,
    durationMs: 3500,
    rotationDurationMs: 30000,
    pulseDurationMs: 4000,
    strokeWidth: 4.5,
    points: parsePolyline("30,230 70,195 120,70 190,165 250,75 310,160 360,205 410,245 450,255"),
    quotes: [
      { en: "Do not anticipate and move without market confirmation. — Jesse Livermore", zh: "不要在没有市场确认的情况下提前行动。 — 杰西·利弗莫尔" },
      { en: "The desire for constant action irrespective of underlying conditions is responsible for many losses in Wall Street. — Jesse Livermore", zh: "不顾市场条件、渴望持续交易，是华尔街许多亏损的根源。 — 杰西·利弗莫尔" },
      { en: "What seems too high and risky to the majority generally goes higher, and what seems too low generally goes lower. — William O'Neil", zh: "多数人认为太高、太冒险的通常会更高，认为太低的通常会更低。 — 威廉·欧奈尔" },
      { en: "Trade what you see, not what you think. — Alexander Elder", zh: "交易你所看到的，而不是你所想的。 — 亚历山大·埃尔德" },
      { en: "The key to trading success is emotional discipline. If intelligence were the key, there would be a lot more people making money. — Victor Sperandeo", zh: "交易成功的关键是情绪纪律。如果关键是智力，那赚钱的人会多得多。 — 维克多·斯佩兰迪奥" },
    ],
    point: klinePoint,
  },
  {
    name: "Double Bottom",
    nameZh: "双底",
    tag: "Reversal",
    tagZh: "反转",
    descriptionEn: "A W-shaped pattern with two troughs at roughly the same price level. A breakout above the peak between the troughs confirms the bullish reversal.",
    descriptionZh: "W 形双底形态，两个低点大致在同一价位。突破两谷之间的峰值确认看涨反转。",
    curveScale: 1.0,
    tradingPoints: {
      direction: { en: "Bullish", zh: "看涨", kind: "bull" },
      entry: { en: "Close above the neckline (middle peak)", zh: "收盘突破颈线（中间高点）" },
      stop: { en: "Below the second bottom", zh: "第二底部下方" },
      target: { en: "Bottom-to-neckline distance projected upward", zh: "底部到颈线距离向上投影" },
      volume: { en: "Expansion on the breakout above neckline", zh: "突破颈线时量能放大" },
      reliability: "★★★★☆",
    },
    checklist: [
      { en: "Two troughs at similar levels (< 5% apart)", zh: "两底价位接近（相差<5%）" },
      { en: "At least 3 weeks between the two troughs", zh: "两底间隔至少3周" },
      { en: "Volume expansion on the breakout", zh: "突破时量能放大" },
      { en: "Clear peak (neckline) between the troughs", zh: "两底间存在明确的颈线高点" },
      { en: "Daily close above the neckline", zh: "日线收盘突破颈线" },
    ],
    brandtNotes: [
      { en: "Wait for confirmation, not the second low itself.", zh: "等待突破确认，而非第二个低点本身。" },
      { en: "Bottoms take longer to form than tops—be patient.", zh: "底部构筑比顶部耗时更长——保持耐心。" },
      { en: "Best combined with bullish divergence on momentum.", zh: "最佳配合是动量出现看涨背离。" },
    ],
    rotate: false,
    particleCount: 55,
    trailSpan: 0.32,
    durationMs: 3500,
    rotationDurationMs: 30000,
    pulseDurationMs: 4000,
    strokeWidth: 4.5,
    points: parsePolyline("30,60 70,95 120,220 190,125 250,215 310,130 360,85 410,45 450,35"),
    quotes: [
      { en: "Fear and greed are the worst emotions to have in connection with the buying and selling of stocks. — Walter Schloss", zh: "恐惧和贪婪是与买卖股票最不相配的情绪。 — 沃尔特·施洛斯" },
      { en: "Being right about the direction of the market doesn't help if you are wrong about the timing. — Peter Lynch", zh: "方向判断正确但时机判断错误也无济于事。 — 彼得·林奇" },
      { en: "If you personalize losses, you can't trade. — Bruce Kovner", zh: "如果你把亏损当作人身攻击，你就没法交易。 — 布鲁斯·科夫纳" },
      { en: "Courage taught me that no matter how bad a crisis gets, any sound investment will eventually pay off. — Carlos Slim", zh: "勇气教会我，无论危机多严重，任何合理的投资终会回报。 — 卡洛斯·斯利姆" },
      { en: "An investment in knowledge pays the best interest. — Benjamin Franklin", zh: "对知识的投资回报最高。 — 本杰明·富兰克林" },
    ],
    point: klinePoint,
  },
  {
    name: "Rising Wedge",
    nameZh: "上升楔形",
    tag: "Reversal",
    tagZh: "反转",
    descriptionEn: "Both support and resistance trend upward but converge. The narrowing range signals weakening momentum, often leading to a bearish breakdown.",
    descriptionZh: "支撑线和阻力线同时上倾但逐渐收敛。不断收窄的区间暗示动能减弱，常导致看跌破位。",
    curveScale: 1.0,
    tradingPoints: {
      direction: { en: "Bearish", zh: "看跌", kind: "bear" },
      entry: { en: "Close below the rising support trendline", zh: "收盘跌破上升支撑线" },
      stop: { en: "Above the upper (resistance) trendline", zh: "上轨（阻力线）上方" },
      target: { en: "Retrace to wedge origin or base width", zh: "回测楔形起点或底宽投影" },
      volume: { en: "Decreases steadily as the wedge narrows", zh: "楔形收窄过程中量能持续递减" },
      reliability: "★★★☆☆",
    },
    checklist: [
      { en: "Both trendlines slope upward and converge", zh: "两条趋势线同向上倾并收敛" },
      { en: "Lower trendline slope steeper than the upper", zh: "下轨斜率大于上轨" },
      { en: "At least 3 touches on each trendline", zh: "每条趋势线至少3次触碰" },
      { en: "Volume contracts as the wedge tightens", zh: "楔形收紧时量能萎缩" },
      { en: "Decisive close below the lower support", zh: "决定性收盘跌破下轨支撑" },
    ],
    brandtNotes: [
      { en: "Treacherous for bulls—prices rise while momentum fades.", zh: "对多头危险——价格上行但动量衰减。" },
      { en: "Most reliable at the exhaustion phase of uptrends.", zh: "上升趋势衰竭阶段最可靠。" },
      { en: "Often appears as the final wave of a bull run.", zh: "常作为牛市末端的最后一浪出现。" },
    ],
    rotate: false,
    particleCount: 60,
    trailSpan: 0.36,
    durationMs: 4000,
    rotationDurationMs: 30000,
    pulseDurationMs: 4500,
    strokeWidth: 4,
    points: parsePolyline("30,235 60,200 100,165 140,215 180,120 220,170 260,90 300,130 340,70 380,95 410,115 440,235"),
    quotes: [
      { en: "Successful trading is about managing risk, not avoiding it. — Benjamin Graham", zh: "成功的交易是管理风险，而非回避风险。 — 本杰明·格雷厄姆" },
      { en: "The markets are unforgiving, and emotional trading always results in losses. — Alexander Elder", zh: "市场是无情的，情绪化交易总是导致亏损。 — 亚历山大·埃尔德" },
      { en: "Don't focus on making money; focus on protecting what you have. — Paul Tudor Jones", zh: "不要专注于赚钱，要专注于保护你已有的。 — 保罗·都铎·琼斯" },
      { en: "Know what you own, and know why you own it. — Peter Lynch", zh: "了解你持有的是什么，以及你为什么持有它。 — 彼得·林奇" },
      { en: "You can be free. You can live and work anywhere in the world. But you have to learn not to give back your profits. — Alexander Elder", zh: "你可以获得自由，在世界任何地方生活和工作。但你必须学会不把利润还回去。 — 亚历山大·埃尔德" },
    ],
    point: klinePoint,
  },
  {
    name: "Falling Wedge",
    nameZh: "下降楔形",
    tag: "Reversal",
    tagZh: "反转",
    descriptionEn: "Both trendlines slope downward but converge. The tightening range often precedes a bullish breakout as selling pressure exhausts.",
    descriptionZh: "两条趋势线同时下倾但逐渐收敛。不断收紧的区间常在卖压耗尽后引发看涨突破。",
    curveScale: 1.0,
    tradingPoints: {
      direction: { en: "Bullish", zh: "看涨", kind: "bull" },
      entry: { en: "Close above the descending resistance trendline", zh: "收盘突破下降阻力线" },
      stop: { en: "Below the lower (support) trendline", zh: "下轨（支撑线）下方" },
      target: { en: "Retrace to wedge origin or base width", zh: "回测楔形起点或底宽投影" },
      volume: { en: "Contracts through the wedge, surges on breakout", zh: "楔形中量能萎缩，突破时激增" },
      reliability: "★★★☆☆",
    },
    checklist: [
      { en: "Both trendlines slope downward and converge", zh: "两条趋势线同向下倾并收敛" },
      { en: "Upper trendline slope steeper than the lower", zh: "上轨斜率大于下轨" },
      { en: "At least 3 touches on each trendline", zh: "每条趋势线至少3次触碰" },
      { en: "Volume contracts as the wedge tightens", zh: "楔形收紧时量能萎缩" },
      { en: "Breakout above upper resistance on heavy volume", zh: "放量突破上轨阻力线" },
    ],
    brandtNotes: [
      { en: "The patience pattern—selling exhausts before reversal.", zh: "耐心形态——反转前卖压逐步耗尽。" },
      { en: "Less common than rising wedge, but high reward when confirmed.", zh: "出现频率低于上升楔形，但确认后回报丰厚。" },
      { en: "Best appears at the tail of a prolonged downtrend.", zh: "最佳出现在长期下跌趋势的末端。" },
    ],
    rotate: false,
    particleCount: 60,
    trailSpan: 0.36,
    durationMs: 4000,
    rotationDurationMs: 30000,
    pulseDurationMs: 4500,
    strokeWidth: 4,
    points: parsePolyline("30,60 60,95 100,130 140,80 180,170 220,125 260,205 300,165 340,220 380,200 410,180 440,60"),
    quotes: [
      { en: "The most important quality for an investor is temperament, not intellect. — Warren Buffett", zh: "投资者最重要的品质是性情，而非智力。 — 沃伦·巴菲特" },
      { en: "Never let a win go to your head, or a loss to your heart. — Chuck D", zh: "永远别让胜利冲昏头脑，也别让失败伤透心灵。 — 查克·D" },
      { en: "Throughout my financial career, I have continually witnessed examples of other people that I have known being ruined by a failure to respect risk. — Larry Hite", zh: "在我的金融生涯中，我不断看到认识的人因不尊重风险而毁灭。 — 拉里·海特" },
      { en: "Compound interest is the eighth wonder of the world. He who understands it, earns it; he who doesn't, pays it. — Albert Einstein", zh: "复利是世界第八大奇迹。理解它的人赚取它，不理解的人支付它。 — 阿尔伯特·爱因斯坦" },
      { en: "The individual investor should act consistently as an investor and not as a speculator. — Benjamin Graham", zh: "个人投资者应始终以投资者而非投机者的身份行事。 — 本杰明·格雷厄姆" },
    ],
    point: klinePoint,
  },
];

function normalizeProgress(progress) {
  return ((progress % 1) + 1) % 1;
}

function createCard(config) {
  const article = document.createElement("article");
  article.className = "curve-card";
  article.tabIndex = 0;
  article.setAttribute("role", "button");

  article.innerHTML = `
    <div class="curve-frame"></div>
    <div class="curve-meta">
      <h2 class="curve-title"></h2>
      <span class="curve-tag"></span>
    </div>
    <p class="curve-desc"></p>
  `;

  const frame = article.querySelector(".curve-frame");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "curve-svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");

  const group = document.createElementNS(SVG_NS, "g");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", String(config.strokeWidth));
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("opacity", "0.1");

  group.appendChild(path);
  svg.appendChild(group);
  frame.appendChild(svg);

  const particles = Array.from({ length: config.particleCount }, () => {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("fill", "currentColor");
    group.appendChild(circle);
    return circle;
  });

  return {
    article,
    config,
    group,
    path,
    particles,
    startTime: performance.now(),
    phaseOffset: Math.random(),
  };
}

function getDescription(config) {
  return currentLanguage === "zh" ? config.descriptionZh : config.descriptionEn;
}

function getName(config) {
  return currentLanguage === "zh" && config.nameZh ? config.nameZh : config.name;
}

function getTag(config) {
  return currentLanguage === "zh" && config.tagZh ? config.tagZh : config.tag;
}

function applyLanguage() {
  const ui = UI_TEXT[currentLanguage];
  document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
  heroEyebrow.textContent = ui.heroEyebrow;
  heroTitle.textContent = ui.heroTitle;
  gallery.setAttribute("aria-label", ui.galleryLabel);
  viewerTradingLabel.textContent = ui.tradingPoints;
  viewerChecklistLabel.textContent = ui.checklist;
  viewerNotesLabel.textContent = ui.notes;
  viewerCodeLabel.textContent = ui.code;
  viewerClose.textContent = ui.close;
  langEnButton.classList.toggle("is-active", currentLanguage === "en");
  langZhButton.classList.toggle("is-active", currentLanguage === "zh");

  instances.forEach((instance) => {
    const desc = instance.article.querySelector(".curve-desc");
    if (desc) {
      desc.textContent = getDescription(instance.config);
    }
    const title = instance.article.querySelector(".curve-title");
    if (title) {
      title.textContent = getName(instance.config);
    }
    const tag = instance.article.querySelector(".curve-tag");
    if (tag) {
      tag.textContent = getTag(instance.config);
    }
    const name = getName(instance.config);
    instance.article.setAttribute(
      "aria-label",
      currentLanguage === "zh"
        ? `${ui.ariaOpen}${name}`
        : `${ui.ariaOpen} ${name}`
    );
  });

  if (activeInstance) {
    viewerTitle.textContent = getName(activeInstance.config);
    viewerTag.textContent = getTag(activeInstance.config);
    viewerDesc.textContent = getDescription(activeInstance.config);
  }
}

function buildPath(config, detailScale, steps = 480) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const point = config.point(index / steps, detailScale, config);
    return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");
}

function getParticle(config, index, progress, detailScale) {
  const tailOffset = index / (config.particleCount - 1);
  const point = config.point(
    normalizeProgress(progress - tailOffset * config.trailSpan),
    detailScale,
    config
  );
  const fade = Math.pow(1 - tailOffset, 0.56);

  return {
    x: point.x,
    y: point.y,
    radius: 0.9 + fade * 2.7,
    opacity: 0.04 + fade * 0.96,
  };
}

function getDetailScale(time, config, phaseOffset) {
  const pulseProgress =
    ((time + phaseOffset * config.pulseDurationMs) % config.pulseDurationMs) /
    config.pulseDurationMs;
  const pulseAngle = pulseProgress * Math.PI * 2;
  return 0.52 + ((Math.sin(pulseAngle + 0.55) + 1) / 2) * 0.48;
}

function getRotation(time, config, phaseOffset) {
  if (!config.rotate) {
    return 0;
  }

  return -(
    ((time + phaseOffset * config.rotationDurationMs) % config.rotationDurationMs) /
    config.rotationDurationMs
  ) * 360;
}

const instances = curves.map((config) => {
  const instance = createCard(config);
  gallery.appendChild(instance.article);
  return instance;
});

const viewerParticles = Array.from({ length: 120 }, () => {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("fill", "currentColor");
  viewerGroup.appendChild(circle);
  return circle;
});

let activeInstance = null;
let activeViewerConfig = null;

function createViewerConfig(config) {
  return {
    ...config,
    point: config.point,
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pickLang(entry) {
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  return currentLanguage === "zh" ? entry.zh ?? entry.en : entry.en ?? entry.zh;
}

function renderTradingPoints(config) {
  const tp = config.tradingPoints;
  if (!tp) {
    viewerTrading.innerHTML = "";
    return;
  }

  const rows = ["direction", "entry", "stop", "target", "volume", "reliability"];
  const html = rows
    .filter((key) => tp[key] !== undefined)
    .map((key) => {
      const label = escapeHtml(pickLang(TRADING_POINT_LABELS[key]));
      let valueHtml;
      let ddClass = "";
      if (key === "reliability") {
        valueHtml = escapeHtml(tp.reliability);
        ddClass = ' class="reliability"';
      } else if (key === "direction") {
        valueHtml = escapeHtml(pickLang(tp.direction));
        const kind = tp.direction.kind || "neutral";
        ddClass = ` class="direction-${escapeHtml(kind)}"`;
      } else {
        valueHtml = escapeHtml(pickLang(tp[key]));
      }
      return `<dt>${label}</dt><dd${ddClass}>${valueHtml}</dd>`;
    })
    .join("");

  viewerTrading.innerHTML = html;
}

function renderChecklist(config) {
  const items = config.checklist || [];
  viewerChecklist.innerHTML = items
    .map((item) => `<li>${escapeHtml(pickLang(item))}</li>`)
    .join("");
}

function renderBrandtNotes(config) {
  const items = config.brandtNotes || [];
  const patternNotes = items
    .map((item) => `<li>${escapeHtml(pickLang(item))}</li>`)
    .join("");
  const riskHeading = `<li class="notes-subheading">${escapeHtml(pickLang(RISK_RULES_HEADING))}</li>`;
  const riskBullets = BRANDT_RISK_RULES
    .map((item) => `<li class="notes-rule">${escapeHtml(pickLang(item))}</li>`)
    .join("");
  viewerNotes.innerHTML = patternNotes + riskHeading + riskBullets;
}

function splitQuote(str) {
  const sep = ' \u2014 ';
  const idx = str.lastIndexOf(sep);
  if (idx === -1) return [str, ''];
  return [str.slice(0, idx), str.slice(idx + sep.length)];
}

function renderQuotes(config) {
  const quotes = config.quotes || [];
  viewerCode.innerHTML = quotes.map((q, i) => {
    const raw = currentLanguage === 'zh' ? q.zh : q.en;
    const [text, author] = splitQuote(raw);
    return `<div style="margin-bottom:${i < quotes.length - 1 ? '22px' : '0'}">` +
      `<p style="margin:0 0 6px;color:#f2f2f2;font-size:15px;line-height:1.65;font-weight:700;font-style:italic">\u201C${text}\u201D</p>` +
      `<p style="margin:0;color:rgba(255,255,255,0.5);font-size:12px;text-align:right">\u2014 ${author}</p>` +
      `</div>`;
  }).join('');
}

function syncViewerMeta(config) {
  renderTradingPoints(config);
  renderChecklist(config);
  renderBrandtNotes(config);
  renderQuotes(config);
  viewerPath.setAttribute("stroke-width", String(config.strokeWidth));
}

function setActiveInstance(instance) {
  activeInstance = instance;
  document.body.classList.add("modal-open");
  if (openAnimationFrame) {
    cancelAnimationFrame(openAnimationFrame);
    openAnimationFrame = 0;
  }
  const rect = instance.article.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const modalWidth = Math.min(1200, vw - 32);
  const modalHeight = Math.min(vh - 32, vw <= 640 ? vh - 24 : vh - 32);
  const targetLeft = (vw - modalWidth) / 2;
  const targetTop = (vh - modalHeight) / 2;
  const scaleX = Math.max(0.18, rect.width / modalWidth);
  const scaleY = Math.max(0.18, rect.height / modalHeight);
  viewer.style.setProperty("--viewer-translate-x", `${rect.left - targetLeft}px`);
  viewer.style.setProperty("--viewer-translate-y", `${rect.top - targetTop}px`);
  viewer.style.setProperty("--viewer-scale", `${Math.min(scaleX, scaleY)}`);
  viewerModal.classList.remove("is-open");
  viewerModal.classList.add("is-entering");
  viewerModal.setAttribute("aria-hidden", "false");
  viewerTitle.textContent = getName(instance.config);
  viewerTag.textContent = getTag(instance.config);
  viewerDesc.textContent = getDescription(instance.config);
  activeViewerConfig = createViewerConfig(instance.config);
  syncViewerMeta(activeViewerConfig);

  instances.forEach((item) => {
    item.article.classList.toggle("is-active", item === instance);
    item.article.setAttribute("aria-pressed", item === instance ? "true" : "false");
  });

  openAnimationFrame = requestAnimationFrame(() => {
    openAnimationFrame = requestAnimationFrame(() => {
      viewerModal.classList.add("is-open");
      viewerModal.classList.remove("is-entering");
      openAnimationFrame = 0;
    });
  });
}

function clearActiveInstance() {
  activeInstance = null;
  document.body.classList.remove("modal-open");
  if (openAnimationFrame) {
    cancelAnimationFrame(openAnimationFrame);
    openAnimationFrame = 0;
  }
  viewerModal.classList.remove("is-open");
  viewerModal.classList.remove("is-entering");
  viewerModal.setAttribute("aria-hidden", "true");
  instances.forEach((item) => {
    item.article.classList.remove("is-active");
    item.article.setAttribute("aria-pressed", "false");
  });
  viewerTitle.textContent = "";
  viewerTag.textContent = "";
  viewerDesc.textContent = "";
  viewerTrading.innerHTML = "";
  viewerChecklist.innerHTML = "";
  viewerNotes.innerHTML = "";
  viewerCode.innerHTML = "";
  viewerPath.setAttribute("d", "");
  activeViewerConfig = null;
}

instances.forEach((instance) => {
  const open = () => setActiveInstance(instance);
  instance.article.addEventListener("click", open);
  instance.article.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
});

viewerClose.addEventListener("click", () => {
  clearActiveInstance();
});


langEnButton.addEventListener("click", () => {
  currentLanguage = "en";
  applyLanguage();
  if (activeViewerConfig) {
    syncViewerMeta(activeViewerConfig);
  }
});

langZhButton.addEventListener("click", () => {
  currentLanguage = "zh";
  applyLanguage();
  if (activeViewerConfig) {
    syncViewerMeta(activeViewerConfig);
  }
});

viewerBackdrop.addEventListener("click", () => {
  clearActiveInstance();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeInstance) {
    clearActiveInstance();
  }
});

function renderInstance(instance, now) {
  const time = now - instance.startTime;
  const { config, group, path, particles, phaseOffset } = instance;
  const progress =
    ((time + phaseOffset * config.durationMs) % config.durationMs) / config.durationMs;
  const detailScale = getDetailScale(time, config, phaseOffset);
  const rotation = getRotation(time, config, phaseOffset);

  group.setAttribute("transform", `rotate(${rotation} 50 50)`);
  path.setAttribute("d", buildPath(config, detailScale));

  particles.forEach((node, index) => {
    const particle = getParticle(config, index, progress, detailScale);
    node.setAttribute("cx", particle.x.toFixed(2));
    node.setAttribute("cy", particle.y.toFixed(2));
    node.setAttribute("r", particle.radius.toFixed(2));
    node.setAttribute("opacity", particle.opacity.toFixed(3));
  });
}

function renderViewer(now) {
  if (!activeInstance) {
    return;
  }

  const time = now - activeInstance.startTime;
  const { phaseOffset } = activeInstance;
  const config = activeViewerConfig ?? activeInstance.config;
  const progress =
    ((time + phaseOffset * config.durationMs) % config.durationMs) / config.durationMs;
  const detailScale = getDetailScale(time, config, phaseOffset);
  const rotation = getRotation(time, config, phaseOffset);

  viewerGroup.setAttribute("transform", `rotate(${rotation} 50 50)`);
  viewerPath.setAttribute("d", buildPath(config, detailScale));

  viewerParticles.forEach((node, index) => {
    if (index >= config.particleCount) {
      node.setAttribute("opacity", "0");
      return;
    }

    const particle = getParticle(config, index, progress, detailScale);
    node.setAttribute("cx", particle.x.toFixed(2));
    node.setAttribute("cy", particle.y.toFixed(2));
    node.setAttribute("r", (particle.radius * 1.35).toFixed(2));
    node.setAttribute("opacity", Math.min(1, particle.opacity + 0.04).toFixed(3));
  });
}

function tick(now) {
  instances.forEach((instance) => renderInstance(instance, now));
  renderViewer(now);
  window.requestAnimationFrame(tick);
}

instances.forEach((instance) => renderInstance(instance, performance.now()));
applyLanguage();
window.requestAnimationFrame(tick);

// ============================================================
// Live Scan view
// ============================================================

const SCAN_UI = {
  en: {
    gallery: "Gallery",
    scan: "Live Scan",
    universe: "Universe",
    scanned: "Scanned",
    signals: "Signals",
    bullish: "Bullish",
    bearish: "Bearish",
    asof: "As of",
    loading: "Loading weekly scan data…",
    errorLoad: "Could not load scan data.",
    entry: "Entry",
    stop: "Stop",
    target: "Target",
    rr: "R:R",
    risk: "Risk",
    lastPrice: "Last",
    candidates: "Recommended Signals",
    universeTitle: "Symbol Universe",
    universeHint: "Click any symbol to inspect its weekly chart and detected pattern structure.",
    patternsLabel: "patterns",
    backtest: "Backtest",
    scans: "Scans",
    totalLabel: "Candidates",
    hit: "Target Hit",
    stopLabel: "Stopped",
    pending: "Pending",
    hitrate: "Hit Rate",
    btColScan: "Scan",
    btColSymbol: "Symbol",
    btColPattern: "Pattern",
    btColDir: "Dir",
    btColOutcome: "Outcome",
    btColWeeks: "Wks",
    btColScore: "Score",
    btEmpty: "No backtest data yet — will populate after weekly runs.",
    outTargetHit: "Target",
    outStopHit: "Stopped",
    outPending: "Pending",
    outExpired: "Expired",
    outNoData: "No Data",
    outNoLevels: "No Lvl",
    daily: "Daily",
    dailyTitle: "Daily Gary Norden Analysis",
    dailyHint: "Each report analyzes the prior US trading session through Gary Norden's framework (yields, correlation, sector rotation, geopolitical risk).",
    dailyEmpty: "No daily reports generated yet.",
  },
  zh: {
    gallery: "形态图鉴",
    scan: "本周扫描",
    universe: "品种全景",
    scanned: "扫描品种",
    signals: "信号数",
    bullish: "看涨",
    bearish: "看跌",
    asof: "数据截至",
    loading: "加载周线扫描数据…",
    errorLoad: "扫描数据加载失败。",
    entry: "入场",
    stop: "止损",
    target: "目标",
    rr: "盈亏比",
    risk: "风险",
    lastPrice: "现价",
    candidates: "推荐信号",
    universeTitle: "品种全景",
    universeHint: "点击任意品种查看周线图与识别出的形态结构。",
    patternsLabel: "个形态",
    backtest: "回测",
    scans: "扫描次数",
    totalLabel: "候选总数",
    hit: "目标达成",
    stopLabel: "止损打到",
    pending: "进行中",
    hitrate: "胜率",
    btColScan: "扫描日",
    btColSymbol: "品种",
    btColPattern: "形态",
    btColDir: "方向",
    btColOutcome: "结果",
    btColWeeks: "周数",
    btColScore: "评分",
    btEmpty: "尚无回测数据，每周五自动累积。",
    outTargetHit: "达标",
    outStopHit: "止损",
    outPending: "进行中",
    outExpired: "过期",
    outNoData: "无数据",
    outNoLevels: "无止盈止损",
    daily: "每日分析",
    dailyTitle: "每日 Gary Norden 视角分析",
    dailyHint: "每份报告基于 Gary Norden 框架（收益率/相关性/板块轮动/地缘风险）分析上一个美股交易日。",
    dailyEmpty: "尚无每日报告。",
  },
};

const PATTERN_ZH_MAP = {
  "H&S Top": "头肩顶",
  "Inverse H&S": "头肩底",
  "Rectangle": "矩形整理",
  "Rectangle Breakout": "矩形突破",
  "Rising Wedge": "上升楔形",
  "Falling Wedge": "下降楔形",
  "Expanding Triangle": "扩展三角形",
  "Wide Bodied Bar": "宽体K线",
};

const tabGallery = document.querySelector("#tab-gallery");
const tabScan = document.querySelector("#tab-scan");
const tabDaily = document.querySelector("#tab-daily");
const tabBacktest = document.querySelector("#tab-backtest");
const viewGallery = document.querySelector("#view-gallery");
const viewScan = document.querySelector("#view-scan");
const viewDaily = document.querySelector("#view-daily");
const viewBacktest = document.querySelector("#view-backtest");
const scanGrid = document.querySelector("#scan-grid");
const scanEmpty = document.querySelector("#scan-empty");
const universeGroupsEl = document.querySelector("#universe-groups");
const backtestResultsEl = document.querySelector("#backtest-results");
const backtestEmptyEl = document.querySelector("#backtest-empty");
const dailyListEl = document.querySelector("#daily-list");
const dailyCountEl = document.querySelector("#daily-count");
const dailyEmptyEl = document.querySelector("#daily-empty");

let scanData = null;
let scanLoading = false;

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 2 : abs >= 1 ? 3 : 5;
  return Number(value).toFixed(digits);
}

function buildSparklinePath(closes, width = 260, height = 90, pad = 6) {
  if (!closes || closes.length < 2) return { path: "", area: "" };
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  const step = innerW / (closes.length - 1);
  let linePath = "";
  closes.forEach((c, i) => {
    const x = pad + i * step;
    const y = pad + innerH - ((c - min) / range) * innerH;
    linePath += `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)} `;
  });
  const firstX = pad;
  const lastX = pad + (closes.length - 1) * step;
  const areaPath = `${linePath} L ${lastX.toFixed(2)} ${height - pad} L ${firstX.toFixed(2)} ${height - pad} Z`;
  return { path: linePath.trim(), area: areaPath };
}

function renderSparkline(closes, direction) {
  const width = 260;
  const height = 90;
  const { path, area } = buildSparklinePath(closes, width, height);
  const stroke = direction === "bull" ? "#7ee7b0" : direction === "bear" ? "#ff8c8c" : "#d4d4d4";
  const fillOpacity = 0.18;
  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="grad-${Math.random().toString(36).slice(2, 8)}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity="${fillOpacity}"/>
          <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="${stroke}" fill-opacity="${fillOpacity}"/>
      <path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function renderStars(score) {
  const filled = Math.max(0, Math.min(7, score));
  return "★".repeat(filled) + '<span style="color:rgba(255,255,255,0.15)">' + "★".repeat(Math.max(0, 5 - filled)) + "</span>";
}

function patternLabel(patternEn) {
  return currentLanguage === "zh"
    ? (PATTERN_ZH_MAP[patternEn] || patternEn)
    : patternEn;
}

function renderScanCard(candidate, rankIndex) {
  const ui = SCAN_UI[currentLanguage];
  const name = currentLanguage === "zh" ? candidate.nameZh : candidate.nameEn;
  const dirClass = candidate.direction || "neutral";
  const dirLabel = dirClass === "bull"
    ? ui.bullish
    : dirClass === "bear"
    ? ui.bearish
    : (currentLanguage === "zh" ? "观望" : "Neutral");

  const primary = candidate.primaryPattern || "";
  const primaryShort = primary.split(" ")[0] || primary;
  const primaryLabel = currentLanguage === "zh"
    ? primaryShort
    : (PATTERN_ZH_MAP_REV[primaryShort] || primary.split(" ").slice(1).join(" ") || primaryShort);

  const patternChips = (candidate.patterns || [])
    .map((p) => {
      const age = p.ageWeeks != null ? ` · ${p.ageWeeks}w` : "";
      const rrTag = p.rr != null ? ` · ${p.rr}:1` : "";
      const primary = p.isPrimary ? " is-primary" : "";
      return `<span class="scan-pattern-chip ${p.direction}${primary}">${escapeHtml(patternLabel(p.type))}${age}${rrTag}</span>`;
    })
    .join("");

  const trade = candidate.trade || {};
  const rows = [
    trade.entry != null ? [ui.entry, formatPrice(trade.entry)] : null,
    trade.stop != null ? [ui.stop, formatPrice(trade.stop)] : null,
    trade.target != null ? [ui.target, formatPrice(trade.target)] : null,
    trade.rr != null ? [ui.rr, `${trade.rr.toFixed(1)}:1`] : null,
    trade.riskPct != null ? [ui.risk, `${trade.riskPct.toFixed(1)}%`] : null,
    [ui.lastPrice, formatPrice(candidate.lastPrice)],
  ].filter(Boolean);

  const details = rows
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join("");

  const finalScore = candidate.finalScore != null
    ? candidate.finalScore.toFixed(1)
    : "";

  const vc = trade.volumeConfirmed;
  const vr = trade.volumeRatio;
  let volChip = "";
  if (vc === true) {
    volChip = `<span class="vol-badge vol-ok" title="${currentLanguage === "zh" ? "突破放量 " : "volume confirmed "}${vr}×avg">✓ Vol ${vr}×</span>`;
  } else if (vc === false) {
    volChip = `<span class="vol-badge vol-warn" title="${currentLanguage === "zh" ? "突破量能不足 " : "weak breakout volume "}${vr}×avg">⚠ Vol ${vr}×</span>`;
  }

  const card = document.createElement("a");
  card.className = "scan-card";
  card.href = `./debug.html?symbol=${encodeURIComponent(candidate.symbol)}`;
  card.innerHTML = `
    <div class="scan-card-rank">#${rankIndex + 1}</div>
    <div class="scan-card-head">
      <div class="scan-card-title">
        <span class="scan-card-symbol">${escapeHtml(candidate.symbol)}</span>
        <span class="scan-card-name">${escapeHtml(name)}</span>
      </div>
      <span class="scan-card-badge ${dirClass}">${escapeHtml(dirLabel)}</span>
    </div>
    <div class="scan-card-strength">
      <span class="scan-card-score" title="Score">${renderStars(candidate.score)}</span>
      <span class="scan-card-final">${finalScore}</span>
      ${volChip}
    </div>
    <div class="scan-card-patterns">${patternChips}</div>
    <dl class="scan-card-details">${details}</dl>
  `;
  return card;
}

const PATTERN_ZH_MAP_REV = Object.fromEntries(
  Object.entries({
    "H&S Top": "头肩顶",
    "Inverse H&S": "头肩底",
    "Rectangle": "矩形整理",
    "Rectangle Breakout": "矩形突破",
    "Rising Wedge": "上升楔形",
    "Falling Wedge": "下降楔形",
    "Expanding Triangle": "扩展三角形",
    "Wide Bodied Bar": "宽体K线",
  }).map(([en, zh]) => [zh, en])
);

let dailyData = null;
let dailyLoading = false;
let backtestData = null;
let backtestLoading = false;

async function loadDailyData() {
  if (dailyData || dailyLoading) return;
  dailyLoading = true;
  try {
    const resp = await fetch("./data/daily_index.json", { cache: "no-cache" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    dailyData = await resp.json();
    renderDailyView();
  } catch (err) {
    dailyEmptyEl.hidden = false;
    dailyEmptyEl.textContent = `${SCAN_UI[currentLanguage].errorLoad || "Load failed"} (${err.message})`;
  } finally {
    dailyLoading = false;
  }
}

function renderDailyView() {
  if (!dailyData) return;
  const ui = SCAN_UI[currentLanguage];
  dailyCountEl.textContent = dailyData.count ?? 0;

  document.querySelectorAll("[data-daily-label]").forEach((el) => {
    const key = el.dataset.dailyLabel;
    if (key === "title") el.textContent = ui.dailyTitle;
    if (key === "hint") el.textContent = ui.dailyHint;
  });

  const entries = dailyData.entries || [];
  if (entries.length === 0) {
    dailyEmptyEl.hidden = false;
    dailyEmptyEl.textContent = ui.dailyEmpty;
    dailyListEl.innerHTML = "";
    return;
  }
  dailyEmptyEl.hidden = true;
  dailyListEl.innerHTML = entries.map((e) => `
    <a class="daily-entry" href="./data/${encodeURI(e.file)}" target="_blank" rel="noopener">
      <div class="daily-entry-head">
        <span class="daily-entry-date">${escapeHtml(e.date)}</span>
        <span class="daily-entry-title">${escapeHtml(e.title)}</span>
      </div>
      <p class="daily-entry-preview">${escapeHtml(e.preview || "")}</p>
    </a>
  `).join("");
}


async function loadBacktestData() {
  if (backtestData || backtestLoading) return;
  backtestLoading = true;
  try {
    const resp = await fetch("./data/backtest_summary.json", { cache: "no-cache" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    backtestData = await resp.json();
    renderBacktestView();
  } catch (err) {
    backtestEmptyEl.hidden = false;
    backtestEmptyEl.textContent = `${SCAN_UI[currentLanguage].errorLoad || "Load failed"} (${err.message})`;
  } finally {
    backtestLoading = false;
  }
}

const OUTCOME_LABEL_KEY = {
  target_hit: "outTargetHit",
  stop_hit: "outStopHit",
  pending: "outPending",
  expired: "outExpired",
  no_data: "outNoData",
  no_levels: "outNoLevels",
};

function renderBacktestView() {
  if (!backtestData) return;
  const ui = SCAN_UI[currentLanguage];
  const outcomes = backtestData.outcomes || {};
  document.querySelector("#bt-scans").textContent = backtestData.scansProcessed || 0;
  document.querySelector("#bt-total").textContent = backtestData.candidatesTotal || 0;
  document.querySelector("#bt-hit").textContent = outcomes.target_hit || 0;
  document.querySelector("#bt-stop").textContent = outcomes.stop_hit || 0;
  document.querySelector("#bt-pending").textContent = outcomes.pending || 0;
  document.querySelector("#bt-hitrate").textContent = backtestData.hitRate != null
    ? `${(backtestData.hitRate * 100).toFixed(0)}%`
    : "—";

  document.querySelectorAll("[data-bt-label]").forEach((el) => {
    const key = el.dataset.btLabel;
    const map = {
      scans: ui.scans, total: ui.totalLabel, hit: ui.hit,
      stop: ui.stopLabel, pending: ui.pending, hitrate: ui.hitrate,
    };
    if (map[key]) el.textContent = map[key];
  });

  // Results table
  const results = backtestData.results || [];
  if (results.length === 0) {
    backtestEmptyEl.hidden = false;
    backtestEmptyEl.textContent = ui.btEmpty;
    backtestResultsEl.innerHTML = "";
    return;
  }
  backtestEmptyEl.hidden = true;

  // Header row
  const header = `
    <div class="backtest-row backtest-row-header">
      <span class="bt-date">${escapeHtml(ui.btColScan)}</span>
      <span class="bt-sym">${escapeHtml(ui.btColSymbol)}</span>
      <span class="bt-pattern">${escapeHtml(ui.btColPattern)}</span>
      <span class="bt-dir">${escapeHtml(ui.btColDir)}</span>
      <span class="bt-outcome">${escapeHtml(ui.btColOutcome)}</span>
      <span class="bt-weeks">${escapeHtml(ui.btColWeeks)}</span>
      <span class="bt-score">${escapeHtml(ui.btColScore)}</span>
    </div>
  `;
  // Sort by scanDate desc, then target_hit → stop_hit → pending
  const outcomeRank = { target_hit: 0, stop_hit: 1, pending: 2, expired: 3, no_data: 4, no_levels: 5 };
  const sorted = [...results].sort((a, b) => {
    const d = b.scanDate.localeCompare(a.scanDate);
    if (d !== 0) return d;
    return (outcomeRank[a.outcome] ?? 9) - (outcomeRank[b.outcome] ?? 9);
  });

  const rows = sorted.map((r) => {
    const outcomeLabel = ui[OUTCOME_LABEL_KEY[r.outcome]] || r.outcome;
    const patternName = currentLanguage === "zh"
      ? (PATTERN_ZH_MAP[r.primaryPattern?.split(" ")[1]] || r.primaryPattern || "—")
      : (r.primaryPattern || "—");
    const weeks = r.weeks != null ? r.weeks : "—";
    const score = r.finalScore != null ? r.finalScore.toFixed(1) : "—";
    const dirLabel = r.direction === "bull"
      ? (currentLanguage === "zh" ? "涨" : "Bull")
      : r.direction === "bear"
      ? (currentLanguage === "zh" ? "跌" : "Bear")
      : "—";
    return `
      <a class="backtest-row" href="./debug.html?symbol=${encodeURIComponent(r.symbol)}">
        <span class="bt-date">${escapeHtml(r.scanDate)}</span>
        <span class="bt-sym">${escapeHtml(r.symbol)}</span>
        <span class="bt-pattern" title="${escapeHtml(r.primaryPattern || "")}">${escapeHtml(patternName)}</span>
        <span class="bt-dir ${r.direction}">${escapeHtml(dirLabel)}</span>
        <span class="bt-outcome ${r.outcome}">${escapeHtml(outcomeLabel)}</span>
        <span class="bt-weeks">${escapeHtml(String(weeks))}</span>
        <span class="bt-score">${escapeHtml(score)}</span>
      </a>
    `;
  }).join("");

  backtestResultsEl.innerHTML = header + rows;
}

function renderUniverseInScan() {
  if (!scanData || !scanData.universe || !universeGroupsEl) return;
  universeGroupsEl.innerHTML = "";
  scanData.universe.forEach((group) => {
    const section = document.createElement("section");
    section.className = "universe-group";
    const label = currentLanguage === "zh" ? group.labelZh : group.labelEn;
    const cells = group.symbols.map((s) => {
      const name = currentLanguage === "zh" ? s.nameZh : s.nameEn;
      const closes = s.weeklyCloses || [];
      const chart = closes.length > 1
        ? renderSparkline(closes, "neutral")
        : `<div class="universe-cell-chart-empty">—</div>`;
      return `
        <a class="universe-cell" href="./debug.html?symbol=${encodeURIComponent(s.symbol)}" data-symbol="${escapeHtml(s.symbol)}">
          <div class="universe-cell-top">
            <span class="universe-cell-symbol">${escapeHtml(s.symbol)}</span>
          </div>
          <div class="universe-cell-chart">${chart}</div>
          <span class="universe-cell-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
        </a>
      `;
    }).join("");
    section.innerHTML = `
      <div class="universe-group-head">
        <h3 class="universe-group-title">${escapeHtml(label)}</h3>
        <span class="universe-group-count">${group.count}</span>
      </div>
      <div class="universe-grid">${cells}</div>
    `;
    universeGroupsEl.appendChild(section);
  });
}

function renderScanView() {
  if (!scanData) return;
  const ui = SCAN_UI[currentLanguage];
  // Summary reflects the actionable candidate set, not the whole scanner universe
  const cands = scanData.candidates || [];
  const bulls = cands.filter((c) => c.direction === "bull").length;
  const bears = cands.filter((c) => c.direction === "bear").length;
  document.querySelector("#scan-signals").textContent = cands.length;
  document.querySelector("#scan-bullish").textContent = bulls;
  document.querySelector("#scan-bearish").textContent = bears;
  document.querySelector("#scan-asof").textContent = scanData.dataAsOf || "—";

  document.querySelectorAll("[data-sum-label]").forEach((el) => {
    const key = el.dataset.sumLabel;
    if (ui[key]) el.textContent = ui[key];
  });
  document.querySelectorAll("[data-scan-label]").forEach((el) => {
    const key = el.dataset.scanLabel;
    if (ui[key]) el.textContent = ui[key];
  });

  scanGrid.innerHTML = "";
  scanData.candidates.forEach((c, i) => scanGrid.appendChild(renderScanCard(c, i)));

  renderUniverseInScan();
}

async function loadScanData() {
  if (scanData || scanLoading) return;
  scanLoading = true;
  scanEmpty.hidden = false;
  scanEmpty.textContent = SCAN_UI[currentLanguage].loading;
  try {
    const resp = await fetch("./data/scan_latest.json", { cache: "no-cache" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    scanData = await resp.json();
    scanEmpty.hidden = true;
    renderScanView();
  } catch (err) {
    scanEmpty.textContent = `${SCAN_UI[currentLanguage].errorLoad} (${err.message})`;
  } finally {
    scanLoading = false;
  }
}

function switchView(view) {
  tabGallery.classList.toggle("is-active", view === "gallery");
  tabScan.classList.toggle("is-active", view === "scan");
  tabDaily.classList.toggle("is-active", view === "daily");
  tabBacktest.classList.toggle("is-active", view === "backtest");
  viewGallery.hidden = view !== "gallery";
  viewScan.hidden = view !== "scan";
  viewDaily.hidden = view !== "daily";
  viewBacktest.hidden = view !== "backtest";
  if (view === "scan") loadScanData();
  if (view === "daily") loadDailyData();
  if (view === "backtest") loadBacktestData();
}

tabGallery.addEventListener("click", () => switchView("gallery"));
tabScan.addEventListener("click", () => switchView("scan"));
tabDaily.addEventListener("click", () => switchView("daily"));
tabBacktest.addEventListener("click", () => switchView("backtest"));

// Re-render scan view when language changes (if already loaded)
const originalApplyLanguage = applyLanguage;
function applyLanguageWithScan() {
  originalApplyLanguage();
  tabGallery.textContent = SCAN_UI[currentLanguage].gallery;
  tabScan.textContent = SCAN_UI[currentLanguage].scan;
  tabDaily.textContent = SCAN_UI[currentLanguage].daily;
  tabBacktest.textContent = SCAN_UI[currentLanguage].backtest;
  if (scanData) renderScanView();
  if (dailyData) renderDailyView();
  if (backtestData) renderBacktestView();
}
applyLanguageWithScan();
langEnButton.removeEventListener && langEnButton.removeEventListener("click", () => {});
// Wrap existing handlers to re-apply scan labels too
const prevEnHandler = () => {
  currentLanguage = "en";
  applyLanguageWithScan();
  if (activeViewerConfig) syncViewerMeta(activeViewerConfig);
};
const prevZhHandler = () => {
  currentLanguage = "zh";
  applyLanguageWithScan();
  if (activeViewerConfig) syncViewerMeta(activeViewerConfig);
};
// Replace the lang buttons by cloning to drop old listeners, then re-attaching
const newLangEn = langEnButton.cloneNode(true);
const newLangZh = langZhButton.cloneNode(true);
langEnButton.replaceWith(newLangEn);
langZhButton.replaceWith(newLangZh);
newLangEn.addEventListener("click", prevEnHandler);
newLangZh.addEventListener("click", prevZhHandler);

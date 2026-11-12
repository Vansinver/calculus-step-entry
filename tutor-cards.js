const textbookGraphSources = [
  {
    id: 'arccot-p300',
    page: 300,
    title: '反余切函数',
    chapter: '附录Ⅰ · 基本初等函数的图形与主要性质',
    reading: '看值域、单调性和两条水平渐近线。',
    matches: spec => spec?.expressions?.length === 1 && compactPlot(spec.expressions[0]) === 'arccot(x)',
  },
  {
    id: 'cycloid-p302',
    page: 302,
    title: '摆线（8）',
    chapter: '附录Ⅱ · 几种常用的曲线',
    reading: '对照教材的参数方程，观察滚动一周对应的一拱。',
    matches: spec => {
      if (spec?.kind !== 'parametric') return false;
      const x = compactPlot(spec.x).match(/^(?:(\d+(?:\.\d+)?)\*\(t-sin\(t\)\)|t-sin\(t\))$/);
      const y = compactPlot(spec.y).match(/^(?:(\d+(?:\.\d+)?)\*\(1-cos\(t\)\)|1-cos\(t\))$/);
      const radius = Number(x?.[1] ?? 1);
      return !!(x && y && radius > 0 && radius === Number(y[1] ?? 1));
    },
  },
];

function compactPlot(expression) {
  return String(expression ?? '').replace(/\s+/g, '').toLowerCase();
}

function withTextbookGraphIndex(message) {
  const index = textbookGraphSources.map(source => source.id + '＝' + source.title).join('；');
  return message + '\n【已核教材图谱】条目编号：' + index +
    '。仅在学生询问书上对应条目时，可另起一行写 [[textbook:条目编号]]。正文不要报附录页码，网页会核对并显示。按需绘图时保留原有绘图指令，并把条目行放在绘图参数行之前。';
}

function readTextbookGraphReply(raw, plotRequested) {
  const ids = [];
  const text = raw.replace(/^[ \t]*\[\[textbook:([^\]\r\n]*)\]\][ \t]*$/gmi, (_, id) => {
    ids.push(id.trim().toLowerCase());
    return '';
  }).trim();
  return {text, ids: plotRequested ? [] : ids.filter(id => textbookGraphSources.some(source => source.id === id))};
}

function makeTextbookCard(source) {
  const card = document.createElement('aside');
  card.className = 'tutor-card tutor-source';
  card.setAttribute('aria-label', '回归教材');
  const heading = document.createElement('strong');
  heading.textContent = '回归教材 · 印刷第 ' + source.page + ' 页';
  card.append(heading);
  for (const text of ['《高等数学（本科少学时类型）》第五版上册', source.chapter + ' · ' + source.title, source.reading]) {
    const line = document.createElement('p');
    line.textContent = text;
    card.append(line);
  }
  return card;
}

// The trial accepts only verified cards for the current question.
const trialCardQuestion = 'paper-q01-variant-a';
const trialSourceId = 'arcsin-domain-p10';
const trialVisualId = 'arcsin';

function readTrialReply(raw, questionId) {
  if (questionId !== trialCardQuestion) return {text: raw};
  const marker = raw.trim().match(/(?:^|\n)\s*\[\[cards:([a-z0-9,-]+)\]\]\s*$/);
  if (!marker) return {text: raw};
  const ids = marker[1].split(',');
  const text = raw.trim().slice(0, marker.index).trim();
  if (!text) return {text: '这次没有收到完整讲解，请再问一次。'};
  return {
    text,
    sourceId: ids.includes(trialSourceId) ? trialSourceId : null,
    visualId: ids.includes('arccot') ? 'arccot' : ids.includes(trialVisualId) ? trialVisualId : null,
  };
}

function appendTrialCards(body, message, questionId) {
  if (message.role !== 'assistant') return;
  if (Array.isArray(message.plotSpec) || message.expressionPlot) {
    const frame = document.createElement('iframe');
    frame.className = 'plot-reply-frame';
    frame.title = '可拖动函数图';
    frame.loading = 'lazy';
    const page = message.expressionPlot ? 'expression-preview.html' : 'plot-tool-preview.html';
    frame.src = './' + page + '?plot=' + encodeURIComponent(JSON.stringify(message.expressionPlot || message.plotSpec));
    body.after(frame);
    body = frame;
  }
  for (const source of textbookGraphSources.filter(source =>
    source.matches(message.expressionPlot) ||
    (!message.expressionPlot && message.textbookIds?.includes(source.id)) ||
    (source.id === 'arccot-p300' && message.visualId === 'arccot')
  )) {
    const card = makeTextbookCard(source);
    body.after(card);
    body = card;
  }
  if (questionId !== trialCardQuestion) return;
  if (message.sourceId === trialSourceId) {
    const book = document.createElement('aside');
    book.className = 'tutor-card tutor-source';
    book.setAttribute('aria-label', '回归教材');
    book.innerHTML = '<strong>回归教材 · 印刷第 10 页</strong><p>《高等数学（本科少学时类型）》第五版上册</p><p>看反正弦的定义域和值域。先分清允许输入的正弦值和输出的角。</p>';
    body.after(book);
    body = book;
  }
  if (!Array.isArray(message.plotSpec) && message.visualId === trialVisualId) body.after(makeArcsinCard());
  if (!Array.isArray(message.plotSpec) && message.visualId === 'arccot') body.after(makeArccotCard());
}

function makeArcsinCard() {
  const card = document.createElement('figure');
  card.className = 'tutor-card tutor-visual';
  card.innerHTML = `<strong>拖动看看 · 反正弦</strong>
    <svg viewBox="0 0 340 228" role="img" aria-label="反正弦曲线从负一上升到一，两端的实心点都包含">
      <path class="tutor-grid" d="M48 32H300M48 192H300"/>
      <path class="tutor-axis" d="M38 112H315M174 18V204"/>
      <text x="318" y="116">x</text><text x="180" y="18">y</text>
      <g text-anchor="middle">
        <text x="25" y="28">π</text><text x="25" y="44">2</text>
        <text x="25" y="188">π</text><text x="25" y="204">2</text>
        <text x="48" y="220">−1</text><text x="174" y="220">0</text><text x="300" y="220">1</text>
      </g>
      <path class="tutor-axis" d="M17 31H33M17 191H33M4 191H12"/>
      <path class="tutor-curve"/>
      <path class="tutor-guide"/>
      <circle class="tutor-end" cx="48" cy="192" r="4"/>
      <circle class="tutor-end" cx="300" cy="32" r="4"/>
      <circle class="tutor-point" r="6"/>
    </svg>
    <figcaption>横轴是输入，纵轴是角度。拖到两端，观察实心点对应的角。</figcaption>
    <label class="tutor-range-label">输入 x <input aria-label="反正弦的输入 x" type="range" min="-1" max="1" step="0.01" value="0"></label>
    <output></output>
    <div class="tutor-stops"><button type="button" data-value="-1">左端点</button><button type="button" data-value="0.5">看中间一点</button><button type="button" data-value="1">右端点</button></div>`;
  const input = card.querySelector('input');
  const point = card.querySelector('.tutor-point');
  const guide = card.querySelector('.tutor-guide');
  const output = card.querySelector('output');
  const px = x => 174 + 126 * x;
  const py = y => 112 - 160 * y / Math.PI;
  const curve = Array.from({length: 129}, (_, i) => {
    const angle = (i - 64) * Math.PI / 128;
    return `${i ? 'L' : 'M'}${px(Math.sin(angle)).toFixed(2)} ${py(angle).toFixed(2)}`;
  }).join(' ');
  card.querySelector('.tutor-curve').setAttribute('d', curve);
  const angles = new Map([
    [-1, '-\\dfrac{\\pi}{2}'], [-0.5, '-\\dfrac{\\pi}{6}'], [0, '0'],
    [0.5, '\\dfrac{\\pi}{6}'], [1, '\\dfrac{\\pi}{2}'],
  ]);

  function update() {
    const x = Number(input.value);
    const y = Math.asin(x);
    point.setAttribute('cx', px(x));
    point.setAttribute('cy', py(y));
    guide.setAttribute('d', `M${px(x)} 112V${py(y)}H174`);
    const inputValue = Math.abs(x) === 0.5 ? (x < 0 ? '-' : '') + '\\dfrac{1}{2}' : String(x);
    const angle = angles.get(x);
    const result = angle === undefined ? `\\approx ${y.toFixed(3)}\\,\\mathrm{rad}` : '=' + angle;
    output.innerHTML = mathMarkup('x=' + inputValue) + '，' + mathMarkup('\\arcsin x' + result);
  }

  input.addEventListener('input', update);
  for (const button of card.querySelectorAll('[data-value]')) {
    button.addEventListener('click', () => {
      input.value = button.dataset.value;
      update();
    });
  }
  update();
  return card;
}

async function loadTrialCardReplay() {
  if (!params.has('cardDemo') || questions[state.q]?.id !== trialCardQuestion) return;
  const thread = state.tutors[state.q];
  if (!thread.length) {
    const response = await fetch('./card-demo.json', {cache:'no-store'});
    if (!response.ok) throw Error('回放未加载');
    const demo = await response.json();
    const reply = readTrialReply(demo.reply, trialCardQuestion);
    const time = new Date().toISOString();
    thread.push({id:uid(),role:'user',content:demo.question,replay:true,createdAt:time},
      {id:uid(),role:'assistant',content:reply.text,sourceId:reply.sourceId,visualId:reply.visualId,createdAt:time});
  }
  openChat();
  $('#chat-messages').scrollTop = 0;
}

function makeArccotCard() {
  const card = document.createElement('figure');
  card.className = 'tutor-card tutor-visual';
  card.innerHTML = `<strong>拖动看看 · 反余切</strong>
    <svg viewBox="0 0 340 220" role="img" aria-label="反余切曲线从左往右下降，左侧趋向π，右侧趋向零">
      <path class="tutor-grid" d="M46 32H305M46 192H305"/>
      <path class="tutor-axis" d="M39 192H315M174 19V198"/>
      <text x="320" y="196">x</text><text x="180" y="18">y</text>
      <text x="22" y="37">π</text><text x="22" y="197">0</text>
      <text x="42" y="213">−4</text><text x="170" y="213">0</text><text x="299" y="213">4</text>
      <path class="tutor-curve"/><path class="tutor-guide"/><circle class="tutor-point" r="6"/>
    </svg>
    <figcaption>图上只画出一段。输入可以是任意实数，曲线向两边延伸，始终夹在两条水平线之间。</figcaption>
    <label class="tutor-range-label">输入 x <input aria-label="反余切的输入 x" type="range" min="-4" max="4" step="0.01" value="0"></label>
    <output></output>
    <div class="tutor-stops"><button type="button" data-value="-1">看负值</button><button type="button" data-value="0">看零点</button><button type="button" data-value="1">看正值</button></div>`;
  const input = card.querySelector('input');
  const px = x => 174 + 32 * x;
  const py = y => 192 - 160 * y / Math.PI;
  const angle = x => Math.PI / 2 - Math.atan(x);
  const curve = Array.from({length:129}, (_,i) => {
    const x = -4 + i / 16;
    return `${i ? 'L' : 'M'}${px(x).toFixed(2)} ${py(angle(x)).toFixed(2)}`;
  }).join(' ');
  card.querySelector('.tutor-curve').setAttribute('d', curve);
  const exact = new Map([[-1,'\\dfrac{3\\pi}{4}'],[0,'\\dfrac{\\pi}{2}'],[1,'\\dfrac{\\pi}{4}']]);
  function update() {
    const x = Number(input.value);
    const y = angle(x);
    const dot = card.querySelector('.tutor-point');
    dot.setAttribute('cx', px(x));
    dot.setAttribute('cy', py(y));
    card.querySelector('.tutor-guide').setAttribute('d', `M${px(x)} 192V${py(y)}H174`);
    const result = exact.has(x) ? '=' + exact.get(x) : `\\approx ${y.toFixed(3)}\\,\\mathrm{rad}`;
    card.querySelector('output').innerHTML = mathMarkup('x=' + x) + '，' + mathMarkup('\\operatorname{arccot} x' + result);
  }
  input.addEventListener('input', update);
  for (const button of card.querySelectorAll('[data-value]')) {
    button.addEventListener('click', () => {
      input.value = button.dataset.value;
      update();
    });
  }
  update();
  return card;
}

async function loadPlotReplay() {
  if (questions[state.q]?.id !== trialCardQuestion) return;
  const thread = state.tutors[state.q];
  if (!thread.length) {
    const response = await fetch('./plot-replay.json', {cache:'no-store'});
    if (!response.ok) throw Error('回放未加载');
    const time = new Date().toISOString();
    for (const row of await response.json()) {
      const reply = readTrialReply(row.reply, trialCardQuestion);
      thread.push({id:uid(),role:'user',content:row.question,replay:true,createdAt:time},
        {id:uid(),role:'assistant',content:reply.text,plotSpec:row.plotSpec,replay:true,createdAt:time});
    }
    persist();
  }
  openChat();
  $('#chat-messages').scrollTop = 0;
  updateV07Jump();
}

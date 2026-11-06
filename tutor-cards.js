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
    visualId: ids.includes(trialVisualId) ? trialVisualId : null,
  };
}

function appendTrialCards(body, message, questionId) {
  if (questionId !== trialCardQuestion || message.role !== 'assistant') return;
  if (message.sourceId === trialSourceId) {
    const book = document.createElement('aside');
    book.className = 'tutor-card tutor-source';
    book.setAttribute('aria-label', '回归教材');
    book.innerHTML = '<strong>回归教材 · 印刷第 10 页</strong><p>《高等数学（本科少学时类型）》第五版上册</p><p>看反正弦的定义域和值域。先分清允许输入的正弦值和输出的角。</p>';
    body.after(book);
    body = book;
  }
  if (message.visualId === trialVisualId) body.after(makeArcsinCard());
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
    thread.push({id:uid(),role:'user',content:demo.question,createdAt:time},
      {id:uid(),role:'assistant',content:reply.text,sourceId:reply.sourceId,visualId:reply.visualId,createdAt:time});
  }
  openChat();
  $('#chat-messages').scrollTop = 0;
}

function questionPrompts(question) {
  if (Array.isArray(question.prompts)) return question.prompts;
  return [...new Set([question.firstAsk, question.lessons.at(-1)[4]].filter(Boolean))]
    .map(text => ({text: /[？?。]$/.test(text) ? text : text + '？'}));
}

function syncV07Controls() {
  for (const id of ['study-welcome','textbook','lesson-details','reference-answer']) $('#'+id).hidden = true;
  $('#question-start').hidden = !!questions[state.q]?.personal;
  const readOnly = !!questions[state.q]?.gradingPending;
  $('#question-start').hidden ||= readOnly;
  $('#show-chat-answer').hidden = !!questions[state.q]?.personal || readOnly;
  $('#question-directory').open = false;
}

function renderV07Reference(question) {
  return '<article class="chat-message chat-reference"><div class="message-author">已核参考答案</div><div class="message-body">'+
    mathMarkup(question.answer)+'<p>'+renderMessage(question.answerExplanation)+'</p></div></article>';
}

function showV07Reference() {
  if(questions[state.q]?.gradingPending){toast(questions[state.q].gradingPending);return;}
  if(questions[state.q]?.personal){toast('这道个人题暂无平台已核参考答案，可以向私教提问。');return;}
  if (busy) return;
  const thread = state.tutors[state.q];
  if (!thread.some(item=>item.role==='reference')) {
    thread.push({id:uid(),role:'reference',content:'学生已查看本题参考答案。',createdAt:new Date().toISOString()});
  }
  state.revealed[state.q] = true;
  persist();
  renderHistory();
  $('#chat-messages .chat-reference').scrollIntoView({block:'nearest'});
}

function installV07Controls() {
  installMovableChatWindow($('#chat-window'));
  $('#open-question-directory').onclick = () => {
    openChat();
    if ($('#question-directory').hidden) $('#compose-editor').focus();
    else $('#question-directory').open = true;
  };
  $('#show-chat-answer').onclick = showV07Reference;
  const thread = $('#chat-messages');
  installThreadJump(thread, $('#jump-latest'), () => chatOpen);
  installDockableBubble($('#chat-bubble'), openChat);
}

function installDockableBubble(bubble, activate) {
  const phone = $('.app');
  const nav = $('.bottom-nav');
  let spot = {side: 'right', ratio: 1};
  let drag = null;
  let suppressClick = false;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function bounds() {
    const box = phone.getBoundingClientRect();
    const left = Math.max(8, box.left + 8);
    const right = Math.max(left, Math.min(innerWidth, box.right) - 52);
    const top = 72;
    const bottom = Math.max(top, nav.getBoundingClientRect().top - 56);
    return {left, right, top, bottom};
  }

  function place(x, y) {
    bubble.style.left = x + 'px';
    bubble.style.top = y + 'px';
  }

  function dock() {
    const b = bounds();
    place(b[spot.side], b.top + clamp(spot.ratio, 0, 1) * (b.bottom - b.top));
  }

  bubble.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0 || drag) return;
    const box = bubble.getBoundingClientRect();
    suppressClick = false;
    drag = {id:e.pointerId, x:e.clientX, y:e.clientY, left:box.left, top:box.top, moved:false};
    bubble.setPointerCapture(e.pointerId);
  });
  bubble.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true;
    const b = bounds();
    place(clamp(drag.left + dx, b.left, b.right), clamp(drag.top + dy, b.top, b.bottom));
  });
  bubble.addEventListener('pointerup', e => {
    if (!drag || e.pointerId !== drag.id) return;
    suppressClick = drag.moved;
    drag = null;
    if (!suppressClick) return;
    const b = bounds();
    const box = bubble.getBoundingClientRect();
    spot = {side:box.left <= (b.left + b.right) / 2 ? 'left' : 'right',
      ratio:b.bottom > b.top ? (box.top - b.top) / (b.bottom - b.top) : 1};
    dock();
  });
  function cancelDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    suppressClick = drag.moved;
    drag = null;
    dock();
  }
  bubble.addEventListener('pointercancel', cancelDrag);
  bubble.addEventListener('lostpointercapture', cancelDrag);
  bubble.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) activate();
  });
  window.addEventListener('resize', dock);
  dock();
}


function remainingV07Prompts(question, thread = []) {
  const normalize = text => String(text ?? '').trim().replace(/[？?。！!]+$/, '').replace(/\s+/g, '');
  const sent = new Set(thread.filter(item => item.role === 'user' && item.mode !== 'grade' && !item.replay)
    .map(item => normalize(item.content)));
  const options = questionPrompts(question);
  const completed = new Set(options.filter(item => sent.has(normalize(item.text))).map(item => item.id));
  const available = options.filter(item => !sent.has(normalize(item.text)) && (!item.after || completed.has(item.after)));
  return [...available.filter(item => item.after), ...available.filter(item => !item.after)].slice(0, 3);
}

function renderV07NoteGroups(notes) {
  const groups = new Map();
  for (const item of notes.slice().reverse()) {
    if (!groups.has(item.type)) groups.set(item.type, []);
    groups.get(item.type).push(item);
  }
  return Array.from(groups, ([type, items]) =>
    '<details class="saved-note-type"'+(items.length === 1 ? ' open' : '')+'><summary>'+
    esc(type)+' <span>'+items.length+' 条</span></summary>'+items.map(item=>noteCard(item)).join('')+'</details>'
  ).join('');
}

function renderV07Collection(items) {
  if (!items.length) return '<div class="empty-state">还没有收藏。可以点题目旁的书签，<br>也可以写感悟、保留一段AI精华。</div>';
  const groups = new Map();
  for (const item of items.slice().reverse()) {
    const index = savedQuestionIndex(item);
    if (!groups.has(index)) groups.set(index, []);
    groups.get(index).unshift(item);
  }
  return Array.from(groups, ([index, saved]) => {
    const question = questions[index];
    const bookmarks = saved.filter(item=>item.type==='题目');
    const notes = saved.filter(item=>item.type!=='题目');
    const origin = question?.id === trialCardQuestion ? '关联 '+question.paper+' · 原卷第1题 · 项目变式' :
      question ? question.paper+' · '+question.source : '原题出处待确认';
    const title = question?.label || '未归题的记录';
    const savedDate = [...notes].reverse().map(recordDate).find(Boolean);
    const submitted = [...(state.tutors[index] || [])].reverse().find(item =>
      item.role === 'user' && item.mode === 'grade' && !item.replay && item.createdAt);
    const activity = reviewDesktop.matches ? [
      submitted ? '最近提交作答 ' + recordDate(submitted) : '',
      savedDate ? '最近记录于 ' + savedDate : '',
    ].filter(Boolean).map(label => '<p>' + esc(label) + '</p>').join('') : '';
    const link = question ? '<button class="text-button" data-open-q="'+index+'">回到这道题</button>' : '';
    const bookmarkActions = bookmarks.map(item=>'<button class="text-button" data-delete-item="'+esc(item.id)+'">取消题目收藏</button>').join('');
    const details = notes.length ? '<details class="saved-question-notes"><summary>查看学习记录 · '+notes.length+' 条</summary>'+renderV07NoteGroups(notes)+'</details>' : '';
    return '<section class="saved-question"><div class="saved-question-main"><h3>'+esc(title)+'</h3><p>'+esc(origin)+'</p>'+
      (bookmarks.length ? '<span class="note-kind">已收藏题目</span>' +
        (bookmarks[0].date ? ' <small>收藏于 ' + esc(bookmarks[0].date) + '</small>' : '') : '')+activity+'</div>'+details+'<div class="note-actions">'+link+bookmarkActions+'</div></section>';
  }).join('');
}

function updateThreadJump(thread, button, active) {
  const distance = thread.scrollHeight - thread.clientHeight - thread.scrollTop;
  button.hidden = !active || distance <= 80;
}

function installThreadJump(thread, button, isActive) {
  const update = () => updateThreadJump(thread, button, isActive());
  button.onclick = () => {
    thread.scrollTop = thread.scrollHeight;
    update();
  };
  thread.addEventListener('scroll', update, {passive:true});
  new ResizeObserver(update).observe(thread);
}

function updateV07Jump() {
  updateThreadJump($('#chat-messages'), $('#jump-latest'), chatOpen);
}


function v07LocalReply(message, questionId, thread) {
  const request = message.trim().replace(/[？?。！!]+$/, '');
  if (/^(?:你记得(?:我们)?(?:的)?(?:之前|刚才)?(?:的)?(?:对话|聊天)(?:内容)?(?:有|是)?什么|你(?:还)?记得我们(?:刚才|之前)?(?:都)?聊过什么|我们(?:刚才|之前)?(?:都)?聊过什么|回顾本题对话)$/.test(request)) {
    const demoQuestion = '课本哪一页讲反正弦的输入范围？画图给我看为什么两个端点能取。';
    const lines = thread.filter((item,index) => item.role === 'user' && !item.replay && !item.local &&
      !(index === 0 && params.has('cardDemo') && item.content === demoQuestion));
    if (!lines.length) return {reply:'这道题还没有你发出的学习消息。',author:'本题记录'};
    const excerpts = lines.slice(-6).map((item,i) => {
      const text = item.content.replace(/\s+/g,' ').trim();
      return (i+1)+'、'+(text.length > 120 ? text.slice(0,120)+'…' : text);
    });
    return {reply:'本题已保存 '+lines.length+' 条你发出的消息。'+(lines.length>6?'下面是最近 6 条。':'')+'\n\n'+excerpts.join('\n'),author:'本题记录'};
  }
  if (questionId !== trialCardQuestion) return null;
  const asksForGraph = /^(?:请)?(?:你)?(?:能|可以|能不能|可不可以)?(?:帮我|给我|请)?(?:再)?画/.test(request) ||
    /^(?:我想|我想要|想)?(?:再)?看(?:看)?(?:一下)?反余切(?:的)?(?:函数)?图/.test(request);
  if (asksForGraph && /反余切|arccot/i.test(request) && !/比较|对比|同一张|同一个坐标|叠加|导数|积分|不要|别画/.test(request)) {
    return {reply:'这里采用值域为 \\( (0,\\pi) \\) 的反余切。曲线从左向右下降，左侧趋近 \\(\\pi\\)，右侧趋近 \\(0\\)。拖动下面的滑块，看看输入从负变正时，角度如何越过 \\(\\dfrac{\\pi}{2}\\)。\n\n[[cards:arccot]]',author:'函数图卡'};
  }
  return null;
}

// Study and review use the same desktop window movement and viewport constraints.
function installMovableChatWindow(frame){
  if(frame._movableChat)return frame._movableChat;
  const header=frame.querySelector('.chat-header'),desktop=matchMedia('(hover: hover) and (pointer: fine)');
  let offset={x:0,y:0},drag=null;
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  function reset(){offset={x:0,y:0};frame.style.translate='';endDrag();}
  function endDrag(){
    const current=drag;drag=null;frame.classList.remove('is-dragging');
    if(current&&header.hasPointerCapture(current.id))header.releasePointerCapture(current.id);
  }
  function constrain(){
    if(frame.hidden||!desktop.matches)return;
    if(frame.classList.contains('expanded')){reset();return;}
    const box=frame.getBoundingClientRect();
    offset={x:offset.x+clamp(0,8-box.left,innerWidth-8-box.right),y:offset.y+clamp(0,8-box.top,innerHeight-8-box.bottom)};
    frame.style.translate=offset.x+'px '+offset.y+'px';
  }
  header.addEventListener('pointerdown',event=>{
    if(!desktop.matches||frame.classList.contains('expanded')||event.button!==0||!event.isPrimary||drag||event.target.closest('button,input,select,textarea,a,[contenteditable="true"]'))return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,box:frame.getBoundingClientRect(),origin:{...offset}};
    header.setPointerCapture(event.pointerId);frame.classList.add('is-dragging');
  });
  header.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id||!header.hasPointerCapture(event.pointerId))return;
    const {box,origin}=drag;
    offset={x:origin.x+clamp(event.clientX-drag.x,8-box.left,innerWidth-8-box.right),y:origin.y+clamp(event.clientY-drag.y,8-box.top,innerHeight-8-box.bottom)};
    frame.style.translate=offset.x+'px '+offset.y+'px';
  });
  header.addEventListener('pointerup',endDrag);header.addEventListener('pointercancel',endDrag);header.addEventListener('lostpointercapture',()=>{drag=null;frame.classList.remove('is-dragging');});
  window.addEventListener('resize',reset);desktop.addEventListener('change',reset);
  new ResizeObserver(constrain).observe(frame);
  frame._movableChat={reset,constrain};return frame._movableChat;
}

function reviewDraftParts(session) {
  return session?.draftParts || partsFromText(session?.draft || '');
}

function saveReviewDraft(parts) {
  const session = reviewDesktop.matches ? reviewWorkspace() : state.reviewSessions.find(item => item.id === reviewActive?.id);
  if (!session) return;
  session.draftParts = parts;
  session.draft = partsText(parts);
  persist();
}

function configureReviewEditor() {
  const old = $('#review-input');
  const rich = reviewDesktop.matches;
  if (rich === (old.tagName !== 'TEXTAREA')) return;
  const session = state.reviewSessions.find(item => item.id === reviewActive?.id);
  const parts = rich ? partsFromText(old.value || '') : serializeEditor(old);
  if (session) saveReviewDraft(parts);
  const editor = document.createElement(rich ? 'div' : 'textarea');
  editor.id = 'review-input';
  if (rich) {
    editor.className = 'rich-editor';
    editor.contentEditable = 'true';
    editor.setAttribute('role','textbox');
    editor.setAttribute('aria-label','复习作答或追问');
    editor.setAttribute('aria-multiline','true');
    editor.dataset.placeholder = '写下你的作答或想问的地方…';
    editor.spellcheck = false;
  } else {
    editor.rows = 2;
    editor.maxLength = 2000;
  }
  old.replaceWith(editor);
  if (rich) {
    initEditor(editor);
    setEditor(editor,parts);
  } else {
    editor.value = partsText(parts);
    editor.addEventListener('input', () => saveReviewDraft(partsFromText(editor.value)));
  }
  $('#review-formula').hidden = !rich;
}

const reviewDesktop = matchMedia('all');
let reviewOpen = false;
let reviewView = 'current';
let reviewShowArchived = false;

function recordDate(item) {
  if (item.createdAt) {
    const date = new Date(item.createdAt);
    if (Number.isFinite(date.getTime())) return date.toLocaleDateString('zh-CN');
  }
  return item.date || '';
}

function openReviewWindow() {
  reviewOpen = true;
  renderReview();
  $('#review-minimize').focus();
}

function closeReviewWindow(returnFocus = true) {
  reviewOpen = false;
  renderReview();
  if (returnFocus) $('#review-bubble').focus();
}

function renderReviewWindow(previous) {
  const floating = reviewDesktop.matches;
  $('#review-model').textContent = window.studyAI.modelLabel(aiStatus.model || 'deepseek-flash');
  const panel = $('#review-panel');
  const parent = $(floating ? '#review-dock' : '#review-home');
  if (panel.parentElement !== parent) parent.append(panel);
  $('#review-bubble').hidden = !floating || page !== 'collection' || reviewOpen;
  $('#review-window').hidden = !floating || page !== 'collection' || !reviewOpen;
  const browsing = floating && reviewView === 'list';
  const current = state.reviewSessions.find(session => session.id === state.reviewWorkspaceId);
  $('#review-session-title').textContent = browsing ? '复习私教' : current?.title || (floating ? '新复习' : '复习私教');
  $('#review-session-title').disabled = !floating || browsing || !current || reviewBusy;
  $('#review-session-title').title = current?.title || '新复习';
  $('#review-dock').hidden = browsing;
  $('#review-list-button').textContent = browsing ? '返回对话' : '会话';
  $('#review-list-button').setAttribute('aria-expanded',String(browsing));
  const list = $('#review-session-list');
  list.hidden = !browsing;
  if (!browsing) return;
  const visible = previous.filter(session => !!session.archivedAt === reviewShowArchived);
  const archivedCount = previous.filter(session => session.archivedAt).length;
  list.innerHTML = '<div class="review-list-heading"><h3>复习会话</h3><button id="new-review" class="small-primary" type="button">＋ 新建复习</button></div>'+
    '<div class="review-list-tabs"><button type="button" data-review-tab="active" aria-pressed="'+!reviewShowArchived+'">进行中 · '+(previous.length-archivedCount)+'</button><button type="button" data-review-tab="archived" aria-pressed="'+reviewShowArchived+'">已归档 · '+archivedCount+'</button></div>'+
    (visible.length ? visible.map((session,index) =>
      '<div class="review-session-row"><button type="button" class="review-session" data-review-index="'+index+'"><b>'+esc(session.title || '复习会话')+
      '</b><small>'+esc(reviewSessionTime(session))+'</small><span aria-hidden="true">›</span></button><button type="button" class="review-archive-action" data-review-menu="'+index+'" aria-label="会话操作" title="会话操作">⋯</button></div>').join('') :
      '<p class="muted">'+(reviewShowArchived?'还没有归档会话。':'还没有进行中的会话，可以新建一轮。')+'</p>');
  list.querySelectorAll('[data-review-tab]').forEach(button => button.onclick = () => {
    if (reviewBusy) return;
    reviewShowArchived = button.dataset.reviewTab === 'archived';
    renderReview();
  });
  list.querySelectorAll('[data-review-menu]').forEach(button => {
    button.disabled = reviewBusy;
    button.onclick = () => openReviewSessionMenu(visible[Number(button.dataset.reviewMenu)]);
  });
  $('#new-review').disabled = reviewBusy;
  $('#new-review').onclick = () => {
    if (reviewBusy) return;
    reviewShowArchived = false;
    state.reviewWorkspaceId = 'new';
    reviewActive = null;
    reviewView = 'current';
    reviewError = '';
    persist();
    renderReview();
    $('#review-input').focus();
  };
  list.querySelectorAll('[data-review-index]').forEach(button => {
    button.disabled = reviewBusy;
    button.onclick = () => {
      if (reviewBusy) return;
      const session = visible[Number(button.dataset.reviewIndex)];
      state.reviewWorkspaceId = session.id;
      reviewActive = {id:session.id,resumed:true};
      reviewView = 'current';
      reviewError = '';
      persist();
      renderReview();
      $('#review-input').focus();
    };
  });
}

function reviewSessionTime(session) {
  const started = session.createdAt ? new Date(session.createdAt).toLocaleString('zh-CN') : session.date || '开始时间未知';
  return '开始于 '+started+(session.updatedAt ? ' · 最近交流 '+new Date(session.updatedAt).toLocaleString('zh-CN') : '');
}

let reviewBusy = false;
let reviewActive = null;
let reviewError = '';

function savedQuestionIndex(item) {
  if (item.questionId) return questions.findIndex(question => question.id === item.questionId);
  return Number.isInteger(item.q) && questions[item.q] ? item.q : -1;
}

function reviewFormulaText(latex,display=false){
  const slash=String.fromCharCode(92);
  return slash+(display?'[':'(')+normalizeMathText(latex)+slash+(display?']':')');
}
function reviewSavedRecord(item,versionStatus='current') {
  return {type:item.type,date:item.createdAt||item.date||null,id:item.id,
    text:item.parts?partsText(item.parts):[item.text,...(item.formulas||[]).map(f=>reviewFormulaText(f))].filter(Boolean).join('\n'),
    versionStatus,evidenceRole:item.type==='AI精华'?'学生手动保留的AI讲解，不是学生作答':'学生手动记录，是否适用于当前题面须结合版本状态确认'};
}
function reviewAttemptRecord(attempt) {
  return {type:'提交作答',id:attempt.id||null,date:attempt.createdAt||null,text:attempt.text||attempt.content||'',versionStatus:'current',evidenceRole:'学生实际提交；不是参考答案，也不自动代表正确或掌握'};
}
function currentReviewSources() {
  if(reviewDesktop.matches)hydratePersonalQuestions();
  const byQuestion=new Map();
  for(const item of state.saved){
    const index=savedQuestionIndex(item);if(index<0)continue;
    const q=questions[index];if(q.personal||q.gradingPending)continue;
    if(!byQuestion.has(q.id))byQuestion.set(q.id,{
      index,questionId:q.id,label:q.label,source:q.paper+' · '+q.source,
      origin:/-variant-|变式/.test(q.id+' '+q.source)?'variant':'original',verification:'configured',
      knowledge:q.knowledge,question:[q.questionText,q.formula?reviewFormulaText(q.formula,true):'',q.conditionFormula?reviewFormulaText(q.conditionFormula,true):''].filter(Boolean),
      questionType:q.type||Object.keys(exerciseTypes).find(key=>(q.source||'').includes(exerciseTypes[key]))||'',options:q.options||[],blankCount:q.blankCount||null,bookmark:null,records:[]
    });
    const row=byQuestion.get(q.id);
    if(item.type==='题目')row.bookmark={date:item.createdAt||item.date||null};
    else row.records.push(reviewSavedRecord(item));
  }
  // Only otherwise-eligible configured questions enter review; submitting alone does not add a new original question.
  if(reviewDesktop.matches)for(const row of byQuestion.values()){
    const attempts=(state.tutors[row.index]||[]).filter(x=>x.role==='user'&&x.mode==='grade'&&!x.replay&&x.createdAt&&Number.isFinite(Date.parse(x.createdAt))).slice(-3);
    row.records.push(...attempts.map(reviewAttemptRecord));
  }
  if(reviewDesktop.matches)for(const item of personalExercises()){
    const body=partsText(item.parts||partsFromText(item.body||''));if(item.deletedAt||!body.trim())continue;
    const questionId=personalQuestionId(item.id),index=questions.findIndex(x=>x.id===questionId),signature=personalSignature(item);
    if(index<0)continue;
    const row={index,questionId,label:item.title,source:'私教题 · '+(exerciseTypes[item.type]||'待补题型'),origin:'personal',verification:'pending',
      savedAt:item.createdAt||null,knowledge:normalizeKnowledge(item.knowledgePoints).join(' · '),question:[body],questionType:item.type||'',options:item.options||[],blankCount:item.blankCount||null,
      bookmark:null,records:[],previousVersionRecordCount:0};
    for(const record of state.saved){
      if(record.questionId!==questionId&&!(record.q===index&&!record.questionId))continue;
      if(record.type==='题目'){row.bookmark={date:record.createdAt||record.date||null};continue;}
      const referenced=(state.tutors[index]||[]).find(turn=>turn.id&&turn.id===record.sourceId);
      const recordSignature=record.questionSignature||referenced?.signature;
      if(recordSignature&&recordSignature!==signature){row.previousVersionRecordCount++;continue;}
      row.records.push(reviewSavedRecord(record,recordSignature?'current':'unknown'));
    }
    const allAttempts=state.personalAttempts?.[item.id]||[];
    row.previousVersionAttemptCount=allAttempts.filter(x=>x.signature!==signature).length;
    row.records.push(...allAttempts.filter(x=>x.signature===signature).slice(-3).map(reviewAttemptRecord));
    byQuestion.set(questionId,row);
  }
  return [...byQuestion.values()];
}
function reviewSourcePreview(source){
  const configured=questions.find(question=>question.id===source.questionId&&!question.personal);
  if(configured)return configuredQuestionBody(configured);
  return source.question.map(text=>'<div>'+renderMessage(text)+'</div>').join('')+
    (['single','multiple'].includes(source.questionType)?exerciseAnswerPreview(source.questionType,null,source.options||[]):source.questionType==='fill'&&source.blankCount?'<p class="muted">填空 · '+esc(source.blankCount)+' 空</p>':'');
}

function renderLegacyReview() {
  const sources = currentReviewSources();
  const current = reviewActive && state.reviewSessions.find(session => session.id === reviewActive.id);
  const canContinue = !!current && reviewActive.signature === JSON.stringify(sources);
  $('#review-summary').textContent = sources.length
    ? '可复习 ' + sources.length + ' 道题。开始后，当前收藏和学习记录会发给 DeepSeek。'
    : '有题目收藏或学习记录后，就可以在这里开始复习。';
  if (canContinue && reviewDesktop.matches) {
    $('#review-summary').textContent = (current.title || '复习会话')+' · '+reviewSessionTime(current);
  }
  const editor = $('#review-input');
  if (editor.isContentEditable) {
    if (document.activeElement !== editor) setEditor(editor,reviewDraftParts(current));
  } else editor.value = current?.draft || '';
  $('#start-review').disabled = reviewBusy || !sources.length;
  $('#start-review').textContent = reviewBusy ? 'DeepSeek 正在回复…' : '开始一轮复习';
  $('#review-error').textContent = reviewError;
  $('#review-error').hidden = !reviewError;
  $('#review-thread').innerHTML = canContinue ? reviewTranscript(current) : '';
  $('#review-form').hidden = !canContinue;
  if (reviewDesktop.matches) editor.contentEditable = reviewBusy ? 'false' : 'true';
  else editor.disabled = reviewBusy;
  $('#review-formula').disabled = reviewBusy;
  $('#review-send').disabled = reviewBusy;
  const previous = state.reviewSessions.filter(session => !canContinue || session.id !== current.id).slice().reverse();
  $('#review-history').hidden = reviewDesktop.matches || !previous.length;
  renderReviewWindow(previous);
  if (canContinue) {
    const thread = $('#review-thread');
    thread.scrollTop = current.scroll?.atBottom === false ? current.scroll.top : thread.scrollHeight;
  }
  updateThreadJump($('#review-thread'),$('#review-jump-latest'),reviewDesktop.matches && reviewOpen && reviewView === 'current');
  $('#review-history-list').innerHTML = reviewDesktop.matches ? '' : previous.map(session =>
    '<details><summary>'+esc(session.date)+'</summary>'+reviewTranscript(session)+'</details>').join('');
}

function reviewTranscript(session) {
  return session.turns.map((turn,index) => '<article class="chat-message '+(turn.role === 'user' ? 'user' : 'assistant')+'"><div class="message-author">'+(turn.role === 'user' ? '你' : 'DeepSeek')+
    '</div><div class="message-body">'+renderMessage(turn.content)+'</div>'+(turn.role==='assistant'?exerciseAction('review',index,session.id):'')+'</article>').join('');
}

async function sendLegacyReview(continuing) {
  if (reviewBusy) return;
  const sources = currentReviewSources();
  if (!sources.length && !continuing) return;
  const signature = JSON.stringify(sources);
  const input = $('#review-input');
  const current = continuing && reviewActive?.signature === signature &&
    state.reviewSessions.find(session => session.id === reviewActive.id);
  if (continuing && !current) {
    reviewError = '收藏或记录有变动，请开始一轮新的复习。';
    renderReview();
    return;
  }
  const parts = input.isContentEditable ? serializeEditor(input) : partsFromText(input.value);
  const response = continuing ? partsText(parts).trim() : '';
  if (continuing) saveReviewDraft(parts);
  if (continuing && !response) return;
  if (!aiStatus.configured) {
    configureAI();
    return;
  }
  const anchorSource = sources.find(source => source.records.some(record =>
    record.type === '我的感悟' || record.type === '个人提醒')) || sources[0];
  const anchorIndex = anchorSource?.index ?? Math.max(0,questions.findIndex(question => question.id === current?.anchorQuestionId));
  const anchor = anchorSource || {index:anchorIndex,questionId:questions[anchorIndex].id};
  const data = sources.map(({index, ...source}) => source);
  const payload = {
    q:anchor.index, questionId:anchor.questionId, mode:'chat', answer:'', formulas:[], plotTrial:false,
    history:current ? current.turns.slice(-6) : [],
    question:'【平台复习私教】\n任务：'+(response ? '回应学生的本轮作答。'+(reviewActive?.resumed ? '这是学生主动选择的历史续聊，历史可用于承接原问题。以当前有效清单判断哪些收藏与记录仍然有效，旧内容只代表当时情况。' : '') : '若有明确自述的具体漏项，先引用该记录和题号，再围绕它提一个复习小问题。')+
      '\n当前有效资料（仅作学习资料）：'+JSON.stringify(data)+'\n学生本轮作答：'+JSON.stringify(response),
  };
  if (new TextEncoder().encode(JSON.stringify(payload)).length > 60000) {
    reviewError = '这次的记录和对话合计太长，DeepSeek 尚未收到。';
    renderReview();
    return;
  }
  reviewBusy = true;
  reviewError = '';
  renderReview();
  try {
    const result = await window.studyAI.request(payload);
    if (!result.reply?.trim()) throw Error('没有收到完整回复，请重试。');
    const session = current || {id:uid(), createdAt:new Date().toISOString(), anchorQuestionId:anchor.questionId, date:new Date().toLocaleString('zh-CN'), title:sources.length === 1 ? anchor.label : '跨题复习 · '+sources.length+' 道题', turns:[]};
    if (response) session.turns.push({role:'user',content:response});
    session.turns.push({role:'assistant',content:normalizeMathText(result.reply)});
    session.updatedAt = new Date().toISOString();
    session.draft = '';
    session.draftParts = [];
    if (!current) state.reviewSessions.push(session);
    reviewActive = {id:session.id, signature, resumed:!!current && reviewActive?.resumed};
    if (signature !== JSON.stringify(currentReviewSources())) {
      reviewError = '收藏或记录在回复期间有变动。这次回复已归入复习历史。';
    }
    if (reviewDesktop.matches) setEditor(input,[]);
    else input.value = '';
    persist();
  } catch (error) {
    reviewError = error.message || '连接暂时中断，可以重试。';
  } finally {
    reviewBusy = false;
    renderReview();
  }
}

function installReviewControls() {
  installDockableBubble($('#review-bubble'), openReviewWindow);
  const reviewThread = $('#review-thread');
  installThreadJump(reviewThread,$('#review-jump-latest'),() =>
    reviewDesktop.matches && reviewOpen && reviewView === 'current');
  reviewThread.addEventListener('scroll',() => {
    if (!reviewOpen || reviewView !== 'current') return;
    const session = reviewDesktop.matches ? reviewWorkspace() : state.reviewSessions.find(item => item.id === reviewActive?.id);
    if (!session) return;
    session.scroll = {top:reviewThread.scrollTop,atBottom:reviewThread.scrollHeight-reviewThread.clientHeight-reviewThread.scrollTop<=80};
    persist();
  },{passive:true});
  const frame = $('#review-window');
  const mover=installMovableChatWindow(frame);
  $('#review-settings').onclick = openTutorSettings;
  $('#review-session-title').onclick = () => {
    const session = state.reviewSessions.find(item => item.id === state.reviewWorkspaceId);
    renameReviewSession(session);
  };
  $('#review-expand').onclick = () => {
    const expanded = frame.classList.toggle('expanded');
    mover.reset();
    $('#review-expand').textContent = expanded ? '小窗' : '放大';
    $('#review-expand').setAttribute('aria-label', expanded ? '恢复复习小窗' : '放大复习窗口');
  };
  $('#review-minimize').onclick = () => closeReviewWindow();
  $('#review-list-button').onclick = () => {
    if (reviewBusy) return;
    reviewView = reviewView === 'current' ? 'list' : 'current';
    renderReview();
  };
  function syncReviewLayout() {
    $('#platform-version').textContent = '学习空间 · ' + (reviewDesktop.matches ? 'v4.1' : 'v0.7');
    document.title = (reviewDesktop.matches ? '梵知高数·一步一步 · ' : '高数，一步一步 · ')+(reviewDesktop.matches ? 'v4.1' : 'v0.7')+'';
    configureReviewEditor();
    if (questions.length) renderAll();
  }
  reviewDesktop.addEventListener('change', syncReviewLayout);
  syncReviewLayout();
  $('#review-select').onclick = chooseReviewQuestions;
  $('#review-suggestion').onclick = () => {
    if (reviewBusy) return;
    const editor = $('#review-input');
    if (partsText(serializeEditor(editor)).trim()) {toast('输入框已有内容，可以先编辑或发送。');return;}
    const parts = [{type:'text',text:'从本次复习范围里帮我挑一个值得练习的点，先问我一个小问题。'}];
    setEditor(editor,parts);
    saveReviewDraft(parts);
    editor.focus();
  };
  $('#start-review').onclick = () => sendReview(false);
  $('#review-form').onsubmit = event => {
    event.preventDefault();
    sendReview(true);
  };
}

function reviewWorkspace() {
  if (!state.reviewWorkspaceId) state.reviewWorkspaceId = state.reviewSessions.at(-1)?.id || 'new';
  const session = state.reviewSessions.find(item => item.id === state.reviewWorkspaceId);
  if (session) {
    reviewActive = {id:session.id,resumed:true};
    return session;
  }
  reviewActive = null;
  state.reviewWorkspaceId = 'new';
  state.reviewNewDraft ??= {draft:'',draftParts:[],scope:{mode:'all',questionIds:[]}};
  return state.reviewNewDraft;
}

function reviewScopeSources(workspace) {
  const all = currentReviewSources();
  if (workspace.scope?.mode !== 'selected') return all;
  const ids = new Set(workspace.scope.questionIds);
  return all.filter(source => ids.has(source.questionId));
}

function reviewScopeLabel(scope, count) {
  return scope?.mode === 'selected' ? '已选 '+scope.questionIds.length+' 道题' :
    '全部收藏与锦囊 · '+count+' 道题';
}

function renderReview() {
  if (!reviewDesktop.matches) {
    $('#review-scope-bar').hidden = true;
    $('#review-suggestion').hidden = true;
    $('#start-review').hidden = false;
    renderLegacyReview();
    return;
  }
  applyReviewAutoArchive();
  const workspace = reviewWorkspace();
  const sources = reviewScopeSources(workspace);
  const existing = !!reviewActive;
  $('#start-review').hidden = true;
  $('#review-scope-bar').hidden = false;
  $('#review-select').hidden = existing;
  $('#review-select').disabled = reviewBusy;
  $('#review-scope-label').textContent = existing
    ? (workspace.scopeAtStart || '历史会话 · 开始范围未记录')+' · 当前有效 '+sources.length+' 道题'
    : '本次范围：'+reviewScopeLabel(workspace.scope,sources.length);
  $('#review-summary').textContent = existing
    ? (workspace.archivedAt ? '已归档 · ' : '')+reviewSessionTime(workspace)
    : '新复习 · 可以直接提问，也可以让私教帮你挑一个练习点。';
  $('#review-suggestion').hidden = existing;
  $('#review-suggestion').disabled = reviewBusy || !sources.length;
  $('#review-error').textContent = reviewError;
  $('#review-error').hidden = !reviewError;
  $('#review-thread').innerHTML = existing ? reviewTranscript(workspace) :
    '<div class="chat-empty"><b>这一轮，你想从哪里开始？</b>按上方范围读取题目和学习记录，可以直接写下你的复习需求。</div>';
  $('#review-form').hidden = false;
  const editor = $('#review-input');
  if (document.activeElement !== editor) setEditor(editor,reviewDraftParts(workspace));
  editor.contentEditable = reviewBusy ? 'false' : 'true';
  $('#review-formula').disabled = reviewBusy;
  $('#review-send').disabled = reviewBusy;
  $('#review-send').textContent = reviewBusy ? '发送中…' : '发送';
  $('#review-history').hidden = true;
  $('#review-history-list').innerHTML = '';
  const previous = state.reviewSessions.slice().sort((a,b) =>
    String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  renderReviewWindow(previous);
  const thread = $('#review-thread');
  thread.scrollTop = workspace.scroll?.atBottom === false ? workspace.scroll.top : thread.scrollHeight;
  updateThreadJump(thread,$('#review-jump-latest'),reviewOpen && reviewView === 'current');
}

function chooseReviewQuestions() {
  if (reviewBusy || reviewActive) return;
  const workspace = reviewWorkspace();
  const sources = currentReviewSources();
  const selected = new Set((workspace.scope?.questionIds || []).filter(id => sources.some(source => source.questionId === id)));
  let mode = workspace.scope?.mode || 'all';
  const rows=sources.map((source,index)=>{
    const records=source.records.filter(x=>x.type!=='提交作答'),attempts=source.records.filter(x=>x.type==='提交作答'),unknown=records.filter(x=>x.versionStatus==='unknown').length;
    return '<div class="review-source-row"><label class="review-question-choice"><input type="checkbox" data-scope-index="'+index+'"'+(selected.has(source.questionId)?' checked':'')+'><span><b>'+esc(source.label)+'</b><small>'+esc(collectionSourceNames[source.origin]||'题目')+(source.verification==='pending'?' · 待核验':'')+' · '+esc(source.knowledge||'待补知识点')+'</small><small>'+records.length+' 条学习记录'+(attempts.length?' · 最近 '+attempts.length+' 次提交':'')+(unknown?' · '+unknown+' 条旧记录需确认适用性':'')+'</small></span></label><details class="review-source-preview"><summary>查看完整题目</summary>'+reviewSourcePreview(source)+'</details></div>';
  }).join('');
  showDialog('本次复习范围',
    '<div class="review-scope-workspace"><div class="review-scope-content">'+
    '<label class="review-scope-mode"><input type="radio" name="review-scope-mode" value="all"'+(mode==='all'?' checked':'')+'> 全部收藏与锦囊</label>'+
    '<label class="review-scope-mode"><input type="radio" name="review-scope-mode" value="selected"'+(mode==='selected'?' checked':'')+'> 只复习勾选的题</label>'+
    '<div class="review-scope-grid">'+(rows || '<p class="muted">还没有可选题目，可以先保存题目或学习记录。</p>')+'</div></div><footer class="review-scope-footer">'+
    '<p id="review-scope-count" class="muted"></p><div class="review-scope-actions"><button type="button" id="review-scope-save" class="primary-button">使用这个范围</button></div></footer></div>');
  function updateSelection() {
    $('#review-scope-count').textContent = mode === 'all' ? '将使用全部 '+sources.length+' 道题及其有效学习记录。' : '已勾选 '+selected.size+' 道题。';
    $('#review-scope-save').disabled = mode === 'selected' && !selected.size;
  }
  document.querySelectorAll('[name="review-scope-mode"]').forEach(radio => radio.onchange = () => {mode=radio.value;updateSelection();});
  document.querySelectorAll('[data-scope-index]').forEach(checkbox => checkbox.onchange = () => {
    const id = sources[Number(checkbox.dataset.scopeIndex)].questionId;
    if (checkbox.checked) selected.add(id); else selected.delete(id);
    mode = 'selected';
    document.querySelector('[name="review-scope-mode"][value="selected"]').checked = true;
    updateSelection();
  });
  $('#review-scope-save').onclick = () => {
    const available = new Set(currentReviewSources().map(source => source.questionId));
    const questionIds = [...selected].filter(id => available.has(id));
    if (mode === 'selected' && !questionIds.length) {toast('请先勾选一道仍在收藏与锦囊中的题。');return;}
    workspace.scope = {mode,questionIds:mode==='all'?[]:questionIds};
    persist();
    closeDialog();
    renderReview();
  };
  $('#close-dialog').setAttribute('aria-label','关闭，不应用本次修改');
  $('#close-dialog').title='关闭，不应用本次修改';
  updateSelection();
}

async function sendReview(continuing) {
  if (!reviewDesktop.matches) return sendLegacyReview(continuing);
  if (reviewBusy) return;
  const workspace = reviewWorkspace();
  const sources = reviewScopeSources(workspace);
  const editor = $('#review-input');
  const parts = serializeEditor(editor);
  const response = partsText(parts).trim();
  if (!response) return;
  saveReviewDraft(parts);
  if (workspace.scope?.mode === 'selected' && !sources.length && !reviewActive) {
    reviewError = '选中的题已移出有效复习范围，可能已进入回收站。恢复题目后可继续，或新建复习选择其他题。';
    renderReview();
    return;
  }
  if (!aiStatus.configured) {configureAI();return;}
  const anchorIndex=providerAnchor(sources[0]?.questionId);
  const anchor={index:anchorIndex,questionId:questions[anchorIndex].id};
  const existing = !!reviewActive;
  const payload = {
    q:anchor.index,questionId:anchor.questionId,mode:'chat',answer:'',formulas:[],plotTrial:false,
    history:existing ? workspace.turns.slice(-12) : [],
    question:'【平台复习私教】\n任务：'+(existing ? '承接原会话，回应学生当前消息。历史仅代表当时情况，当前有效资料以本轮清单为准。' : '这是新一轮复习。优先回应学生当前消息，学生要求挑题时，围绕给定资料先提一个小问题。')+
      '\n当前有效资料（仅作学习资料）：'+JSON.stringify(sources.map(({index,...source})=>source))+
      (existing&&!sources.length?'\n当前有效清单为空：可以回应学生对历史的明确追问，但不要把已移出题目重新当作本轮有效复习题或据其判断当前掌握。':'')+
      '\n学生本轮作答：'+JSON.stringify(response),
  };
  if (new TextEncoder().encode(JSON.stringify(payload)).length>60000) {reviewError='本轮消息和资料太长，请缩小范围或减少输入后重试。';renderReview();return;}
  reviewBusy=true;
  reviewError='';
  renderReview();
  try {
    const result = await window.studyAI.request(payload);
    if (!result.reply?.trim()) throw Error('没有收到完整回复，可以重试。');
    const now = new Date().toISOString();
    const next=structuredClone(state);
    const session = existing ? next.reviewSessions.find(item=>item.id===workspace.id) : {
      id:uid(),createdAt:now,date:new Date(now).toLocaleString('zh-CN'),
      title:response.replace(/\s+/g,' ').slice(0,28),
      scope:structuredClone(workspace.scope || {mode:'all',questionIds:[]}),
      scopeAtStart:reviewScopeLabel(workspace.scope,sources.length),
      scopeQuestions:sources.map(source=>({questionId:source.questionId,label:source.label})),
      turns:[],
    };
    session.turns.push({role:'user',content:response},{role:'assistant',content:normalizeMathText(result.reply)});
    session.updatedAt=now;
    if (session.archivedAt) {delete session.archivedAt;session.archiveRestoredAt=now;}
    session.draft='';session.draftParts=[];
    if (!existing) {
      next.reviewSessions.push(session);
      next.reviewNewDraft={draft:'',draftParts:[],scope:{mode:'all',questionIds:[]}};
    }
    next.reviewWorkspaceId=session.id;
    try{localStorage.setItem(KEY,JSON.stringify(next));}catch{throw Error('未能保存本轮回复，输入和选题仍保留，请检查浏览器存储后重试。');}
    Object.assign(state,next);
    reviewActive={id:session.id,resumed:existing};
    setEditor(editor,[]);
  } catch(error) {
    reviewError=error.message || '连接暂时中断，消息已保留，可以重试。';
  } finally {
    reviewBusy=false;
    renderReview();
  }
}

function setReviewArchived(session, archived) {
  if (reviewBusy || !session) return;
  if (archived) {
    session.archivedAt = new Date().toISOString();
    session.archiveReason = 'manual';
  } else {
    delete session.archivedAt;
    session.archiveRestoredAt = new Date().toISOString();
  }
  persist();
  renderReview();
  toast(archived ? '会话已归档，可在已归档列表中找回。' : '会话已恢复到进行中。');
}

function reviewLastActivity(session) {
  const exact = [session.updatedAt,session.createdAt,session.archiveRestoredAt]
    .filter(Boolean).map(value => Date.parse(value)).filter(Number.isFinite);
  if (exact.length) return Math.max(...exact);
  const old = String(session.date || '').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (!old) return null;
  const [,year,month,day,hour,minute,second] = old;
  const value = new Date(+year,+month-1,+day,+(hour ?? 23),+(minute ?? 59),+(second ?? 59));
  return value.getFullYear()===+year && value.getMonth()===+month-1 && value.getDate()===+day ? value.getTime() : null;
}

function applyReviewAutoArchive() {
  const policy = state.reviewArchivePolicy;
  if (!reviewOpen || !policy?.enabled || ![7,30,90].includes(policy.days) || reviewBusy) return;
  const cutoff = Date.now()-policy.days*86400000;
  let changed = false;
  for (const session of state.reviewSessions) {
    if (session.archivedAt || session.id===state.reviewWorkspaceId ||
      session.draft?.trim() || partsText(session.draftParts || []).trim()) continue;
    const activity = reviewLastActivity(session);
    if (activity === null || activity>cutoff) continue;
    session.archivedAt = new Date().toISOString();
    session.archiveReason = 'auto';
    changed = true;
  }
  if (changed) persist();
}

function openTutorSettings() {
  if (!reviewDesktop.matches) {configureAI();return;}
  const policy = state.reviewArchivePolicy || {enabled:false,days:30};
  showDialog('功能设置',
    '<section class="tutor-setting-section"><h3>模型与连接</h3><p>当前模型 '+esc(window.studyAI.modelLabel(aiStatus.model || 'deepseek-flash'))+'</p><button type="button" id="open-model-options" class="settings-action">模型切换与连接</button></section>'+
    (page==='study'&&questions[state.q]?.personal?'<section class="tutor-setting-section"><h3>当前个人题</h3><button type="button" class="settings-action" data-manage-personal-resources="'+esc(questions[state.q].personalId)+'">教材与出处</button></section>':'')+
    '<section class="tutor-setting-section"><h3>复习会话</h3>'+
    '<label class="review-scope-mode"><input type="checkbox" id="review-auto-archive"'+(policy.enabled?' checked':'')+'> 自动归档较早的会话</label>'+
    '<label for="review-archive-days">距最近交流</label> <select id="review-archive-days">'+[7,30,90].map(days=>'<option value="'+days+'"'+(policy.days===days?' selected':'')+'>'+days+' 天</option>').join('')+'</select>'+
    '<p class="muted">开启后，在打开复习私教时整理。当前会话和有草稿的会话会保留。归档后仍可找回，继续发送成功后回到进行中。</p>'+
    '<button type="button" id="save-review-settings" class="primary-button">保存设置</button></section>');
  $('#open-model-options').onclick = () => {
    showDialog('模型切换与连接',
      '<label for="tutor-model-choice">已接入模型</label><select id="tutor-model-choice"><option>'+esc(window.studyAI.modelLabel(aiStatus.model || 'deepseek-flash'))+'</option></select>'+
      '<p class="muted">当前已接入 DeepSeek。其他模型供应商接入后，会加入此列表。</p>'+
      '<button type="button" id="configure-selected-model" class="primary-button">配置当前模型连接</button>');
    $('#configure-selected-model').onclick = configureAI;
  };
  $('#save-review-settings').onclick = () => {
    state.reviewArchivePolicy={enabled:$('#review-auto-archive').checked,days:Number($('#review-archive-days').value)};
    persist();
    closeDialog();
    renderReview();
    toast('归档设置已保存。');
  };
}

function openReviewSessionMenu(session) {
  if (reviewBusy || !session) return;
  showDialog('会话操作','<p class="review-session-name">'+esc(session.title || '复习会话')+'</p>'+
    '<button type="button" id="rename-review-menu" class="settings-action">重命名</button>'+
    '<button type="button" id="archive-review-menu" class="settings-action">'+(session.archivedAt?'恢复到进行中':'归档会话')+'</button>');
  $('#rename-review-menu').onclick = () => renameReviewSession(session);
  $('#archive-review-menu').onclick = () => {setReviewArchived(session,!session.archivedAt);closeDialog();};
}

function renameReviewSession(session) {
  if (reviewBusy || !session) return;
  showDialog('重命名会话',
    '<form id="rename-review-form"><label for="review-name-input">会话名称</label>'+
    '<input id="review-name-input" class="api-field" type="text" maxlength="160" autocomplete="off">'+
    '<p id="review-name-error" class="error" role="alert" hidden></p>'+
    '<div class="review-scope-actions"><button id="cancel-review-name" class="secondary-button" type="button">取消</button><button class="primary-button" type="submit">保存名称</button></div></form>');
  const input = $('#review-name-input');
  input.value = session.title || '复习会话';
  input.focus();
  input.select();
  $('#cancel-review-name').onclick = closeDialog;
  $('#rename-review-form').onsubmit = event => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name || Array.from(name).length>80) {
      $('#review-name-error').textContent = '请输入 1 到 80 个字的会话名称。';
      $('#review-name-error').hidden = false;
      input.focus();
      return;
    }
    session.title = name;
    session.titleUpdatedAt = new Date().toISOString();
    persist();
    closeDialog();
    renderReview();
    toast('会话名称已保存。');
  };
}


document.addEventListener('toggle',event=>{
  if(!event.target.matches?.('.review-source-preview'))return;
  const summary=event.target.querySelector(':scope > summary');
  if(summary)summary.textContent=event.target.open?'收起题目':'查看完整题目';
},true);

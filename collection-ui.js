// One desktop card model for saved configured questions and personal exercises.
const collectionSourceNames={original:'原卷题',variant:'配套变式',personal:'私教题'};
function normalizeKnowledge(value) {
  const aliases={'导数的定义':'导数定义','反余切':'反余切函数','反正弦':'反正弦函数','复合函数的定义域':['复合函数','定义域'],'复合函数的值域':['复合函数','值域']};
  const items=Array.isArray(value)?value:String(value||'').split(/[，,、;；·\n]/);
  return [...new Set(items.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean).flatMap(x=>aliases[x]||x))];
}
function knowledgeChoices() {
  return [...new Set([...questions.flatMap(q=>normalizeKnowledge(q.knowledge)),...personalExercises().flatMap(x=>normalizeKnowledge(x.knowledgePoints)), '反余切函数','反正弦函数','反正切函数','定义域','值域','导数定义','极限'])];
}
function collectionTime(iso,fallback='') {
  if(iso) {const d=new Date(iso);if(Number.isFinite(d.getTime()))return {text:d.toLocaleString('zh-CN'),full:iso};}
  return {text:fallback||'日期未知',full:fallback||''};
}
function collectionTimeLine(label,iso,fallback='') {
  const t=collectionTime(iso,fallback);
  return '<span title="'+esc(t.full)+'">'+esc(label)+' '+esc(t.text)+'</span>';
}
function noteTimeValue(item) {
  if(item.createdAt&&Number.isFinite(Date.parse(item.createdAt)))return Date.parse(item.createdAt);
  const m=String(item.date||'').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:$|\s)/);
  return m?new Date(+m[1],+m[2]-1,+m[3]).getTime():null;
}
function orderedCollectionNotes(notes) {
  const known=notes.filter(x=>noteTimeValue(x)!==null).sort((a,b)=>noteTimeValue(a)-noteTimeValue(b));
  let i=0;return notes.map(x=>noteTimeValue(x)===null?x:known[i++]);
}
function collectionRecords(entry) {
  if(!entry.notes.length)return '';
  const notes=orderedCollectionNotes(entry.notes),latest=notes.filter(x=>noteTimeValue(x)!==null).sort((a,b)=>noteTimeValue(b)-noteTimeValue(a))[0];
  const isOpen=state.collectionNotesOpen?.[entry.key]!==false;
  return '<details class="collection-records" data-notes-key="'+esc(entry.key)+'"'+(isOpen?' open':'')+'><summary><b>学习记录 · '+notes.length+' 条</b>'+(latest?'<span class="collapsed-record-date">最近记录于 '+esc(recordDate(latest))+'</span>':'')+'</summary><div class="collection-record-content">'+notes.map(x=>noteCard(x)).join('')+'</div></details>';
}
function configuredQuestionOptions(q) {
  if(!['single','multiple'].includes(q.type))return '';
  return (q.options||[]).map((text,i)=>'<div class="personal-question-option"><b>'+
    String.fromCharCode(65+i)+'.</b><span>'+renderMessage(text)+'</span></div>').join('');
}
function configuredQuestionBody(q) {
  if(!q)return '<p class="muted">原题配置暂不可用，学习记录仍保留。</p>';
  return renderMessage(q.questionText||'')+(q.formula?'<div class="math-display">'+mathMarkup(q.formula)+'</div>':'')+(q.conditionFormula?'<div class="math-display">'+mathMarkup(q.conditionFormula)+'</div>':'')+configuredQuestionOptions(q);
}
function collectionEntries() {
  const groups=new Map();
  for(const item of state.saved.slice().reverse()) {const index=savedQuestionIndex(item);if(questions[index]?.personal)continue;if(!groups.has(index))groups.set(index,[]);groups.get(index).unshift(item);}
  const entries=Array.from(groups,([index,items])=>{
    const q=questions[index],bookmarks=items.filter(x=>x.type==='题目'),notes=items.filter(x=>x.type!=='题目');
    const source=!q?'unknown':(/-variant-|变式/.test(q.id+' '+q.source))?'variant':'original';
    const type=q?.type||Object.keys(exerciseTypes).find(k=>(q?.source||'').includes(exerciseTypes[k]))||'';
    const submission=(state.tutors[index]||[]).slice().reverse().find(x=>x.role==='user'&&x.mode==='grade'&&!x.replay&&x.createdAt&&Number.isFinite(Date.parse(x.createdAt)));
    return {key:'configured:'+(q?.id||index),source,title:q?.label||'未归题的记录',subtitle:q?.paper||'',type,typeLabel:exerciseTypes[type]||(/填空题/.test(q?.source||'')?'填空题':'待补题型'),score:q?.score?q.score+'分':(q?.source||'').match(/\d+(?:\.\d+)?分/)?.[0]||'',knowledge:normalizeKnowledge(q?.knowledge),body:configuredQuestionBody(q),notes,bookmarks,index,submission};
  });
  for(const x of personalExercises().slice().reverse()) {
    const index=questions.findIndex(q=>q.personalId===x.id);
    const saved=state.saved.filter(record=>record.questionId===personalQuestionId(x.id)||(!record.questionId&&index>=0&&record.q===index));
    const submission=(state.tutors[index]||[]).slice().reverse().find(m=>m.role==='user'&&m.mode==='grade'&&m.createdAt);
    entries.push({key:'personal:'+x.id,source:'personal',title:x.title,type:x.type,typeLabel:exerciseTypes[x.type]||'待补题型',knowledge:normalizeKnowledge(x.knowledgePoints),body:partsHTML(x.parts||partsFromText(x.body||''))+(['single','multiple'].includes(x.type)?exerciseAnswerPreview(x.type,null,x.options||[]):x.type==='fill'?'<p class="personal-blank-count">填空 · '+esc(x.blankCount||'待确认')+' 空</p>':''),notes:saved.filter(m=>m.type!=='题目'),bookmarks:saved.filter(m=>m.type==='题目'),submission,personal:x,trashed:!!x.deletedAt});
  }
  return entries;
}
function renderCollectionCard(entry) {
  const x=entry.personal;
  let time='';
  if(x)time=collectionTimeLine('保存于',x.createdAt,x.date);
  else if(entry.bookmarks.length)time=collectionTimeLine('收藏于',entry.bookmarks[0].createdAt,entry.bookmarks[0].date);
  if(x&&entry.bookmarks?.length)time+=collectionTimeLine('收藏于',entry.bookmarks[0].createdAt,entry.bookmarks[0].date);
  if(entry.submission)time+=collectionTimeLine('最近提交作答',entry.submission.createdAt);
  if(entry.trashed)time+=collectionTimeLine('移入回收站',x.deletedAt);
  const tags=[collectionSourceNames[entry.source]||'来源待确认',entry.typeLabel,entry.score,x?'待核验':entry.bookmarks.length?'已收藏':'有学习记录'].filter(Boolean);
  const knowledge=entry.knowledge.length?entry.knowledge.map(t=>'<span class="knowledge-tag">'+esc(t)+'</span>').join(''):'<span class="knowledge-pending">待补知识点</span>';
  const actions=x?(entry.trashed?'<button class="text-button" data-restore-exercise="'+esc(x.id)+'">恢复题目</button>':'<button class="primary-button personal-practice-entry" data-practice-exercise="'+esc(x.id)+'">去练习</button><button class="text-button" data-personal-menu="'+esc(x.id)+'" aria-label="管理'+esc(x.title)+'">管理题目 ⋯</button>'):(questions[entry.index]?'<button class="text-button" data-open-q="'+entry.index+'">回到这道题</button>':'')+entry.bookmarks.map(item=>'<button class="text-button" data-delete-item="'+esc(item.id)+'">取消题目收藏</button>').join('');
  return '<article class="collection-card" data-collection-key="'+esc(entry.key)+'"><div class="collection-card-top"><div class="collection-labels">'+tags.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div><div class="collection-time">'+time+'</div></div><h3>'+renderMessage(entry.title)+'</h3>'+(entry.subtitle?'<p class="collection-subtitle">'+esc(entry.subtitle)+'</p>':'')+'<div class="collection-knowledge" aria-label="知识点">'+knowledge+'</div><div class="collection-question-body">'+entry.body+'</div>'+collectionRecords(entry)+'<div class="note-actions">'+actions+'</div></article>';
}
function renderUnifiedCollection() {
  const filter=state.collectionFilter||{},source=filter.source||'all',knowledge=filter.knowledge||'',type=filter.type||'';
  const entries=collectionEntries(),trash=entries.filter(x=>x.trashed),active=entries.filter(x=>!x.trashed),base=filter.trash?trash:active;
  const filtered=base.filter(x=>(source==='all'||x.source===source)&&(!knowledge||x.knowledge.includes(knowledge))&&(!type||x.type===type));
  const points=[...new Set([...base.flatMap(x=>x.knowledge),...(knowledge?[knowledge]:[])])].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  return '<section class="unified-collection"><div class="paper-collection-entry"><button class="text-button" id="practice-papers-entry">我的练习卷 · '+practicePapers().length+'</button><span class="muted">选题组卷，按自己的顺序练习</span></div><div class="collection-toolbar"><button type="button" class="secondary-button study-media-button" data-study-photo>拍照录题</button><div class="collection-heading"><h2>'+(filter.trash?'回收站':'我的题目')+' · '+base.length+'</h2><button class="text-button" data-collection-trash="'+(filter.trash?'off':'on')+'">'+(filter.trash?'返回我的题目':'回收站 · '+trash.length)+'</button></div><div class="collection-source-filters" role="group" aria-label="题目来源筛选">'+[['all','全部'],...Object.entries(collectionSourceNames)].map(([value,label])=>'<button type="button" data-collection-source="'+value+'" aria-pressed="'+(source===value)+'">'+label+'</button>').join('')+'</div><div class="collection-filters"><label>知识点<select id="collection-knowledge-filter"><option value="">全部知识点</option>'+points.map(t=>'<option value="'+esc(t)+'"'+(knowledge===t?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label><label>题型<select id="collection-type-filter"><option value="">全部题型</option>'+Object.entries(exerciseTypes).map(([value,label])=>'<option value="'+value+'"'+(type===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label></div><p class="muted">'+(filter.trash?'删除的个人题保留在这里，可恢复；原始聊天不会被删除。':'找到 '+filtered.length+' 道题 · 直接读题，展开学习记录后可回看感悟。')+'</p></div><div class="collection-cards">'+(filtered.length?filtered.map(renderCollectionCard).join(''):'<div class="empty-state">'+(filter.trash?'这里暂时没有题目。':'当前条件下没有题目，可以调整筛选。')+'</div>')+'</div></section>';
}
function setCollectionFilter(patch) {state.collectionFilter={...state.collectionFilter,...patch};persist();renderCollection();}
function setPersonalTrashed(id,trashed) {
  const current=personalExercises().find(x=>x.id===id);if(!current)return;
  if(busy&&questions[state.q]?.personalId===id){toast('请等这道题的回复完成后再移入回收站。');return;}
  const next=personalExercises().map(x=>{if(x.id!==id)return x;const copy={...x};if(trashed)copy.deletedAt=new Date().toISOString();else delete copy.deletedAt;return copy;});
  if(!storeExercises(next))return;
  closeDialog();renderCollection();toast(trashed?'已移入回收站，可以恢复。':'题目已恢复，原保存时间保留。');
}
function openPersonalMenu(item) {
  showDialog('管理题目','<p>'+renderMessage(item.title)+'</p><button type="button" class="settings-action" data-edit-exercise="'+esc(item.id)+'">编辑题目与知识点</button><button type="button" class="settings-action" data-manage-personal-resources="'+esc(item.id)+'">教材与出处</button><button type="button" class="settings-action" data-view-exercise-source="'+esc(item.id)+'">查看来源</button><button type="button" class="settings-action" data-trash-exercise="'+esc(item.id)+'">删除题目 · 移入回收站</button><p class="muted">删除后可在回收站恢复，来源聊天继续保留。</p>');
}
document.addEventListener('toggle',e=>{
  const node=e.target;
  if(!node.matches?.('.collection-records')||!node.isConnected||!reviewDesktop.matches)return;
  state.collectionNotesOpen??={};if(state.collectionNotesOpen[node.dataset.notesKey]===node.open)return;
  state.collectionNotesOpen[node.dataset.notesKey]=node.open;persist();
},true);
document.addEventListener('change',e=>{
  if(!reviewDesktop.matches)return;
  if(e.target.id==='collection-knowledge-filter')setCollectionFilter({knowledge:e.target.value});
  if(e.target.id==='collection-type-filter')setCollectionFilter({type:e.target.value});
});
document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button||!reviewDesktop.matches)return;
  if(button.dataset.collectionSource)setCollectionFilter({source:button.dataset.collectionSource});
  if(button.dataset.collectionTrash)setCollectionFilter({trash:button.dataset.collectionTrash==='on',source:'all',knowledge:'',type:''});
  if(button.dataset.personalMenu){const item=personalExercises().find(x=>x.id===button.dataset.personalMenu);if(item)openPersonalMenu(item);}
  if(button.dataset.trashExercise)setPersonalTrashed(button.dataset.trashExercise,true);
  if(button.dataset.restoreExercise)setPersonalTrashed(button.dataset.restoreExercise,false);
});

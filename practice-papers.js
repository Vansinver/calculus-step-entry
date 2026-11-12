// Local, manually assembled papers. Persist question data, never rendered HTML or answers.
let paperWorkspace=null;
function practicePapers(){return Array.isArray(state.practicePapers)?state.practicePapers:[];}
function paperCopy(value){return JSON.parse(JSON.stringify(value));}
function paperSignature(item){return JSON.stringify({type:item.type,text:item.text||'',formula:item.formula||'',conditionFormula:item.conditionFormula||'',parts:item.parts||[],options:item.options||[],blankCount:item.blankCount||null});}
function paperLibrary(){
  return collectionEntries().filter(e=>!e.trashed&&(e.personal||questions[e.index])).map(e=>{
    const x=e.personal,q=x?null:questions[e.index];
    const item={key:e.key,title:e.title,source:e.source,paper:e.subtitle||'',type:e.type,knowledge:e.knowledge,score:e.score||'',pending:!!x||!!q?.gradingPending};
    if(x){item.personalId=x.id;item.parts=paperCopy(x.parts||partsFromText(x.body||''));item.options=paperCopy(x.options||[]);item.blankCount=x.blankCount||null;}
    else{item.questionId=q.id;item.text=q.questionText||'';item.formula=q.formula||'';item.conditionFormula=q.conditionFormula||'';item.options=paperCopy(q.options||[]);item.blankCount=q.blankCount||null;}
    const hasBody=x?partsText(item.parts).trim():item.text.trim()||item.formula.trim();
    item.valid=!!(hasBody&&exerciseTypes[item.type]&&(!['single','multiple'].includes(item.type)||(item.options.length>=2&&item.options.every(v=>String(v).trim())))&&(!x||item.type!=='fill'||Number.isInteger(item.blankCount)&&item.blankCount>=1&&item.blankCount<=20));
    return item;
  });
}
function paperBody(item){
  if(item.personalId)return partsHTML(item.parts||[])+(['single','multiple'].includes(item.type)?exerciseAnswerPreview(item.type,null,item.options||[]):item.type==='fill'?exerciseAnswerPreview(item.type,item.blankCount,[]):'');
  return configuredQuestionBody({questionText:item.text,formula:item.formula,conditionFormula:item.conditionFormula})+(['single','multiple'].includes(item.type)?exerciseAnswerPreview(item.type,null,item.options||[]):'');
}
function paperMeta(item){return [collectionSourceNames[item.source]||'来源待确认',exerciseTypes[item.type]||'待补题型',item.score,item.pending?'待核验':'',item.paper,...(item.knowledge||[])].filter(Boolean).join(' · ');}
function paperSourceStatus(item){
  let live=paperLibrary().find(x=>x.key===item.key);
  // Removing a bookmark does not remove an original question from the study directory.
  if(!live&&!item.personalId){
    const q=questions.find(q=>!q.personal&&q.id===item.questionId);
    if(q)live={type:q.type||Object.keys(exerciseTypes).find(k=>(q.source||'').includes(exerciseTypes[k]))||'',text:q.questionText||'',formula:q.formula||'',conditionFormula:q.conditionFormula||'',options:q.options||[],blankCount:q.blankCount||null};
  }
  if(!live)return '来源已不在当前题目列表，卷内题面仍保留。';
  if(paperSignature(live)!==paperSignature(item))return '来源题面已修改，卷内保留保存时的题面。';
  return '';
}
function paperCommit(patch){
  try{localStorage.setItem(KEY,JSON.stringify({...state,...patch}));}catch{toast('未能保存，当前内容仍保留，请重试。');return false;}
  Object.assign(state,patch);return true;
}
function paperCloseLabel(){
  $('#close-dialog').setAttribute('aria-label','关闭，保留组卷草稿');$('#close-dialog').title='关闭，保留组卷草稿';
}
function rememberPaperDraft(){
  if(!paperWorkspace)return false;
  return paperCommit({practicePaperDraft:paperCopy({id:paperWorkspace.id,title:paperWorkspace.title,items:paperWorkspace.items})});
}
function openPaperList(){
  if(!reviewDesktop.matches)return;
  paperWorkspace=null;
  const papers=practicePapers().slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  showDialog('我的练习卷','<div class="paper-workspace"><div class="paper-list-head"><p class="muted">自己选题、调整顺序，保存后随时打开。练习卷只保存在当前浏览器。</p><button class="primary-button" id="paper-new">＋ 新建练习卷</button></div><div class="paper-scroll">'+(state.practicePaperDraft?'<div class="paper-draft"><b>有一份未保存的组卷草稿</b><button class="text-button" id="paper-resume">继续编辑草稿</button></div>':'')+(papers.length?papers.map(p=>'<article class="paper-list-card"><div><button class="paper-title-button" data-paper-read="'+esc(p.id)+'">'+esc(p.title)+'</button><p class="muted">'+p.items.length+' 道题</p></div><div class="collection-time">'+collectionTimeLine('创建于',p.createdAt)+(p.updatedAt!==p.createdAt?collectionTimeLine('最近修改',p.updatedAt):'')+'</div><div class="note-actions"><button class="text-button" data-paper-edit="'+esc(p.id)+'">编辑练习卷</button><button class="text-button" data-paper-delete="'+esc(p.id)+'">删除练习卷</button></div></article>').join(''):'<p class="empty-state">还没有练习卷，从已收藏的题目和私教题里挑几道吧。</p>')+'</div></div>');
  $('#paper-new').onclick=()=>{if(state.practicePaperDraft){openPaperEditor(state.practicePaperDraft);toast('已打开未保存草稿；保存后可再新建练习卷。');}else openPaperEditor();};
  if($('#paper-resume')){
    $('#paper-resume').insertAdjacentHTML('afterend','<button class="text-button" id="paper-discard-draft">舍弃草稿</button>');
    $('#paper-resume').onclick=()=>openPaperEditor(state.practicePaperDraft);
    $('#paper-discard-draft').onclick=()=>confirmPermanentAction({title:'舍弃这份组卷草稿？',description:'只移除未保存的改动，已保存的练习卷和题库里的题目保留。',preview:'<b>'+esc(state.practicePaperDraft.title||'未命名草稿')+'</b>',commit:()=>{if(!paperCommit({practicePaperDraft:null}))return false;openPaperList();return true;}});
  }
}
function openPaperEditor(existing=null){
  if(!reviewDesktop.matches)return;
  paperWorkspace={id:existing?.id||null,title:existing?.title||'我的练习卷',items:paperCopy(existing?.items||[]),query:'',source:'',type:'',knowledge:''};
  showDialog('编辑练习卷','<div class="paper-workspace"><div class="paper-editor-top"><label for="paper-title">练习卷名称</label><input id="paper-title" maxlength="80" value="'+esc(paperWorkspace.title)+'"><p class="muted">勾选题目，在“卷内顺序”中调整。保存时保留题面，不带答案、聊天或学习记录。</p><input id="paper-search" type="search" placeholder="搜索题目、题干或知识点" aria-label="搜索组卷题目"><div class="paper-filters"><label>来源<select id="paper-source"><option value="">全部来源</option>'+Object.entries(collectionSourceNames).map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label><label>题型<select id="paper-type"><option value="">全部题型</option>'+Object.entries(exerciseTypes).map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label><label>知识点<select id="paper-knowledge"><option value="">全部知识点</option>'+[...new Set(paperLibrary().flatMap(x=>x.knowledge))].map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select></label></div></div><div class="paper-columns"><section><h3>可选题目 <span id="paper-found"></span></h3><div id="paper-library" class="paper-scroll"></div></section><section><h3>卷内顺序 <span id="paper-selected-count"></span></h3><div id="paper-selected" class="paper-scroll"></div></section></div><footer class="paper-footer"><p id="paper-draft-status" class="muted" role="status"></p><div class="paper-footer-actions"><button class="secondary-button" id="paper-preview-draft">预览卷面</button><button class="primary-button" id="paper-save">保存练习卷</button></div></footer></div>');
  paperCloseLabel();
  $('#paper-title').oninput=e=>{paperWorkspace.title=e.target.value;paperUpdateDraft();};
  $('#paper-search').oninput=e=>{paperWorkspace.query=e.target.value;renderPaperLibrary();};
  for(const name of ['source','type','knowledge'])$('#paper-'+name).onchange=e=>{paperWorkspace[name]=e.target.value;renderPaperLibrary();};
  $('#paper-save').onclick=savePaper;
  renderPaperLibrary();renderPaperSelected();paperUpdateDraft();
}
function paperUpdateDraft(){
  const okay=rememberPaperDraft();
  if($('#paper-draft-status'))$('#paper-draft-status').textContent=okay?'组卷草稿已保留 · '+paperWorkspace.items.length+' 道题':'草稿暂未保存，请保持窗口并重试。';
}
function renderPaperLibrary(){
  if(!paperWorkspace||!$('#paper-library'))return;
  const w=paperWorkspace,query=w.query.trim().toLocaleLowerCase();
  const items=paperLibrary().filter(x=>(!w.source||x.source===w.source)&&(!w.type||x.type===w.type)&&(!w.knowledge||x.knowledge.includes(w.knowledge))&&(!query||[x.title,x.text,x.formula,x.conditionFormula,partsText(x.parts||[]),...(x.options||[]),...x.knowledge].join(' ').toLocaleLowerCase().includes(query)));
  $('#paper-found').textContent='· '+items.length;
  $('#paper-library').innerHTML=items.length?items.map(item=>'<article class="paper-question" data-paper-key="'+esc(item.key)+'"><label class="paper-choice"><input type="checkbox" data-paper-select="'+esc(item.key)+'"'+(w.items.some(x=>x.key===item.key)?' checked':'')+(!item.valid?' disabled':'')+'><span><b>'+esc(item.title)+'</b><small>'+esc(paperMeta(item))+'</small></span></label>'+(!item.valid?'<p class="muted">'+(item.personalId?'请先在“我的题目 → 管理题目”中补全题型、题干及作答字段。':'该配置题尚缺明确题型或作答字段，暂不能加入练习卷。')+'</p>':'')+'<details class="review-source-preview"><summary>查看完整题目</summary><div class="paper-question-body">'+paperBody(item)+'</div></details></article>').join(''):'<p class="empty-state">当前条件下没有题目，试试调整筛选。</p>';
}
function renderPaperSelected(){
  if(!paperWorkspace||!$('#paper-selected'))return;
  const items=paperWorkspace.items;
  $('#paper-selected-count').textContent='· '+items.length;
  $('#paper-save').disabled=!items.length;$('#paper-preview-draft').disabled=!items.length;
  $('#paper-selected').innerHTML=items.length?items.map((item,i)=>'<article class="paper-question" data-paper-order="'+i+'"><b>'+ (i+1)+'. '+esc(item.title)+'</b><p class="muted">'+esc(paperMeta(item))+'</p>'+(paperSourceStatus(item)?'<p class="paper-source-status">'+esc(paperSourceStatus(item))+'</p>':'')+'<details class="review-source-preview"><summary>查看完整题目</summary><div class="paper-question-body">'+paperBody(item)+'</div></details><div class="paper-order-actions"><button class="text-button" data-paper-move="'+i+'" data-direction="-1"'+(i===0?' disabled':'')+' aria-label="第'+(i+1)+'题上移">上移</button><button class="text-button" data-paper-move="'+i+'" data-direction="1"'+(i===items.length-1?' disabled':'')+' aria-label="第'+(i+1)+'题下移">下移</button><button class="text-button" data-paper-remove="'+i+'">移出本卷</button></div></article>').join(''):'<p class="empty-state">勾选题目后，会按选择顺序放在这里。</p>';
}
function savePaper(){
  if(!paperWorkspace)return;
  const w=paperWorkspace,title=w.title.trim();
  if(!title){toast('请给练习卷起个名字。');$('#paper-title').focus();return;}
  if(!w.items.length){toast('请至少选择一道题。');return;}
  const prior=practicePapers().find(x=>x.id===w.id),now=new Date().toISOString();
  const paper={id:prior?.id||uid(),title,createdAt:prior?.createdAt||now,updatedAt:now,items:paperCopy(w.items),schemaVersion:1};
  const next=prior?practicePapers().map(x=>x.id===paper.id?paper:x):[...practicePapers(),paper];
  if(!paperCommit({practicePapers:next,practicePaperDraft:null})){$('#paper-draft-status').textContent='保存未成功，当前题目和顺序仍保留。';return;}
  paperWorkspace=null;renderCollection();openSavedPaper(paper.id);toast('练习卷已保存。');
}
function openSavedPaper(id){
  const paper=practicePapers().find(x=>x.id===id);if(!paper)return;
  paperWorkspace=null;
  showDialog(paper.title,'<div class="paper-workspace"><div class="paper-list-head"><button class="text-button" id="paper-back">返回练习卷列表</button><div class="paper-reader-actions"><button class="primary-button" data-paper-preview="'+esc(id)+'">查看卷面</button><button class="text-button" data-paper-edit="'+esc(id)+'">编辑练习卷</button></div></div><div class="paper-scroll paper-reader"><div class="paper-reader-meta"><b>'+paper.items.length+' 道题</b><div class="collection-time">'+collectionTimeLine('创建于',paper.createdAt)+(paper.updatedAt!==paper.createdAt?collectionTimeLine('最近修改',paper.updatedAt):'')+'</div></div><p class="muted">按保存时的题面展示。进入来源题目练习时，沿用那道题的作答和学习记录。</p>'+paper.items.map((item,i)=>{
    const status=paperSourceStatus(item);
    return '<article class="paper-question" data-paper-reader="'+i+'"><h3>第 '+(i+1)+' 题 · '+esc(item.title)+'</h3><p class="muted">'+esc(paperMeta(item))+'</p><div class="paper-question-body">'+paperBody(item)+'</div>'+(status?'<p class="paper-source-status">'+esc(status)+'</p>':'')+'<div class="note-actions"><button class="text-button" data-paper-practice="'+i+'" data-paper-id="'+esc(paper.id)+'"'+(status?' disabled':'')+'>去这道题练习</button></div></article>';
  }).join('')+'</div></div>');
  $('#paper-back').onclick=openPaperList;
}
function requestPaperDeletion(id){
  const paper=practicePapers().find(x=>x.id===id);if(!paper)return;
  confirmPermanentAction({title:'永久删除这份练习卷？',description:'只删除这份卷子的名称、顺序和题面副本'+(state.practicePaperDraft?.id===id?'，以及这份卷子的未保存草稿':'')+'；题库里的原题、聊天和学习记录保留。',preview:'<b>'+esc(paper.title)+'</b><p>'+paper.items.length+' 道题</p>',commit:()=>{
    const patch={practicePapers:practicePapers().filter(x=>x.id!==id)};
    if(state.practicePaperDraft?.id===id)patch.practicePaperDraft=null;
    if(!paperCommit(patch))return false;
    renderCollection();openPaperList();return true;
  }});
}
document.addEventListener('change',e=>{
  const key=e.target.dataset.paperSelect;if(!key||!paperWorkspace)return;
  const live=paperLibrary().find(x=>x.key===key);
  if(e.target.checked&&live?.valid&&!paperWorkspace.items.some(x=>x.key===key))paperWorkspace.items.push(paperCopy(live));
  if(!e.target.checked)paperWorkspace.items=paperWorkspace.items.filter(x=>x.key!==key);
  renderPaperSelected();paperUpdateDraft();
});
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!reviewDesktop.matches)return;
  if(b.id==='practice-papers-entry')openPaperList();
  if(b.dataset.paperRead)openSavedPaper(b.dataset.paperRead);
  if(b.dataset.paperEdit){
    if(state.practicePaperDraft&&state.practicePaperDraft.id!==b.dataset.paperEdit){openPaperEditor(state.practicePaperDraft);toast('先继续已有草稿，保存后再编辑其他卷子。');}
    else openPaperEditor(state.practicePaperDraft||practicePapers().find(x=>x.id===b.dataset.paperEdit));
  }
  if(b.dataset.paperDelete)requestPaperDeletion(b.dataset.paperDelete);
  if(b.dataset.paperMove!==undefined&&paperWorkspace){
    const i=+b.dataset.paperMove,j=i+Number(b.dataset.direction),items=paperWorkspace.items;
    if(j<0||j>=items.length)return;
    [items[i],items[j]]=[items[j],items[i]];renderPaperSelected();paperUpdateDraft();
    $('#paper-selected [data-paper-order="'+j+'"] button[data-direction="'+b.dataset.direction+'"]')?.focus();
  }
  if(b.dataset.paperRemove!==undefined&&paperWorkspace){paperWorkspace.items.splice(+b.dataset.paperRemove,1);renderPaperLibrary();renderPaperSelected();paperUpdateDraft();}
  if(b.dataset.paperPractice!==undefined){
    if(busy){toast('请等当前回复完成后再进入练习。');return;}
    const item=practicePapers().find(x=>x.id===b.dataset.paperId)?.items[+b.dataset.paperPractice];
    if(!item||paperSourceStatus(item)){toast('来源已经变化，仍可在卷内查看保存的题面。');return;}
    closeDialog();if(item.personalId)goPersonalPractice(item.personalId);else{const i=questions.findIndex(q=>!q.personal&&q.id===item.questionId);if(i>=0)switchQuestion(i);}
  }
});

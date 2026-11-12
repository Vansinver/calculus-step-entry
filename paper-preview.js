// Shared screen preview for saved question snapshots and unsaved assembly drafts.
let paperPreview=null;
const paperPreviewViews=new Map();
function closePaperPreview(){
  if(!paperPreview)return;
  const current=paperPreview;
  closeThemedMenu();
  paperPreviewViews.set(current.key,{signature:current.signature,side:current.side,scale:current.scale,x:current.x,y:current.y});
  current.overlay.remove();paperPreview=null;document.body.style.overflow=current.overflow;
  if(current.focus?.isConnected)current.focus.focus();
}
function previewQuestion(item,index,continued=false){
  const node=document.createElement('section');node.className='preview-question';node.dataset.previewQuestion=index;
  node.innerHTML='<div class="preview-question-heading"><b>第 '+(index+1)+' 题'+(continued?'（续）':'')+'</b><span>'+esc(exerciseTypes[item.type]||'题型待补')+(item.score?' · 原卷'+esc(item.score):'')+(item.pending?' · 待核验':'')+'</span></div><div class="preview-question-body"></div>';
  return node;
}
function previewUnits(html){
  const root=document.createElement('div');root.innerHTML=html;const units=[];
  for(const node of root.childNodes){
    if(node.nodeType===Node.TEXT_NODE){
      const text=node.textContent;
      for(let i=0;i<text.length;i+=120){const span=document.createElement('span');span.textContent=text.slice(i,i+120);units.push(span);}
    }else units.push(node.cloneNode(true));
  }
  return units;
}
async function openPaperPreview(paper,kind='saved',editing=false,undo=null){
  if(!reviewDesktop.matches||!paper?.items?.length){toast('请先选择题目。');return;}
  if(paperPreview)closePaperPreview();
  const snapshot=paperCopy(paper),key=kind+':'+(paper.id||'new'),signature=JSON.stringify({title:snapshot.title,items:snapshot.items});
  const overlay=document.createElement('section');overlay.id='paper-preview-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','paper-preview-title');
  overlay.innerHTML='<header class="preview-toolbar"><div><h2 id="paper-preview-title">'+esc(snapshot.title||'我的练习卷')+'</h2><p>'+snapshot.items.length+' 道题 · '+(kind==='draft'?'当前编辑草稿':'已保存题面')+'</p></div><div class="preview-tools"><button id="preview-previous" aria-label="上一面">上一面</button><output id="preview-side"></output><button id="preview-next" aria-label="下一面">下一面</button><button id="preview-zoom-out" aria-label="缩小卷面">−</button><output id="preview-zoom"></output><button id="preview-zoom-in" aria-label="放大卷面">＋</button><button id="preview-fit">适应窗口</button><button id="preview-actual">100%</button><button id="preview-center">回到居中</button><button id="preview-close">'+(kind==='draft'?'返回编辑':'返回题目列表')+'</button></div></header><p class="preview-hint">按住卷面拖动查看，整页等比例缩放。左右各有独立页脚；预览不改变题目、顺序或保存内容。可导出数字版PDF；实际打印纸型后续核定。</p><div class="preview-board" id="preview-board" aria-label="可拖动缩放的真实试卷卷面"></div><div id="preview-measure" aria-hidden="true"></div>';
  const view={overlay,key,signature,paper:snapshot,kind,focus:document.activeElement,overflow:document.body.style.overflow,side:0,scale:1,x:0,y:0,sheets:[],drag:null};
  paperPreview=view;document.body.append(overlay);document.body.style.overflow='hidden';
  overlay.querySelector('#preview-close').onclick=closePaperPreview;
  try{await document.fonts.ready;}catch{}
  if(paperPreview!==view)return;
  const measure=overlay.querySelector('#preview-measure'),pages=[],bodies=snapshot.items.map(paperBody);
  const fontWarmup=document.createElement('div');fontWarmup.innerHTML=bodies.join('');measure.append(fontWarmup);
  try{await document.fonts.ready;}catch{}
  if(paperPreview!==view)return;
  fontWarmup.remove();
  const kinds=new Set(snapshot.items.map(x=>x.type)),label=kinds.size===1?(exerciseTypes[snapshot.items[0].type]||'')+'专项':'混合练习';
  function newPage(){
    const page=document.createElement('div');page.className='preview-logical-page';page.dataset.logicalPage=pages.length+1;
    page.innerHTML=(pages.length===0?'<div class="preview-paper-heading"><h3>'+esc(snapshot.title||'我的练习卷')+'</h3><p>'+esc(label)+' · '+snapshot.items.length+' 道题 · 本卷总分待设</p><div class="preview-student-fields"><span>姓名：________</span><span>班级：________</span><span>日期：________</span></div></div>':'<div class="preview-continuation-title">'+esc(snapshot.title||'我的练习卷')+'（续）</div>')+'<div class="preview-page-flow"></div><footer class="preview-page-footer"></footer>';
    measure.append(page);pages.push(page);return page;
  }
  const flow=page=>page.querySelector('.preview-page-flow');
  const over=page=>flow(page).scrollHeight>flow(page).clientHeight+1;
  let page=newPage();
  for(let index=0;index<snapshot.items.length;index++){
    const item=snapshot.items[index],html=bodies[index],question=previewQuestion(item,index);
    question.querySelector('.preview-question-body').innerHTML=html;
    const work=document.createElement('div');work.className='preview-working-space';if(item.type==='solution')work.classList.add('solution');question.append(work);
    flow(page).append(question);
    if(!over(page))continue;
    question.remove();
    if(flow(page).children.length){page=newPage();flow(page).append(question);if(!over(page))continue;question.remove();}
    // Oversized text is split between logical pages; math expressions and ordinary options remain atomic.
    const units=previewUnits(html);let part=previewQuestion(item,index);flow(page).append(part);
    for(const unit of units){
      let body=part.querySelector('.preview-question-body');body.append(unit);
      if(!over(page))continue;
      unit.remove();
      if(body.childNodes.length){page=newPage();part=previewQuestion(item,index,true);flow(page).append(part);body=part.querySelector('.preview-question-body');body.append(unit);}
      else{body.append(unit);}
      if(over(page)){
        // Extreme indivisible objects are fitted on their own page for preview; no source data is discarded.
        const available=Math.max(50,flow(page).clientHeight-part.querySelector('.preview-question-heading').offsetHeight-24);
        const height=Math.max(1,unit.getBoundingClientRect().height);if(unit.nodeType===Node.ELEMENT_NODE)unit.style.zoom=String(Math.min(1,available/height));
      }
    }
  }
  pages.forEach((p,i)=>{p.querySelector('.preview-page-footer').innerHTML=paperFooter('第 '+(i+1)+' 页（共 '+pages.length+' 页）');});
  const board=overlay.querySelector('#preview-board');
  for(let i=0;i<pages.length;i+=2){
    const sheet=document.createElement('article');sheet.className='preview-sheet';sheet.dataset.previewSide=i/2;
    sheet.append(pages[i]);if(pages[i+1])sheet.append(pages[i+1]);else{const blank=document.createElement('div');blank.className='preview-logical-page preview-empty-page';blank.innerHTML='<span>本半页留白</span><footer class="preview-page-footer">'+paperFooter()+'</footer>';sheet.append(blank);}
    board.append(sheet);view.sheets.push(sheet);
  }
  measure.remove();
  function update(){
    if(paperPreview!==view)return;
    view.sheets.forEach((sheet,i)=>{sheet.hidden=i!==view.side;if(i===view.side)sheet.style.transform='translate('+view.x+'px,'+view.y+'px) scale('+view.scale+')';});
    overlay.querySelector('#preview-side').textContent=(view.side+1)+' / '+view.sheets.length+' 面';
    overlay.querySelector('#preview-zoom').textContent=Math.round(view.scale*100)+'%';
    for(const selector of ['#preview-previous','#preview-next','#preview-side'])overlay.querySelector(selector).hidden=view.sheets.length===1;
    overlay.querySelector('#preview-previous').disabled=view.side===0;overlay.querySelector('#preview-next').disabled=view.side===view.sheets.length-1;
    overlay.querySelector('#preview-zoom-out').disabled=view.scale<=.1;overlay.querySelector('#preview-zoom-in').disabled=view.scale>=2;
  }
  function center(){view.x=(board.clientWidth-1200*view.scale)/2;view.y=(board.clientHeight-850*view.scale)/2;update();}
  function fit(){view.scale=Math.max(.1,Math.min(1,(board.clientWidth-36)/1200,(board.clientHeight-36)/850));center();}
  function zoom(next){next=Math.max(.1,Math.min(2,next));const x=board.clientWidth/2,y=board.clientHeight/2;view.x=x-(x-view.x)*next/view.scale;view.y=y-(y-view.y)*next/view.scale;view.scale=next;update();}
  overlay.querySelector('#preview-fit').onclick=fit;overlay.querySelector('#preview-center').onclick=center;overlay.querySelector('#preview-actual').onclick=()=>{view.scale=1;center();};
  overlay.querySelector('#preview-zoom-in').onclick=()=>zoom(view.scale+.1);overlay.querySelector('#preview-zoom-out').onclick=()=>zoom(view.scale-.1);
  overlay.querySelector('#preview-previous').onclick=()=>{if(view.side>0){view.side--;fit();}};overlay.querySelector('#preview-next').onclick=()=>{if(view.side<view.sheets.length-1){view.side++;fit();}};
  board.addEventListener('pointerdown',e=>{if(e.button!==0)return;view.drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:view.x,top:view.y};board.setPointerCapture(e.pointerId);board.classList.add('dragging');});
  board.addEventListener('pointermove',e=>{if(view.drag?.id!==e.pointerId)return;view.x=view.drag.left+e.clientX-view.drag.x;view.y=view.drag.top+e.clientY-view.drag.y;update();});
  const release=e=>{if(view.drag?.id!==e.pointerId)return;view.drag=null;board.classList.remove('dragging');if(board.hasPointerCapture(e.pointerId))board.releasePointerCapture(e.pointerId);};
  board.addEventListener('pointerup',release);board.addEventListener('pointercancel',release);
  view.fit=fit;const saved=paperPreviewViews.get(key);
  if(saved?.signature===signature){Object.assign(view,{side:Math.min(saved.side,view.sheets.length-1),scale:saved.scale,x:saved.x,y:saved.y});update();}else fit();
  installPreviewOrder(view,editing,undo);
  installPaperExport(view);
  overlay.querySelector('#preview-close').focus();
}
document.addEventListener('keydown',e=>{if(paperPreview&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closePaperPreview();}},true);
window.addEventListener('resize',()=>paperPreview?.fit?.());
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!reviewDesktop.matches)return;
  if(b.dataset.paperPreview){const paper=practicePapers().find(x=>x.id===b.dataset.paperPreview);if(paper)openPaperPreview(paper);}
  if(b.id==='paper-preview-draft'&&paperWorkspace)openPaperPreview({id:paperWorkspace.id||'new',title:paperWorkspace.title,items:paperWorkspace.items},'draft');
});

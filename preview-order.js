function installPreviewOrder(view,editing=false,undo=null){
  const root=view.overlay,tools=root.querySelector('.preview-tools');view.orderUndo=undo;
  tools.insertAdjacentHTML('afterbegin','<button id="preview-order-mode">'+(editing?'完成调整':'调整题序')+'</button>');
  root.querySelector('#preview-order-mode').onclick=()=>{
    if(!editing&&view.kind==='saved'){
      if(state.practicePaperDraft&&state.practicePaperDraft.id!==view.paper.id){toast('请先处理另一份组卷草稿，不会覆盖它。');return;}
      const paper=state.practicePaperDraft||view.paper;closePaperPreview();openPaperEditor(paper);openPaperPreview(paper,'draft',true);return;
    }
    openPaperPreview(view.paper,view.kind,!editing,view.orderUndo);
  };
  if(!editing)return;
  root.classList.add('preview-reordering');root.querySelector('.preview-hint').textContent='拖动题目手柄换序；空白处拖动卷面。整道题一起移动，放下后自动分页。改动仅存草稿，请返回编辑后保存。';
  tools.insertAdjacentHTML('beforeend','<button id="preview-order-undo"'+(undo?'':' disabled')+'>撤销移动</button><label>选题 <select id="preview-order-source">'+view.paper.items.map((x,i)=>'<option value="'+i+'">第'+(i+1)+'题</option>').join('')+'</select></label><label>移到 <select id="preview-order-target">'+view.paper.items.map((x,i)=>'<option value="'+i+'">第'+(i+1)+'位</option>').join('')+'</select></label><button id="preview-order-apply">移动</button>');
  const commit=items=>{
    if(!paperWorkspace)return false;
    if(!paperCommit({practicePaperDraft:{id:paperWorkspace.id,title:paperWorkspace.title,items:paperCopy(items)}}))return false;
    paperWorkspace.items=paperCopy(items);renderPaperSelected();return true;
  };
  const move=(from,to)=>{if(from===to){toast('题目已在这个位置，无需移动。');return;}if(!view.paper.items[from]||!view.paper.items[to])return;const prior=paperCopy(view.paper.items),items=paperCopy(prior),[item]=items.splice(from,1);items.splice(to,0,item);if(!commit(items))return;openPaperPreview({...view.paper,items},'draft',true,prior);};
  root.querySelector('#preview-order-undo').onclick=()=>{if(view.orderUndo&&commit(view.orderUndo))openPaperPreview({...view.paper,items:view.orderUndo},'draft',true,view.paper.items);};
  root.querySelector('#preview-order-apply').onclick=()=>move(+root.querySelector('#preview-order-source').value,+root.querySelector('#preview-order-target').value);
  const source=root.querySelector('#preview-order-source'),target=root.querySelector('#preview-order-target'),apply=root.querySelector('#preview-order-apply');
  const syncMove=()=>{apply.disabled=source.value===target.value;apply.textContent=apply.disabled?'已在此位置':'移动';};source.addEventListener('change',syncMove);target.addEventListener('change',syncMove);syncMove();
  let from=null;
  root.querySelectorAll('[data-preview-question]').forEach(node=>{
    const index=+node.dataset.previewQuestion,handle=document.createElement('span');handle.className='preview-order-handle';handle.textContent='⠿ 拖动第'+(index+1)+'题';handle.draggable=true;handle.tabIndex=0;handle.setAttribute('role','button');handle.setAttribute('aria-label','拖动第'+(index+1)+'题，或用上方选题移动');
    node.querySelector('.preview-question-heading').prepend(handle);
    handle.onpointerdown=e=>e.stopPropagation();
    handle.ondragstart=e=>{from=index;e.dataTransfer.setData('text/plain',String(index));e.dataTransfer.effectAllowed='move';node.classList.add('preview-order-lifted');};
    handle.ondragend=()=>{from=null;root.querySelectorAll('.preview-order-target,.preview-order-lifted').forEach(n=>n.classList.remove('preview-order-target','preview-order-lifted'));};
    node.ondragover=e=>{if(from===null)return;e.preventDefault();root.querySelectorAll('.preview-order-target').forEach(n=>n.classList.remove('preview-order-target'));node.classList.add('preview-order-target');};
    node.ondrop=e=>{e.preventDefault();node.classList.remove('preview-order-target');if(from!==null)move(from,index);};
  });
}

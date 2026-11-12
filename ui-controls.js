// Shared desktop form menus; native controls remain the data source and touch fallback.
const themedDesktop=matchMedia('(hover: hover) and (pointer: fine)');
const themedEntries=new Map();
let themedPopup=null,themedActive=null,themedIndex=0,themedItems=[],themedSearch='',themedSearchTimer;
function themedLabel(node) {
  const label=node.labels?.[0];if(!label)return node.getAttribute('aria-label')||'选择';
  const clone=label.cloneNode(true);clone.querySelectorAll('select,input,.themed-select').forEach(x=>x.remove());
  return clone.textContent.trim()||'选择';
}
function closeThemedMenu() {
  if(themedPopup)themedPopup.hidden=true;
  if(themedActive)themedActive.control.setAttribute('aria-expanded','false');
  themedActive=null;themedItems=[];themedSearch='';
}
function ensureThemedPopup() {
  if(themedPopup)return;
  themedPopup=document.createElement('div');themedPopup.id='themed-select-popup';themedPopup.className='themed-select-popup';themedPopup.hidden=true;themedPopup.setAttribute('role','listbox');document.body.append(themedPopup);
  themedPopup.addEventListener('mousedown',e=>e.preventDefault());
  themedPopup.addEventListener('click',e=>{const option=e.target.closest('[data-themed-index]');if(option)chooseThemedItem(+option.dataset.themedIndex);});
}
function refreshThemedEntry(entry) {
  const {node,control}=entry;
  if(entry.kind==='select') {
    const text=node.selectedOptions[0]?.textContent||'';
    if(control.querySelector('.themed-select-value').textContent!==text)control.querySelector('.themed-select-value').textContent=text;
    control.disabled=node.disabled;
    control.setAttribute('aria-label',entry.label+'：'+text);
  }
}
function availableThemedItems(entry) {
  if(entry.kind==='select')return Array.from(entry.node.options,(x,index)=>({value:x.value,text:x.textContent,index,disabled:x.disabled||x.parentElement.disabled,selected:x.selected}));
  const text=entry.node.value,last=Math.max(...['、','，',',',';','；','·'].map(x=>text.lastIndexOf(x)));
  entry.prefix=last<0?'':text.slice(0,last+1);const query=text.slice(last+1).trim().toLocaleLowerCase();
  const list=document.getElementById(entry.listId);
  return Array.from(list?.options||[],x=>({value:x.value,text:x.label||x.value,disabled:false,selected:false})).filter(x=>!query||x.value.toLocaleLowerCase().includes(query)).slice(0,80);
}
function highlightThemedItem(index) {
  themedIndex=index;
  themedPopup.querySelectorAll('[role=option]').forEach((x,i)=>x.classList.toggle('is-active',i===index));
  const active=themedPopup.querySelector('[data-themed-index="'+index+'"]');
  if(active){themedActive.control.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});}
}
function openThemedMenu(entry) {
  if(!themedDesktop.matches||entry.node.disabled)return;
  if(themedActive!==entry)closeThemedMenu();
  ensureThemedPopup();themedActive=entry;themedItems=availableThemedItems(entry);
  if(!themedItems.length){closeThemedMenu();return;}
  themedPopup.innerHTML=themedItems.map((x,i)=>'<div id="themed-option-'+i+'" class="themed-option'+(x.selected?' is-selected':'')+'" role="option" aria-selected="'+!!x.selected+'" aria-disabled="'+!!x.disabled+'" data-themed-index="'+i+'"><span>'+esc(x.text)+'</span>'+(x.selected?'<span aria-hidden="true">✓</span>':'')+'</div>').join('');
  themedPopup.setAttribute('aria-label',entry.label);themedPopup.hidden=false;
  entry.control.setAttribute('aria-controls',themedPopup.id);entry.control.setAttribute('aria-expanded','true');
  const rect=entry.control.getBoundingClientRect(),below=innerHeight-rect.bottom-12,above=rect.top-12;
  const aboveMenu=below<Math.min(230,themedItems.length*44)&&above>below;
  const maxHeight=Math.min(330,Math.max(70,aboveMenu?above-6:below-6));
  const width=Math.min(Math.max(rect.width,180),innerWidth-24);
  Object.assign(themedPopup.style,{width:width+'px',maxHeight:maxHeight+'px',left:Math.max(12,Math.min(rect.left,innerWidth-width-12))+'px',top:'0px'});
  const height=themedPopup.getBoundingClientRect().height;
  themedPopup.style.top=(aboveMenu?Math.max(12,rect.top-height-6):rect.bottom+6)+'px';
  let index=themedItems.findIndex(x=>x.selected&&!x.disabled);if(index<0)index=themedItems.findIndex(x=>!x.disabled);
  highlightThemedItem(index);
}
function chooseThemedItem(index) {
  const item=themedItems[index],entry=themedActive;if(!entry||!item||item.disabled)return;
  closeThemedMenu();entry.control.focus();entry.suppress=true;
  try {
    if(entry.kind==='select'){entry.node.selectedIndex=item.index;refreshThemedEntry(entry);}
    else entry.node.value=entry.prefix+item.value;
    entry.node.dispatchEvent(new Event('input',{bubbles:true}));entry.node.dispatchEvent(new Event('change',{bubbles:true}));
  }finally{entry.suppress=false;}
}
function themedKeydown(event,entry) {
  const open=themedActive===entry;
  if(event.key==='Escape'&&open){event.preventDefault();event.stopImmediatePropagation();closeThemedMenu();return;}
  if(event.key==='Tab'){if(open)closeThemedMenu();return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
    event.preventDefault();if(!open){openThemedMenu(entry);return;}
    const usable=themedItems.map((x,i)=>x.disabled?-1:i).filter(x=>x>=0);if(!usable.length)return;
    let pos=usable.indexOf(themedIndex),next=event.key==='Home'?0:event.key==='End'?usable.length-1:(pos+(event.key==='ArrowDown'?1:-1)+usable.length)%usable.length;
    highlightThemedItem(usable[next]);return;
  }
  if((event.key==='Enter'||(event.key===' '&&entry.kind==='select'))&&!event.isComposing) {
    event.preventDefault();if(open)chooseThemedItem(themedIndex);else openThemedMenu(entry);return;
  }
  if(entry.kind==='select'&&event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey) {
    event.preventDefault();if(!open)openThemedMenu(entry);
    clearTimeout(themedSearchTimer);themedSearch+=event.key.toLocaleLowerCase();themedSearchTimer=setTimeout(()=>themedSearch='',650);
    const found=themedItems.findIndex(x=>!x.disabled&&x.text.toLocaleLowerCase().startsWith(themedSearch));if(found>=0)highlightThemedItem(found);
  }
}
function installThemedControl(node) {
  if(themedEntries.has(node)||!themedDesktop.matches)return;
  if(node.tagName==='SELECT') {
    const label=themedLabel(node),wrapper=document.createElement('span');wrapper.className='themed-select';
    const control=document.createElement('button');control.type='button';control.className='themed-select-trigger';control.innerHTML='<span class="themed-select-value"></span><span class="themed-select-arrow" aria-hidden="true">⌄</span>';
    control.setAttribute('role','combobox');control.setAttribute('aria-haspopup','listbox');control.setAttribute('aria-expanded','false');
    const entry={kind:'select',node,control,label,oldTab:node.getAttribute('tabindex')};themedEntries.set(node,entry);
    node.classList.add('themed-select-native');node.before(wrapper);wrapper.append(node,control);node.tabIndex=-1;
    control.onclick=e=>{e.preventDefault();themedActive===entry?closeThemedMenu():openThemedMenu(entry);};
    control.addEventListener('keydown',e=>themedKeydown(e,entry));refreshThemedEntry(entry);
  } else if(node.matches('input[list]')) {
    const entry={kind:'suggestions',node,control:node,label:themedLabel(node),listId:node.getAttribute('list')};themedEntries.set(node,entry);
    node.removeAttribute('list');node.setAttribute('role','combobox');node.setAttribute('aria-autocomplete','list');node.setAttribute('aria-expanded','false');
    node.addEventListener('focus',()=>{if(themedDesktop.matches)openThemedMenu(entry);});
    node.addEventListener('input',()=>{if(!entry.suppress&&themedDesktop.matches)openThemedMenu(entry);});
    node.addEventListener('keydown',e=>{if(themedDesktop.matches)themedKeydown(e,entry);});
  }
}
function syncThemedControls() {
  if(themedActive&&!themedActive.node.isConnected)closeThemedMenu();
  for(const [node,entry] of themedEntries) {
    if(!node.isConnected){themedEntries.delete(node);continue;}
    if(themedDesktop.matches){if(entry.kind==='select'){node.tabIndex=-1;refreshThemedEntry(entry);}else node.removeAttribute('list');}
    else if(entry.kind==='select'){entry.oldTab===null?node.removeAttribute('tabindex'):node.setAttribute('tabindex',entry.oldTab);}
    else node.setAttribute('list',entry.listId);
  }
  if(themedDesktop.matches)document.querySelectorAll('select,input[list]').forEach(installThemedControl);
}
const themedObserver=new MutationObserver(records=>{
  let scan=false;
  for(const record of records){
    const node=record.target.nodeType===1?record.target:record.target.parentElement;
    if(node?.matches('select,option,optgroup')||node?.closest('select'))scan=true;
    for(const added of record.addedNodes)if(added.nodeType===1&&(added.matches('select,input[list]')||added.querySelector('select,input[list]')))scan=true;
  }
  if(scan)syncThemedControls();
  if(themedActive&&!themedActive.node.isConnected)closeThemedMenu();
});
themedObserver.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected','label'],characterData:true});
themedDesktop.addEventListener('change',()=>{closeThemedMenu();syncThemedControls();});
document.addEventListener('change',e=>{const entry=themedEntries.get(e.target);if(entry)refreshThemedEntry(entry);},true);
document.addEventListener('pointerdown',e=>{if(themedActive&&!themedActive.control.contains(e.target)&&!themedPopup?.contains(e.target))closeThemedMenu();},true);
document.addEventListener('scroll',e=>{if(themedActive&&!themedPopup.contains(e.target))closeThemedMenu();},true);
window.addEventListener('resize',closeThemedMenu);
document.addEventListener('click',e=>{
  const label=e.target.closest('label[for]');if(!label||!themedDesktop.matches)return;
  const entry=themedEntries.get(document.getElementById(label.htmlFor));if(entry?.kind==='select'){e.preventDefault();entry.control.focus();}
});
syncThemedControls();

// Permanent actions use a separate confirmation layer, preserving any underlying dialog.
let permanentConfirmation=null;
function confirmPermanentAction({title,description,preview='',commit}) {
  if(permanentConfirmation)return;
  closeThemedMenu();
  const previousFocus=document.activeElement,previousOverflow=document.body.style.overflow;
  const overlay=document.createElement('div');overlay.id='permanent-confirm-overlay';overlay.className='permanent-confirm-overlay';
  overlay.innerHTML='<section class="permanent-confirm-sheet" role="alertdialog" aria-modal="true" aria-labelledby="permanent-confirm-title" aria-describedby="permanent-confirm-description"><h2 id="permanent-confirm-title">'+esc(title)+'</h2><p id="permanent-confirm-description">'+esc(description)+'</p>'+(preview?'<div class="permanent-confirm-preview">'+preview+'</div>':'')+'<p id="permanent-confirm-error" class="error" hidden role="alert"></p><div class="permanent-confirm-actions"><button type="button" id="cancel-permanent-action" class="secondary-button">取消</button><button type="button" id="confirm-permanent-action" class="primary-button">确认永久移除</button></div></section>';
  permanentConfirmation={overlay,previousFocus,previousOverflow};document.body.append(overlay);document.body.style.overflow='hidden';
  const cancel=overlay.querySelector('#cancel-permanent-action'),confirm=overlay.querySelector('#confirm-permanent-action');
  function finish() {
    overlay.remove();permanentConfirmation=null;document.body.style.overflow=previousOverflow;
    if(previousFocus?.isConnected)previousFocus.focus();else document.querySelector(page==='collection'?'#nav-collection':'#new-note')?.focus();
  }
  cancel.onclick=finish;overlay.onclick=e=>{if(e.target===overlay)finish();};
  confirm.onclick=()=>{confirm.disabled=true;try{if(commit()!==false)finish();else{const error=overlay.querySelector('#permanent-confirm-error');error.hidden=false;error.textContent='未能保存这次操作，内容仍保留，请重试或取消。';}}catch{const error=overlay.querySelector('#permanent-confirm-error');error.hidden=false;error.textContent='未能完成移除，内容仍保留。';}finally{if(confirm.isConnected)confirm.disabled=false;}};
  overlay.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();(document.activeElement===cancel?confirm:cancel).focus();}});
  cancel.focus();
}
document.addEventListener('keydown',e=>{
  if(!permanentConfirmation)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();permanentConfirmation.overlay.querySelector('#cancel-permanent-action').click();}
},true);
function requestSavedItemRemoval(id) {
  const item=state.saved.find(x=>x.id===id);if(!item)return;
  const commit=()=>{
    const next=state.saved.filter(x=>x.id!==id);
    try{localStorage.setItem(KEY,JSON.stringify({...state,saved:next}));}catch{return false;}
    state.saved=next;renderNotes();renderCollection();renderQuestion();return true;
  };
  if(!themedDesktop.matches||item.type==='题目'){if(!commit())toast('未能保存操作，内容仍保留。');return;}
  confirmPermanentAction({title:'永久移除这条学习记录？',description:'这条“'+item.type+'”移除后无法恢复。题目收藏和原始聊天会保留。',preview:itemContent(item),commit});
}

// Verified, self-written textbook summaries. Private source photographs stay outside runtime assets.
const personalTextbookCatalog=[
  {id:'inverse-definition-p9',revision:1,title:'反函数的定义与对应关系',pages:'9',chapter:'第一章第一节 · 反函数',
    reading:'先读反函数的定义，分清原函数的定义域和值域如何交换。',
    summary:'原函数在给定定义域上满足一一对应时，反过来的对应关系才能构成反函数。反函数的定义域是原函数的值域，反函数的值域是原函数的定义域。这里的“反”是对应关系的反向，不是函数值取倒数。',
    concepts:['反函数','定义域','值域'],promptDrafts:['这题里的两个变量分别表示什么？','怎样从原函数的对应关系写出反过来的对应？']},
  {id:'arcsin-definition-p10',revision:1,title:'反正弦函数及取值约定',pages:'10',chapter:'第一章第一节 · 反函数',
    reading:'看反正弦的定义和图1-11，区分输入的数值与输出的角，并核对端点。',
    summary:String.raw`教材先把正弦限制在 \([-\dfrac{\pi}{2},\dfrac{\pi}{2}]\) 上，再定义其反函数。反正弦的输入范围为 \([-1,1]\)，输出角度范围为 \([-\dfrac{\pi}{2},\dfrac{\pi}{2}]\)。这是概念定义，不等于任何复合题的完整答案；还应检查当前题自己的条件。`,
    concepts:['反正弦函数','反函数','定义域','值域'],promptDrafts:['题目中反正弦的输入是哪个表达式？','怎样用图像或特殊值检查端点？']},
  {id:'arccot-definition-p11',revision:1,title:'反余切函数与分支约定',pages:'11',chapter:'第一章第一节 · 反三角函数',
    reading:'核对cot所选区间，再按反函数关系区分输入范围和输出角的范围。',
    summary:String.raw`教材把余切限制在 \((0,\pi)\) 上定义反余切，所得 \(y=\operatorname{arccot}x\) 的定义域为 \((-\infty,+\infty)\)，值域为 \((0,\pi)\)。应用到具体题时先确认其采用这一约定；不能把其他分支的结论直接混用。`,
    concepts:['反余切函数','反函数','定义域','值域'],promptDrafts:['这里的arccot怎样由cot反过来定义？','怎样把原函数所选区间和值域对应到反函数？','能用一个特殊值检查自己写出的范围吗？']},
  {id:'arctan-definition-p11',revision:1,title:'反正切函数的定义',pages:'11',chapter:'第一章第一节 · 反三角函数',reading:'看正切所选区间及反正切的定义，区分输入数值与输出角。',summary:String.raw`教材将正切限制在 \((-\dfrac{\pi}{2},\dfrac{\pi}{2})\) 上定义反正切，反正切的定义域是实数，值域为该开区间。复合题仍需另外检查分母等条件。`,concepts:['反正切函数','反函数','定义域','值域'],promptDrafts:[]},
  {id:'function-domain-p4-5',revision:1,title:'函数、定义域与自然定义域',pages:'4—5',chapter:'第一章第一节 · 函数',reading:'看函数定义、定义域和值域，以及自然定义域的说明。',summary:'函数须对定义域中的每个输入给出唯一确定的函数值。只有表达式而没有另行限制时，自然定义域取使表达式有意义的所有实数；分母、根式和复合运算的限制应结合本题检查。',concepts:['函数','定义域','值域','分母','自然定义域'],promptDrafts:[]},
  {id:'composite-function-p11',revision:1,title:'复合函数及输入范围',pages:'11',chapter:'第一章第一节 · 复合函数',reading:'对照复合函数定义，检查内层输出能否作为外层输入。',summary:'将一个函数的输出作为另一个函数的输入得到复合函数。内层表达式需有意义，其输出还要落在外层函数定义域内；不能只检查一层。',concepts:['复合函数','定义域','内层','外层'],promptDrafts:[]},
  {id:'infinity-definition-p32-33',revision:1,title:'无穷大与正负无穷大的定义',pages:'32—33',chapter:'第一章第二节 · 无穷大',reading:'核对量词、趋近过程与不等式方向，区分无穷大和正/负无穷大。',summary:String.raw`无穷大描述一个趋近过程中的函数行为。对任意给定正数 \(M\)，最终绝对值大于 \(M\)。正无穷大要求最终 \(f(x)>M\)，负无穷大要求最终 \(f(x)<-M\)，并按题目趋近方向写邻域或阈值条件。`,concepts:['无穷大','负无穷大','正无穷大','极限','量词'],promptDrafts:[]},
  {id:'derivative-definition-p66-67',revision:1,title:'导数定义与实际增量',pages:'66—67',chapter:'第二章第一节 · 导数的概念',reading:'对照增量式与另一种导数定义写法，核对实际输入增量和分母。',summary:String.raw`导数是差商在输入增量趋零时的极限，需该有限极限存在。常用式为 \(f'(x_0)=\lim_{h\to0}\dfrac{f(x_0+h)-f(x_0)}{h}\)，也可写为 \(\lim_{x\to x_0}\dfrac{f(x)-f(x_0)}{x-x_0}\)。题目若改用其他增量，需核对分子实际增量与分母的对应。`,concepts:['导数','导数定义','增量','差商','求导'],promptDrafts:[]},
].map(x=>({...x,book:'《高等数学（本科少学时类型）》第五版上册',verification:'body_verified',checkedAt:'2026-11-07'}));

if(reviewDesktop.matches){
  for(const resource of reviewedTextbookResources){
    const existing=personalTextbookCatalog.findIndex(item=>item.id===resource.id);
    if(existing===-1)personalTextbookCatalog.push(resource);
    else personalTextbookCatalog[existing]=resource;
  }
}

function currentTextbookCatalog(){return reviewDesktop.matches?reviewedTextbookResources:personalTextbookCatalog;}

function personalTeachingRevisions(item){return state.personalTeaching?.[item.id]?.[personalSignature(item)]||[];}
function personalTeachingContext(item,message=''){
  if(reviewDesktop.matches)return reviewedTeachingContext(item,message);
  const body=partsText(item.parts||partsFromText(item.body||''));
  const normalize=x=>String(x||'').toLowerCase().replace(/\s+/g,'');
  const main=normalize(body+' '+(item.options||[]).join(' ')),query=normalize(message),tags=normalize((item.knowledgePoints||[]).join(' '));
  const aliases={
    'inverse-definition-p9':['反函数','一一对应','inverse'],
    'arcsin-definition-p10':['反正弦','arcsin','asin'],
    'arccot-definition-p11':['反余切','arccot','acot'],
    'arctan-definition-p11':['反正切','arctan','atan'],
    'function-domain-p4-5':['定义域','值域','分母','根式','自然定义域'],
    'composite-function-p11':['复合','内层','外层'],
    'infinity-definition-p32-33':['无穷','infty','极限','forall','exists'],
    'derivative-definition-p66-67':['导数','求导','差商','增量',"f'",'dy','dx']
  };
  const ranked=personalTextbookCatalog.map(resource=>{
    let score=0;for(const word of aliases[resource.id]||resource.concepts){if(main.includes(word))score+=6;if(query.includes(word))score+=4;if(tags.includes(word))score+=1;}
    return {resource,score};
  }).sort((a,b)=>b.score-a.score);
  // A small verified library can be passed as a semantic fallback when terminology is unfamiliar.
  const hits=ranked.filter(x=>x.score>0),chosen=hits.length?hits.slice(0,6):ranked;
  return {selection:'automatic_retrieval',questionSignature:personalSignature(item),retrieval:{method:hits.length?'keyword_recall_then_model_relevance':'small_library_semantic_review',catalogSize:personalTextbookCatalog.length,scope:'已核概念摘要小库，非整本教材'},resources:chosen.map(({resource:{promptDrafts,...resource},score})=>({...structuredClone(resource),retrievalScore:score}))};
}
function personalTeachingStatus(item){return '私教会按当前题目自动查找已核教材，无需选择或配置。';}
function personalResourceCard(resource,label='已核教材资料',compact=false){
  return '<aside class="tutor-card tutor-source personal-source-card" data-personal-resource="'+esc(resource.id)+'">'+(compact?'':'<strong>'+esc(label)+' · 印刷第 '+esc(resource.pages)+' 页</strong>')+'<p>'+esc(resource.book)+'</p><p>'+esc(resource.chapter)+(compact?'':' · '+esc(resource.title))+'</p><p>'+esc(resource.reading)+'</p>'+(resource.summary?'<details><summary>查看已核要点</summary><div>'+renderMessage(resource.summary)+'</div><p class="muted">项目自编摘要；资料已核不代表当前个人题已核验。</p></details>':'')+'</aside>';
}
function appendPersonalSources(body,message){
  if(message.role!=='assistant'||!Array.isArray(message.personalSources))return;
  for(const ref of message.personalSources){
    // Only render a source snapshot created from the platform catalog, not a raw model object.
    if(!personalTextbookCatalog.some(x=>x.id===ref.id)||!ref.book||!ref.pages)continue;
    const box=document.createElement('div');box.innerHTML='<details class="textbook-citation"><summary>教材出处 · 印刷第 '+esc(ref.pages)+' 页</summary>'+personalResourceCard(ref,'本次回复引用')+'</details>';body.after(box);body=box;
  }
}
function readPersonalTeachingReply(raw,context){
  const ids=[];
  const text=raw.replace(/\[\[personal-source:([^\]\r\n]*)\]\]/gi,(_,value)=>{
    for(const id of value.split(/[,，;；\s]+/).filter(Boolean))if(ids.length<2&&context.resources.some(x=>x.id===id)&&!ids.includes(id))ids.push(id);
    return '';
  }).trim();
  return {text,resources:ids.map(id=>structuredClone(context.resources.find(x=>x.id===id)))};
}
function openPersonalTeaching(id){
  if(!reviewDesktop.matches)return;
  const item=personalExercises().find(x=>x.id===id);if(!item||item.deletedAt){toast('请先恢复这道题。');return;}
  const index=questions.findIndex(x=>x.personalId===id),signature=personalSignature(item);
  const recent=(state.tutors[index]||[]).slice().reverse().find(x=>x.role==='assistant'&&x.signature===signature&&x.personalSources?.length);
  showDialog('教材与出处','<div class="review-scope-workspace personal-resource-workspace"><div class="review-scope-content"><h3>'+esc(item.title)+'</h3><p>私教收到题目后会自动检索并判断资料是否适用；你可以直接在聊天里问“教材哪里讲这个知识点”。</p><p class="muted">当前可查 '+currentTextbookCatalog().length+' 项已核概念摘要。找不到适用依据时会说明范围不足，不要求你选教材，也不猜页码。</p>'+(recent?'<h3>本题最近回复引用的依据</h3>'+recent.personalSources.map(x=>personalResourceCard(x,'回复当时引用')).join(''):'<p class="muted">本题当前题面还没有带出处的回复，可以直接向私教提问。</p>')+'<details class="personal-catalog"><summary>查看当前已核教材目录 · '+currentTextbookCatalog().length+' 项</summary><div class="review-scope-grid">'+currentTextbookCatalog().map(x=>personalResourceCard(x)).join('')+'</div></details><p class="muted">若引用不适用，可直接在聊天中指出；资料原页已核与本题数学已核分别判断。</p></div></div>');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-manage-personal-resources]');if(b)openPersonalTeaching(b.dataset.managePersonalResources);});

// Shared brand; all PDF processing stays in this browser.
const paperBrand=Object.freeze({studio:'梵知',paperMark:'梵知高数·一步一步'});
function paperFooter(number=''){return '<span class="preview-page-number">'+esc(number)+'</span><span class="preview-brand" aria-label="'+esc(paperBrand.paperMark)+'"><img class="paper-brand-wordmark" src="assets/brand/wordmark-b.png" alt="梵知" width="38" height="19"><span>高数·一步一步</span></span>';}
let paperPDFBusy=false,paperCanvasLoader=null;
function loadPaperCanvas(){
  if(window.html2canvas)return Promise.resolve();
  if(!paperCanvasLoader)paperCanvasLoader=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='vendor/html2canvas/html2canvas.min.js';script.onload=resolve;
    script.onerror=()=>{script.remove();paperCanvasLoader=null;reject(Error('PDF组件暂未加载，请重试。'));};document.head.append(script);
  });return paperCanvasLoader;
}
// Minimal image-only PDF writer: stream lengths and xref offsets count bytes.
function paperImagePDF(images){
  const encode=s=>new TextEncoder().encode(s),chunks=[],offsets=[0];let length=0;
  const push=b=>{chunks.push(b);length+=b.length;};push(encode('%PDF-1.4\n%Fanzhi\n'));
  const object=(id,parts)=>{offsets[id]=length;push(encode(id+' 0 obj\n'));parts.forEach(p=>push(typeof p==='string'?encode(p):p));push(encode('\nendobj\n'));};
  object(1,['<< /Type /Catalog /Pages 2 0 R >>']);object(2,['<< /Type /Pages /Count '+images.length+' /Kids ['+images.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>']);
  images.forEach((image,i)=>{
    const page=3+i*3,imageId=page+1,streamId=page+2;
    object(page,['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 900 637.5] /Resources << /XObject << /Im0 '+imageId+' 0 R >> >> /Contents '+streamId+' 0 R >>']);
    object(imageId,['<< /Type /XObject /Subtype /Image /Width '+image.width+' /Height '+image.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+image.bytes.length+' >>\nstream\n',image.bytes,'\nendstream']);
    const content='q\n900 0 0 637.5 0 0 cm\n/Im0 Do\nQ\n';object(streamId,['<< /Length '+encode(content).length+' >>\nstream\n'+content+'endstream']);
  });const xref=length;push(encode('xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n'));return new Blob(chunks,{type:'application/pdf'});
}
function installPaperExport(view){
  const button=document.createElement('button');button.id='preview-export-pdf';button.textContent='导出PDF';button.disabled=paperPDFBusy;view.overlay.querySelector('.preview-tools').append(button);
  button.onclick=async()=>{
    if(paperPDFBusy)return;if(view.drag){toast('请先放下当前拖动的卷面，再导出。');return;}
    const snapshot=paperCopy(view.paper),sheets=view.sheets.map(x=>x.cloneNode(true));paperPDFBusy=true;button.disabled=true;button.textContent='正在生成…';
    const host=document.createElement('div');host.setAttribute('aria-hidden','true');host.style.cssText='position:fixed;left:0;top:0;width:1200px;height:850px;z-index:-1000;pointer-events:none;background:white';document.body.append(host);
    try{
      await loadPaperCanvas();await document.fonts.ready;const images=[];if(sheets.length>50)throw Error('卷面超过50面，请减少题目后导出。');
      for(let i=0;i<sheets.length;i++){
        button.textContent='正在生成 '+(i+1)+'/'+sheets.length;const sheet=sheets[i];sheet.removeAttribute('hidden');sheet.style.cssText='position:relative;left:0;top:0;transform:none;box-shadow:none;border-color:transparent;margin:0';sheet.querySelectorAll('.preview-order-handle').forEach(n=>n.remove());host.replaceChildren(sheet);
        const canvas=await html2canvas(sheet,{scale:3.125,width:1200,height:850,backgroundColor:'#fff',logging:false,allowTaint:false,useCORS:false,windowWidth:1400,windowHeight:1000});
        const binary=atob(canvas.toDataURL('image/jpeg',.98).split(',')[1]),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));images.push({bytes,width:canvas.width,height:canvas.height});canvas.width=canvas.height=0;
      }
      const blob=paperImagePDF(images),url=URL.createObjectURL(blob),link=document.createElement('a'),date=new Date(),day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
      const title=String(snapshot.title||'我的练习卷').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').slice(0,70)||'我的练习卷';link.href=url;link.download=title+'-'+day+'.pdf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('PDF已生成，已发起下载。');
    }catch(error){toast(error.message||'PDF生成未完成，卷子和草稿仍保留，请重试。');}
    finally{host.remove();paperPDFBusy=false;document.querySelectorAll('#preview-export-pdf').forEach(b=>{b.disabled=false;b.textContent='导出PDF';});}
  };
}

// Desktop brand placement only. Phone UI remains on its existing version.
const brandHeader=document.querySelector('.brand-row'),brandSymbol=brandHeader?.querySelector('.brand'),brandTitle=brandHeader?.querySelector('strong');
const priorBrandMarkup=brandHeader?{symbol:brandSymbol.innerHTML,title:brandTitle.innerHTML}:null;
let brandFavicon=null;
function syncPlatformBrand(){
  if(!brandHeader)return;
  const desktop=reviewDesktop.matches;brandHeader.classList.toggle('fanzhi-brand-header',desktop);
  if(desktop){
    brandSymbol.innerHTML='<img src="assets/brand/symbol-a.png" alt="梵知图形标志" width="40" height="40">';
    brandTitle.innerHTML='<img class="fanzhi-wordmark" src="assets/brand/wordmark-b.png" alt="梵知" width="54" height="27"><span class="fanzhi-product">高数·一步一步</span>';
    if(!brandFavicon){brandFavicon=document.createElement('link');brandFavicon.rel='icon';brandFavicon.type='image/png';brandFavicon.sizes='32x32';brandFavicon.href='assets/brand/favicon-32.png';document.head.append(brandFavicon);}
  }else{
    brandSymbol.innerHTML=priorBrandMarkup.symbol;brandTitle.innerHTML=priorBrandMarkup.title;brandFavicon?.remove();brandFavicon=null;
  }
  Promise.all([...brandHeader.querySelectorAll('img')].map(x=>x.decode().catch(()=>{}))).then(()=>{if(typeof updateHeaderHeight==='function')updateHeaderHeight();});
}
reviewDesktop.addEventListener('change',syncPlatformBrand);syncPlatformBrand();

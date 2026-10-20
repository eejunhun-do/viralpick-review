/* Product identity & page access at the top of Threads / Instagram studios. */
(function(){
'use strict';
function render(){
 const p=typeof selected!=='undefined'?selected:null;
 for(const key of ['threads','instagram']){
  const box=document.querySelector('#'+key+' .vpStudioCurrentProduct');if(!box)continue;
  let img=box.querySelector('.vpStudioProductThumb');
  if(!img){img=document.createElement('img');img.className='vpStudioProductThumb';img.alt='현재 작업 중인 상품의 대표 이미지';img.referrerPolicy='no-referrer';box.prepend(img)}
  let url='';
  try{
   const parsed=new URL(p?.imageUrl||'');
   if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&parsed.hostname.includes('.')&&!['localhost','127.0.0.1'].includes(parsed.hostname))url=parsed.href;
  }catch{}
  if(!url){
   const own=typeof liveMedia!=='undefined'?liveMedia.get(p?.id)?.product:null;
   if(own?.kind==='licensed-upload'&&/^data:image\/(?:png|webp|jpeg);base64,/.test(own.data||''))url=own.data;
  }
  img.onerror=()=>{img.hidden=true;img.title='상품 이미지 서버에서 사진을 불러오지 못했습니다.'};
  img.hidden=!url;
  if(url){if(img.src!==url){img.hidden=false;img.src=url}}else img.removeAttribute('src');
  let page=box.querySelector('.vpStudioProductLink');
  if(!page){
   page=document.createElement('button');page.type='button';page.className='btn vpStudioProductLink';
   page.textContent='상품 페이지 열기 ↗';page.onclick=()=>window.openSelectedProductPage?.();
   const change=[...box.querySelectorAll('button')].find(b=>b.textContent.includes('상품 변경'));
   if(change)change.after(page);else box.append(page);
  }
  const href=(typeof partnerLink==='function'?partnerLink(p):null)||p?.originalUrl||'';
  page.disabled=!(typeof isCoupangProductLink==='function'&&isCoupangProductLink(href));
  page.title=page.disabled?'등록된 쿠팡 상품 페이지가 없습니다.':'쿠팡 상품 페이지를 새 창으로 엽니다.';
 }
}
function init(){
 const oldSelect=window.selectProduct;
 if(typeof oldSelect==='function')window.selectProduct=function(id){oldSelect(id);render()};
 const oldSync=window.vpStudioSyncSelection;
 window.vpStudioSyncSelection=()=>{oldSync?.();render()};
 const oldRefresh=window.vpCreatorRefresh;
 window.vpCreatorRefresh=()=>{oldRefresh?.();render()};
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
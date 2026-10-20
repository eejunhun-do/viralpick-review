/* Shared Instagram-like carousel review for the image/card and final review steps. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const KEY='vp-instagram-preview-account-v1';
const ids=['vpInstagramFeedVisual','vpInstagramFeedFinal'];
let swipe=null,rendering=false;
function alias(){try{return localStorage.getItem(KEY)||'내 인스타그램'}catch{return '내 인스타그램'}}
function el(tag,cls,content){
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(content!==undefined)n.textContent=content;
 return n;
}
function makeFeed(id){
 const section=el('section','vpInstagramFeedCard');section.id=id;
 const header=el('header','vpInstagramFeedHeader');
 const avatar=el('div','vpInstagramFeedAvatar','I');
 const info=el('div','vpInstagramFeedWho');
 const name=el('strong','vpInstagramFeedName','내 인스타그램');
 info.append(name,el('small','','광고 · 미리보기'));
 header.append(avatar,info,el('span','vpInstagramFeedMore','···'));
 const photo=el('div','vpInstagramFeedMedia');
 photo.setAttribute('tabindex','0');photo.setAttribute('role','region');photo.setAttribute('aria-label','캐러셀 사진, 좌우 방향키 또는 스와이프로 카드 이동');
 const img=el('img','vpInstagramFeedImage');img.alt='캐러셀 카드 실제 PNG 출력 모습';img.draggable=false;
 const index=el('span','vpInstagramFeedCounter','1/5');
 const left=el('button','vpInstagramFeedNav previous','‹');left.type='button';left.setAttribute('aria-label','이전 카드');
 const right=el('button','vpInstagramFeedNav next','›');right.type='button';right.setAttribute('aria-label','다음 카드');
 left.onclick=()=>{if(typeof goInstagramSlide==='function')goInstagramSlide((typeof instaCardIndex==='number'?instaCardIndex:0)-1)};
 right.onclick=()=>{if(typeof goInstagramSlide==='function')goInstagramSlide((typeof instaCardIndex==='number'?instaCardIndex:0)+1)};
 photo.addEventListener('touchstart',event=>{if(event.touches.length!==1)return;swipe={x:event.touches[0].clientX,y:event.touches[0].clientY}},{passive:true});
 photo.addEventListener('touchend',event=>{if(!swipe||!event.changedTouches.length)return;const dx=event.changedTouches[0].clientX-swipe.x,dy=event.changedTouches[0].clientY-swipe.y;swipe=null;if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.2)goInstagramSlide(instaCardIndex+(dx<0?1:-1))},{passive:true});
 photo.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();goInstagramSlide(instaCardIndex+(event.key==='ArrowRight'?1:-1))}});
 photo.append(img,index,left,right);
 const actions=el('div','vpInstagramFeedActions');
 const icons=el('div','vpInstagramFeedIcons');
 for(const [txt,label] of [['♡','좋아요 미리보기'],['♧','댓글 미리보기'],['➤','공유 미리보기']]){const icon=el('span','',txt);icon.setAttribute('aria-label',label);icons.append(icon)}
 const dots=el('div','vpInstagramFeedDots');dots.setAttribute('aria-label','5장 캐러셀 진행 상태');
 actions.append(icons,dots,el('span','vpInstagramFeedBookmark','▢'));
 const caption=el('div','vpInstagramFeedCaption');
 const captionAccount=el('strong','vpInstagramFeedName','내 인스타그램');
 const captionText=el('span','vpInstagramFeedText');
 caption.append(captionAccount,captionText);
 const more=el('button','vpInstagramFeedExpand','더 보기');more.type='button';
 more.onclick=()=>{section.classList.toggle('expanded');more.textContent=section.classList.contains('expanded')?'접기':'더 보기'};
 const editor=el('label','vpInstagramAliasLabel','표시 계정명');
 const input=el('input','vpInstagramAliasInput');input.maxLength=45;input.placeholder='내 인스타그램';input.value=alias();input.setAttribute('aria-label','Instagram 미리보기 계정명');
 input.addEventListener('input',()=>{try{localStorage.setItem(KEY,input.value.trim().slice(0,45))}catch{}refreshNames()});
 editor.append(input);
 section.append(header,photo,actions,caption,more,editor);
 return section;
}
function refreshNames(){
 const name=alias();
 for(const id of ids){
  const root=$('#'+id);if(!root)continue;
  root.querySelectorAll('.vpInstagramFeedName').forEach(n=>n.textContent=name);
  root.querySelector('.vpInstagramFeedAvatar').textContent=name.slice(0,1).toUpperCase();
  const input=root.querySelector('.vpInstagramAliasInput');if(input&&document.activeElement!==input)input.value=name;
 }
}
function render(){
 if(rendering)return;
 rendering=true;
 try{
  const multi=typeof isMultiMode==='function'&&isMultiMode('Instagram');
  const active=Math.min(4,Math.max(0,typeof instaCardIndex==='number'?instaCardIndex:0));
  const targets=ids.map(id=>$('#'+id)).filter(Boolean);
  for(const root of targets)root.hidden=multi;
  if(multi||!targets.length)return;
  let src='';
  try{const cv=buildContentCanvas('Instagram',active,typeof coverIndex==='number'?coverIndex:0);src=cv.toDataURL('image/jpeg',.85)}catch{}
  const caption=typeof getCurrentInstagramCaption==='function'?getCurrentInstagramCaption():'';
  for(const root of targets){
   const image=root.querySelector('.vpInstagramFeedImage');
   if(src){image.src=src;image.style.visibility='visible'}else{image.removeAttribute('src');image.style.visibility='hidden'}
   root.querySelector('.vpInstagramFeedCounter').textContent=(active+1)+' / 5';
   root.querySelector('.vpInstagramFeedDots').textContent=Array.from({length:5},(_,i)=>i===active?'●':'○').join(' ');
   root.querySelector('.previous').disabled=active===0;
   root.querySelector('.next').disabled=active===4;
   root.querySelector('.vpInstagramFeedText').textContent=' '+caption;
  }
  refreshNames();
 }finally{rendering=false}
}
function init(){
 const visual=$('#instagram .vpStudioStage[data-studio-stage="visual"]');
 const viewer=visual?.querySelector('.instagramCarouselViewer');
 if(viewer&&!$('#vpInstagramFeedVisual'))viewer.prepend(makeFeed('vpInstagramFeedVisual'));
 const final=$('#instagram .vpStudioStage[data-studio-stage="final"]');
 const obsolete=final?.querySelector('#vpInstagramSocialReview');if(obsolete)obsolete.remove();
 if(final&&!$('#vpInstagramFeedFinal'))final.insertBefore(makeFeed('vpInstagramFeedFinal'),final.querySelector('.vpStudioReviewNote')||final.children[1]);
 window.vpInstagramFeedRefresh=render;
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
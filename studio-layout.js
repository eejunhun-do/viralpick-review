/* ViralPick Studio v1: presentation-only grouping. Existing editing, export and auth APIs stay intact. */
(function(){
'use strict';
const names={source:'상품 · 자료',copy:'AI 문구 · 편집',visual:'이미지 · 카드',final:'검토 · 저장'};
const order=Object.keys(names);
const studios={};
function el(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
}
function append(stage,node){if(node)stage.appendChild(node);}
function direct(root,selector){return [...root.children].find(node=>node.matches(selector));}
function advanced(title,nodes){
 const details=el('details','vpStudioAdvanced');
 details.appendChild(el('summary','',title));
 const body=el('div','vpStudioAdvancedBody');
 for(const node of nodes)append(body,node);
 details.appendChild(body);
 return details;
}
function build(platform){
 const key=platform.toLowerCase(),root=document.getElementById(key);
 if(!root||root.classList.contains('vpStudioReady'))return;
 const sourceRoot=direct(root,'#vpAiCopyPanel');
 const top=direct(root,'.top');
 const intro=key==='instagram'?direct(root,'.aiNote'):null;
 const hook=direct(root,'.openingHookPanel');
 const multi=direct(root,'.multiStudioPanel');
 const end=direct(root,'.finalActions');
 const hero=el('div','vpStudioHero');
 const heroTitle=el('div','vpStudioIdentity');
 heroTitle.appendChild(el('span','vpStudioKicker','VIRALPICK · '+platform.toUpperCase()+' STUDIO'));
 heroTitle.appendChild(el('h1','',platform==='Threads'?'Threads 콘텐츠 제작':'Instagram 콘텐츠 제작'));
 heroTitle.appendChild(el('p','',platform==='Threads'?'상품 자료부터 공감형 문구와 후킹 이미지까지 순서대로 제작하세요.':'상품 자료부터 AI 캡션, 표지와 캐러셀, 최종 저장까지 진행하세요.'));
 const productBox=el('div','vpStudioCurrentProduct');
 productBox.appendChild(el('span','vpStudioProductLabel','현재 작업 상품'));
 const productName=el('strong','vpStudioProductName','상품 선택 필요');
 const productMeta=el('small','vpStudioProductMeta','');
 productBox.appendChild(productName);productBox.appendChild(productMeta);
 const change=el('button','btn','상품 변경 ↗');
 change.type='button';change.onclick=()=>window.show('discover');
 productBox.appendChild(change);
 hero.appendChild(heroTitle);hero.appendChild(productBox);
 const nav=el('nav','vpStudioSteps');nav.setAttribute('aria-label',platform+' 제작 순서');
 const buttons={};
 for(const [i,step] of order.entries()){
  const button=el('button','vpStudioStepButton');
  button.type='button';button.dataset.step=step;
  button.appendChild(el('span','vpStudioStepNumber',String(i+1).padStart(2,'0')));
  button.appendChild(el('span','vpStudioStepText',names[step]));
  button.onclick=()=>go(key,step);
  nav.appendChild(button);buttons[step]=button;
 }
 const stages={};
 for(const step of order){
  const pane=el('div','vpStudioStage');
  pane.dataset.studioStage=step;pane.hidden=true;
  const titles={
   source:['상품과 근거 자료','단일 상품을 선택하거나 모음형을 설정하고, 추출한 후기·상세 정보를 연결하세요.'],
   copy:['문구 생성과 수정','AI로 사실 기반 문구를 만들고, 최종 게시 문장을 직접 검토하세요.'],
   visual:['이미지 및 카드 제작','후킹 이미지와 캐러셀을 만들고 미리보기를 확인하세요.'],
   final:['최종 검토 · 내보내기','문구·이미지·제휴 고지를 확인한 후 저장하거나 예약하세요.']
  };
  const heading=el('div','vpStudioSectionHeading');
  heading.appendChild(el('h2','',titles[step][0]));
  heading.appendChild(el('p','',titles[step][1]));
  pane.appendChild(heading);stages[step]=pane;
 }
 root.prepend(nav);root.prepend(hero);
 for(const step of order)root.appendChild(stages[step]);
 if(multi){
  const config=multi.querySelector('.multiConfig');
  if(config){
   const box=advanced('모음형 세부 설정 열기',[config]);
   box.classList.add('vpStudioMultiSettings');
   multi.appendChild(box);
  }
  append(stages.source,multi);
 }
 if(sourceRoot)append(stages.source,sourceRoot);
 if(intro){intro.textContent='Threads와 Instagram이 같은 상품·후기 자료를 사용합니다. 이 단계에서 마크다운을 한 번만 분석하세요.';append(stages.source,intro);}
 const lead=el('div','vpStudioCopyLead');
 lead.appendChild(el('div','vpStudioCopyLeadText','먼저 실제 상품정보와 구매후기를 연결한 다음 AI 문구를 생성하세요. 작성된 문구는 아래에서 직접 수정할 수 있습니다.'));
 const leadActions=el('div','vpStudioLeadActions');
 const dataButton=el('button','btn','상품 근거자료 보기');
 dataButton.type='button';dataButton.onclick=()=>go(key,'source');
 const aiButton=el('button','btn primary',platform==='Threads'?'✨ AI Threads 문구 생성':'✨ AI Instagram 문구 생성');
 aiButton.type='button';aiButton.onclick=()=>window.generateProductCopy(platform);
 leadActions.appendChild(dataButton);leadActions.appendChild(aiButton);
 lead.appendChild(leadActions);stages.copy.appendChild(lead);
 if(key==='threads'){
  const variants=direct(root,'.singleOnlyThreads.panel');
  const preview=direct(root,'.threadPreview');
  if(preview){
   const left=preview.children[0],right=preview.children[1];
   if(right){right.classList.add('singleOnlyThreads','vpStudioThreadText');append(stages.copy,right);}
   if(left){left.classList.add('singleOnlyThreads','vpStudioThreadArt');append(stages.visual,left);}
   preview.remove();
  }
  if(hook||variants)append(stages.copy,advanced('기존 템플릿 6안 · 첫 문장 후킹 설정',[hook,variants]));
  const multiResult=direct(root,'#multiThreadsResult');
  if(multiResult){
   const caption=multiResult.querySelector('#multiThreadCaption')?.closest('.panel');
   if(caption){
    caption.classList.add('vpStudioMultiCopy');
    append(stages.copy,caption);
   }
   append(stages.visual,multiResult);
  }
  append(stages.visual,direct(root,'.singleOnlyThreads.aiNote'));
 }else{
  const cover=direct(root,'.singleOnlyInstagram.panel');
  const twocol=direct(root,'.twocol');
  if(twocol){
   const carousel=twocol.children[0],extra=twocol.children[1];
   if(extra){
    const panels=[...extra.children];
    if(panels[0])append(stages.copy,panels[0]);
    if(panels[1])append(stages.final,panels[1]);
   }
   if(carousel)append(stages.visual,carousel);
   twocol.remove();
  }
  if(hook)append(stages.copy,advanced('기존 첫 문장 후킹 설정',[hook]));
  append(stages.visual,cover);
  // Cover should appear before the carousel, irrespective of legacy document order.
  if(cover)stages.visual.insertBefore(cover,stages.visual.children[1]||null);
  append(stages.visual,direct(root,'.singleOnlyInstagram.aiNote'));
 }
 const reminders=el('div','vpStudioReviewNote');
 reminders.appendChild(el('strong','','게시 전 확인 사항'));
 const checklist=el('p','',
   '① 추출 후기의 표본 수와 장단점 확인  ·  ② 기능·성능·가격 표현 검증  ·  ③ 이미지 사용 권한 확인  ·  ④ 쿠팡 파트너스 광고 고지 확인');
 reminders.appendChild(checklist);stages.final.insertBefore(reminders,stages.final.firstChild.nextSibling);
 append(stages.final,end);
 if(top){
  const actions=top.querySelector('.btnrow');
  if(actions)append(stages.final,advanced('기존 바로가기 · 다운로드 · 예약 기능',[actions]));
  top.remove();
 }
 for(const [i,step] of order.entries()){
  const bar=el('div','vpStudioStageFooter');
  if(i>0){
   const prev=el('button','btn','← 이전 단계');
   prev.type='button';prev.onclick=()=>go(key,order[i-1]);bar.appendChild(prev);
  }
  if(i<order.length-1){
   const next=el('button','btn primary','다음 단계 →');
   next.type='button';next.onclick=()=>go(key,order[i+1]);bar.appendChild(next);
  }
  stages[step].appendChild(bar);
 }
 studios[key]={root,stages,buttons,productName,productMeta,current:'source'};
 root.classList.add('vpStudioReady');
}
function sync(){
 const p=window.selected;
 for(const studio of Object.values(studios)){
  studio.productName.textContent=p?.name||'상품이 선택되지 않았습니다';
  const id=p?.coupangProductId?' · 쿠팡 ID '+p.coupangProductId:'';
  studio.productMeta.textContent=(p?.source==='coupang'?'쿠팡 상품':p?'직접 등록 상품':'상품 발굴에서 선택')+id;
 }
}
function go(platform,step){
 const studio=studios[platform];if(!studio||!stagesValid(step))return;
 if(step==='source'){
  const panel=document.getElementById('vpAiCopyPanel');
  if(panel)studio.stages.source.appendChild(panel);
 }
 studio.current=step;
 for(const candidate of order){
  const active=candidate===step;
  studio.stages[candidate].hidden=!active;
  studio.buttons[candidate].classList.toggle('active',active);
  studio.buttons[candidate].setAttribute('aria-current',active?'step':'false');
 }
 sync();
 try{sessionStorage.setItem('vpStudioStep_'+platform,step);}catch{}
 if(document.getElementById(platform)?.classList.contains('active')){
  studio.root.querySelector('.vpStudioSteps')?.scrollIntoView({block:'nearest',behavior:'instant'});
 }
}
function stagesValid(step){return Object.prototype.hasOwnProperty.call(names,step)}
function init(){
 build('Threads');build('Instagram');sync();
 const nativeShow=window.show;
 if(typeof nativeShow==='function'){
  window.show=function(view){
   nativeShow(view);
   if(view==='threads'||view==='instagram'){
    const target=studios[view]?.current||'source';go(view,target);
   }
  };
 }
 const nativeSelect=window.selectProduct;
 if(typeof nativeSelect==='function'){
  window.selectProduct=function(id){nativeSelect(id);sync();};
 }
 window.vpStudioGo=function(platform,step){
  const key=String(platform).toLowerCase();
  if(!studios[key])return;
  if(!studios[key].root.classList.contains('active'))window.show(key);
  go(key,step);
  window.scrollTo({top:0,behavior:'smooth'});
 };
 window.vpStudioSyncSelection=sync;
 window.vpStudioAfterCopyGenerated=function(platform){window.vpStudioGo(platform,'copy')};
 const active=document.querySelector('.view.active');
 if(active&&(active.id==='threads'||active.id==='instagram'))go(active.id,'source');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
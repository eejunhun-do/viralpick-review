/* ViralPick Threads: paired problem -> solution photo story. Instagram stays unchanged. */
(function(){
'use strict';
const $=selector=>document.querySelector(selector);
const PAIR_DB='viralpick-thread-pairs-v1',STORE='pair-stories';
const memo=new Map(),loadedImages=new Map(),loading=new Set(),edits=new Map();
let busy=false,ready=false,loadError='';
function owner(){return String(typeof selected!=='undefined'?selected?.id||'':'')}
function emptyRecord(){return {pairs:Array.from({length:5},()=>({pain:'',solve:''})),selectedIndex:0,images:{}}}
function record(){
 const id=owner();
 if(!memo.has(id)){memo.set(id,emptyRecord());load(id)}
 return memo.get(id);
}
function imageKey(id,index,slot){return id+':'+index+':'+slot}
function current(){const r=record();return {r,index:r.selectedIndex,pair:r.pairs[r.selectedIndex]}}
function openDb(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(Error('이 브라우저에서 사진 저장소를 사용할 수 없습니다.'));return}
  const req=indexedDB.open(PAIR_DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
  req.onerror=()=>reject(req.error||Error('사진 저장소 오류'));
  req.onsuccess=()=>resolve(req.result);
 });
}
async function readStore(key){
 const db=await openDb();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(key);
  req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
 })}finally{db.close()}
}
async function writeStore(key,value){
 const db=await openDb();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).put(value,key);
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 })}finally{db.close()}
}
const revisions=new Map();
function save(){
 const id=owner(),r=record();
 const revision=(revisions.get(id)||0)+1;revisions.set(id,revision);
 // Serialize writes so a slow older write cannot replace a newer selection.
 const previous=edits.get(id)||Promise.resolve();
 const next=previous.catch(()=>{}).then(()=>writeStore(id,r)).catch(e=>{
  loadError='브라우저 사진 저장 실패: '+e.message+' · 현재 화면에서는 계속 사용할 수 있습니다.';
  status(loadError);
 });
 edits.set(id,next);
}
async function load(id){
 if(loading.has(id))return;
 loading.add(id);
 const revision=revisions.get(id)||0;
 try{
  const stored=await readStore(id);
  if(stored&&memo.has(id)&&(revisions.get(id)||0)===revision){
   const pairs=Array.isArray(stored.pairs)?stored.pairs.slice(0,5):[];
   if(pairs.length===5){
    memo.set(id,{pairs:pairs.map(p=>({pain:String(p?.pain||'').slice(0,120),solve:String(p?.solve||'').slice(0,120)})),
     selectedIndex:Math.max(0,Math.min(4,Number(stored.selectedIndex)||0)),
     images:stored.images&&typeof stored.images==='object'?stored.images:{}});
   }
  }
 }catch(e){loadError='사진 기록을 불러올 수 없습니다: '+e.message}
 finally{loading.delete(id);if(id===owner()){void hydratePair();render()}}
}
async function getLoaded(index,slot){
 const id=owner(),r=record(),data=r.images[index+':'+slot];
 if(!data||!/^data:image\/(?:webp|jpeg|png);base64,/.test(data))return null;
 const key=imageKey(id,index,slot),cached=loadedImages.get(key);
 if(cached?.data===data)return cached.image;
 return await new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>{loadedImages.set(key,{data,image});resolve(image)};
  image.onerror=()=>reject(Error('생성 사진을 열 수 없습니다.'));
  image.src=data;
 });
}
async function hydratePair(){
 const id=owner(),{index}=current();
 await Promise.allSettled([getLoaded(index,'pain'),getLoaded(index,'solve')]);
 if(id===owner())render();
}
function canvasData(slide){
 if(!ready||typeof isMultiMode==='function'&&isMultiMode('Threads'))return null;
 const {r,index,pair}=current(),slot=slide===1?'solve':'pain';
 const stored=r.images[index+':'+slot],cached=loadedImages.get(imageKey(owner(),index,slot));
 return {headline:pair[slot]||'후킹 문장을 입력해 줘',image:cached?.data===stored?cached.image:null,showProduct:slot==='solve'};
}
function status(message){
 const node=$('#vpPairStatus');
 if(node&&message)node.textContent=message;
}
function sentence(value){return String(value||'').trim().slice(0,120)}
function updatePair(slot,value){
 const {r,index,pair}=current(),next=sentence(value);
 if(next===pair[slot])return;
 pair[slot]=next;
 // An old photo no longer represents the revised premise.
 delete r.images[index+':'+slot];
 loadedImages.delete(imageKey(owner(),index,slot));
 save();render();
}
function selectPair(index){
 if(busy)return;
 const r=record();if(!Number.isInteger(index)||index<0||index>=r.pairs.length)return;
 r.selectedIndex=index;save();render();void hydratePair();
}
function description(){
 return String($('#vpAiDescription')?.value||'').trim().slice(0,3500);
}
function reviews(){
 const evidence=typeof loadReviewEvidence==='function'?loadReviewEvidence(String(selected?.coupangProductId||'')):null;
 return (Array.isArray(evidence?.reviews)?evidence.reviews.map(item=>String(item.content||'')).filter(Boolean).join('\n'):$('#vpAiReviews')?.value||'').slice(0,5400);
}
async function makePairs(){
 if(busy)return;
 if(!window.confirm('AI로 불편→해결 후킹 5세트를 새로 만들까요? 현재 후킹과 연결된 사진은 초기화됩니다. OpenAI 요금이 발생합니다.'))return;
 busy=true;render();status('AI가 실제 제품 정보에 근거한 연결형 후킹 5세트를 생성 중…');
 try{
  const request={title:selected.name,description:description(),reviews:reviews()};
  const result=await backendRequest('/api/thread-hook-pairs',{method:'POST',body:JSON.stringify(request)});
  if(!Array.isArray(result.pairs)||result.pairs.length!==5)throw Error('후킹 5세트가 반환되지 않았습니다.');
  const next=result.pairs.map(p=>({pain:sentence(p.pain),solve:sentence(p.solve)}));
  if(next.some(p=>p.pain.length<8||p.solve.length<8))throw Error('일부 후킹 문장이 비어 있습니다.');
  const r=record();r.pairs=next;r.images={};r.selectedIndex=0;
  for(const key of [...loadedImages.keys()])if(key.startsWith(owner()+':'))loadedImages.delete(key);
  save();status('연결형 후킹 5세트 완료! 원하는 세트를 골라 두 장을 생성하세요.');
 }catch(e){status('후킹 생성 실패: '+e.message)}
 finally{busy=false;render()}
}
function applyHooksToPosts(){
 const {r,pair}=current(),pain=sentence(pair.pain),solve=sentence(pair.solve);
 if(!pain||!solve){status('먼저 연결된 불편·해결 후킹 두 문장을 작성해 주세요.');return}
 if(typeof getCurrentThreadText!=='function'||typeof getThreadReplyText!=='function'){status('Threads 본문 편집기를 불러오지 못했습니다.');return}
 // Do not unexpectedly overwrite edited AI copy: user explicitly requests this action.
 let first=getCurrentThreadText().trim();
 let second=typeof readThreadReply==='function'?String(readThreadReply()||'').trim():'';
 if(r.appliedPain&&first.startsWith(r.appliedPain))first=first.slice(r.appliedPain.length).trimStart();
 if(r.appliedSolve&&second.startsWith(r.appliedSolve))second=second.slice(r.appliedSolve.length).trimStart();
 if(!first.startsWith(pain))first=pain+'\\n\\n'+first;
 if(!second.startsWith(solve))second=solve+'\\n\\n'+(second||'제품 정보와 실제 후기를 비교해 봐.\\n옵션과 제한 사항도 확인해 봐.');
 customThreadEdits[threadEditKey()]=first;
 saveThreadReply(second);
 r.appliedPain=pain;r.appliedSolve=solve;save();
 renderThreads();window.vpCreatorRenderReview?.();
 status('선택한 두 후킹을 Threads 1단·2단 첫 줄에 각각 반영했습니다. 본문은 다시 검토해 주세요.');
}
async function makeImage(slot){
 if(busy)return;
 const productId=owner(),{index,pair}=current(),hook=pair[slot];
 if(!hook||hook.length<8){status('먼저 선택한 세트의 '+(slot==='pain'?'불편':'해결')+' 후킹 문장을 입력해 주세요.');return}
 const confirmText=slot==='pain'?'불편 상황만 보여주는 사진 1장을 생성할까요?':'선택한 실제 제품으로 불편이 완화되는 사진 1장을 생성할까요?';
 if(!window.confirm(confirmText+' OpenAI 이미지 생성 비용이 발생합니다.'))return;
 busy=true;render();status(slot==='pain'?'1번 불편한 상황 사진을 생성 중…':'2번 실제 제품 사용 사진을 생성 중…');
 try{
  const style=typeof hookPhotoStyle==='string'?hookPhotoStyle:'warm-editorial';
  const note=String(selected?.visual||'').slice(0,190);
  const scene=(slot==='pain'
   ?'Before the solution. Show the everyday inconvenience in the Korean hook. No advertised product. '
   :'After the problem. Show the selected real product naturally reducing the very same inconvenience. ')
   +'Hook: '+hook+'. Context: '+note;
  const common={purpose:slot==='pain'?'threads-pain':'threads-solve',product:selected.name,hook,scene:scene.slice(0,500),style};
  const ref=slot==='solve'?await window.vpCreatorReferencePayload('threads'):{imageMode:'scene'};
  const result=await backendRequest('/api/image',{method:'POST',body:JSON.stringify({...common,...ref})});
  const data=Array.isArray(result.images)?result.images[0]:result.image;
  if(result.count!==1||typeof data!=='string'||!/^data:image\/(?:webp|png|jpeg);base64,/.test(data))throw Error('이미지 1장을 정상적으로 받지 못했습니다.');
  if(productId!==owner())throw Error('생성 도중 선택한 상품이 변경되었습니다. 이전 상품에 자동 반영하지 않았습니다.');
  const r=record();if(r.selectedIndex!==index||r.pairs[index][slot]!==hook)throw Error('생성 도중 후킹 문구가 변경되어 결과를 적용하지 않았습니다.');
  r.images[index+':'+slot]=data;
  await getLoaded(index,slot);
  save();status((slot==='pain'?'불편':'해결')+' 이미지 생성 완료 · 두 사진을 확인하고 ZIP으로 저장할 수 있습니다.');
 }catch(e){status('이미지 생성 실패: '+e.message)}
 finally{busy=false;render()}
}
function pictureFor(slot){
 const {r,index}=current(),cached=loadedImages.get(imageKey(owner(),index,slot));
 return r.images[index+':'+slot]&&cached?.data===r.images[index+':'+slot]?cached.image:null;
}
function artwork(slot){
 if(!pictureFor(slot))return '';
 try{return buildContentCanvas('Threads',slot==='pain'?0:1,threadImageIndex).toDataURL('image/jpeg',.76)}catch{return ''}
}
function imageNode(slot,parent){
 if(!parent)return;
 const url=artwork(slot);parent.replaceChildren();
 if(url){const img=new Image();img.src=url;img.alt=slot==='pain'?'불편 상황 후킹 이미지':'제품으로 해결한 상황 후킹 이미지';parent.append(img)}
 else{const placeholder=document.createElement('div');placeholder.className='vpPairBlank';placeholder.textContent=slot==='pain'?'불편 상황 이미지 생성 전':'제품 해결 이미지 생성 전';parent.append(placeholder)}
}
function render(){
 const root=$('#vpAssetStudioThreads');if(!root||!ready)return;
 const {r,index,pair}=current();
 root.querySelector('.vpPairChoices').replaceChildren(...r.pairs.map((item,i)=>{
  const button=document.createElement('button');button.type='button';button.className='vpPairOption'+(index===i?' active':'');
  button.setAttribute('aria-pressed',String(index===i));button.disabled=busy;
  const head=document.createElement('strong');head.textContent='세트 '+(i+1);
  const pain=document.createElement('span');pain.textContent='불편 · '+(item.pain||'문장 입력 전');
  const solve=document.createElement('span');solve.textContent='해결 · '+(item.solve||'문장 입력 전');
  button.append(head,pain,solve);button.onclick=()=>selectPair(i);return button;
 }));
 for(const slot of ['pain','solve']){
  const input=root.querySelector('.vpPairEdit'+(slot==='pain'?'Pain':'Solve'));
  if(input&&document.activeElement!==input)input.value=pair[slot]||'';
  imageNode(slot,root.querySelector('.vpPairStage'+(slot==='pain'?'Pain':'Solve')+' .vpPairArtwork'));
 }
 root.querySelectorAll('.vpPairGenerate,.vpPairsGenerate,.vpPairSave,.vpPairApplyCopy').forEach(b=>b.disabled=busy);
 const both=Boolean(pictureFor('pain')&&pictureFor('solve'));
 root.querySelector('.vpPairSave').disabled=busy||!both;
 root.querySelector('.vpPairState').textContent=(pictureFor('pain')?'1번 사진 완료':'1번 사진 대기')+' · '+(pictureFor('solve')?'2번 사진 완료':'2번 사진 대기')+' · 저장 위치: 이 브라우저';
 updateFinal();
}
function updateFinal(){
 const first=$('#vpThreadSocialReview .vpFirstPost .vpPairFinalMedia');
 const second=$('#vpThreadSocialReview .vpSecondPost .vpPairFinalMedia');
 imageNode('pain',first);imageNode('solve',second);
}
async function exportTwo(){
 if(!pictureFor('pain')||!pictureFor('solve'))throw Error('불편·해결 사진을 각각 생성해야 두 장을 저장할 수 있습니다.');
 const entries=[];
 for(const [slot,name,slide] of [['pain','01_problem',0],['solve','02_solution',1]]){
  const canvas=buildContentCanvas('Threads',slide,threadImageIndex);
  const blob=await pngBlob(canvas);
  entries.push({name:name+'.png',bytes:new Uint8Array(await blob.arrayBuffer())});
 }
 const blob=makeZipEntries(entries);
 downloadFile(blob,'ViralPick_Threads_2장_'+safeFileName(selected.name)+'.zip');
 status('후킹 문구가 합성된 이미지 2장을 ZIP으로 저장했습니다.');
}
function install(){
 const root=$('#vpAssetStudioThreads');
 if(!root||ready)return;
 ready=true;root.classList.add('vpThreadPairMode');
 const oldHook=root.querySelector('.vpCreatorHookStep');if(oldHook)oldHook.hidden=true;
 const oldScene=root.querySelector('.vpCreatorSceneRow');if(oldScene)oldScene.hidden=true;
 const photo=root.querySelector('.vpCreatorPhotoStep');
 const heading=photo?.querySelector('.vpCreatorPhaseLabel');
 if(heading){heading.innerHTML='<span>03</span><strong>2번 이미지 · 제품으로 해결한 상황</strong><small>아래에서 실제 판매 제품의 사진을 선택한 다음, AI 편집 권한을 확인하세요.</small>'}
 const pair=document.createElement('section');pair.className='vpCreatorPhase vpPairHookStage';pair.id='vpThreadPairBuilder';
 pair.innerHTML='<div class="vpCreatorPhaseLabel"><span>01</span><strong>불편 → 해결 후킹 5세트</strong><small>한 세트를 고르면 두 문장과 두 이미지가 1:1로 연결됩니다. 기능은 상품정보로 확인한 내용만 사용하세요.</small></div>'+
 '<div class="vpPairTools"><button type="button" class="btn primary vpPairsGenerate">✨ AI 연결형 후킹 5세트 생성</button><p id="vpPairStatus" role="status">후킹을 AI로 생성하거나 선택한 세트를 직접 작성하세요. AI 생성에는 별도 요금이 발생합니다.</p></div>'+
 '<div class="vpPairChoices" role="group" aria-label="불편 해결 후킹 세트"></div>'+
 '<div class="vpPairEditors"><label>1번 · 불편한 상황 후킹<textarea class="vpPairEditPain" rows="2" maxlength="120" placeholder="예: 요리할 때 계속 저어야 해서 귀찮지?"></textarea></label><label>2번 · 연결된 해결 후킹<textarea class="vpPairEditSolve" rows="2" maxlength="120" placeholder="예: 자동으로 저어주면 손이 한결 편하겠지?"></textarea></label></div>'+
 '<button type="button" class="btn vpPairApplyCopy">선택 후킹을 Threads 1단·2단 첫 줄에 적용</button>';
 const problem=document.createElement('section');problem.className='vpCreatorPhase vpPairStagePain';
 problem.innerHTML='<div class="vpCreatorPhaseLabel"><span>02</span><strong>1번 이미지 · 불편한 상황</strong><small>제품 이미지는 사용하지 않습니다. 불편한 장면만 사진으로 보여줍니다.</small></div>'+
 '<div class="vpPairArtwork"></div><button type="button" class="btn primary vpPairGenerate vpPainCreate">불편한 상황 실사 1장 생성</button>';
 const solveControls=document.createElement('div');solveControls.className='vpPairStageSolve';
 solveControls.innerHTML='<div class="vpPairArtwork"></div><button type="button" class="btn primary vpPairGenerate vpSolveCreate">선택한 상품으로 해결 장면 1장 생성</button>';
 if(photo)photo.append(solveControls);
 const finish=document.createElement('section');finish.className='vpCreatorPhase vpPairFinish';
 finish.innerHTML='<div class="vpCreatorPhaseLabel"><span>04</span><strong>2장 연결형 이미지 최종 확인</strong><small>선택한 두 문구와 각각의 생성 이미지를 확인한 뒤 저장하세요.</small></div>'+
 '<p class="vpPairState" aria-live="polite"></p><button type="button" class="btn primary vpPairSave">불편 + 해결 이미지 2장 ZIP 저장</button>'+
 '<p class="vpCreatorEmpty">AI 생성 사진은 실제 제품·효능과 다를 수 있습니다. 기능과 이미지 활용 권한은 게시 전에 확인하세요.</p>';
 const container=root.querySelector('.vpCreatorReference')||root;
 container.prepend(pair);
 if(photo&&photo.parentNode===container){container.insertBefore(problem,photo);photo.after(finish)}
 else{container.append(problem,finish)}
 root.querySelector('.vpPairsGenerate').onclick=()=>void makePairs();
 root.querySelector('.vpPairApplyCopy').onclick=applyHooksToPosts;
 root.querySelector('.vpPainCreate').onclick=()=>void makeImage('pain');
 root.querySelector('.vpSolveCreate').onclick=()=>void makeImage('solve');
 root.querySelector('.vpPairSave').onclick=()=>void exportTwo().catch(e=>status('저장 실패: '+e.message));
 for(const [cl,slot] of [['vpPairEditPain','pain'],['vpPairEditSolve','solve']]){
  root.querySelector('.'+cl).addEventListener('change',e=>updatePair(slot,e.target.value));
 }
 for(const selector of ['.vpFirstPost','.vpSecondPost']){
  const article=$('#vpThreadSocialReview '+selector);
  const body=article?.querySelector('.vpPreviewBody');
  if(body){
   const media=document.createElement('div');media.className='vpPairFinalMedia';
   body.after(media);
  }
 }
 const originalRefresh=window.vpCreatorRefresh;
 window.vpCreatorRefresh=()=>{originalRefresh?.();refresh()};
 const originalReview=window.vpCreatorRenderReview;
 window.vpCreatorRenderReview=()=>{originalReview?.();updateFinal()};
 window.vpThreadPairArtworkForSlide=canvasData;
 window.vpThreadPairExport=exportTwo;
 refresh();
}
function refresh(){
 if(!ready)return;
 record();
 void hydratePair();
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
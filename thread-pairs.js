/* ViralPick Threads: paired problem -> solution photo story. Instagram stays unchanged. */
(function(){
'use strict';
const $=selector=>document.querySelector(selector);
const PAIR_DB='viralpick-thread-pairs-v1',STORE='pair-stories';
const memo=new Map(),loadedImages=new Map(),loading=new Set(),edits=new Map();
let busy=false,ready=false,loadError='';
const imageStage={pain:{phase:'idle',detail:'생성 대기',started:0},solve:{phase:'idle',detail:'참조 상품 사진 확인 필요',started:0}};
const imageHistory=[];let stageTimer=null;
const phaseLabels={idle:'대기',preparing:'준비 중',requesting:'서버 호출 중',generating:'AI 생성 중',saving:'저장 중',complete:'완료',failed:'실패'};
function renderImageStages(){
 for(const [slot,id] of [['pain','vpPairProgressPain'],['solve','vpPairProgressSolve']]){
  const node=$('#'+id),st=imageStage[slot];if(!node)continue;
  const active=['preparing','requesting','generating','saving'].includes(st.phase);
  const sec=active?' · '+Math.max(0,Math.floor((Date.now()-st.started)/1000))+'초':'';
  node.dataset.phase=st.phase;
  node.textContent=(phaseLabels[st.phase]||st.phase)+sec+' — '+st.detail+
   (active&&Date.now()-st.started>30000?' (응답 지연 중, 중복 클릭하지 마세요)':'');
 }
 const list=$('#vpPairEventList');if(list){
  list.replaceChildren();
  for(const item of imageHistory.slice(0,18)){
   const li=document.createElement('li');
   li.textContent=new Date(item.at).toLocaleTimeString('ko-KR')+' · '+(item.slot==='pain'?'1번':'2번')+' '+(phaseLabels[item.phase]||item.phase)+' · '+item.message;
   list.append(li);
  }
 }
}
function markStage(slot,phase,message){
 const st=imageStage[slot];st.phase=phase;st.detail=String(message).slice(0,260);
 if(phase==='preparing')st.started=Date.now();
 imageHistory.unshift({slot,phase,message:st.detail,at:Date.now()});
 if(imageHistory.length>36)imageHistory.length=36;
 const label=(slot==='pain'?'1번 불편':'2번 해결')+' 이미지';
 if(phase==='failed')window.vpActivity?.error?.('Threads 이미지 실패',label+' · '+st.detail);
 else if(phase==='complete')window.vpActivity?.info?.('Threads 이미지 완료',label+' · '+st.detail);
 else window.vpActivity?.info?.('Threads 이미지 진행',label+' · '+phaseLabels[phase]);
 renderImageStages();
}

function owner(){return String(typeof selected!=='undefined'?selected?.id||'':'')}
function emptyRecord(){return {pairs:Array.from({length:5},()=>({pain:'',solve:''})),selectedIndex:0,images:{},appliedPain:'',appliedSolve:''}}
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
 const snapshot={...r,pairs:r.pairs.map(p=>({...p})),images:{...r.images}};
 const previous=edits.get(id)||Promise.resolve();
 const next=previous.catch(()=>{}).then(()=>writeStore(id,snapshot)).then(()=>true).catch(e=>{
  loadError='사진 기록 저장 실패: '+e.message+' · 현재 화면의 이미지는 유지됩니다.';
  status(loadError);return false;
 });
 edits.set(id,next);return next;
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
     images:stored.images&&typeof stored.images==='object'?stored.images:{},
     appliedPain:String(stored.appliedPain||''),appliedSolve:String(stored.appliedSolve||'')});
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
 for(const id of ['#vpPairStatus','#vpPairCopyStatus']){const node=$(id);if(node&&message)node.textContent=message}
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
 r.selectedIndex=index;
 for(const slot of ['pain','solve']){imageStage[slot].phase='idle';imageStage[slot].detail='선택한 후킹의 이미지 준비 대기';imageStage[slot].started=0}
 save();render();void hydratePair();
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
  const request={title:selected.name,description:description(),reviews:reviews(),webResearch:window.vpProductResearchContext?.()||null};
  const result=await backendRequest('/api/thread-hook-pairs',{method:'POST',body:JSON.stringify(request)});
  if(!Array.isArray(result.pairs)||result.pairs.length!==5)throw Error('후킹 5세트가 반환되지 않았습니다.');
  const next=result.pairs.map(p=>({pain:sentence(p.pain),solve:sentence(p.solve)}));
  if(next.some(p=>p.pain.length<8||p.solve.length<8))throw Error('일부 후킹 문장이 비어 있습니다.');
  const r=record();r.pairs=next;r.images={};r.selectedIndex=0;
 for(const slot of ['pain','solve']){imageStage[slot].phase='idle';imageStage[slot].detail='새 후킹의 이미지 생성 대기';imageStage[slot].started=0}
  for(const key of [...loadedImages.keys()])if(key.startsWith(owner()+':'))loadedImages.delete(key);
  save();status('연결형 후킹 5세트 완료! 원하는 세트를 골라 두 장을 생성하세요.');
 }catch(e){status('후킹 생성 실패: '+e.message)}
 finally{busy=false;render()}
}
function applyHooksToPosts(){
 // Do not replace the first sentence of an existing AI draft; regenerate all paragraphs
 // from the selected pain + solve story, so the narrative is coherent from the start.
 const pair=current().pair;
 if(!pair.pain||!pair.solve){status('먼저 불편·해결 후킹 두 문장을 선택해 주세요.');return}
 window.vpStudioGo?.('Threads','copy');
 const node=$('#vpPairCopyStatus');if(node)node.textContent='후킹 세트가 선택됐습니다. 아래 AI 문구 생성을 누르면 이 두 문장부터 이어지는 1단·2단을 새로 작성합니다.';
}
async function makeImage(slot,{confirmed=false,preparedReference=null}={}){
 if(busy)return false;
 const productId=owner(),{index,pair}=current(),hook=pair[slot];
 if(!hook||hook.length<8){markStage(slot,'failed','후킹 문구를 먼저 작성해 주세요.');return false}
 if(!confirmed&&!window.confirm((slot==='pain'?'불편':'해결')+' 이미지 1장 생성 시 OpenAI 요금이 발생합니다. 계속할까요?'))return false;
 busy=true;render();stageTimer=setInterval(renderImageStages,1000);
 const activityId=window.vpActivity?.begin?.('Threads '+(slot==='pain'?'1번':'2번')+' 이미지','생성 준비');
 let ok=false;
 try{
  markStage(slot,'preparing',slot==='pain'?'후킹·장면 준비 중':'실제 제품 사진·AI 편집 권한 검사 중');
  const style=typeof hookPhotoStyle==='string'?hookPhotoStyle:'warm-editorial';
  const scene=(slot==='pain'?'Before the solution. Show the everyday inconvenience. No advertised product. ':
   'After the problem. Show the exact selected reference product reducing the inconvenience. ')+
   'Hook: '+hook+'. Context: '+String(selected?.visual||'').slice(0,190);
  const common={purpose:slot==='pain'?'threads-pain':'threads-solve',product:selected.name,hook,scene:scene.slice(0,500),style};
  let ref={imageMode:'scene'};
  if(slot==='solve'){
   if(typeof window.vpCreatorThreadsPreparedReference!=='function')
    throw Error('제품 사진 준비 기능이 로드되지 않았습니다. 새로고침해 주세요.');
   try{ref=preparedReference||await window.vpCreatorThreadsPreparedReference()}
   catch(e){throw Error('2번 이미지에 사용할 제품 사진을 준비할 수 없습니다: '+String(e.message||'사진 오류')+
    ' · 상업적 AI 편집 권한을 체크하거나 권한 있는 사진을 직접 업로드해 주세요.')}
  }
  if(productId!==owner())throw Error('작업 상품이 변경되어 요청을 중지했습니다.');
  markStage(slot,'requesting','OpenAI 이미지 서버에 요청을 보냅니다.');
  window.vpActivity?.update?.(activityId,'이미지 '+(slot==='pain'?'1':'2')+'번 서버 호출');
  markStage(slot,'generating','GPT Image 2 결과 응답 대기 중');
  const result=await backendRequest('/api/image',{method:'POST',body:JSON.stringify({...common,...ref})});
  const data=Array.isArray(result.images)?result.images[0]:result.image;
  if(result.count!==1||typeof data!=='string'||!/^data:image\/(?:webp|png|jpeg);base64,/.test(data))
   throw Error('서버에서 유효한 이미지 1장을 받지 못했습니다. API 사용량 및 응답 상태를 확인해 주세요.');
  if(productId!==owner())throw Error('다른 상품으로 바뀌어 결과를 적용하지 않았습니다.');
  const r=record();
  if(r.selectedIndex!==index||r.pairs[index][slot]!==hook)throw Error('작업 중 후킹 문구가 바뀌어 반영하지 않았습니다.');
  markStage(slot,'saving','이미지를 받았습니다. 브라우저 기록에 저장 중');
  r.images[index+':'+slot]=data;await getLoaded(index,slot);
  const persisted=await save();
  if(persisted===false)throw Error('현재 이미지 미리보기는 유지되지만 브라우저 기록 저장에 실패했습니다. ZIP으로 저장해 주세요.');
  markStage(slot,'complete','이미지 생성과 기록 저장 완료');
  window.vpActivity?.end?.(activityId,true,'이미지 정상 생성 완료');ok=true;
 }catch(e){
  const msg=String(e?.message||'알 수 없는 오류').slice(0,300);
  markStage(slot,'failed',msg);status((slot==='pain'?'1번':'2번')+' 이미지 실패: '+msg);
  window.vpActivity?.end?.(activityId,false,msg);
 }finally{busy=false;clearInterval(stageTimer);stageTimer=null;render();renderImageStages()}
 return ok;
}
async function generateMissingPair(){
 if(busy)return;
 const {r,index,pair}=current();
 if(!pair.pain||!pair.solve){status('불편·해결 후킹 두 문장을 먼저 선택해 주세요.');return}
 const todo=['pain','solve'].filter(slot=>!r.images[index+':'+slot]);
 if(!todo.length){status('두 이미지가 모두 준비되어 있습니다. 각각 다시 생성할 수 있습니다.');return}
 if(!window.confirm('아직 없는 '+todo.length+'장의 이미지 생성에 AI 요금이 발생합니다. 진행할까요?'))return;
 let prepared=null;
 if(todo.includes('solve')){
  try{markStage('solve','preparing','제품 사진을 미리 검사합니다.');prepared=await window.vpCreatorThreadsPreparedReference()}
  catch(e){const m='상품 사진 준비 실패: '+String(e.message||e)+' · 사진 선택·AI 편집 권한을 확인하세요.';
   markStage('solve','failed',m);status(m);return}
 }
 for(const slot of todo){if(!await makeImage(slot,{confirmed:true,preparedReference:slot==='solve'?prepared:null})){status('실패한 이미지만 다시 생성해 주세요. 성공한 이미지는 유지됩니다.');break}}
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
function renderCopyHooks(){
 const panel=$('#vpPairCopyPanel');if(!panel)return;
 const {r,index,pair}=current();
 const list=panel.querySelector('.vpPairCopyChoices');list.replaceChildren();
 r.pairs.forEach((item,i)=>{
  const button=document.createElement('button');
  button.type='button';button.className='vpPairOption'+(i===index?' active':'');button.disabled=busy;
  button.setAttribute('aria-pressed',String(i===index));
  const title=document.createElement('strong');title.textContent='세트 '+(i+1);
  const pain=document.createElement('span');pain.textContent='불편 · '+(item.pain||'후킹 생성 전');
  const solve=document.createElement('span');solve.textContent='해결 · '+(item.solve||'후킹 생성 전');
  button.append(title,pain,solve);button.onclick=()=>selectPair(i);list.append(button);
 });
 for(const [slot,sel] of [['pain','.vpPairCopyPain'],['solve','.vpPairCopySolve']]){
  const field=panel.querySelector(sel);if(field&&document.activeElement!==field)field.value=pair[slot]||'';
 }
 const generate=panel.querySelector('.vpPairCopyGenerate');if(generate)generate.disabled=busy;
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
  imageNode(slot,root.querySelector(slot==='pain'?'.vpPairFinishPain':'.vpPairFinishSolve'));
 }
 root.querySelectorAll('.vpPairGenerate,.vpPairsGenerate,.vpPairSave').forEach(b=>b.disabled=busy);
 const both=Boolean(pictureFor('pain')&&pictureFor('solve'));
 root.querySelector('.vpPairSave').disabled=busy||!both;
 renderCopyHooks();
 root.querySelector('.vpPairState').textContent=(pictureFor('pain')?'1번 사진 완료':'1번 사진 대기')+' · '+(pictureFor('solve')?'2번 사진 완료':'2번 사진 대기')+' · 저장 위치: 이 브라우저';
  const missing=['pain','solve'].filter(slot=>!r.images[index+':'+slot]).length;
  const batch=root.querySelector('.vpPairMakeMissing');if(batch){batch.textContent=missing?'남은 이미지 '+missing+'장 생성':'두 이미지 준비 완료';batch.disabled=busy||!missing}
  for(const slot of ['pain','solve']){const b=root.querySelector(slot==='pain'?'.vpPainCreate':'.vpSolveCreate');if(b)b.textContent=r.images[index+':'+slot]?'해당 이미지 다시 생성':'이미지 생성'}
  renderImageStages();
 updateFinal();
}
function updateFinal(){
 // Both images belong to Threads post 1/2, never the 2/2 product-link reply.
 const multi=typeof isMultiMode==='function'&&isMultiMode('Threads');
 for(const panel of ['#vpThreadVisualReview','#vpThreadSocialReview']){
  const gallery=$(panel+' .vpFirstPost .vpPairGallery');
  if(!gallery)continue;
  gallery.hidden=multi;
  if(multi)continue;
  imageNode('pain',gallery.querySelector('[data-pair-photo="pain"]'));
  imageNode('solve',gallery.querySelector('[data-pair-photo="solve"]'));
 }
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
 '<p class="vpPairFlowNote">이 문장에 맞춰 Threads 1단·2단 전체를 생성하려면 AI 문구 · 편집 단계에서 생성하세요. 기존 첫 줄만 바꾸지 않습니다.</p>';
 const problem=document.createElement('section');problem.className='vpCreatorPhase vpPairStagePain';
 problem.innerHTML='<div class="vpCreatorPhaseLabel"><span>02</span><strong>1번 이미지 · 불편한 상황</strong><small>제품 이미지는 사용하지 않습니다. 불편한 장면만 사진으로 보여줍니다.</small></div>'+
 '<div class="vpPairArtwork"></div><button type="button" class="btn primary vpPairGenerate vpPainCreate">불편한 상황 실사 1장 생성</button>';
 const solveControls=document.createElement('div');solveControls.className='vpPairStageSolve';
 solveControls.innerHTML='<div class="vpPairArtwork"></div><button type="button" class="btn primary vpPairGenerate vpSolveCreate">선택한 상품으로 해결 장면 1장 생성</button>';
 if(photo)photo.append(solveControls);
 const finish=document.createElement('section');finish.className='vpCreatorPhase vpPairFinish';
 finish.innerHTML='<div class="vpCreatorPhaseLabel"><span>04</span><strong>2장 연결형 이미지 최종 확인</strong><small>선택한 두 문구와 각각의 생성 이미지를 확인한 뒤 저장하세요.</small></div>'+
 '<p class="vpPairState" aria-live="polite"></p><div class="vpPairFinishGallery"><figure><div class="vpPairFinishPain vpPairArtwork"></div><figcaption>1번 · 불편</figcaption></figure><figure><div class="vpPairFinishSolve vpPairArtwork"></div><figcaption>2번 · 해결</figcaption></figure></div><button type="button" class="btn primary vpPairSave">불편 + 해결 이미지 2장 ZIP 저장</button>'+
 '<p class="vpCreatorEmpty">AI 생성 사진은 실제 제품·효능과 다를 수 있습니다. 기능과 이미지 활용 권한은 게시 전에 확인하세요.</p>';
 const container=root.querySelector('.vpCreatorReference')||root;
 container.prepend(pair);
 // Keep both DOM reading order and the visual flex order strictly 01 -> 02 -> 03 -> 04.
 if(photo&&photo.parentNode===container)container.append(pair,problem,photo,finish);
 else container.append(pair,problem,finish);
 root.querySelector('.vpPairsGenerate').onclick=()=>void makePairs();
  const createMissing=document.createElement('button');createMissing.type='button';createMissing.className='btn primary vpPairMakeMissing';createMissing.textContent='남은 이미지 완성하기';createMissing.onclick=()=>void generateMissingPair();pair.querySelector('.vpPairTools')?.prepend(createMissing);
  const advanced=document.createElement('details');advanced.className='vpPairAdvancedHooks';const title=document.createElement('summary');title.textContent='후킹 세트 선택·수정 (고급)';advanced.append(title);
  for(const cls of ['vpPairChoices','vpPairEditors']){const el=pair.querySelector('.'+cls);if(el)advanced.append(el)}pair.append(advanced);
  const duplicate=pair.querySelector('.vpPairsGenerate');if(duplicate)duplicate.hidden=true;
  for(const [slot,sel] of [['pain','.vpPairStagePain'],['solve','.vpPairStageSolve']]){const btn=root.querySelector(sel+' .vpPairGenerate');if(!btn)continue;const line=document.createElement('p');line.className='vpPairProgress';line.id='vpPairProgress'+(slot==='pain'?'Pain':'Solve');line.setAttribute('role','status');btn.after(line)}
  const details=document.createElement('details');details.className='vpPairDetailedLog';const summary=document.createElement('summary');summary.textContent='이미지 제작 진행 · 오류 로그';const list=document.createElement('ol');list.id='vpPairEventList';details.append(summary,list);finish.append(details);renderImageStages();

 root.querySelector('.vpPainCreate').onclick=()=>void makeImage('pain');
 root.querySelector('.vpSolveCreate').onclick=()=>void makeImage('solve');
 root.querySelector('.vpPairSave').onclick=()=>void exportTwo().catch(e=>status('저장 실패: '+e.message));
 for(const [cl,slot] of [['vpPairEditPain','pain'],['vpPairEditSolve','solve']]){
  root.querySelector('.'+cl).addEventListener('change',e=>updatePair(slot,e.target.value));
 }
 for(const panelId of ['vpThreadVisualReview','vpThreadSocialReview']){
  const panel=document.getElementById(panelId);
  const first=panel?.querySelector('.vpFirstPost .vpPreviewBody');
  if(!first)continue;
  const gallery=document.createElement('div');gallery.className='vpPairGallery';
  gallery.setAttribute('aria-label','Threads 1단에 첨부되는 불편·해결 이미지 두 장');
  for(const [slot,label] of [['pain','1번 · 불편 상황'],['solve','2번 · 제품 해결']]){
   const figure=document.createElement('figure');
   const media=document.createElement('div');media.className='vpPairFinalMedia';media.dataset.pairPhoto=slot;
   const caption=document.createElement('figcaption');caption.textContent=label;
   figure.append(media,caption);gallery.append(figure);
  }
  first.after(gallery);
  const replyMedia=panel.querySelector('.vpSecondPost .vpPairFinalMedia');
  if(replyMedia)replyMedia.remove();
 }
 const copyStage=$('#threads .vpStudioStage[data-studio-stage="copy"]');
 if(copyStage){
  const hooksPanel=document.createElement('section');
  hooksPanel.id='vpPairCopyPanel';hooksPanel.className='vpCreatorPhase vpPairCopyPanel';
  hooksPanel.innerHTML='<div class="vpCreatorPhaseLabel"><span>01</span><strong>먼저 후킹부터 · 불편 → 해결 5세트</strong><small>후킹을 먼저 선택하고 AI 문구를 생성해야 내용과 첫 줄이 자연스럽게 이어집니다.</small></div>'+
   '<div class="vpPairTools"><button class="btn primary vpPairCopyGenerate" type="button">✨ AI 연결형 후킹 5세트 생성</button><p id="vpPairCopyStatus" role="status">기존 문구는 자동 변경되지 않습니다. 후킹을 선택한 후 아래 AI 문구 생성 버튼을 누르세요.</p></div>'+
   '<div class="vpPairCopyChoices vpPairChoices" role="group" aria-label="AI 문구 생성용 후킹 세트 선택"></div>'+
   '<div class="vpPairEditors"><label>1단 · 불편 후킹<textarea rows="2" maxlength="120" class="vpPairCopyPain"></textarea></label><label>2단 · 해결 후킹<textarea rows="2" maxlength="120" class="vpPairCopySolve"></textarea></label></div>';
  hooksPanel.querySelector('.vpPairCopyGenerate').onclick=()=>void makePairs();
  for(const [sel,slot] of [['.vpPairCopyPain','pain'],['.vpPairCopySolve','solve']]){
   hooksPanel.querySelector(sel).addEventListener('change',e=>updatePair(slot,e.target.value));
  }
  const lead=copyStage.querySelector('.vpStudioCopyLead');
  if(lead)copyStage.insertBefore(hooksPanel,lead);else copyStage.insertBefore(hooksPanel,copyStage.children[1]||null);
 }
 window.vpThreadSelectedPair=()=>{
  const {r,index,pair}=current();
  return {pain:sentence(pair.pain),solve:sentence(pair.solve),productId:owner(),pairIndex:index};
 };
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
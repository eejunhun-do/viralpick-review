/* Instagram single-product 5-card editorial story, shared selected product with Threads. */
(function(){
'use strict';
const $=s=>document.querySelector(s),STORE='vp-instagram-single-story-v1';
const drafts=new Map();
let creating=false;
function productKey(){return String(typeof selected!=='undefined'?selected?.id||'':'')}
function trim(v,max){return String(v||'').trim().slice(0,max)}
function currentPair(){
 const pair=window.vpThreadSelectedPair?.();
 return pair?.productId===productKey()?pair:null;
}
function fallback(){
 const p=selected||{},pair=currentPair();
 const pain=trim(pair?.pain||p.problem||'일상에서 은근 반복되는 불편, 공감되시나요?',100);
 const solve=trim(pair?.solve||p.novel||'이런 상황에서 필요한 기능부터 살펴볼까요?',100);
 const feature=trim(p.novel||'구매 전 실제 제품 기능부터 확인해 보세요.',150);
 return {slides:[
  {title:pain,detail:'넘겨서 불편한 상황과 해결 방법을 비교해 보세요.',scene:'A visually captivating photorealistic everyday lifestyle close-up teasing the pain moment, no product visible'},
  {title:'이런 순간 은근 번거롭죠?',detail:pain,scene:'Realistic person handling the exact everyday inconvenience, before any solution, no advertised product'},
  {title:solve,detail:'실제 제품이 이 상황에서 어떻게 쓰이는지 확인해 보세요.',scene:'Show the exact selected product being used to address the same everyday problem'},
  {title:'장점은 쓰는 상황에서 보이죠',detail:feature,scene:'Detailed product-in-use closeup showing a verified useful feature in a realistic setting'},
  {title:'고르기 전엔 이것부터 확인!',detail:'실제 사용 후기 · 옵션 · 크기와 사용 조건 · 최신 가격을 체크해 보세요.',scene:'Lifestyle scene inspecting product options and fit in a realistic, neutral way'}
 ],caption:''};
}
function getStory(){const id=productKey();if(drafts.has(id))return drafts.get(id);
 let stored=null;try{stored=JSON.parse(localStorage.getItem(STORE+':'+id)||'null')}catch{}
 const data=stored?.slides?.length===5?stored:fallback();drafts.set(id,data);return data;
}
function save(){try{localStorage.setItem(STORE+':'+productKey(),JSON.stringify(getStory()))}catch{
 const node=$('#vpInstagramStoryStatus');if(node)node.textContent='저장 공간이 부족합니다. 현재 화면은 유지됩니다.';
}}
function slide(index){
 if(typeof isMultiMode==='function'&&isMultiMode('Instagram'))return null;
 const s=getStory().slides[index];return s?{title:trim(s.title,90),detail:trim(s.detail,220),scene:trim(s.scene,420)}:null;
}
function update(index,key,value){
 const entry=getStory().slides[index];if(!entry||!['title','detail','scene'].includes(key))return;
 entry[key]=trim(value,key==='scene'?420:220);save();
 // Preserve active editing focus; canvas/gallery redraw happens after change.
 if(typeof renderInstagram==='function')renderInstagram();
 window.vpCreatorRenderReview?.();
}
function redraw(){
 const root=$('#vpInstagramSingleStory');if(!root)return;
 const multi=typeof isMultiMode==='function'&&isMultiMode('Instagram');
 root.hidden=false;
 root.querySelector('.vpSingleSlideList').hidden=multi;
 const generateButton=root.querySelector('#vpInstagramSingleGenerate');if(generateButton)generateButton.disabled=multi||creating;
 if(multi){const notice=root.querySelector('.vpSingleStoryMode');if(notice)notice.textContent='모음형 선택 중입니다. 위 단품형 전환 버튼을 눌러 같은 상품의 캐러셀을 제작할 수 있습니다.';return}
 const story=getStory(),container=root.querySelector('.vpSingleSlideList');
 container.replaceChildren();
 const labels=['01 · 시선 끄는 공감 표지','02 · 불편한 순간','03 · 제품으로 해결','04 · 확인된 장점','05 · 구매 전 체크 · 저장'];
 for(let i=0;i<5;i++){
  const entry=story.slides[i];
  const row=document.createElement('details');
  row.className='vpSingleSlideEdit';row.open=i===0;
  const summary=document.createElement('summary');summary.textContent=labels[i];
  row.append(summary);
  for(const [key,label,max] of [['title','제목',90],['detail','핵심 설명',220],['scene','AI 이미지 장면 설명',420]]){
   const holder=document.createElement('label');holder.textContent=label;
   const field=document.createElement('textarea');field.rows=key==='scene'?3:2;
   field.maxLength=max;field.value=entry?.[key]||'';
   field.onchange=()=>update(i,key,field.value);
   holder.append(field);row.append(holder);
  }
  container.append(row);
 }
 const msg=root.querySelector('.vpSingleStoryMode');
 if(msg)msg.textContent='단일 상품 5장 스토리 · '+(story.generated?'AI 기획 완료':'기본 스토리 시안')+' · Threads 선택 상품과 공유';
}
async function generate(){
 if(creating)return;
 const p=selected;if(!p)return;
 if(typeof isMultiMode==='function'&&isMultiMode('Instagram')){changeMultiMode('Instagram','single')}
 if(!window.confirm('선택한 단품으로 Instagram 5장 스토리와 캡션을 AI 기획할까요? 기존 단품 카드 문구·캡션이 교체되고 API 비용이 발생합니다.'))return;
 creating=true;const button=$('#vpInstagramSingleGenerate');if(button)button.disabled=true;
 const note=$('#vpInstagramStoryStatus');if(note)note.textContent='상품정보·후기·Threads 후킹에 맞춰 5장 스토리를 기획 중…';
 const productId=productKey();
 try{
  const review=$('#vpAiReviews')?.value||'';
  const data=await backendRequest('/api/instagram-story',{method:'POST',body:JSON.stringify({
   product:p.name,description:$('#vpAiDescription')?.value||'',reviews:review,
   problem:p.problem,novel:p.novel,audience:p.audience,hookPair:currentPair(),webResearch:window.vpProductResearchContext?.()||null
  })});
  if(!Array.isArray(data.slides)||data.slides.length!==5)throw Error('5장 스토리가 생성되지 않았습니다.');
  if(productId!==productKey())throw Error('작업 상품이 바뀌어 이전 상품의 스토리는 적용하지 않았습니다.');
  drafts.set(productId,{slides:data.slides.map(s=>({title:trim(s.title,90),detail:trim(s.detail,220),scene:trim(s.scene,420)})),caption:trim(data.caption,3000),generated:true});
  save();
  const key=selected.id+':'+instagramDiversity+':'+coverSeed+':'+coverIndex;
  const link=typeof partnerLink==='function'?partnerLink(selected):'';
  customInstagramCaptions[key]=trim(data.caption,3000)+'\n\n'+(link?link+'\n':'')+affiliateDisclosure;
  if(typeof renderInstagram==='function')renderInstagram();
  window.vpCreatorRenderReview?.();
  if(note)note.textContent='단품형 5장 AI 기획 완료. 카드를 수정하고 이미지·카드 탭에서 실사 생성 및 ZIP 저장을 진행하세요.';
 }catch(e){if(note)note.textContent='캐러셀 기획 실패: '+e.message}
 finally{creating=false;if(button)button.disabled=false;redraw()}
}
function init(){
 const copy=$('#instagram .vpStudioStage[data-studio-stage="copy"]');if(!copy)return;
 const panel=document.createElement('section');panel.id='vpInstagramSingleStory';panel.className='vpCreatorPhase vpInstagramSingleStory';
 panel.innerHTML='<div class="vpCreatorPhaseLabel"><span>01</span><strong>단품형 캐러셀 · 불편에서 해결까지 5장</strong><small>Threads에서 선택한 같은 상품과 후킹을 재사용합니다. 5장의 카드 제목과 설명을 직접 바꿀 수 있습니다.</small></div>'+
 '<div class="vpSingleStoryActions"><button class="btn" type="button" id="vpInstagramSingleSwitch">현재 상품으로 단품형 제작</button>'+
 '<button class="btn primary" type="button" id="vpInstagramSingleGenerate">✨ AI 5장 캐러셀 스토리 기획</button></div>'+
 '<p class="vpSingleStoryMode"></p><div class="vpSingleSlideList"></div>'+
 '<p id="vpInstagramStoryStatus" class="queueHint" role="status">01 후킹 → 02 공감 → 03 제품 해결 → 04 검증된 장점 → 05 체크리스트·저장 유도</p>';
 const lead=copy.querySelector('.vpStudioCopyLead');
 if(lead)copy.insertBefore(panel,lead);else copy.append(panel);
 panel.querySelector('#vpInstagramSingleSwitch').onclick=()=>{
  changeMultiMode('Instagram','single');redraw();renderInstagram();
 };
 panel.querySelector('#vpInstagramSingleGenerate').onclick=()=>void generate();
 window.vpInstagramSingleStoryForSlide=slide;
 window.vpInstagramSingleCaption=()=>getStory().caption||'';
 window.vpInstagramSingleStoryRefresh=redraw;
 // Hook the normal product selection sync without disturbing the Threads editor.
 const prior=window.vpCreatorRefresh;
 window.vpCreatorRefresh=()=>{prior?.();redraw()};
 redraw();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
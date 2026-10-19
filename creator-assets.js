/* ViralPick creator assets: reference photo gallery, 5 hook choices, realistic previews. */
(function(){
'use strict';
const HOOK_KEY='vp-creator-hooks-v1';
const ALIAS_KEY='vp-creator-alias-v1';
const $=s=>document.querySelector(s);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={threads:{chosen:'',rights:false,busy:false,owner:''},instagram:{chosen:'',rights:false,busy:false,owner:''}};
const fields=['threads','instagram'];
function ownerKey(){return String(typeof selected==='undefined'?'':selected?.id||'')}
function storageValue(key,backup={}){
 try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'&&!Array.isArray(value)?value:backup}catch{return backup}
}
function validImageURL(url){
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&(!u.port)&&(!u.username)&&(!u.password)&&(
    u.hostname==='coupangcdn.com'||u.hostname.endsWith('.coupangcdn.com'));
 }catch{return false}
}
function assets(){
 const p=selected;
 const result=[];
 if(validImageURL(p?.imageUrl))result.push({id:'thumb',type:'remote',src:p.imageUrl,label:'쿠팡 대표 썸네일'});
 const evidence=typeof loadReviewEvidence==='function'?loadReviewEvidence(String(p?.coupangProductId||'')):null;
 const images=Array.isArray(evidence?.images)?evidence.images:[];
 const seen=new Set(result.map(x=>x.src));
 images.forEach((src,i)=>{
  if(validImageURL(src)&&!seen.has(src)){seen.add(src);result.push({id:'detail:'+i,type:'remote',src,label:'상세 이미지 '+(i+1)})}
 });
 const upload=typeof currentMedia==='function'?currentMedia()?.product:null;
 if(upload?.kind==='licensed-upload'&&typeof upload.data==='string'&&upload.data.startsWith('data:image/')){
  result.unshift({id:'upload',type:'upload',src:upload.data,label:'내 제품 사진'});
 }
 return result.slice(0,35);
}
function selection(platform){
 const items=assets(),s=state[platform];
 if(s.owner!==ownerKey()){s.owner=ownerKey();s.chosen='';s.rights=false}
 const valid=items.find(x=>x.id===s.chosen);
 if(valid)return valid;
 const cached=(()=>{try{return sessionStorage.getItem('vp-creator-photo:'+ownerKey()+':'+platform)}catch{return null}})();
 const restored=items.find(x=>x.id===cached);
 const next=restored||items[0]||null;
 s.chosen=next?.id||'';
 return next;
}
function choose(platform,id){
 const target=assets().find(x=>x.id===id);
 if(!target)return;
 const s=state[platform];
 s.chosen=id;s.rights=false;
 try{sessionStorage.setItem('vp-creator-photo:'+ownerKey()+':'+platform,id)}catch{}
 renderGallery(platform);
}
function getReference(platform){
 const ref=selection(platform);
 if(!ref)throw Error('참고할 상품 사진이 없습니다. 쿠팡 API 썸네일을 불러오거나 리뷰 추출 마크다운을 분석하거나 사진을 업로드해 주세요.');
 if(ref.type==='remote'&&!state[platform].rights)throw Error('쿠팡 이미지의 상업적 편집·AI 활용 권한을 먼저 확인해 주세요.');
 return ref;
}
async function payload(platform){
 const ref=getReference(platform);
 if(ref.type==='upload')return {imageMode:'product',referenceImage:await vpResizeReferenceImage(ref.src),referenceRightsConfirmed:true,referenceLabel:ref.label};
 return {imageMode:'product',referenceUrl:ref.src,referenceRightsConfirmed:true,referenceLabel:ref.label};
}
function hookKey(platform){return ownerKey()+':'+platform}
function hooks(platform){
 const stored=storageValue(HOOK_KEY),existing=stored[hookKey(platform)];
 if(Array.isArray(existing)&&existing.length===5)return existing;
 const data=typeof getLifestyleHooks==='function'?getLifestyleHooks(selected):null;
 const options=(data?.scenes||['일상에서 이런 순간 있지 않아?','매번 귀찮았던 순간','다들 이런 상황에서 뭐 써?','손이 계속 가는 일이 있음','귀찮은 순간이 반복될 때']).filter(Boolean);
 return [...new Set([...options,...options])].slice(0,5);
}
function renderGallery(platform){
 const root=$('#vpAssetStudio'+(platform==='threads'?'Threads':'Instagram'));
 if(!root)return;
 const photos=assets(),chosen=selection(platform);
 const display=root.querySelector('.vpAssetGrid');
 const selectedText=root.querySelector('.vpChosenImage');
 if(display){
  display.replaceChildren();
  if(!photos.length){const el=document.createElement('p');el.className='vpCreatorEmpty';el.textContent='상품 이미지가 없습니다. 상품 발굴에서 쿠팡 상품을 선택하거나 아래에서 직접 사진을 업로드하세요.';display.append(el)}
  photos.forEach(photo=>{
   const button=document.createElement('button');button.type='button';button.className='vpAssetItem'+(chosen?.id===photo.id?' active':'');
   button.setAttribute('aria-pressed',String(chosen?.id===photo.id));
   button.title=photo.label+' 선택';
   const img=document.createElement('img');img.src=photo.src;img.alt=photo.label;img.loading='lazy';
   const label=document.createElement('span');label.textContent=photo.label;
   button.append(img,label);button.onclick=()=>choose(platform,photo.id);
   display.append(button);
  });
 }
 if(selectedText)selectedText.textContent=chosen?'선택된 이미지: '+chosen.label+' · 선택한 제품을 사용하는 자연스러운 실사 장면으로 제작':'아직 선택된 이미지가 없습니다.';
 const confirm=root.querySelector('.vpAssetRights');
 if(confirm){
  confirm.hidden=!chosen||chosen.type==='upload';
  const check=confirm.querySelector('input');
  if(check)check.checked=state[platform].rights;
 }
 root.querySelector('.vpImageCreate')?.toggleAttribute('disabled',!chosen||state[platform].busy);
 root.querySelector('.vpAssetCount')?.replaceChildren(document.createTextNode(photos.length+'장'));
 renderHooks(platform);
}
function renderHooks(platform){
 const root=$('#vpAssetStudio'+(platform==='threads'?'Threads':'Instagram'));
 if(!root)return;
 const container=root.querySelector('.vpHookChoices');if(!container)return;
 container.replaceChildren();
 const current=platform==='threads'?getHookHeadline():getInstagramCoverHeadline();
 hooks(platform).forEach((text,i)=>{
  const button=document.createElement('button');button.type='button';button.className='vpHookOption'+(text===current?' active':'');
  button.setAttribute('aria-pressed',String(text===current));button.textContent=(i+1)+'. '+text;
  button.onclick=()=>applyHook(platform,text);
  container.append(button);
 });
 const input=root.querySelector('.vpCustomHook');if(input&&document.activeElement!==input)input.value=current||'';
}
function applyHook(platform,text){
 if(!text.trim())return;
 if(platform==='threads'){editHookHeadline(text.slice(0,120));renderThreads();}
 else{editInstagramCoverHeadline(text.slice(0,120));renderInstagram();}
 renderHooks(platform);
 renderFinalPreviews();
}
async function regenerateHooks(platform){
 const root=$('#vpAssetStudio'+(platform==='threads'?'Threads':'Instagram')),button=root?.querySelector('.vpHookRegenerate'),status=root?.querySelector('.vpHookStatus');
 if(!button||button.disabled)return;
 if(!window.confirm('OpenAI API를 이용해 후킹 문구 5개를 새로 만들까요? 비용이 발생할 수 있습니다.'))return;
 button.disabled=true;status.textContent='AI가 생활형 후킹 문구 5개를 작성 중입니다…';
 try{
  const evidence=typeof loadReviewEvidence==='function'?loadReviewEvidence(String(selected?.coupangProductId||'')):null;
  const reviews=Array.isArray(evidence?.reviews)?evidence.reviews.map(r=>r.content).join('\n').slice(0,4800):$('#vpAiReviews')?.value||'';
  const data=await backendRequest('/api/hooks',{method:'POST',body:JSON.stringify({platform:platform==='threads'?'Threads':'Instagram',title:selected.name,description:$('#vpAiDescription')?.value||'',reviews})});
  if(!Array.isArray(data.hooks)||data.hooks.length!==5)throw Error('후킹 후보 5개를 받지 못했습니다.');
  const all=storageValue(HOOK_KEY);all[hookKey(platform)]=data.hooks;
  try{localStorage.setItem(HOOK_KEY,JSON.stringify(all))}catch{}
  status.textContent='AI 후킹 5개 생성 완료. 마음에 드는 문구를 눌러 이미지에 적용하세요.';
  renderHooks(platform);
 }catch(e){status.textContent='후킹 생성 실패: '+e.message}
 finally{button.disabled=false}
}
function sceneText(platform){
 const root=$('#vpAssetStudio'+(platform==='threads'?'Threads':'Instagram'));
 return String(root?.querySelector('.vpCreatorScene')?.value||'').trim()||String(selected.visual||'').trim()||'제품을 일상에서 자연스럽게 사용하는 생활 장면';
}
function setGenerating(platform,busy,message){
 const current=state[platform];if(!current)return;
 current.busy=!!busy;
 const root=$('#vpAssetStudio'+(platform==='threads'?'Threads':'Instagram'));
 const button=root?.querySelector('.vpImageCreate');
 if(button){button.disabled=!!busy||!selection(platform);button.textContent=busy?'AI 실사 사진 2장 생성 중…':'선택한 제품으로 실사 배경 2장 생성'}
 const status=root?.querySelector('.vpAssetStatus');
 if(status&&message)status.textContent=message;
}
function generate(platform){
 const root=$('#vpAssetStudio'+(platform==='threads'?'Threads':'Instagram')),status=root?.querySelector('.vpAssetStatus');
 try{
  const ref=getReference(platform);
  status.textContent='선택한 '+ref.label+' 기준으로 실사 이미지를 생성합니다. 모델 요금 승인 후 요청됩니다.';
  const scene=$('#'+platform+' .vpCreatorScene');
  if(scene&&typeof sceneText(platform)==='string')scene.dataset.activeScene=sceneText(platform);
  return requestAiScene(platform);
 }catch(e){if(status)status.textContent=e.message}
}
function creatorNode(platform){
 const root=document.createElement('div');root.className='vpCreatorReference';
 root.innerHTML='<div class="vpCreatorTitle"><div><h3>실제 상품 사진 선택</h3><p>쿠팡 API 대표 썸네일 · 리뷰 추출기 상세 이미지 · 직접 업로드한 사진을 모았습니다.</p></div><span class="vpAssetCount">0장</span></div>'+
 '<div class="vpAssetGrid" role="group" aria-label="제품 이미지 선택"></div><p class="vpChosenImage" aria-live="polite"></p>'+
 '<label class="vpAssetRights"><input type="checkbox"> 이 이미지의 상업적 편집·AI 활용 권한을 확인했습니다.</label>'+
 '<div class="vpCreatorUpload"><label class="btn">내 제품 사진 추가<input class="vpAssetUpload" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><details><summary>상황 사진 직접 업로드 · 이미지 제거</summary><input type="file" class="vpAssetSceneUpload" accept="image/png,image/jpeg,image/webp"><button type="button" class="btn vpAssetClear">기존 상품 사진 제거</button></details></div>'+
 '<div class="vpCreatorHookHeader"><div><h3>이미지 후킹 문구 5개</h3><p>상황·감정 중심의 문구를 선택하면 실제 이미지 문구에 반영됩니다.</p></div><button type="button" class="btn vpHookRegenerate">✨ AI 후킹 5개 새로 생성</button></div>'+
 '<div class="vpHookChoices" role="group" aria-label="후킹 문구 선택"></div><label class="vpCreatorDirect">후킹 문구 직접 수정<input class="vpCustomHook" maxlength="120" type="text" placeholder="직접 후킹 문구 입력"></label><p class="vpHookStatus" role="status">기본 생활형 후보 5개 제공 · AI 재생성 시 API 비용 발생</p>'+
 '<div class="vpCreatorSceneRow"><label>제품을 사용하는 장면 설명<textarea class="vpCreatorScene" maxlength="500" rows="2" placeholder="예: 외식 중 보호자가 아기에게 일회용 턱받이를 착용시키는 자연스러운 장면"></textarea></label><button type="button" class="btn primary vpImageCreate">선택한 제품으로 실사 배경 2장 생성</button></div><p class="vpAssetStatus" role="status">제품 이미지를 선택하고 편집 권한을 확인한 뒤 생성하세요. AI 생성물은 원본과 차이가 날 수 있습니다.</p>';
 // Assemble the visual editor in the same order people work:
 // 1) narrative hook, 2) real-product photo and image generation, 3) legacy layouts (outside this component).
 const hookStep=document.createElement('section');
 hookStep.className='vpCreatorPhase vpCreatorHookStep';
 const hookHeading=document.createElement('div');hookHeading.className='vpCreatorPhaseLabel';
 hookHeading.innerHTML='<span>01</span><strong>후킹 문장 선택</strong><small>이 문장의 실제 상황을 이미지로 보여줍니다.</small>';
 hookStep.appendChild(hookHeading);
 for(const selector of ['.vpCreatorHookHeader','.vpHookChoices','.vpCreatorDirect','.vpHookStatus']){
  const node=root.querySelector(selector);if(node)hookStep.appendChild(node);
 }
 const photoStep=document.createElement('section');
 photoStep.className='vpCreatorPhase vpCreatorPhotoStep';
 const photoHeading=document.createElement('div');photoHeading.className='vpCreatorPhaseLabel';
 photoHeading.innerHTML='<span>02</span><strong>상품 이미지 선택 · 실사 배경 생성</strong><small>선택한 제품 사진과 위 후킹 문장의 상황을 함께 반영합니다.</small>';
 photoStep.appendChild(photoHeading);
 for(const selector of ['.vpCreatorTitle','.vpAssetGrid','.vpChosenImage','.vpAssetRights','.vpCreatorUpload','.vpCreatorSceneRow','.vpAssetStatus']){
  const node=root.querySelector(selector);if(node)photoStep.appendChild(node);
 }
 root.prepend(hookStep);root.appendChild(photoStep);
 root.querySelector('.vpAssetRights input').onchange=e=>{state[platform].rights=e.target.checked};
 root.querySelector('.vpAssetUpload').onchange=async e=>{if(e.target.files?.[0]){await uploadProductImage(e.target.files[0]);if(currentMedia()?.product?.kind==='licensed-upload'){state[platform].chosen='upload';state[platform].rights=true}else{state[platform].rights=false}renderGallery(platform)}};
 root.querySelector('.vpAssetSceneUpload').onchange=e=>{if(e.target.files?.[0])void uploadSceneImage(e.target.files[0])};
 root.querySelector('.vpAssetClear').onclick=()=>{clearAsset('product');state[platform].chosen='';state[platform].rights=false;renderGallery(platform)};
 root.querySelector('.vpHookRegenerate').onclick=()=>regenerateHooks(platform);
 root.querySelector('.vpImageCreate').onclick=()=>generate(platform);
 root.querySelector('.vpCustomHook').onchange=e=>applyHook(platform,e.target.value);
 return root;
}
function makeThreadPreview(){
 const panel=document.createElement('section');panel.className='vpSocialReviewPanel';
 panel.innerHTML='<div class="vpSocialReviewHeading"><div><h3>Threads 게시물 미리보기</h3><p>Threads 실제 화면을 참고한 검토용 시안입니다. 이 화면에서 직접 게시되지는 않습니다.</p></div><label>표시 계정명<input class="vpPreviewAlias" maxlength="45" placeholder="내 Threads 계정"></label></div>'+
 '<div class="vpThreadFeed"><article class="vpPost vpFirstPost"><div class="vpSocialRail"><span class="vpSocialAvatar">V</span><i></i></div><div class="vpPostContents"><header><strong class="vpPreviewName">내 Threads 계정</strong><span>방금</span><b>···</b></header><div class="vpPreviewBody vpPreviewFirst"></div><div class="vpPreviewMedia" hidden><img alt="생성된 후킹 이미지 미리보기"></div><div class="vpSocialCounts"><span>♡</span><span>▢</span><span>↻</span><span>↗</span><span class="vpPart">1/2</span></div></div></article>'+
 '<article class="vpPost vpSecondPost"><div class="vpSocialRail"><span class="vpSocialAvatar">V</span></div><div class="vpPostContents"><header><strong class="vpPreviewName">내 Threads 계정</strong><span>방금</span><b>···</b></header><div class="vpPreviewBody vpPreviewSecond"></div><div class="vpSocialCounts"><span>♡</span><span>▢</span><span>↻</span><span>↗</span><span class="vpPart">2/2</span></div></div></article></div>'+
 '<div class="vpSocialReviewFoot"><button type="button" class="btn vpCopyOne">1단 복사</button><button type="button" class="btn vpCopyTwo">2단 복사</button><button type="button" class="btn primary vpCopyBoth">1·2단 전체 복사</button></div>';
 panel.querySelector('.vpPreviewAlias').oninput=e=>{
  const alias=e.target.value.trim().slice(0,45);
  try{localStorage.setItem(ALIAS_KEY,alias)}catch{}
  renderThreadPreview();
 };
 panel.querySelector('.vpCopyOne').onclick=()=>copyThreadPart(1);
 panel.querySelector('.vpCopyTwo').onclick=()=>copyThreadPart(2);
 panel.querySelector('.vpCopyBoth').onclick=()=>copyThread();
 return panel;
}
function makeInstagramPreview(){
 const panel=document.createElement('section');panel.className='vpSocialReviewPanel';
 panel.innerHTML='<div class="vpSocialReviewHeading"><div><h3>Instagram 최종 게시물 미리보기</h3><p>캐러셀 표지와 캡션을 검토하는 시안입니다.</p></div></div><div class="vpInstagramReview"><div class="vpInstagramReviewCover"><img alt="Instagram 캐러셀 표지"></div><p class="vpInstagramReviewCaption"></p></div>';
 return panel;
}
function cardImage(platform){
 try{
  const canvas=buildContentCanvas(platform==='threads'?'Threads':'Instagram',0,platform==='threads'?threadImageIndex:undefined);
  if(canvas?.width)return canvas.toDataURL('image/jpeg',0.73);
 }catch{}
 return currentMedia()?.scene?.data||selected?.imageUrl||'';
}
function renderThreadPreview(){
 const root=$('#vpThreadSocialReview');if(!root)return;
 const alias=(()=>{try{return localStorage.getItem(ALIAS_KEY)||'내 Threads 계정'}catch{return '내 Threads 계정'}})();
 const input=root.querySelector('.vpPreviewAlias');if(input&&document.activeElement!==input)input.value=alias;
 root.querySelectorAll('.vpPreviewName').forEach(n=>n.textContent=alias);
 root.querySelectorAll('.vpSocialAvatar').forEach(n=>n.textContent=(alias||'V').slice(0,1).toUpperCase());
 root.querySelector('.vpPreviewFirst').textContent=getCurrentThreadText();
 root.querySelector('.vpPreviewSecond').textContent=getThreadReplyText();
 const frame=root.querySelector('.vpPreviewMedia'),img=frame?.querySelector('img');
 const src=cardImage('threads');
 if(img&&src){img.src=src;frame.hidden=false}else if(frame)frame.hidden=true;
}
function renderInstagramPreview(){
 const root=$('#vpInstagramSocialReview');if(!root)return;
 const image=cardImage('instagram'),img=root.querySelector('.vpInstagramReviewCover img');
 if(image)img.src=image;else img.removeAttribute('src');
 root.querySelector('.vpInstagramReviewCaption').textContent=getCurrentInstagramCaption();
}
function renderFinalPreviews(){if($('#threads .vpStudioStage[data-studio-stage="final"]')?.hidden===false)renderThreadPreview();if($('#instagram .vpStudioStage[data-studio-stage="final"]')?.hidden===false)renderInstagramPreview()}
function refresh(){
 fields.forEach(p=>{
  if(selection(p)?.id==='upload'&&!assets().some(x=>x.id==='upload'))state[p].chosen='thumb';
  renderGallery(p);
 });
 renderFinalPreviews();
}
function init(){
 const threads=$('#vpAssetStudioThreads'),insta=$('#vpAssetStudioInstagram');
 if(!threads||!insta)return;
 threads.replaceChildren(creatorNode('threads'));
 insta.replaceChildren(creatorNode('instagram'));
 // Preserve the legacy photo-style dropdown; it belongs to image generation, not the 3 layout previews.
 const stylePicker=$('#threads .vpStudioThreadArt .hookMakerTools label');
 const photoSection=$('#vpAssetStudioThreads .vpCreatorPhotoStep');
 const sceneRow=photoSection?.querySelector('.vpCreatorSceneRow');
 if(stylePicker&&sceneRow){
  stylePicker.classList.add('vpCreatorStylePicker');
  photoSection.insertBefore(stylePicker,sceneRow);
 }
 const first=$('#threads .vpStudioStage[data-studio-stage="final"]');
 if(first){const panel=makeThreadPreview();panel.id='vpThreadSocialReview';first.insertBefore(panel,first.querySelector('.vpStudioReviewNote')||first.children[1])}
 const second=$('#instagram .vpStudioStage[data-studio-stage="final"]');
 if(second){const panel=makeInstagramPreview();panel.id='vpInstagramSocialReview';second.insertBefore(panel,second.querySelector('.vpStudioReviewNote')||second.children[1])}
 window.vpCreatorSetGenerating=setGenerating;
 window.vpCreatorReferencePayload=payload;
 window.vpCreatorSceneText=sceneText;
 window.vpCreatorRefresh=refresh;
 window.vpCreatorRenderReview=renderFinalPreviews;
 window.vpCreatorRequireReference=getReference;
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
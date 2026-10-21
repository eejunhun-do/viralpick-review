/* ViralPick blog planning studio: product shared with Threads and Instagram. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const state={id:null,fp:'',plan:null,type:null,draft:null,title:0,edited:'',busy:false,plans:new Map(),drafts:new Map(),media:{owner:null,slots:null,uploads:[],consent:false}};
const typeIds=['problem','howto','cause','compare','buying','faq','situation','checklist'];
const weights=[['검색 수요 추정',35],['검색 의도',25],['차별화 여지',20],['정보 신뢰성',10],['구매 연관성',10]];
const make=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e};
const target=(id,value)=>{const e=$('#'+id);if(e)e.textContent=value};
const pCurrent=()=>typeof selected==='object'&&selected?.source!=='sample'?selected:null;
function productInput(){
 const p=pCurrent();if(!p)return null;
 return {name:p.name,category:p.type,problem:p.problem,audience:p.audience,
 description:String($('#vpAiDescription')?.value||p.novel||'').slice(0,1700),
 research:window.vpProductResearchContext?.(p.id)||null,
 threadsHook:String(typeof getHookHeadline==='function'?getHookHeadline():'').slice(0,240),
 instagramHook:String(window.vpInstagramSingleStoryForSlide?.(0)?.title||'').slice(0,240)};
}
function imageUrl(p){try{const url=new URL(p?.imageUrl);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}}
function partnerUrl(p){
 const link=typeof publishPartnerLink==='function'?publishPartnerLink(p):null;
 return typeof link==='string'&&/^https:\/\/(?:coupa\.ng|link\.coupang\.com)\//.test(link)?link:'';
}
function putStatus(msg,kind='info'){
 const el=$('#vpBlogStatus');if(el){el.textContent=msg;el.dataset.kind=kind}
 // These are actual completed/failed UI outcomes, distinct from button-click intent.
 if(kind==='error')window.vpActivity?.error('블로그 · 작업 실패',String(msg).slice(0,190));
 else if(kind==='success')window.vpActivity?.info('블로그 · 처리 완료',String(msg).slice(0,190));
}
function setBusy(b,msg){
 state.busy=b;
 for(const id of ['vpBlogAnalyze','vpBlogRefresh','vpBlogWrite']){const btn=$('#'+id);if(btn)btn.disabled=b||!pCurrent()}
 if(msg)putStatus(msg);
}
function init(){
 if(!$('#vpBlogStudio')||$('#vpBlogStudio').dataset.ready)return;
 $('#vpBlogStudio').dataset.ready='1';
 $('#vpBlogGoDiscovery').onclick=()=>show('discover');
 $('#vpBlogAnalyze').onclick=()=>void analyze(true);
 $('#vpBlogRefresh').onclick=()=>void analyze(true);
 $('#vpBlogWrite').onclick=()=>void generateArticle();
 $('#vpBlogCopy').onclick=()=>void copyDraft();
 $('#vpBlogDownload').onclick=downloadDraft;
 $('#vpBlogRestoreImages').onclick=()=>{
  state.media.slots=null;renderImageManager();preview();
  putStatus('사용 가능한 사진을 기준으로 본문 이미지 추천 배치를 복원했습니다.','success');
 };
 $('#vpBlogImageRights').onchange=e=>{
  state.media.consent=!!e.target.checked;state.media.slots=null;
  renderImageManager();preview();
 };
 $('#vpBlogImageUploads').onchange=e=>void uploadBlogImages(e.target.files);
 $('#vpBlogFinalEdit').oninput=()=>{state.edited=$('#vpBlogFinalEdit').value;preview()};
 for(const [name,score] of weights){
  const el=make('div','vpBlogWeight');el.append(make('span','',name),make('strong','',score+'점'));$('#vpBlogWeights').append(el);
 }
 const original=window.show;
 if(typeof original==='function'&&!original.__vpBlog){
  const f=function(view){const result=original(view);if(view==='blog')sync();return result};
  f.__vpBlog=true;window.show=f;
 }
 sync();
}
function sync(){
 const p=pCurrent(),id=p?String(p.id):null,input=productInput(),fp=JSON.stringify(input||{}).slice(0,10000);
 if(state.id!==id||state.fp!==fp){
  if(state.id!==id){state.media={owner:id,slots:null,uploads:[],consent:false};if($('#vpBlogImageRights'))$('#vpBlogImageRights').checked=false}
  state.id=id;state.fp=fp;state.plan=null;state.draft=null;state.edited='';state.title=0;state.type=null;
  const saved=state.plans.get(id);
  if(saved&&saved.fp===fp){state.plan=saved.plan;state.type=saved.plan.recommended[0]}
 }
 const image=$('#vpBlogProductImg');if(!image)return;
 image.replaceChildren();const url=imageUrl(p);
 if(url){const img=make('img');img.alt=p.name+' 원본 이미지';img.src=url;img.loading='lazy';image.append(img)}
 else image.append(make('span','',p?'썸네일 없음':'상품 미선택'));
 target('vpBlogProductName',p?.name||'실제 상품을 선택해 주세요');
 target('vpBlogProductNotice',p?'Threads·Instagram과 동일한 상품 · '+(url?'썸네일 확인':'사진 없음')+' · AI 웹조사 자료 재사용':'상품 발굴에서 쿠팡 또는 직접 등록 상품을 선택해 주세요.');
 $('#vpBlogAnalyze').disabled=!p||state.busy;
 $('#vpBlogResults').hidden=!state.plan;
 if(state.plan)renderPlan();
 else putStatus(p?'8가지 글 유형 분석을 누르면 검색 의도별 추천·키워드가 표시됩니다.':'상품 발굴에서 실제 상품을 선택해 주세요.');
}
async function analyze(force){
 if(state.busy)return;
 const data=productInput(),id=state.id,fp=state.fp;
 if(!data){putStatus('실제 상품을 먼저 선택해 주세요.','error');return}
 if(!force&&state.plans.has(id)){state.plan=state.plans.get(id).plan;state.type=state.plan.recommended[0];renderPlan();return}
 setBusy(true,'AI가 8가지 블로그 유형의 검색 적합도와 키워드를 분석 중입니다…');
 try{
  const res=await backendRequest('/api/blog',{method:'POST',body:JSON.stringify({action:'plan',product:data})});
  if(state.id!==id||state.fp!==fp)return;
  if(!res.plan?.types||res.plan.types.length!==8)throw Error('8가지 유형 점수를 받지 못했습니다.');
  state.plan=res.plan;state.plans.set(id,{fp,plan:res.plan});state.type=res.plan.recommended[0];
  state.draft=null;state.edited='';renderPlan();
  putStatus('분석 완료 · 상위 3가지 유형을 추천했습니다. 원하는 유형을 선택한 뒤 본문을 작성하세요.','success');
 }catch(e){putStatus('분석 실패: '+String(e.message||e),'error')}
 finally{setBusy(false)}
}
function clickable(label,cls,onClick){
 const b=make('button',cls,label);b.type='button';b.onclick=onClick;return b;
}
function chooseType(type){
 if(!typeIds.includes(type)||!state.plan)return;
 if(state.type!==type){state.type=type;state.draft=null;state.edited='';state.title=0}
 renderPlan();
}
function renderPlan(){
 if(!state.plan)return;$('#vpBlogResults').hidden=false;
 const top=$('#vpBlogTopThree');top.replaceChildren();
 state.plan.types.slice(0,3).forEach((row,i)=>{
  const b=clickable('','vpBlogTop '+(row.id===state.type?'selected':''),()=>chooseType(row.id));
  b.append(make('small','',(i+1)+'순위 추천'),make('strong','',row.name),make('span','vpBlogScore',row.score+'점'),make('p','',row.reason||row.intent));top.append(b);
 });
 const grid=$('#vpBlogTypes');grid.replaceChildren();
 state.plan.types.forEach((row,i)=>{
  const b=clickable('','vpBlogType '+(row.id===state.type?'selected':''),()=>chooseType(row.id));
  b.setAttribute('aria-pressed',String(row.id===state.type));
  const line=make('div','vpBlogTypeTop');line.append(make('span','',String(i+1).padStart(2,'0')+' · '+row.name),make('strong','',row.score+'점'));
  const track=make('div','vpBlogBar'),fill=make('span');fill.style.width=row.score+'%';track.append(fill);
  b.append(line,track,make('p','',row.topic||row.intent));grid.append(b);
 });
 const row=state.plan.types.find(t=>t.id===state.type)||state.plan.types[0];
 target('vpBlogChosenType',row.name+' · 예상 '+row.score+'점');
 const words=$('#vpBlogKeywords');words.replaceChildren();
 row.keywords.forEach(kw=>words.append(make('span','vpBlogKeyword',kw)));
 target('vpBlogAngle',row.angle||row.reason);
 const detail=$('#vpBlogScoreDetail');detail.replaceChildren();
 for(const [key,name,weight] of [['demand','검색 수요 추정',35],['intent','검색 의도 적합성',25],['competition','차별화 여지',20],['trust','정보 신뢰성',10],['conversion','구매 연결성',10]]){
  const score=Number(row.ratings?.[key])||0;
  const item=make('div','vpBlogFactor'),head=make('div','vpBlogFactorHead');
  head.append(make('span','',name+' · 가중치 '+weight+'점'),make('strong','',score+'/100'));
  const track=make('div','vpBlogFactorTrack'),fill=make('span');fill.style.width=score+'%';track.append(fill);
  item.append(head,track);detail.append(item);
 }
 $('#vpBlogDraftSection').hidden=!state.draft;
 if(state.draft)renderDraft();
}
function title(){return state.draft?.titles?.[state.title]||''}
function fullText(){
 const d=state.draft;if(!d)return '';
 const p=pCurrent(),link=partnerUrl(p);
 const lines=[title(),'','※ 이 글에는 제휴 링크가 포함될 수 있으며 링크를 통해 구매 시 일정액의 수수료를 제공받을 수 있습니다.','',d.intro||'',''];
 d.sections.forEach(section=>{lines.push('['+section.heading+']',...section.paragraphs,'')});
 if(d.faq?.length){lines.push('[자주 묻는 질문]');d.faq.forEach(x=>lines.push('Q. '+x.q,'A. '+x.a,''))}
 lines.push('[마무리]',d.conclusion||'','');
 lines.push(link?'상품 상세정보(제휴 링크): '+link:'※ 제휴 링크가 발급되지 않았습니다. 게시 전 별도로 확인해 주세요.');
 return lines.join('\n').trim();
}
const mediaPlacements=[
 {fraction:.2,label:'도입 이후 (약 20%)'},
 {fraction:.4,label:'본문 초반 (약 40%)'},
 {fraction:.6,label:'본문 중후반 (약 60%)'},
 {fraction:.8,label:'마무리 이전 (약 80%)'}
];
function validInlineImage(src){
 return typeof src==='string'&&src.length<14000000&&/^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(src);
}
function safeRemoteImage(src,detail=false){
 try{
  const u=new URL(src);
  if(u.protocol!=='https:'||u.port||u.username||u.password||u.hostname.length>240)return false;
  return !detail||(u.hostname==='coupangcdn.com'||u.hostname.endsWith('.coupangcdn.com'));
 }catch{return false}
}
function availableBlogImages(){
 const images=[],used=new Set(),p=pCurrent();
 const add=(id,label,src,kind)=>{
  if(!src||used.has(src))return;
  if(kind==='generated'||kind==='upload'){
   if(!validInlineImage(src))return;
  }else if(!safeRemoteImage(src,kind==='detail'))return;
  used.add(src);
  images.push({id,label,src,kind});
 };
 if(typeof carouselImageForSlide==='function'&&p){
  for(const n of [1,3,4,5,2]){
   const asset=carouselImageForSlide(n,p.id);
   add('instagram:'+n,'Instagram '+n+'번 · '+(n<3?'문제 상황':'제품 활용')+' (AI 생성)',asset?.data,'generated');
  }
 }
 const own=typeof currentMedia==='function'?currentMedia()?.product:null;
 if(own?.kind==='licensed-upload')add('licensed','직접 등록한 제품 사진',own.data,'upload');
 for(const photo of state.media.uploads)add(photo.id,photo.label,photo.src,'upload');
 // A product thumbnail can be shown in the editor. Users must still check publication rights.
 if(p)add('thumb','상품 대표 썸네일 · 게시 권한 확인 필요',imageUrl(p),'thumbnail');
 if(state.media.consent&&p&&typeof loadReviewEvidence==='function'){
  const detail=loadReviewEvidence(String(p.coupangProductId||''))?.images||[];
  if(Array.isArray(detail))detail.slice(0,12).forEach((url,i)=>add('detail:'+i,'상품 상세 이미지 '+(i+1),url,'detail'));
 }
 return images;
}
function ensureImageSlots(sources){
 const media=state.media;
 if(media.slots===null){
  media.slots=sources.slice(0,4).map((src,i)=>({id:src.id,placement:i}));
 }
 media.slots=media.slots.filter(slot=>sources.some(src=>src.id===slot.id)).slice(0,4);
 return media.slots;
}
function renderImageManager(){
 const box=$('#vpBlogImageRows'),info=$('#vpBlogImageStatus');if(!box||!state.draft)return;
 const sources=availableBlogImages(),slots=ensureImageSlots(sources);
 box.replaceChildren();
 if(!sources.length){
  info.textContent='재사용할 사진이 없습니다. Instagram 이미지를 먼저 만들거나 아래에서 직접 사진을 추가해 주세요.';
  return;
 }
 info.textContent='본문 이미지 '+slots.length+'장 배치 · 사용 가능한 사진 '+sources.length+'장 · 업로드한 사진은 현재 브라우저 탭에서만 유지됩니다.';
 slots.forEach((slot,index)=>{
  const source=sources.find(item=>item.id===slot.id);if(!source)return;
  const row=make('div','vpBlogImageRow');
  const thumb=make('img','vpBlogImageThumb');thumb.src=source.src;thumb.alt='본문 이미지 '+(index+1);thumb.loading='lazy';
  const fields=make('div','vpBlogImageFields'),selected=make('select','vpBlogImageSelect');
  selected.setAttribute('aria-label',(index+1)+'번째 본문 이미지 변경');
  sources.forEach(item=>{
   const option=make('option','',item.label);option.value=item.id;option.selected=item.id===slot.id;selected.append(option);
  });
  selected.onchange=()=>{slot.id=selected.value;renderImageManager();preview()};
  const placement=make('select','vpBlogPlaceSelect');
  placement.setAttribute('aria-label',(index+1)+'번째 이미지 배치 위치');
  mediaPlacements.forEach((point,i)=>{
   const option=make('option','',point.label);option.value=String(i);option.selected=slot.placement===i;placement.append(option);
  });
  placement.onchange=()=>{slot.placement=Number(placement.value);preview()};
  const actions=make('div','vpBlogImageActions');
  const remove=clickable('제거','vpBlogImageRemove',()=>{
   state.media.slots.splice(index,1);renderImageManager();preview();
  });
  actions.append(remove);
  if(source.kind==='generated'||source.kind==='upload'){
   const link=make('a','vpBlogImageDownload','파일 저장');
   link.href=source.src;const ext=source.src.startsWith('data:image/jpeg')?'jpg':source.src.startsWith('data:image/webp')?'webp':'png';link.download='ViralPick_블로그_이미지_'+(index+1)+'.'+ext;actions.append(link);
  }else{
   const link=make('a','vpBlogImageDownload','원본 보기');
   link.href=source.src;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);
  }
  fields.append(selected,placement,actions);row.append(thumb,fields);box.append(row);
 });
 if(slots.length<4&&sources.some(src=>!slots.some(slot=>slot.id===src.id))){
  box.append(clickable('＋ 사용 가능한 이미지 추가','vpBlogAddImage',()=>{
   const next=sources.find(src=>!state.media.slots.some(slot=>slot.id===src.id));
   if(next){state.media.slots.push({id:next.id,placement:Math.min(3,state.media.slots.length)});renderImageManager();preview()}
  }));
 }
}
async function uploadBlogImages(files){
 const owner=state.id;
 const allowed=['image/jpeg','image/png','image/webp'];
 const chosen=Array.from(files||[]).slice(0,4);
 const messages=[];
 for(const file of chosen){
  if(state.media.uploads.length>=4){messages.push('추가 사진은 최대 4장입니다.');break}
  if(!allowed.includes(file.type)||file.size>5*1024*1024||file.size<100){
   messages.push(file.name+'은 지원 형식 또는 5MB 제한을 확인해 주세요.');continue;
  }
  try{
   const data=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
   });
   if(!validInlineImage(data))throw Error('지원하지 않는 이미지 데이터입니다.');
   if(state.id!==owner)return; // prevent async file uploads leaking into another product
   state.media.uploads.push({id:'custom:'+Date.now()+':'+state.media.uploads.length,label:'추가 사진 '+(state.media.uploads.length+1),src:data});
  }catch(e){messages.push(file.name+': '+e.message)}
 }
 if($('#vpBlogImageUploads'))$('#vpBlogImageUploads').value='';
 // Fresh upload should be visible immediately, even when all other image slots were assigned.
 const sources=availableBlogImages();
 ensureImageSlots(sources);
 const newPhotos=state.media.uploads.filter(x=>!state.media.slots.some(slot=>slot.id===x.id));
 for(const photo of newPhotos){
  if(state.media.slots.length>=4)break;
  state.media.slots.push({id:photo.id,placement:state.media.slots.length});
 }
 renderImageManager();preview();
 if(messages.length)putStatus(messages.join(' / '),'error');
 else putStatus('블로그 이미지 '+chosen.length+'장 업로드를 처리했습니다. 배치 위치를 확인해 주세요.','success');
}
function inlineFigure(source){
 const fig=make('figure','vpBlogFigure vpBlogInlineFigure'),img=make('img');
 img.loading='lazy';img.src=source.src;img.alt=source.label;
 fig.append(img,make('figcaption','',source.label+(source.kind==='generated'?' · AI 생성 이미지':' · 게시 권한 확인 필요')));
 return fig;
}
function renderDraft(){
 const d=state.draft;if(!d)return;
 $('#vpBlogDraftSection').hidden=false;const list=$('#vpBlogTitles');list.replaceChildren();
 d.titles.forEach((val,index)=>{
  const role=d.titleRoles?.[index]||[
  {label:'검색 키워드 · 문제 해결'},{label:'검색 키워드 · 사용 방법'},{label:'검색 키워드 · 정보 탐색'},{label:'구매 직전 · 선택 기준'},{label:'확인된 상품명 또는 제품군'}
 ][index];
 const b=clickable('', 'vpBlogTitleOption '+(state.title===index?'active':''),()=>{
   const original=state.edited===fullText();state.title=index;
   if(original)state.edited=fullText();
   renderDraft();
  });
  b.append(make('span','vpBlogTitleRole',(index+1)+'번 · '+role.label),make('span','vpBlogTitleText',val));
  list.append(b);
 });
 if(!state.edited)state.edited=fullText();
 $('#vpBlogFinalEdit').value=state.edited;
 renderImageManager();preview();
 const checks=$('#vpBlogVerification');checks.replaceChildren();checks.append(make('strong','','게시 전 사실 확인'));
 const notes=['직접 써본 후기처럼 표현되지는 않았는지 확인','상품 스펙·사용 조건·안전 안내를 공식 자료와 대조','최신 가격·재고 및 제휴 고지 확인',...(partnerUrl(pCurrent())?[]:['제휴 링크 미발급: 쿠팡 파트너스 링크를 별도 확인해야 합니다.']),...(d.verificationNotes||[])];
 notes.forEach(x=>checks.append(make('p','','• '+x)));
}
function preview(){
 const root=$('#vpBlogPreview');if(!root||!state.draft)return;
 root.replaceChildren();
 const p=pCurrent(),url=imageUrl(p);
 root.append(make('h1','',title()),make('div','vpBlogDisclosure','※ 제휴 링크를 통한 구매 시 일정 수수료를 제공받을 수 있습니다.'));
 if(url){
  const fig=make('figure','vpBlogFigure'),img=make('img');
  img.src=url;img.loading='lazy';img.alt=p.name+' 상품 썸네일';
  fig.append(img,make('figcaption','','상품 대표 이미지 · 실제 게시 시 이용 권한 확인 필요'));root.append(fig);
 }
 const all=state.edited||fullText();
 const lines=all.split(/\n+/).map(x=>x.trim()).filter(x=>x&&x!==title()&&!x.startsWith('※')).slice(0,110);
 const isHeading=line=>/^\[[^\]]{2,90}\]$/.test(line);
 const paragraphs=lines.filter(x=>!isHeading(x)).length;
 const sources=availableBlogImages(),slots=ensureImageSlots(sources);
 const placements=slots.map((slot,index)=>({
  source:sources.find(x=>x.id===slot.id),
  after:Math.max(1,Math.ceil(paragraphs*(mediaPlacements[slot.placement]?.fraction||.2))),
  index
 })).filter(x=>x.source).sort((a,b)=>a.after-b.after||a.index-b.index);
 let consumed=0,paragraphCount=0;
 for(const line of lines){
  const heading=isHeading(line);
  root.append(make(heading?'h2':'p','',heading?line.slice(1,-1):line));
  if(!heading)paragraphCount++;
  while(placements[consumed]&&placements[consumed].after<=paragraphCount){
   root.append(inlineFigure(placements[consumed++].source));
  }
 }
 while(placements[consumed])root.append(inlineFigure(placements[consumed++].source));
 const link=partnerUrl(p);
 if(link){
  const a=make('a','vpBlogAffiliate','상품 정보 확인하기 ↗');
  a.href=link;a.target='_blank';a.rel='sponsored noopener noreferrer nofollow';root.append(a);
 }
}
async function generateArticle(){
 if(state.busy||!state.plan)return;
 const data=productInput(),type=state.type,id=state.id,fp=state.fp;
 const len=$('#vpBlogLength').value,cacheKey=id+':'+fp+':'+type+':'+len;
 if(state.drafts.has(cacheKey)){state.draft=state.drafts.get(cacheKey);state.title=0;state.edited='';renderPlan();putStatus('기존에 작성한 같은 유형의 본문을 불러왔습니다.','success');return}
 setBusy(true,'선택 유형으로 검색형 제목 5개·목차·본문을 AI가 작성 중입니다…');
 try{
  const res=await backendRequest('/api/blog',{method:'POST',body:JSON.stringify({action:'draft',product:data,plan:state.plan,type,length:len})});
  if(state.id!==id||state.fp!==fp||state.type!==type)return;
  if(!res.draft?.titles||!res.draft?.sections)throw Error('본문 생성 결과가 비어 있습니다.');
  state.draft=res.draft;state.drafts.set(cacheKey,res.draft);state.title=0;state.edited='';
  renderPlan();putStatus('제목 5안·본문 완료 · 사실 확인 후 게시하세요.','success');
  $('#vpBlogDraftSection').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){putStatus('본문 생성 실패: '+String(e.message||e),'error')}
 finally{setBusy(false)}
}
async function copyDraft(){
 if(!state.draft)return;
 try{await navigator.clipboard.writeText(state.edited||fullText());putStatus('편집한 최종 본문을 복사했습니다.','success')}
 catch{putStatus('클립보드 권한을 확인해 주세요.','error')}
}
function downloadDraft(){
 if(!state.draft)return;
 const blob=new Blob(['\uFEFF'+(state.edited||fullText())],{type:'text/plain;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download='ViralPick_블로그_초안.txt';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),2000);putStatus('TXT 저장을 시작했습니다.','success');
}
window.vpBlogSync=sync;
window.vpBlogPlan=()=>void analyze(true);
window.vpBlogSelectProduct=id=>{
 const p=typeof products!=='undefined'?products.find(p=>String(p.id)===String(id)):null;
 if(!p||p.source==='sample')return;
 if(typeof window.selectProduct==='function')window.selectProduct(p.id);
 window.show('blog');sync();
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
/* ViralPick blog planning studio: product shared with Threads and Instagram. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const state={id:null,fp:'',plan:null,type:null,draft:null,title:0,edited:'',busy:false,plans:new Map(),drafts:new Map()};
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
function putStatus(msg,kind='info'){const el=$('#vpBlogStatus');if(el){el.textContent=msg;el.dataset.kind=kind}}
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
function renderDraft(){
 const d=state.draft;if(!d)return;
 $('#vpBlogDraftSection').hidden=false;const list=$('#vpBlogTitles');list.replaceChildren();
 d.titles.forEach((val,index)=>{
  const b=clickable((index+1)+'. '+val,'vpBlogTitleOption '+(state.title===index?'active':''),()=>{
   const original=state.edited===fullText();state.title=index;
   if(original)state.edited=fullText();
   renderDraft();
  });list.append(b);
 });
 if(!state.edited)state.edited=fullText();
 $('#vpBlogFinalEdit').value=state.edited;
 preview();
 const checks=$('#vpBlogVerification');checks.replaceChildren();checks.append(make('strong','','게시 전 사실 확인'));
 const notes=['직접 써본 후기처럼 표현되지는 않았는지 확인','상품 스펙·사용 조건·안전 안내를 공식 자료와 대조','최신 가격·재고 및 제휴 고지 확인',...(partnerUrl(pCurrent())?[]:['제휴 링크 미발급: 쿠팡 파트너스 링크를 별도 확인해야 합니다.']),...(d.verificationNotes||[])];
 notes.forEach(x=>checks.append(make('p','','• '+x)));
}
function preview(){
 const root=$('#vpBlogPreview');if(!root||!state.draft)return;
 root.replaceChildren();
 const d=state.draft,p=pCurrent(),url=imageUrl(p);
 root.append(make('h1','',title()),make('div','vpBlogDisclosure','※ 제휴 링크를 통한 구매 시 일정 수수료를 제공받을 수 있습니다.'));
 if(url){const fig=make('figure','vpBlogFigure'),img=make('img');img.src=url;img.alt=p.name+' 실제 상품 썸네일';img.loading='lazy';fig.append(img,make('figcaption','','실제 상품 썸네일 · 사용 권한 검토 필요'));root.append(fig)}
 const all=state.edited||fullText();
 for(const line of all.split(/\n+/).map(x=>x.trim()).filter(Boolean).slice(0,100)){
  if(line===title()||line.startsWith('※'))continue;
  const heading=/^\[[^\]]{2,90}\]$/.test(line);
  root.append(make(heading?'h2':'p','',heading?line.slice(1,-1):line));
 }
 const link=partnerUrl(p);
 if(link){const a=make('a','vpBlogAffiliate','상품 정보 확인하기 ↗');a.href=link;a.target='_blank';a.rel='sponsored noopener noreferrer nofollow';root.append(a)}
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
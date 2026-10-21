/* ViralPick global activity center: persistent cross-view local operation log.
   Never record prompts, generated content, passwords, tokens, API bodies or URLs. */
(function(){
'use strict';
const LOG_KEY='vp-activity-log-v2',LIMIT=75;
const running=new Map();
let serial=0,history=[];
const $=s=>document.querySelector(s);
function safe(text,max=160){
 return String(text||'').replace(/https?:\/\/\S+/gi,'[주소]').replace(/(api[_ -]?key|secret|password|token|access[_ -]?key)\s*[:=]\s*\S+/gi,'[민감정보]').replace(/[\r\n\t]+/g,' ').slice(0,max);
}
function read(){
 try{const value=JSON.parse(sessionStorage.getItem(LOG_KEY)||sessionStorage.getItem('vp-activity-log-v1')||'[]');
  return Array.isArray(value)?value.filter(v=>v&&['info','busy','success','error','warning'].includes(v.level)).slice(0,LIMIT):[]
 }catch{return []}
}
history=read();
function save(){try{sessionStorage.setItem(LOG_KEY,JSON.stringify(history.slice(0,LIMIT)))}catch{}}
function record(level,label,detail=''){
 const item={id:++serial,time:Date.now(),level,label:safe(label,90),detail:safe(detail,210)};
 history.unshift(item);history=history.slice(0,LIMIT);save();render();
 return item;
}
function begin(label,detail){
 const id=++serial;
 const entry={id,label:safe(label,90),detail:safe(detail,210),started:Date.now()};
 running.set(id,entry);
 note(entry.label,entry.detail||'작업 시작');
 return id;
}
function update(id,detail){
 const entry=running.get(id);if(!entry)return;
 entry.detail=safe(detail,210);
 render();
}
function end(id,success,detail){
 const entry=running.get(id);
 if(!entry)return;
 running.delete(id);
 record(success?'success':'error',entry.label,detail|| (success?'완료':'오류 발생'));
}
function note(label,detail){record('info',label,detail)}
function warning(label,detail){record('warning',label,detail)}
function errored(label,detail){record('error',label,detail)}
function classifyRequest(path,options={}){
 let url;try{url=new URL(path,'https://local.invalid')}catch{return {label:'서버 요청',detail:'처리 중'}}
 let body={};try{if(typeof options.body==='string'&&options.body.length<100000)body=JSON.parse(options.body)||{}}catch{}
 const method=String(options.method||'GET').toUpperCase();
 if(url.pathname==='/api/image'){
  const slide=Number(body.slide);
  const use=body.purpose==='carousel'&&slide>=1&&slide<=5?'Instagram '+slide+'/5번 카드 이미지':body.purpose==='threads-pain'?'Threads 문제 상황 이미지':body.purpose==='threads-solve'?'Threads 해결 상황 이미지':'AI 실사 이미지';
  return {label:use+' 제작',detail:'GPT 이미지 생성 요청 중',done:'이미지 생성 응답 완료'};
 }
 if(url.pathname==='/api/reference-image')return {label:'상품 참조 사진 준비',detail:'서버에서 원본 사진 확인 중',done:'이미지 데이터 준비 완료'};
 if(url.pathname==='/api/blog')return body.action==='draft'?{label:'블로그 AI 본문 작성',detail:'검색형 제목 5안·정보형 본문 작성 중',done:'블로그 본문 작성 완료'}:{label:'블로그 SEO 8유형 분석',detail:'검색 의도·키워드 적합성 점수 평가 중',done:'8가지 유형 분석 완료'};
 if(url.pathname==='/api/copy'&&body.action==='product-research')return {label:'상품 웹조사',detail:'AI 웹검색 및 제품 정보 분석 중',done:'웹조사 응답 완료'};
 if(url.pathname==='/api/copy')return {label:(body.platform||'SNS')+' AI 문구 생성',detail:'제품 정보에 맞춘 문구 작성 중',done:'AI 문구 응답 완료'};
 if(url.pathname==='/api/instagram-story')return {label:'Instagram 캐러셀 문구 기획',detail:'1~5번 카드 내용 작성 중',done:'5장 카드 기획 응답 완료'};
 if(url.pathname==='/api/hooks'||url.pathname==='/api/thread-hook-pairs')return {label:'AI 후킹 문구 생성',detail:'후킹·문제 상황 분석 중',done:'후킹 문구 응답 완료'};
 if(url.pathname==='/api/reports')return {label:'쿠팡 실적 조회',detail:'제휴 클릭·수익 데이터 요청 중',done:'실적 데이터 응답 완료'};
 if(url.pathname==='/api/products'||url.pathname==='/api/discover'||url.pathname==='/api/product-page')return {label:'상품 정보 조회',detail:'쿠팡 상품 데이터 요청 중',done:'상품 데이터 응답 완료'};
 if(url.pathname==='/api/deeplink')return {label:'쿠팡 제휴 링크 발급',detail:'단축 링크 발급 중',done:'제휴 링크 발급 응답 완료'};
 if(url.pathname==='/api/status'||url.pathname==='/api/account')return {label:'계정·서버 상태 확인',detail:'연결 상태 확인 중',done:'연결 상태 응답 완료'};
 return {label:'서버 '+(method==='GET'?'조회':'작업'),detail:'서버 응답 대기 중',done:'서버 처리 완료'};
}
async function trackRequest(path,options,execute){
 const info=classifyRequest(path,options),id=begin(info.label,info.detail);
 try{
  const result=await execute();
  end(id,true,info.done);
  return result;
 }catch(error){
  const msg=String(error?.message||'요청 실패');
  end(id,false,safe(msg,180));
  throw error;
 }
}
function time(t){return new Date(t).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function row(entry){
 const li=document.createElement('li');
 li.className='vpActivityRow '+entry.level;
 const dot=document.createElement('span');dot.className='vpActivityDot';
 const content=document.createElement('div');
 const head=document.createElement('div');head.className='vpActivityLine';
 const title=document.createElement('strong');title.textContent=entry.label;
 const stamp=document.createElement('time');stamp.textContent=time(entry.time||entry.started);
 head.append(title,stamp);
 const detail=document.createElement('p');detail.textContent=entry.detail||'';
 content.append(head,detail);li.append(dot,content);return li;
}

// Capture commands even when a tool changes only local state and does not call an API.
// These are INTENT events, not fabricated completion/success events.
const AREA_NAMES={dashboard:'대시보드',discover:'상품 발굴',threads:'Threads',instagram:'Instagram',blog:'블로그',scheduler:'예약·게시',integrations:'상품 연결',lab:'상품 분석'};
const ACTION_IDS={
 vpBlogAnalyze:'SEO 유형 분석',vpBlogRefresh:'SEO 다시 분석',vpBlogWrite:'블로그 AI 본문 작성',vpBlogCopy:'본문 복사',vpBlogDownload:'TXT 저장',
 vpPerfRefresh:'실적 새로고침',vpPerfApply:'실적 조회 조건 적용',vpPerfMore:'실적 기록 더 보기',vpPerfCsv:'성과 CSV 저장',
 vpAutoScrape:'상품 상세정보 읽기',vpAiThreads:'Threads AI 문구 생성',vpAiInstagram:'Instagram AI 문구 생성',
 carouselBatchBtn:'캐러셀 5장 이미지 일괄 생성',carouselSingleBtn:'캐러셀 선택 카드 재생성',
 vpLookup:'상품 URL 확인',coupangBrowseButton:'상품 발굴 조건 검색',
 vpInstagramSingleGenerate:'Instagram 카드 문구 생성',vpPairsGenerate:'Threads 후킹 5세트 생성',
 vpPainCreate:'Threads 문제 상황 이미지 생성',vpSolveCreate:'Threads 해결 상황 이미지 생성',
 vpWebResearchRun:'상품 웹조사'
};
const ONCLICK_NAMES=[
 [/generateProductCopy\(/,'AI SNS 문구 생성'],[/runCarouselArtworkGeneration|generateCarouselImages/,'Instagram 이미지 생성'],
 [/requestAiScene\(/,'AI 상황 이미지 생성'],[/fetchCoupangProducts|fetchCoupangDiscovery|refreshCoupangCatalog/,'상품 검색·발굴'],
 [/issueCoupangLink/,'쿠팡 제휴 링크 발급'],[/importReviewMarkdown/,'리뷰 자료 분석'],[/generateSNS\(/,'SNS 콘텐츠 생성'],
 [/download.*(?:ZIP|PNG|CSV)/,'콘텐츠 파일 저장'],[/copy(?:Thread|Caption|Coupang)/,'콘텐츠 복사'],
 [/openReservation|addSchedule|confirmReserve/,'게시 예약 작업'],[/show\(/,'화면 이동']
];
function commandLabel(button){
 const fixed=ACTION_IDS[button.id];if(fixed)return fixed;
 // Dynamic controls may contain AI-generated article titles, product details or prompts.
 // Report the kind of action, never persist their user-generated text.
 for(const [selector,label] of [
  ['.vpBlogTop','추천 콘텐츠 유형 선택'],['.vpBlogType','블로그 콘텐츠 유형 선택'],
  ['.vpBlogTitleOption','검색형 제목 선택'],['.vpBlogKeyword','검색 키워드 선택'],
  ['.vpPairsChoice,.vpPairChoice','Threads 후킹 선택'],
  ['.vpAssetItem,.vpAssetTile,.vpAssetCard','상품 이미지 선택'],
  ['.cardThumb,.instaThumb,.instaSlideThumb','콘텐츠 카드 선택'],
  ['.product,.productCard,.coupangSearchItem','상품 선택']
 ])if(button.matches?.(selector))return label;
 const action=button.getAttribute?.('onclick')||'';
 for(const [pattern,name] of ONCLICK_NAMES)if(pattern.test(action))return name;
 // Limit text from rendered product cards, so names/descriptions and tokens are never stored.
 const raw=(button.getAttribute?.('aria-label')||button.textContent||'버튼').replace(/\s+/g,' ').trim();
 const text=raw.replace(/[^\p{Script=Hangul}\p{Script=Latin}\p{Number}\s·+\-_.]/gu,'').trim();
 if(!text||text.length>65)return '화면 선택·기능 실행';
 return safe(text,55);
}
function commandArea(button){
 const section=button.closest?.('.view');
 if(section)return AREA_NAMES[section.id]||'ViralPick';
 if(button.closest?.('.mobileBottom,.nav,.side,.mobileTop,.vpStudioStageBar'))return '화면 이동';
 return 'ViralPick';
}
function commandClick(event){
 const element=event.target;
 const button=element?.closest?.('button,[role="button"],input[type="submit"],input[type="button"],a.btn,.modeCard,.product,.cardThumb,.visual,.copyTab,[onclick]');
 if(!button||button.disabled||button.closest?.('#vpActivityDock'))return;
 const area=commandArea(button),label=commandLabel(button);
 // Covers dynamically added dashboard, discovery, Threads, Instagram, blog and modal buttons.
 note(area+' · '+label,'버튼 선택 · 실행 요청');
}
function commandChange(event){
 const control=event.target;
 if(!control||control.closest?.('#vpActivityDock'))return;
 if(!control.matches?.('select,input[type="checkbox"],input[type="radio"],input[type="file"]'))return;
 const area=commandArea(control),name=control.getAttribute('aria-label')||control.labels?.[0]?.textContent||control.id||'설정';
 note(area+' · 옵션 변경',safe(name,65)+' · 설정이 변경되었습니다. 결과는 화면에서 확인하세요.');
}
function render(){
 const dock=$('#vpActivityDock');if(!dock)return;
 const active=[...running.values()].sort((a,b)=>b.started-a.started);
 const current=active[0],last=history.find(entry=>entry.level!=='busy');
 const indicator=$('#vpActivityIndicator'),label=$('#vpActivityCurrent'),hint=$('#vpActivityDetail'),count=$('#vpActivityCount'),list=$('#vpActivityList');
 dock.dataset.status=active.length?'busy':last?.level||'idle';
 indicator.textContent=active.length?'◉':last?.level==='error'?'!':last?.level==='success'?'✓':'•';
 if(label)label.textContent=current?current.label:last?(last.level==='success'?'완료 · ':last.level==='error'?'오류 · ':'')+last.label:'작업 대기 중';
 if(hint)hint.textContent=current?current.detail:(last?.detail||'AI 작업·이미지 생성 상태를 여기에 표시합니다.');
 if(count)count.textContent=active.length?active.length+'건 진행 중':(history.length?history.length+'건 기록':'기록 보기');
 if(list){
  list.replaceChildren();
  if(!active.length&&!history.length){const empty=document.createElement('li');empty.className='vpActivityEmpty';empty.textContent='아직 실행한 작업이 없습니다.';list.append(empty)}
  for(const entry of active)list.append(row({...entry,level:'busy'}));
  for(const entry of history.filter(item=>item.level!=='busy').slice(0,50))list.append(row(entry));
 }
}
function init(){
 if($('#vpActivityDock'))return;
 const dock=document.createElement('section');dock.id='vpActivityDock';dock.className='vpActivityDock';dock.dataset.status='idle';
 dock.setAttribute('aria-label','ViralPick 작업 상태 및 로그');
 const summary=document.createElement('button');summary.type='button';summary.className='vpActivitySummary';summary.id='vpActivityToggle';summary.setAttribute('aria-expanded','false');summary.setAttribute('aria-controls','vpActivityPanel');
 const icon=document.createElement('span');icon.id='vpActivityIndicator';icon.className='vpActivityIndicator';icon.textContent='•';
 const text=document.createElement('span');text.className='vpActivityText';
 const name=document.createElement('strong');name.id='vpActivityCurrent';name.textContent='작업 대기 중';
 const detail=document.createElement('small');detail.id='vpActivityDetail';detail.textContent='AI 작업·이미지 생성 상태를 여기에 표시합니다.';
 text.append(name,detail);
 const count=document.createElement('span');count.id='vpActivityCount';count.className='vpActivityCount';count.textContent='로그 보기';
 const arrow=document.createElement('span');arrow.className='vpActivityArrow';arrow.textContent='⌃';
 summary.append(icon,text,count,arrow);
 const panel=document.createElement('section');panel.id='vpActivityPanel';panel.className='vpActivityPanel';panel.hidden=true;
 const heading=document.createElement('header');heading.className='vpActivityHeading';
 const headingName=document.createElement('strong');headingName.textContent='작업 진행 로그';
 const clear=document.createElement('button');clear.type='button';clear.textContent='완료 기록 지우기';clear.className='vpActivityClear';
 clear.onclick=()=>{history=[];save();render()};
 heading.append(headingName,clear);
 const list=document.createElement('ol');list.id='vpActivityList';list.className='vpActivityList';
 panel.append(heading,list);dock.append(summary,panel);
 summary.onclick=()=>{
  panel.hidden=!panel.hidden;
  summary.setAttribute('aria-expanded',String(!panel.hidden));
  dock.classList.toggle('expanded',!panel.hidden);
 };
 // The mobile navigation exists in the markup; anchor directly above it.
 document.body.append(dock);
 // Capture click on all supported app buttons, including elements added after load.
 document.addEventListener('click',commandClick,true);
 document.addEventListener('change',commandChange,true);
 render();
}
window.vpActivity={begin,update,end,info:note,warning,error:errored,trackRequest,render,classifyRequest,commandClick,commandChange};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

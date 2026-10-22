/* ViralPick — resume prior products and find real Coupang candidates by relatable pain. */
(function(){
 'use strict';
 const $=s=>document.querySelector(s);
 const core=window.vpSocialDiscoveryCore;
 if(!core)return;
 const HISTORY_KEY='viralpick-product-work-history-v1';
 const NOTES_KEY='viralpick-product-work-notes-v1';
 const RECO_KEY='viralpick-social-recommendations-v1';
 const MAX_HISTORY=35,MAX_NOTES=24,PAGE_SIZE=50;
 let requested=20,currentPage=1,searchCancelled=false;
 let history=[],notes={},recommendations=[],category='all',busy=false,query='',notice='',lastSaved=0,saveTimer=null;
 const cleanText=(s,max=250)=>String(s??'').slice(0,max);
 function read(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}}
 function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(e){notice='브라우저 저장 공간 부족: 작업 자료 자동 저장에 실패했습니다. 필요한 문구를 별도로 복사해 주세요.';return false}}
 const https=value=>typeof value==='string'&&/^https:\/\//i.test(value)&&value.length<=2100?value:null;
 function safeProduct(p){
  return {
   id:p.id,source:p.source,name:cleanText(p.name,120),price:Number(p.price)||0,
   coupangProductId:cleanText(p.coupangProductId||'',30),originalUrl:https(p.originalUrl),
   affiliateUrl:https(p.affiliateUrl),imageUrl:https(p.imageUrl),checkedAt:Number(p.checkedAt)||0,
   problem:cleanText(p.problem,220),novel:cleanText(p.novel,220),visual:cleanText(p.visual,220),
   audience:cleanText(p.audience,150),type:cleanText(p.type,80),reason:cleanText(p.reason,240),
   old:Number(p.old)||0,discount:Number(p.discount)||0
  };
 }
 function remember(p){
  if(!p||p.source==='sample'||!p.id)return;
  const id=String(p.id),item={id,at:Date.now(),product:safeProduct(p)};
  history=[item,...history.filter(x=>String(x.id)!==id)].slice(0,MAX_HISTORY);
  if(!write(HISTORY_KEY,history))return;
  renderHistory();
 }
 function capture(id){
  if(id===null||id===undefined||!selected||selected.source==='sample')return;
  const data={
   description:cleanText($('#vpAiDescription')?.value,32000),
   reviews:cleanText($('#vpAiReviews')?.value,24000),
   markdown:cleanText($('#vpReviewMarkdown')?.value,100000),
   at:Date.now()
  };
  if(!data.description&&!data.reviews&&!data.markdown&&!notes[String(id)])return;
  notes[String(id)]=data;
  const ordered=Object.entries(notes).sort((a,b)=>(b[1].at||0)-(a[1].at||0)).slice(0,MAX_NOTES);
  if(write(NOTES_KEY,Object.fromEntries(ordered)))lastSaved=Date.now();
 }
 function restoreNotes(id){
  const item=notes[String(id)]||{};
  for(const [selector,field] of [['#vpAiDescription','description'],['#vpAiReviews','reviews'],['#vpReviewMarkdown','markdown']]){
   const node=$(selector);if(node)node.value=typeof item[field]==='string'?item[field]:'';
  }
  window.saveCurrentWorkspace?.();
  window.vpProductResearchRefresh?.();
 }
 function resume(id){
  const key=String(id);
  let p=products.find(x=>String(x.id)===key);
  if(!p){
   const saved=history.find(x=>x.id===key)?.product;
   if(!saved||!['coupang','manual'].includes(saved.source))return;
   p={...saved,id:Number(saved.id)};
   if(!Number.isSafeInteger(p.id))return;
   products.push(p);
   if(p.source==='coupang')window.saveCoupangDrafts?.();
   if(p.source==='manual')window.persistManualProducts?.();
  }
  window.selectProduct?.(p.id);
  notice='저장된 상품으로 돌아왔습니다. 문구·상품 분석 메모는 저장된 범위에서 복원됩니다. 이미지 기록은 기존 브라우저 저장소에서 불러옵니다.';
  renderHistory();
 }
 function renderHistory(){
  const list=$('#vpHistoryItems'),caption=$('#vpHistorySummary');if(!list)return;
  list.replaceChildren();
  const all=history.filter(x=>x.product?.source!=='sample');
  // Earlier versions saved products but did not track their last work time.
  const saved=(Array.isArray(products)?products:[])
   .filter(p=>p.source!=='sample'&&!all.some(x=>String(x.id)===String(p.id)))
   .map(p=>({id:String(p.id),at:Number(p.checkedAt)||0,product:safeProduct(p),legacy:true}));
  const combined=[...all,...saved].filter(x=>String(x.product.name||'').toLowerCase().includes(query.toLowerCase())).slice(0,24);
  if(caption)caption.textContent='최근 작업 '+all.length+'개 · 기존 저장 상품 '+saved.length+'개 · 이 브라우저 기준';
  if(!combined.length){
   const empty=document.createElement('p');empty.className='vpDiscoveryEmpty';
   empty.textContent=query?'검색에 해당하는 작업 상품이 없습니다.':'아직 작업 이력이 없습니다. 검색 상품을 선택하면 자동으로 기록됩니다.';
   list.append(empty);
  }
  for(const entry of combined){
   const p=entry.product;
   const item=document.createElement('article');item.className='vpHistoryCard';
   if(p.imageUrl){const img=document.createElement('img');img.src=p.imageUrl;img.alt=p.name+' 상품 사진';img.loading='lazy';img.referrerPolicy='no-referrer';item.append(img)}
   const body=document.createElement('div');body.className='vpHistoryBody';
   const name=document.createElement('strong');name.textContent=p.name;
   const meta=document.createElement('small');
   const when=Number(entry.at)>0?new Date(entry.at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'보관됨';
   meta.textContent=(entry.legacy?'기존 저장 상품':'최근 작업')+' · '+when+' · '+(p.source==='manual'?'직접 등록':'쿠팡 상품');
   body.append(name,meta);
   const actions=document.createElement('div');actions.className='vpHistoryActions';
   const resumeButton=document.createElement('button');resumeButton.type='button';resumeButton.className='btn primary';
   resumeButton.textContent='이 상품 작업 재개';resumeButton.onclick=()=>resume(entry.id);actions.append(resumeButton);
   item.append(body,actions);list.append(item);
  }
  const note=$('#vpHistoryNotice');if(note)note.textContent=notice||'작업 상품·메모는 같은 브라우저에서 자동 보관됩니다. AI 이미지와 SNS 문구는 기존 상품별 저장 기록을 사용합니다.';
 }
 function renderRecommendations(){
  const root=$('#vpSocialRecoList');if(!root)return;
  root.replaceChildren();
  if(!recommendations.length){
   renderRecommendationPages();
   const p=document.createElement('p');p.className='vpDiscoveryEmpty';
   p.textContent='「SNS 맞춤 상품 찾기」를 누르면 쿠팡 파트너스 API에서 실제 상품을 검색합니다. 결과의 적합도는 판매량이나 성과가 아닌 콘텐츠 제작용 추정치입니다.';
   root.append(p);return;
  }
  const start=(currentPage-1)*PAGE_SIZE;
  for(const row of recommendations.slice(start,start+PAGE_SIZE)){
   const p=row.product,scenario=core.scenarios.find(x=>x.id===row.scenarioId);
   if(!scenario)continue;
   const score=core.score(p,scenario);if(!score)continue;
   const card=document.createElement('article');card.className='vpRecoCard';
   if(https(p.imageUrl)){const img=document.createElement('img');img.src=p.imageUrl;img.alt=p.name;img.loading='lazy';img.referrerPolicy='no-referrer';card.append(img)}
   const body=document.createElement('div');body.className='vpRecoBody';
   const top=document.createElement('div');top.className='vpRecoBadges';
   for(const tag of ['제작 적합 '+score.score,'Threads '+score.threads,'Instagram '+score.instagram]){
    const span=document.createElement('span');span.textContent=tag;top.append(span);
   }
   const name=document.createElement('strong');name.textContent=p.name;
   const pain=document.createElement('p');pain.textContent='공감 불편 · '+scenario.problem;
   const visual=document.createElement('p');visual.textContent='이미지 소재 · '+scenario.demo;
   const price=document.createElement('small');price.textContent=(Number(p.price)||0).toLocaleString('ko-KR')+'원 · 상품 기능·가격·재고 확인 필요';
   const start=document.createElement('button');start.type='button';start.className='btn primary';start.textContent='이 상품으로 콘텐츠 제작';
   start.onclick=()=>startRecommendation(row);
   body.append(top,name,pain,visual,price,start);card.append(body);root.append(card);
  }
  renderRecommendationPages();
 }
 function renderRecommendationPages(){
  const root=$('#vpSocialRecoPages');if(!root)return;
  root.replaceChildren();
  const count=recommendations.length,pages=Math.max(1,Math.ceil(count/PAGE_SIZE));
  currentPage=Math.max(1,Math.min(currentPage,pages));
  const info=document.createElement('span');info.className='vpRecoPageInfo';
  if(count)info.textContent='현재 '+count+'개 확보 / 요청 '+requested+'개 · '+currentPage+'/'+pages+'페이지 · 페이지당 최대 50개';
  else info.textContent='검색된 상품 없음 · 요청 '+requested+'개';
  root.append(info);
  if(pages===1)return;
  const button=(caption,target,disabled=false,active=false)=>{
   const el=document.createElement('button');el.className='btn'+(active?' primary':'');el.type='button';
   el.textContent=caption;el.disabled=disabled;el.setAttribute('aria-label',caption+' 페이지');
   if(active)el.setAttribute('aria-current','page');
   el.onclick=()=>{
    currentPage=target;renderRecommendations();
    $('#vpSocialRecoList')?.scrollIntoView?.({behavior:'smooth',block:'start'});
   };
   return el;
  };
  root.append(button('← 이전',Math.max(1,currentPage-1),currentPage===1));
  for(let i=1;i<=pages;i++)root.append(button(String(i),i,false,currentPage===i));
  root.append(button('다음 →',Math.min(pages,currentPage+1),currentPage===pages));
 }
 function startRecommendation(row){
  const scenario=core.scenarios.find(s=>s.id===row.scenarioId);if(!scenario)return;
  const p=row.product;
  const remote={
   id:String(p.id),name:p.name,price:p.price,imageUrl:p.imageUrl,
   productUrl:p.productUrl,problem:scenario.problem,
   novel:'상품명으로 찾은 해결 후보입니다. 실제 기능과 효능은 상품 상세페이지 확인 후 입력하세요.',
   visual:scenario.demo,audience:scenario.audience,reason:'SNS 문제해결형 후보 · 상품명·가격 기준 추정. 효과와 실제 후기는 미검증입니다.'
  };
  // The existing import path preserves Coupang IDs, product links, drafts and artwork.
  remoteProducts.push(remote);
  window.useRemoteProduct(remoteProducts.length-1,false);
  notice='SNS 콘텐츠 제작 후보를 불러왔습니다. 후킹 시나리오는 일반 생활 상황이며 제품의 실제 기능·사용권은 확인 후 적용하세요.';
 }
 async function findRecommendations(){
  const button=$('#vpSocialRecoRun'),msg=$('#vpSocialRecoStatus');
  if(busy){
   searchCancelled=true;
   if(msg)msg.textContent='현재 검색을 중단합니다. 완료된 검색 결과는 그대로 표시됩니다.';
   return;
  }
  const searchCategory=category,searchTarget=requested;
  const planned=core.searchPlans(searchCategory,searchTarget);
  if(!planned.length){if(msg)msg.textContent='선택한 카테고리에 해당하는 검색어가 없습니다.';return}
  busy=true;searchCancelled=false;currentPage=1;
  if(button)button.textContent='검색 중단';
  if(msg)msg.textContent='SNS 적합 상품을 최대 '+requested+'개까지 찾습니다. '+planned.length+'개 검색어 중 실제 매칭된 상품만 표시합니다.';
  const unique=new Map();let errors=0,scanned=0;
  const add=(scenarioId,p)=>{
   if(!p?.id||!p.name||!Number.isFinite(Number(p.price))||Number(p.price)<=0)return;
   const scenario=core.scenarios.find(s=>s.id===scenarioId);
   const fit=core.score(p,scenario);
   if(!fit)return;
   const key=String(p.id),existing=unique.get(key);
   if(!existing||existing.fit<fit.score)unique.set(key,{product:p,scenarioId,fit:fit.score});
  };
  try{
   // Search is explicitly user-triggered and bounded; max 4 partner queries
   // concurrently. Never fabricate products to meet a chosen count.
   for(let i=0;i<planned.length&&!searchCancelled&&unique.size<searchTarget;i+=4){
    const batch=planned.slice(i,i+4);
    const responses=await Promise.allSettled(batch.map(async item=>{
     const result=await window.backendRequest('/api/products?q='+encodeURIComponent(item.query)+'&limit=10');
     return {scenarioId:item.scenarioId,products:Array.isArray(result.products)?result.products:[]};
    }));
    for(const result of responses){
     scanned++;
     if(result.status!=='fulfilled'){errors++;continue}
     const {scenarioId,products:rows}=result.value;
     for(const p of rows)add(scenarioId,p);
    }
    if(msg)msg.textContent='실제 상품 '+Math.min(unique.size,searchTarget)+' / '+searchTarget+
      '개 발견 · 검색 '+scanned+'/'+planned.length+' · 실패한 검색 '+errors+'건';
    if(errors>=8&&unique.size===0){if(msg)msg.textContent='쿠팡 검색 API 오류가 반복되어 요청을 중단했습니다. 연결 상태를 확인해 주세요.';break;}
   }
   if(searchCategory!==category||searchTarget!==requested)return;
   recommendations=[...unique.values()].sort((a,b)=>b.fit-a.fit).slice(0,searchTarget);
   currentPage=1;
   if(!searchCancelled)write(RECO_KEY,{at:Date.now(),category:searchCategory,requested:searchTarget,rows:recommendations});
   if(msg){
    const availability=recommendations.length<searchTarget?' · 적합 상품 부족으로 요청 수량 미달':' · 요청한 수량 확보';
    msg.textContent=(searchCancelled?'검색 중단 · ':'검색 완료 · ')+
     '실제 상품 '+recommendations.length+'/'+searchTarget+'개'+availability+
     (errors?' · API 검색 오류 '+errors+'건':'')+' · 콘텐츠 적합도 추정, 판매 실적 아님';
   }
   renderRecommendations();
  }catch(e){if(msg)msg.textContent='SNS 상품 검색 오류: '+String(e.message||e)}
  finally{busy=false;searchCancelled=false;if(button)button.textContent='SNS 맞춤 상품 찾기'}
 }
 function mount(){
  const discover=$('#discover');if(!discover||$('#vpProductHistoryPanel'))return;
  const historyPanel=document.createElement('section');historyPanel.id='vpProductHistoryPanel';historyPanel.className='panel vpDiscoveryPanel';
  historyPanel.innerHTML='<div class="panelHead"><h2>최근 작업 상품 · 바로 복원</h2><span class="badge blue">오류 후 작업 재개</span></div>'+
   '<div class="pad"><p class="vpDiscoveryHelp">이전에 선택한 상품과 브라우저에 저장된 상품을 찾아 다시 작업할 수 있습니다.</p>'+
   '<label class="vpHistorySearch">상품명 검색<input type="search" id="vpHistoryQuery" placeholder="이전에 작업한 상품 검색" autocomplete="off"></label>'+
   '<p class="vpDiscoveryHelp" id="vpHistorySummary"></p><div id="vpHistoryItems" class="vpHistoryList"></div>'+
   '<p id="vpHistoryNotice" class="vpDiscoveryHelp" role="status"></p></div>';
  const recoPanel=document.createElement('section');recoPanel.id='vpSocialRecoPanel';recoPanel.className='panel vpDiscoveryPanel';
  recoPanel.innerHTML='<div class="panelHead"><h2>Threads · Instagram 문제해결형 추천</h2><span class="badge orange">콘텐츠 적합도 추정</span></div>'+
   '<div class="pad"><p class="vpDiscoveryHelp">일상의 불편을 1단 공감형 문구로, 해결 상황을 2단 및 이미지로 만들기 좋은 상품을 찾습니다. 추천 점수는 판매·조회수 실적이 아닙니다.</p>'+
   '<div class="vpRecoControls"><label>불편 상황<select id="vpSocialRecoCategory"></select></label>'+ 
   '<label>상품 검색 수량<select id="vpSocialRecoLimit"><option value="20">20개</option><option value="50">50개</option><option value="100">100개</option><option value="200">200개</option></select></label>'+ 
   '<button class="btn primary" id="vpSocialRecoRun" type="button">SNS 맞춤 상품 찾기</button></div>'+
   '<p id="vpSocialRecoStatus" class="vpDiscoveryHelp" role="status">검색 버튼을 누르면 쿠팡 API에서 실제 상품을 조회합니다.</p>'+
   '<div id="vpSocialRecoList" class="vpRecoList"></div><nav id="vpSocialRecoPages" class="vpRecoPagination" aria-label="SNS 추천 상품 페이지"></nav></div>';
  const before=$('#discoverProducts')?.closest('.panel');
  if(before){discover.insertBefore(historyPanel,before);discover.insertBefore(recoPanel,before)}
  else discover.append(historyPanel,recoPanel);
  const search=$('#vpHistoryQuery');search.oninput=()=>{query=search.value.trim().slice(0,80);renderHistory()};
  const select=$('#vpSocialRecoCategory');
  for(const [id,label] of Object.entries(core.labels)){const option=document.createElement('option');option.value=id;option.textContent=label;select.append(option)}
  select.onchange=()=>{if(busy)searchCancelled=true;category=select.value;currentPage=1;recommendations=[];renderRecommendations();const msg=$('#vpSocialRecoStatus');if(msg)msg.textContent='검색 조건이 변경됐습니다. SNS 맞춤 상품 찾기를 눌러 주세요.'};
  const limitSelect=$('#vpSocialRecoLimit');limitSelect.value=String(requested);
  limitSelect.onchange=()=>{if(busy)searchCancelled=true;requested=Number(limitSelect.value)||20;currentPage=1;recommendations=[];renderRecommendations();const msg=$('#vpSocialRecoStatus');if(msg)msg.textContent=requested+'개 검색을 준비했습니다. SNS 맞춤 상품 찾기를 눌러 주세요.'};
  $('#vpSocialRecoRun').onclick=()=>void findRecommendations();
  const style=document.createElement('style');style.textContent=
   '.vpDiscoveryPanel{margin:16px 0}.vpDiscoveryPanel .pad{padding:18px}.vpDiscoveryHelp{font-size:12px;color:#637187;line-height:1.55;margin:0 0 12px}'+
   '.vpHistorySearch{display:grid;gap:6px;max-width:380px;font-size:12px;font-weight:750}.vpHistorySearch input,.vpRecoControls select{background:#fff;border:1px solid #dbe3eb;border-radius:9px;padding:10px;min-height:43px;width:100%;box-sizing:border-box}'+
   '.vpHistoryList{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:10px;margin:13px 0}'+
   '.vpHistoryCard{display:flex;gap:11px;padding:12px;border:1px solid #e2e7ee;border-radius:12px;min-width:0;align-items:center;flex-wrap:wrap}'+
   '.vpHistoryCard>img{width:56px;height:65px;object-fit:contain;border-radius:8px;background:#f3f6f9;flex-shrink:0}.vpHistoryBody{display:grid;gap:6px;min-width:150px;flex:1}'+
   '.vpHistoryBody strong{font-size:12px;line-height:1.45;overflow-wrap:anywhere}.vpHistoryBody small,.vpRecoBody small{font-size:11px;color:#738093}'+
   '.vpHistoryActions{flex:0 0 auto}.vpHistoryActions .btn{font-size:11px;padding:9px 10px}'+
   '.vpRecoControls{display:flex;align-items:end;gap:10px;flex-wrap:wrap;margin:13px 0}.vpRecoControls label{display:grid;gap:5px;min-width:180px;font-size:12px;font-weight:750}'+
   '.vpRecoList{display:grid;grid-template-columns:repeat(auto-fill,minmax(285px,1fr));gap:12px}.vpRecoCard{display:flex;gap:12px;padding:13px;border:1px solid #e0e6ef;border-radius:13px;min-width:0}'+
   '.vpRecoCard>img{width:86px;height:112px;object-fit:contain;border-radius:9px;background:#f6f8fa;flex-shrink:0}.vpRecoBody{display:grid;gap:8px;min-width:0;align-content:start;flex:1}'+
   '.vpRecoBody strong{font-size:13px;line-height:1.5;overflow-wrap:anywhere}.vpRecoBody p{font-size:12px;line-height:1.48;color:#506075;margin:0}'+
   '.vpRecoBadges{display:flex;gap:4px;flex-wrap:wrap}.vpRecoBadges span{background:#eaf1fc;color:#355992;padding:4px 7px;border-radius:8px;font-size:10px;font-weight:750}'+
   '.vpRecoBody .btn{justify-self:start;font-size:11px}.vpDiscoveryEmpty{font-size:12px;color:#7a8796;padding:14px;border:1px dashed #dfe5ed;border-radius:10px}'+
   '.vpRecoPagination{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;padding:16px 0 6px}.vpRecoPagination .btn{min-width:39px}.vpRecoPageInfo{width:100%;text-align:center;color:#697487;font-size:12px;margin-bottom:5px}'+
   '@media(max-width:640px){.vpDiscoveryPanel .pad{padding:13px}.vpHistoryList,.vpRecoList{grid-template-columns:1fr}.vpHistoryCard{align-items:flex-start}.vpHistoryActions{width:100%}.vpHistoryActions .btn{width:100%}}';
  document.head.append(style);
 }
 function initialize(){
  history=read(HISTORY_KEY,[]);if(!Array.isArray(history))history=[];
  history=history.filter(x=>x&&x.id&&x.product&&['manual','coupang'].includes(x.product.source)).slice(0,MAX_HISTORY);
  notes=read(NOTES_KEY,{});if(!notes||typeof notes!=='object'||Array.isArray(notes))notes={};
  const saved=read(RECO_KEY,null);
  if(saved&&saved.at>Date.now()-30*60*1000&&Array.isArray(saved.rows)){
   requested=[20,50,100,200].includes(Number(saved.requested))?Number(saved.requested):20;
   recommendations=saved.rows.slice(0,requested);category=core.labels[saved.category]?saved.category:'all';
  }
  mount();
  const select=$('#vpSocialRecoCategory');if(select)select.value=category;
  const original=window.selectProduct;
  if(typeof original==='function')window.selectProduct=function(id){
   const oldId=selected?.id;
   if(selected?.source!=='sample')capture(oldId);
   const output=original.apply(this,arguments);
   if(selected?.source!=='sample'){
    restoreNotes(selected.id);remember(selected);
   }else renderHistory();
   return output;
  };
  const manual=window.saveManualProduct;
  if(typeof manual==='function')window.saveManualProduct=function(){
   const result=manual.apply(this,arguments);
   if(selected?.source==='manual'){capture(selected.id);remember(selected)}
   return result;
  };
  const fields=['#vpAiDescription','#vpAiReviews','#vpReviewMarkdown'];
  for(const selector of fields){$(selector)?.addEventListener('input',()=>{
   if(saveTimer)clearTimeout(saveTimer);
   saveTimer=setTimeout(()=>{if(selected?.source!=='sample'){capture(selected.id);remember(selected)}},700);
  })}
  if(selected?.source!=='sample'){
   if(notes[String(selected.id)])restoreNotes(selected.id);
   else capture(selected.id);
   remember(selected);
  }else renderHistory();
  renderRecommendations();
  window.vpProductDiscoveryRemember=remember;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();

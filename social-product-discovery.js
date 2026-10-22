/* ViralPick — resume prior products and find real Coupang candidates by relatable pain. */
(function(){
 'use strict';
 const $=s=>document.querySelector(s);
 const core=window.vpSocialDiscoveryCore;
 if(!core)return;
 const HISTORY_KEY='viralpick-product-work-history-v1';
 const NOTES_KEY='viralpick-product-work-notes-v1';
 const RECO_KEY='viralpick-social-recommendations-v1';
 const MAX_HISTORY=35,MAX_NOTES=24;
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
  if(id===null||id===undefined||!window.selected||window.selected.source==='sample')return;
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
  const saved=(Array.isArray(window.products)?products:[])
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
   const p=document.createElement('p');p.className='vpDiscoveryEmpty';
   p.textContent='「SNS 맞춤 상품 찾기」를 누르면 쿠팡 파트너스 API에서 실제 상품을 검색합니다. 결과의 적합도는 판매량이나 성과가 아닌 콘텐츠 제작용 추정치입니다.';
   root.append(p);return;
  }
  for(const row of recommendations){
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
  window.remoteProducts.push(remote);
  window.useRemoteProduct(window.remoteProducts.length-1,false);
  notice='SNS 콘텐츠 제작 후보를 불러왔습니다. 후킹 시나리오는 일반 생활 상황이며 제품의 실제 기능·사용권은 확인 후 적용하세요.';
 }
 async function findRecommendations(){
  if(busy)return;
  const button=$('#vpSocialRecoRun'),msg=$('#vpSocialRecoStatus');
  const candidates=core.pickScenarios(category);
  if(!candidates.length)return;
  busy=true;if(button){button.disabled=true;button.textContent='쿠팡 상품 검색 중…'}
  if(msg)msg.textContent='문제해결 상황 '+candidates.length+'개를 실제 쿠팡 API에서 순서대로 검색합니다.';
  const found=[];let errors=0;
  try{
   // Two concurrent searches keep partner API usage controlled.
   for(let i=0;i<candidates.length;i+=2){
    const segment=candidates.slice(i,i+2);
    const result=await Promise.allSettled(segment.map(async sc=>{
     const data=await window.backendRequest('/api/products?q='+encodeURIComponent(sc.query)+'&limit=7');
     return {sc,rows:Array.isArray(data.products)?data.products:[]};
    }));
    result.forEach((out,k)=>{
     if(out.status==='rejected'){errors++;return}
     const {sc,rows}=out.value;
     for(const p of rows){
      if(!core.matches(p,sc))continue;
      const fit=core.score(p,sc);if(fit)found.push({product:p,scenarioId:sc.id,fit:fit.score});
     }
    });
    if(msg)msg.textContent='상품 후보 확인 중 · '+Math.min(i+2,candidates.length)+'/'+candidates.length+'가지 불편 상황 검색';
   }
   const dedup=new Map();
   for(const item of found){
    const key=String(item.product.id);
    const existing=dedup.get(key);
    if(!existing||existing.fit<item.fit)dedup.set(key,item);
   }
   recommendations=[...dedup.values()].sort((a,b)=>b.fit-a.fit).slice(0,24);
   const cache={at:Date.now(),category,rows:recommendations};
   write(RECO_KEY,cache);
   if(msg)msg.textContent=recommendations.length?
    '실제 쿠팡 후보 '+recommendations.length+'개 · '+errors+'개 검색 실패 · SNS 제작 적합도 추정순':
    '조건에 맞는 실제 상품을 찾지 못했습니다.'+(errors?' 일부 API 조회가 실패했습니다. 쿠팡 API 연결을 확인해 주세요.':' 검색 조건을 바꿔보세요.');
   renderRecommendations();
  }catch(e){if(msg)msg.textContent='SNS 추천 검색 실패: '+String(e.message||e)}
  finally{busy=false;if(button){button.disabled=false;button.textContent='SNS 맞춤 상품 찾기'}}
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
   '<div class="vpRecoControls"><label>불편 상황<select id="vpSocialRecoCategory"></select></label><button class="btn primary" id="vpSocialRecoRun" type="button">SNS 맞춤 상품 찾기</button></div>'+
   '<p id="vpSocialRecoStatus" class="vpDiscoveryHelp" role="status">검색 버튼을 누르면 쿠팡 API에서 실제 상품을 조회합니다.</p>'+
   '<div id="vpSocialRecoList" class="vpRecoList"></div></div>';
  const before=$('#discoverProducts')?.closest('.panel');
  if(before){discover.insertBefore(historyPanel,before);discover.insertBefore(recoPanel,before)}
  else discover.append(historyPanel,recoPanel);
  const search=$('#vpHistoryQuery');search.oninput=()=>{query=search.value.trim().slice(0,80);renderHistory()};
  const select=$('#vpSocialRecoCategory');
  for(const [id,label] of Object.entries(core.labels)){const option=document.createElement('option');option.value=id;option.textContent=label;select.append(option)}
  select.onchange=()=>{category=select.value};
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
   '@media(max-width:640px){.vpDiscoveryPanel .pad{padding:13px}.vpHistoryList,.vpRecoList{grid-template-columns:1fr}.vpHistoryCard{align-items:flex-start}.vpHistoryActions{width:100%}.vpHistoryActions .btn{width:100%}}';
  document.head.append(style);
 }
 function initialize(){
  history=read(HISTORY_KEY,[]);if(!Array.isArray(history))history=[];
  history=history.filter(x=>x&&x.id&&x.product&&['manual','coupang'].includes(x.product.source)).slice(0,MAX_HISTORY);
  notes=read(NOTES_KEY,{});if(!notes||typeof notes!=='object'||Array.isArray(notes))notes={};
  const saved=read(RECO_KEY,null);
  if(saved&&saved.at>Date.now()-30*60*1000&&Array.isArray(saved.rows)){
   recommendations=saved.rows.slice(0,24);category=core.labels[saved.category]?saved.category:'all';
  }
  mount();
  const select=$('#vpSocialRecoCategory');if(select)select.value=category;
  const original=window.selectProduct;
  if(typeof original==='function')window.selectProduct=function(id){
   const oldId=window.selected?.id;
   if(window.selected?.source!=='sample')capture(oldId);
   const output=original.apply(this,arguments);
   if(window.selected?.source!=='sample'){
    restoreNotes(window.selected.id);remember(window.selected);
   }else renderHistory();
   return output;
  };
  const manual=window.saveManualProduct;
  if(typeof manual==='function')window.saveManualProduct=function(){
   const result=manual.apply(this,arguments);
   if(window.selected?.source==='manual'){capture(window.selected.id);remember(window.selected)}
   return result;
  };
  const fields=['#vpAiDescription','#vpAiReviews','#vpReviewMarkdown'];
  for(const selector of fields){$(selector)?.addEventListener('input',()=>{
   if(saveTimer)clearTimeout(saveTimer);
   saveTimer=setTimeout(()=>{if(window.selected?.source!=='sample'){capture(window.selected.id);remember(window.selected)}},700);
  })}
  if(window.selected?.source!=='sample'){
   if(!notes[String(window.selected.id)])capture(window.selected.id);
   remember(window.selected);
  }else renderHistory();
  renderRecommendations();
  window.vpProductDiscoveryRemember=remember;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();

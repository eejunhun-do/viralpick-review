/* Mobile and desktop product research evidence; does not scrape protected Coupang reviews. */
(function(){
 'use strict';
 const $=selector=>document.querySelector(selector);
 const KEY='vp-product-web-research-v1';
 const negative=/(?:단점|아쉬|불편하|불편함|무겁|부족|불량|고장|한계|약점|문제점|단,|다만|하지만|반면|구매 전|구매전|체크사항|주의사항|유의사항|제약|제한적|쉽지 않|어렵다|못한다|안 된다)/i;
 let working=false,productSeen='',currentMessage='';
 function trim(v,max){return String(v||'').trim().slice(0,max)}
 function id(){return String(typeof selected==='undefined'?'':selected?.id||'')}
 function retrieve(){
  try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{return {}}
 }
 function current(){
  const item=retrieve()[id()];
  if(!item||typeof item!=='object'||item.productName!==trim(selected?.name,180))return null;
  return item;
 }
 function context(productId=id()){
  const record=retrieve()[String(productId)];
  if(!record||record.productName!==trim((typeof products==='undefined'?[]:products).find(p=>String(p.id)===String(productId))?.name,180))return null;
  const research=record.research;
  if(!research||!Array.isArray(research.facts)||!Array.isArray(research.sources))return null;
  const sources=research.sources.slice(0,8).map(x=>({title:trim(x.title,110),url:trim(x.url,1600)}));
  const known=new Set(sources.map(x=>x.url));
  const facts=research.facts.filter(x=>known.has(x.source_url)&&['feature','advantage','usage'].includes(x.type)&&!negative.test(String(x.claim||''))).slice(0,12).map(x=>({type:trim(x.type,24),claim:trim(x.claim,270),source_url:trim(x.source_url,1600)}));
   return {summary:facts.length?facts.slice(0,3).map(f=>f.claim).join(' ').slice(0,550):'검증 가능한 장점 자료가 부족합니다. 추가 조사가 필요합니다.',model:trim(research.model,140),
   facts,
   sources,notCustomerReviews:true};
 }
 function root(){return $('#vpProductWebResearch')}
 function buttonBusy(value){
  const btn=root()?.querySelector('.vpWebResearchRun');
  if(btn){btn.disabled=!!value;btn.textContent=value?'공개 웹자료 조사 중…':'AI로 블로그·웹 제품정보 조사'}
 }
 function clear(el){if(el)el.replaceChildren()}
 function text(tag,label,cls){
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  el.textContent=label;return el;
 }
 function render(){
  const panel=root();if(!panel)return;
  const now=id(),record=current(),q=panel.querySelector('.vpWebResearchModel');
  if(now!==productSeen){
   productSeen=now;
   if(q)q.value=record?.query||trim(selected?.name,150);
   currentMessage='';
  }
  buttonBusy(working);
  const status=panel.querySelector('.vpWebResearchStatus');
  if(status)status.textContent=currentMessage||(record?'이 상품의 공개 웹조사 자료를 불러왔습니다. 조사 시점: '+new Date(record.createdAt).toLocaleString('ko-KR'):'상품명을 확인하고 검색하면 모바일에서도 조사 결과를 사용할 수 있습니다.');
  const view=panel.querySelector('.vpWebResearchResult');clear(view);
  const evidence=context();
  if(!evidence)return;
  view.append(text('strong','웹 검색 요약 (구매후기가 아님)'));
  if(evidence.summary)view.append(text('p',evidence.summary,'vpWebResearchSummary'));
  const labels={feature:'확인된 제품 설명',advantage:'웹자료에 소개된 장점',usage:'활용 상황'};
  const list=document.createElement('div');list.className='vpWebResearchClaims';
  evidence.facts.forEach(f=>{
   const row=document.createElement('div');row.className='vpWebResearchClaim';
   row.append(text('b',labels[f.type]||'참고 사항'));
   row.append(text('span',f.claim));
   const matching=evidence.sources.find(x=>x.url===f.source_url);
   if(matching){
    const a=document.createElement('a');a.href=matching.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='자료 보기 ↗';a.title=matching.title;row.append(a);
   }
   list.append(row);
  });
  view.append(list);
  const src=document.createElement('div');src.className='vpWebResearchSources';
  src.append(text('strong','조사 출처'));
  for(const x of evidence.sources){
   const a=document.createElement('a');a.href=x.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=x.title+' ↗';src.append(a);
  }
  view.append(src);
  view.append(text('small','웹에 게시된 주장·설명은 실제 구매후기와 다릅니다. 모델명·규격·기능을 원문에서 확인한 뒤 사용하세요. 블로그나 홍보 글의 평가는 확정적 성능 표현으로 사용하지 않습니다.','vpWebResearchWarning'));
 }
 async function perform(){
  if(working)return;
  const productId=id(),name=trim(selected?.name,180),q=trim(root()?.querySelector('.vpWebResearchModel')?.value,140);
  if(!name){currentMessage='상품을 먼저 선택해 주세요.';render();return}
  if(q.length<2){currentMessage='상품명 또는 모델명을 입력해 주세요.';render();return}
  if(!confirm('상품명·모델명으로 공개 웹사이트·블로그를 검색할까요? OpenAI 웹검색과 모델 이용 요금이 발생합니다.'))return;
  working=true;currentMessage='AI가 제품 정보를 조사하고 출처를 확인하는 중입니다. 잠시 기다려 주세요.';render();
  try{
   const response=await backendRequest('/api/copy',{method:'POST',body:JSON.stringify({action:'product-research',product:name,model:q})});
   if(!response?.research?.facts?.length||!response.research.sources?.length)throw Error('출처가 있는 자료를 받지 못했습니다.');
   if(id()!==productId){currentMessage='조사 중 다른 상품을 선택했습니다. 이전 상품 결과를 현재 상품에 적용하지 않았습니다.';return}
   const all=retrieve();
   all[productId]={productName:name,query:q,research:response.research,createdAt:response.generatedAt||new Date().toISOString()};
   const entries=Object.entries(all).slice(-24);
   try{localStorage.setItem(KEY,JSON.stringify(Object.fromEntries(entries)))}catch{currentMessage='브라우저 저장 공간 부족으로 결과를 보관하지 못했습니다.';return}
   currentMessage='공개 웹정보 '+response.research.facts.length+'건 · 출처 '+response.research.sources.length+'곳을 연결했습니다. 이제 Threads/Instagram AI 문구 생성에 자동 반영됩니다.';
  }catch(e){currentMessage='웹조사 실패: '+trim(e?.message,300)}
  finally{working=false;render()}
 }
 function install(){
  const source=$('#vpAiCopyPanel .pad');
  if(!source||root())return;
  const panel=document.createElement('section');panel.id='vpProductWebResearch';panel.className='vpProductWebResearch';
  panel.innerHTML='<h3>상품명·모델명 기반 AI 웹정보 조사</h3>'+
   '<p class="queueHint">모바일에서도 사용 가능 · 공개 블로그·웹페이지에서 확인된 장점과 활용 상황을 조사합니다. 실제 구매후기와 구분해 사용하며 출처를 제공합니다.</p>'+
   '<label class="vpWebResearchQuery">조사할 상품명 또는 모델명<input class="vpWebResearchModel" maxlength="140" placeholder="예: 브랜드 + 정확한 모델명" autocomplete="off"></label>'+
   '<button type="button" class="btn primary vpWebResearchRun">AI로 블로그·웹 제품정보 조사</button>'+
   '<p class="vpWebResearchStatus queueHint" role="status"></p><div class="vpWebResearchResult" aria-live="polite"></div>';
  const anchor=source.querySelector('#vpAiDescription')?.closest('.field');
  if(anchor)source.insertBefore(panel,anchor);else source.append(panel);
  panel.querySelector('.vpWebResearchRun').onclick=()=>void perform();
  window.vpProductResearchContext=context;
  window.vpProductResearchRefresh=render;
  const orig=window.selectProduct;
  if(typeof orig==='function')window.selectProduct=function(...args){const x=orig.apply(this,args);render();return x};
  render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
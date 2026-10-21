// Blog planning scores indicate editorial potential, NOT real search-volume or ranking data.
export const BLOG_TYPES=Object.freeze([
 {id:'problem',name:'문제 해결형',intent:'당장 겪는 문제를 해결하려는 검색'},
 {id:'howto',name:'사용법·방법형',intent:'제품 사용 순서와 방법을 찾는 검색'},
 {id:'cause',name:'원인·증상 분석형',intent:'문제가 왜 발생하는지 알아보는 검색'},
 {id:'compare',name:'제품 비교·차이형',intent:'서로 다른 방식·제품을 비교하는 검색'},
 {id:'buying',name:'구매 가이드·선택형',intent:'구매 전 선택 기준과 조건을 알아보는 검색'},
 {id:'faq',name:'FAQ·궁금증 해결형',intent:'제품 관련 질문을 간단명료하게 해결하려는 검색'},
 {id:'situation',name:'상황별 추천형',intent:'상황에 맞는 도구나 준비물을 찾는 검색'},
 {id:'checklist',name:'체크리스트·준비형',intent:'상황별 준비물·점검표를 찾는 검색'}
]);
export const SEO_WEIGHTS=Object.freeze({demand:35,intent:25,competition:20,trust:10,conversion:10});
const safe=(v,n=200)=>String(v??'').trim().slice(0,n);
const clamp=v=>Math.round(Math.min(100,Math.max(0,Number(v)||0)));
export function blogProductInput(value){
 if(!value||typeof value!=='object')return null;
 const name=safe(value.name,160);
 if(name.length<2)return null;
 const research=value.research&&typeof value.research==='object'?value.research:{};
 const sources=(Array.isArray(research.sources)?research.sources:[]).slice(0,8).map(s=>({title:safe(s?.title,120),url:safe(s?.url,700)}))
  .filter(s=>/^https:\/\/[^/\s]+$/i.test(s.url));
 const valid=new Set(sources.map(s=>s.url));
 const facts=(Array.isArray(research.facts)?research.facts:[]).slice(0,12)
  .map(f=>({claim:safe(f?.claim,220),source_url:safe(f?.source_url,700)}))
  .filter(f=>f.claim.length>5&&valid.has(f.source_url));
 const ideas=research.scope==='general'?(Array.isArray(research.guidance)?research.guidance:[]).slice(0,5).map(s=>safe(s,170)):[];
 return {
  name,category:safe(value.category,100),problem:safe(value.problem,500),
  audience:safe(value.audience,240),description:safe(value.description,1700),
  productFacts:facts,sources,generalIdeas:ideas,
  threadsHook:safe(value.threadsHook,240),instagramHook:safe(value.instagramHook,240)
 };
}
export function validateBlogPlan(value){
 if(!value||typeof value!=='object'||!Array.isArray(value.types))return null;
 const found=new Map();
 for(const row of value.types){
  const id=safe(row?.id,30);
  if(!BLOG_TYPES.some(t=>t.id===id)||found.has(id))continue;
  const ratings=row?.ratings;
  if(!ratings||typeof ratings!=='object'||Object.keys(SEO_WEIGHTS).some(k=>!Number.isFinite(Number(ratings[k]))||Number(ratings[k])<0||Number(ratings[k])>100))continue;
  const keywords=[...new Set((Array.isArray(row.keywords)?row.keywords:[]).map(k=>safe(k,65)).filter(k=>k.length>=2))].slice(0,6);
  if(keywords.length<2)continue;
  const signals=Object.fromEntries(Object.keys(SEO_WEIGHTS).map(k=>[k,clamp(ratings[k])]));
  const score=Math.round(Object.entries(SEO_WEIGHTS).reduce((acc,[k,w])=>acc+signals[k]*w,0)/100);
  found.set(id,{id,score,ratings:signals,keywords,angle:safe(row.angle,160),reason:safe(row.reason,300),
   topic:safe(row.topic,170)});
 }
 if(found.size!==BLOG_TYPES.length)return null;
 const types=BLOG_TYPES.map(t=>({...t,...found.get(t.id)})).sort((a,b)=>b.score-a.score);
 return {types,estimated:true,measurement:'AI 기반 기획용 예상치 · 검색량·경쟁도 실측 안 됨',
  recommended:types.slice(0,3).map(t=>t.id)};
}
export function validateBlogDraft(data){
 if(!data||typeof data!=='object')return null;
 const titles=(Array.isArray(data.titles)?data.titles:[]).map(x=>safe(x,105)).filter(x=>x.length>=14).slice(0,5);
 const sections=(Array.isArray(data.sections)?data.sections:[]).slice(0,10).map(x=>({
  heading:safe(x?.heading,110),
  paragraphs:(Array.isArray(x?.paragraphs)?x.paragraphs:[]).slice(0,4).map(y=>safe(y,900)).filter(y=>y.length>=22),
 })).filter(x=>x.heading&&x.paragraphs.length);
 const faq=(Array.isArray(data.faq)?data.faq:[]).slice(0,5).map(x=>({q:safe(x?.q,130),a:safe(x?.a,500)})).filter(x=>x.q&&x.a);
 if(titles.length!==5||sections.length<4)return null;
 return {titles,intro:safe(data.intro,1200),sections,faq,conclusion:safe(data.conclusion,950),
  imageNotes:(Array.isArray(data.imageNotes)?data.imageNotes:[]).slice(0,4).map(x=>safe(x,180)),
  verificationNotes:(Array.isArray(data.verificationNotes)?data.verificationNotes:[]).slice(0,8).map(x=>safe(x,150))}
}

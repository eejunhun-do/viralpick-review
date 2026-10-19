import {session} from '../lib/account-store.js';
import {json,preflight,checkAccess,safePayload} from '../lib/api-guard.js';
export function OPTIONS(req){return preflight(req)}
const HOSTS=new Set(['www.coupang.com','m.coupang.com','coupang.com','link.coupang.com','coupa.ng']);
function verified(raw){
 try{const url=new URL(raw);if(url.protocol!=='https:'||!HOSTS.has(url.hostname)||url.username||url.password||url.port)return null;return url}catch{return null}
}
function decode(s){return String(s||'').replace(/&(?:amp|quot|apos|lt|gt|nbsp|#39|#x27|#x2F);/g,v=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' ','&#39;':"'",'&#x27;':"'",'&#x2F;':'/'}[v]||v)).replace(/\s+/g,' ').trim()}
function textTags(html,property){
 const m=html.match(new RegExp('<meta\\b[^>]*(?:property|name)=["\\x27]'+property+'["\\x27][^>]*>','i'))?.[0];
 return decode(m?.match(/content=["']([^"']*)["']/i)?.[1]||'');
}
function textOnly(html){return decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '))}
function extract(html){
 const title=textTags(html,'og:title')||decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 const description=textTags(html,'og:description')||textTags(html,'description');
 const image=textTags(html,'og:image');
 // Do not pretend that anonymous text scraped from a page is an authenticated customer review.
 const structured=[];
 for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const obj=JSON.parse(m[1]);structured.push(...(Array.isArray(obj)?obj:[obj]))}catch{}
 }
 const product=structured.find(x=>x&&typeof x==='object'&&(String(x['@type']).includes('Product')||String(x['@type']).includes('ProductGroup')));
 const details=decode([description,typeof product?.description==='string'?product.description:''].filter(Boolean).join(' ')).slice(0,2600);
 return {title:title.slice(0,200),description:details,imageUrl: /^https:\/\//.test(image)?image:null,reviewNotes:'',reviewStatus:'not_accessible',extracted:{title:!!title,description:!!details,review:false}};
}
export async function POST(req){
 const denied=checkAccess(req);if(denied)return json(req,{ok:false,message:denied},401);
 let body;try{body=await safePayload(req,4000)}catch(e){return json(req,{ok:false,message:e.message},400)}
 let url=verified(body.url);if(!url)return json(req,{ok:false,message:'쿠팡 HTTPS 상품 링크만 허용됩니다.'},400);
 let html='',status=0;
 try{
  for(let n=0;n<4;n++){
   const response=await fetch(url.toString(),{redirect:'manual',headers:{Accept:'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(8500),cache:'no-store'});
   status=response.status;
   if([301,302,303,307,308].includes(status)){
    const next=verified(new URL(response.headers.get('location')||'',url).toString());
    if(!next)return json(req,{ok:false,message:'쿠팡 외부 주소로 이동하는 링크는 서버에서 열지 않습니다.'},422);
    url=next;continue;
   }
   if(!response.ok)return json(req,{ok:false,message:'상품 페이지 접근 실패 (HTTP '+status+'). 상세 페이지가 자동 접근을 제한할 수 있습니다.'},422);
   const type=response.headers.get('content-type')||'';
   if(!type.includes('text/html'))return json(req,{ok:false,message:'HTML 상품 페이지가 아닙니다.'},422);
   const len=Number(response.headers.get('content-length')||0);
   if(len>1800000)return json(req,{ok:false,message:'페이지 용량 제한 초과'},422);
   html=(await response.text()).slice(0,1800000);break;
  }
  if(!html)return json(req,{ok:false,message:'리디렉션이 많아 상품 페이지를 확인하지 못했습니다.'},422);
  const result=extract(html);
  if(!result.title&&!result.description)return json(req,{ok:false,message:'상품 정보를 확인할 수 없습니다. 접근 제한 또는 동적 페이지일 수 있습니다.'},422);
  return json(req,{ok:true,url:url.toString(),...result,notice:'공개 HTML에서 확인된 정보만 수집했습니다. 구매후기는 확인되지 않았으며 AI가 임의 생성하지 않습니다.'});
 }catch(e){return json(req,{ok:false,message:e.name==='TimeoutError'?'상세페이지 응답 시간 초과':'상품 페이지를 읽지 못했습니다. 접근 제한 여부를 확인하세요.'},502)}
}

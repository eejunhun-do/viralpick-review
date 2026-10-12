import {json,preflight,checkAccess} from '../lib/api-guard.js';
export function OPTIONS(req){return preflight(req)}
export async function GET(req){
 const problem=checkAccess(req);
 if(problem)return json(req,{ok:false,message:problem},problem.includes('설정')?503:401);
 // The Toss product-list endpoint and schema must be supplied from the approved, official API contract.
 // Never accept upstream URLs, auth headers or credentials from browser requests.
 const template=process.env.TOSS_PRODUCTS_URL;
 const token=process.env.TOSS_API_TOKEN;
 const allowedHost=process.env.TOSS_API_ALLOWED_HOST;
 if(!template||!token||!allowedHost)return json(req,{ok:false,connected:false,message:'토스 상품 조회 명세 및 인증 정보가 설정되지 않았습니다. 승인된 API URL·호스트·토큰을 서버 환경변수로 등록하세요.'},503);
 let upstream;
 try{
  const origin=new URL(req.url);
  const keyword=String(origin.searchParams.get('q')||'').trim().slice(0,50);
  const url=new URL(template.replaceAll('{keyword}',encodeURIComponent(keyword)).replaceAll('{limit}','6'));
  if(url.protocol!=='https:'||url.hostname!==allowedHost)return json(req,{ok:false,message:'허용된 토스 API 호스트가 아닙니다.'},500);
  const hName=process.env.TOSS_AUTH_HEADER||'Authorization';
  if(!/^[A-Za-z0-9-]+$/.test(hName)||hName.toLowerCase()==='host')return json(req,{ok:false,message:'인증 헤더 설정 오류'},500);
  const prefix=process.env.TOSS_AUTH_PREFIX===undefined?'Bearer ':process.env.TOSS_AUTH_PREFIX;
  const res=await fetch(url,{headers:{[hName]:prefix+token,'Accept':'application/json'},signal:AbortSignal.timeout(12000),cache:'no-store'});
  if(!res.ok)return json(req,{ok:false,message:'토스 상품 조회 API 오류 ('+res.status+')'},502);
  upstream=await res.json();
 }catch(e){return json(req,{ok:false,message:'토스 API 통신/응답 형식 오류. 공식 명세와 서버 설정을 확인해 주세요.'},502)}
 const raw=upstream?.data?.products??upstream?.data?.items??upstream?.products??upstream?.items;
 if(!Array.isArray(raw))return json(req,{ok:false,message:'API 응답 구조가 예상 매핑과 다릅니다. 승인된 문서에 맞춰 api/products.js 매핑을 조정해야 합니다.'},502);
 const products=raw.slice(0,6).map((r,i)=>{
  const id=r.productId??r.id??r.itemId??null;
  const name=r.productName??r.name??r.title??'';
  const price=Number(r.salePrice??r.sellingPrice??r.price??0);
  const image=r.imageUrl??r.thumbnailUrl??r.image??'';
  return {id:id===null?null:String(id),name:String(name).slice(0,160),price:Number.isFinite(price)&&price>0?price:null,imageUrl:typeof image==='string'&&/^https:\/\//.test(image)?image:null};
 }).filter(p=>p.id&&p.name&&p.price!==null);
 return json(req,{ok:true,products,notice:'API 데이터는 현재 화면 표시용이며 서버 DB에 저장하지 않습니다. 발행 전에 가격과 재고를 재확인하세요.'});
}

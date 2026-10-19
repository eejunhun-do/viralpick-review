import {session} from '../lib/account-store.js';
import {json,preflight,checkAccess} from '../lib/api-guard.js';
import {SEARCH_PATH,partnerRequest,isConfigured,validProductUrl} from '../lib/coupang-partners.js';

export function OPTIONS(req){return preflight(req)}
export async function GET(req){
 const auth=checkAccess(req);
 if(auth)return json(req,{ok:false,message:auth},auth.includes('설정')?503:401);
 if(!session(req)&&!isConfigured())return json(req,{ok:false,connected:false,provider:'coupang-partners',message:'쿠팡 파트너스 API 키가 아직 설정되지 않았습니다. 쿠팡 파트너스 최종 승인 후 Access/Secret Key를 Vercel 환경변수에 등록하세요.'},503);
 const url=new URL(req.url);
 const q=(url.searchParams.get('q')||'').trim().slice(0,80);
 if(q.length<2)return json(req,{ok:false,message:'상품 검색어를 두 글자 이상 입력해 주세요.'},400);
 const limit=Math.max(1,Math.min(10,Number(url.searchParams.get('limit')||10)||10));
 const query=new URLSearchParams({keyword:q,limit:String(limit)});
 let data;
 try{data=await partnerRequest('GET',SEARCH_PATH+'?'+query.toString(),undefined,session(req))}
 catch(e){return json(req,{ok:false,provider:'coupang-partners',message:e.message||'쿠팡 API 통신 오류'},e.status===503?503:502)}
 const raw=data?.data?.productData??data?.data?.products??data?.productData;
 if(!Array.isArray(raw))return json(req,{ok:false,message:'쿠팡 상품 검색 결과의 응답 필드가 예상한 형식과 다릅니다. 파트너스 API 최신 문서를 확인해 주세요.'},502);
 const products=raw.slice(0,limit).map(p=>{
  const id=p.productId??p.id;
  const name=p.productName??p.name;
  const price=Number(p.productPrice??p.price);
  const image=typeof p.productImage==='string'?p.productImage:null;
  return {
   id:id===undefined||id===null?null:String(id),
   name:typeof name==='string'?name.slice(0,160):'',
   price:Number.isFinite(price)&&price>0?price:null,
   imageUrl:image&&/^https:\/\//.test(image)?image.slice(0,1600):null,
   productUrl:validProductUrl(p.productUrl),isRocket:!!p.isRocket,
   provider:'coupang-partners'
  };
 }).filter(p=>p.id&&p.name&&p.price!==null);
 return json(req,{ok:true,provider:'coupang-partners',products,notice:'파트너스 API productUrl은 추적 링크입니다. 가격·재고는 조회 시점 기준이며 게시 전 확인하세요.'});
}
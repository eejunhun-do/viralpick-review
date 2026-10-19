import {json,preflight,checkAccess,safePayload} from '../lib/api-guard.js';
import {DEEPLINK_PATH,partnerRequest,isConfigured,validProductUrl} from '../lib/coupang-partners.js';

export function OPTIONS(req){return preflight(req)}
export async function POST(req){
 const auth=checkAccess(req);
 if(auth)return json(req,{ok:false,message:auth},auth.includes('설정')?503:401);
 if(!isConfigured())return json(req,{ok:false,message:'쿠팡 파트너스 API 키를 서버에 먼저 등록하세요.'},503);
 let body;try{body=await safePayload(req,5000)}catch(e){return json(req,{ok:false,message:'요청 형식 오류: '+e.message},400)}
 const urls=Array.isArray(body.urls)?body.urls:[body.url];
 if(urls.length===0||urls.length>10)return json(req,{ok:false,message:'한 번에 1~10개 URL만 변환할 수 있습니다.'},400);
 const originals=urls.map(validProductUrl);
 if(originals.some(s=>!s))return json(req,{ok:false,message:'쿠팡 상품 또는 쿠팡 검색 페이지의 https URL만 허용됩니다.'},400);
 let result;
 try{result=await partnerRequest('POST',DEEPLINK_PATH,{coupangUrls:originals})}
 catch(e){return json(req,{ok:false,message:e.message||'쿠팡 딥링크 API 호출 실패'},e.status===503?503:502)}
 const rows=Array.isArray(result?.data)?result.data:[];
 const links=originals.map((original,i)=>{
  const match=rows.find(r=>r.originalUrl===original)||rows[i];
  const affiliateUrl=validProductUrl(match?.shortenUrl);
  return {originalUrl:original,affiliateUrl};
 });
 if(links.some(l=>!l.affiliateUrl))return json(req,{ok:false,message:'파트너스 딥링크가 일부 생성되지 않았습니다. 발급 내역을 확인해 주세요.'},502);
 return json(req,{ok:true,provider:'coupang-partners',links});
}
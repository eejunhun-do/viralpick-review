import {createHmac} from 'node:crypto';

export const COUPANG_BASE='https://api-gateway.coupang.com';
export const SEARCH_PATH='/v2/providers/affiliate_open_api/apis/openapi/products/search';
export const DEEPLINK_PATH='/v2/providers/affiliate_open_api/apis/openapi/deeplink';
export function isConfigured(){return Boolean(process.env.COUPANG_PARTNERS_ACCESS_KEY?.trim()&&process.env.COUPANG_PARTNERS_SECRET_KEY?.trim())}
export function signingDate(now=new Date()){
 const pad=v=>String(v).padStart(2,'0');
 return String(now.getUTCFullYear()).slice(-2)+pad(now.getUTCMonth()+1)+pad(now.getUTCDate())+'T'+pad(now.getUTCHours())+pad(now.getUTCMinutes())+pad(now.getUTCSeconds())+'Z';
}
export function hmacAuthorization(method,pathWithQuery,key,secret,now=new Date()){
 const url=new URL(pathWithQuery,COUPANG_BASE);
 if(url.origin!==COUPANG_BASE||!url.pathname.startsWith('/v2/providers/affiliate_open_api/'))throw Error('허용하지 않는 API 경로입니다.');
 const date=signingDate(now);
 const message=date+method.toUpperCase()+url.pathname+url.search.slice(1);
 const digest=createHmac('sha256',secret).update(message,'utf8').digest('hex');
 return 'CEA algorithm=HmacSHA256, access-key='+key+', signed-date='+date+', signature='+digest;
}
export async function partnerRequest(method,path,body){
 const key=process.env.COUPANG_PARTNERS_ACCESS_KEY?.trim();
 const secret=process.env.COUPANG_PARTNERS_SECRET_KEY?.trim();
 if(!key||!secret){const e=new Error('서버에 쿠팡 파트너스 API Access Key와 Secret Key를 설정해 주세요.');e.status=503;throw e}
 const url=new URL(path,COUPANG_BASE);
 const res=await fetch(url,{
  method,
  headers:{
   Authorization:hmacAuthorization(method,path,key,secret),Accept:'application/json',
   ...(body===undefined?{}:{'Content-Type':'application/json; charset=utf-8'})
  },
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  redirect:'error',signal:AbortSignal.timeout(12000),cache:'no-store'
 });
 if(!res.ok){const e=new Error('쿠팡 파트너스 API 호출 오류 (HTTP '+res.status+')');e.status=502;throw e}
 let result;
 try{result=await res.json()}catch{throw Error('쿠팡 API 응답 형식을 읽을 수 없습니다.')}
 const code=result?.rCode??result?.code;
 if(code!==undefined&&String(code)!=='0'&&String(code).toUpperCase()!=='SUCCESS'){
  const e=new Error('쿠팡 파트너스 API 응답 오류 ('+String(code).slice(0,30)+')');e.status=502;throw e;
 }
 return result;
}
export function validProductUrl(value){
 if(typeof value!=='string'||value.length>2048)return null;
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||!['www.coupang.com','m.coupang.com','coupang.com','coupa.ng','link.coupang.com'].includes(u.hostname))return null;
  return u.toString();
 }catch{return null}
}
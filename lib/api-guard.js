import {timingSafeEqual} from 'node:crypto';
import {session} from './account-store.js';

const officialFrontend='https://eejunhun-do.github.io';
export function responseHeaders(request){
  const origin=request.headers.get('origin');
  const self=new URL(request.url).origin;
  const trusted=origin===officialFrontend||origin===self;
  const headers={
    'Cache-Control':'no-store',
    'Vary':'Origin',
    'Content-Type':'application/json; charset=utf-8',
    'X-Content-Type-Options':'nosniff'
  };
  if(trusted){
    headers['Access-Control-Allow-Origin']=origin;
    headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers']='Content-Type, X-Viralpick-Access, Authorization';
  }
  return {originAllowed:!origin||trusted,headers};
}
export function json(request,value,status=200){
  return new Response(JSON.stringify(value),{status,headers:responseHeaders(request).headers});
}
export function preflight(request){
  const {originAllowed,headers}=responseHeaders(request);
  return new Response(null,{status:originAllowed?204:403,headers});
}
export function checkAccess(request){
  const origin=responseHeaders(request);
  if(!origin.originAllowed)return '허용되지 않은 호출 출처입니다.';
  if(session(request))return null;
  const expected=process.env.VIRALPICK_ACCESS_KEY||'';
  if(expected.length<16)return '서버에 VIRALPICK_ACCESS_KEY(16자 이상)를 설정해야 합니다.';
  const actual=request.headers.get('x-viralpick-access')||'';
  const a=Buffer.from(actual),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))return '연결 암호가 일치하지 않습니다.';
  return null;
}
export async function safePayload(request,max=20000){
  const limit=Number(request.headers.get('content-length')||0);
  if(limit>max)throw new Error('요청 본문 용량 초과');
  const body=await request.text();
  if(body.length>max)throw new Error('요청 본문 용량 초과');
  return JSON.parse(body);
}

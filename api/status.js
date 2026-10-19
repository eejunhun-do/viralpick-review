import {json,preflight,checkAccess} from '../lib/api-guard.js';
import {session,getKeys} from '../lib/account-store.js';
import {isConfigured} from '../lib/coupang-partners.js';
export function OPTIONS(req){return preflight(req)}
export async function GET(req){
 const problem=checkAccess(req);
 if(problem)return json(req,{ok:false,message:problem},problem.includes('설정')?503:401);
 const user=session(req);const userKeys=user?await getKeys(user):null;
 return json(req,{
  ok:true,
  imageReady:Boolean(user?userKeys?.openaiApiKey:process.env.OPENAI_API_KEY),
  coupangConfigured:user?Boolean(userKeys?.coupangAccessKey&&userKeys?.coupangSecretKey):isConfigured(),
  account:user||null,
  affiliateProvider:'coupang-partners',
  imageModel:'gpt-image-2',
  notice:'쿠팡 파트너스 API Access Key와 Secret Key는 Vercel 서버 환경변수에만 저장합니다. 쿠팡 파트너스 최종 승인이 필요하며, 실제 API 연결은 키 등록 후 가능합니다.'
 });
}
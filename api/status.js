import {json,preflight,checkAccess} from '../lib/api-guard.js';
export function OPTIONS(req){return preflight(req)}
export function GET(req){
 const problem=checkAccess(req);
 if(problem)return json(req,{ok:false,message:problem},problem.includes('설정')?503:401);
 return json(req,{
  ok:true,
  imageReady:Boolean(process.env.OPENAI_API_KEY),
  tossConfigured:Boolean(process.env.TOSS_PRODUCTS_URL&&process.env.TOSS_API_TOKEN),
  imageModel:'gpt-image-2',
  notice:'토스 API 세부 요청 명세는 승인 후 별도 설정해야 합니다. 서버는 상품 데이터를 저장하지 않습니다.'
 });
}

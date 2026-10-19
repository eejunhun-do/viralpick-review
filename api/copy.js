import {session,getKeys} from '../lib/account-store.js';
import {json,preflight,checkAccess,safePayload} from '../lib/api-guard.js';
export function OPTIONS(req){return preflight(req)}
export async function POST(req){
 const denied=checkAccess(req);
 if(denied)return json(req,{ok:false,message:denied},401);
 const user=session(req);
 const key=user?(await getKeys(user)).openaiApiKey:process.env.OPENAI_API_KEY;
 if(!key)return json(req,{ok:false,message:'내 API 등록에서 OpenAI API 키를 등록하세요.'},503);
 let data;try{data=await safePayload(req,16000)}catch(e){return json(req,{ok:false,message:e.message},400)}
 const platform=data.platform==='Instagram'?'Instagram':'Threads';
 const products=Array.isArray(data.products)?data.products.slice(0,10):[];
 if(!products.length)return json(req,{ok:false,message:'상품을 먼저 선택하세요.'},400);
 const evidence=products.map(p=>({
  title:String(p.title||'').slice(0,180),price:Number(p.price)||null,
  category:String(p.category||'').slice(0,80),
  description:String(p.description||'').slice(0,2500),
  reviewNotes:String(p.reviewNotes||'').slice(0,2500)
 }));
 const instructions=[
 '한국어 소셜미디어 제품 소개 콘텐츠 작성자 역할이다.',
 '반드시 입력된 제품 사실과 사용자가 제공한 상세정보 및 실제 후기 요약에만 근거한다.',
 '제공되지 않은 제품 기능, 스펙, 효과, 구매자 리뷰, 별점, 할인율, 배송, 사용 경험 등을 꾸며내지 않는다.',
 '후기가 입력되지 않았다면 실제 구매후기라고 주장하지 않는다.',
 '확인 불가능한 효능, 과장된 표현, 허위 희소성, 확정적 성과를 금지한다.',
 '개인적으로 제품을 사용했다고 주장하지 않는다.',
 '읽기 쉬운 자연스러운 한국어로 작성하고 문장이 반복되는 템플릿형 카피를 피한다.',
 platform==='Threads'?'Threads용: 첫 문장은 관심을 끄는 질문 또는 제품의 확인 가능한 특징. 짧은 문단 3~5개, 최대 550자.':'Instagram용: 자연스러운 캡션과 간결한 줄바꿈, 유용한 선택 기준, 관련성 있는 해시태그 최대 5개. 최대 850자.',
 '끝에 반드시 문구를 정확하게 덧붙인다: 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
 '결과는 게시글 본문만 반환한다.'
 ].join('\n');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
  const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini',temperature:0.65,max_tokens:850,messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify({platform,products:evidence})}]}),signal:controller.signal});
  const result=await res.json().catch(()=>({}));
  if(!res.ok)return json(req,{ok:false,message:'OpenAI 문구 생성 실패 (HTTP '+res.status+'). 모델 권한 및 사용량을 확인하세요.'},502);
  const text=String(result.choices?.[0]?.message?.content||'').trim();
  if(!text)return json(req,{ok:false,message:'생성 결과가 비어 있습니다.'},502);
  return json(req,{ok:true,text:text.slice(0,3000),platform,model:'gpt-4.1-mini'});
 }catch(e){return json(req,{ok:false,message:e.name==='AbortError'?'문구 생성 시간 초과':'AI 문구 생성 요청 실패'},502)}
 finally{clearTimeout(timer)}
}

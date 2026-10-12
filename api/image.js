import {json,preflight,checkAccess,safePayload} from '../lib/api-guard.js';
export function OPTIONS(req){return preflight(req)}
export async function POST(req){
 const problem=checkAccess(req);
 if(problem)return json(req,{ok:false,message:problem},problem.includes('설정')?503:401);
 const key=process.env.OPENAI_API_KEY;
 if(!key)return json(req,{ok:false,message:'서버에 OPENAI_API_KEY를 설정해 주세요.'},503);
 let data;
 try{data=await safePayload(req)}catch(e){return json(req,{ok:false,message:'요청 형식 오류: '+e.message},400)}
 const product=String(data.product||'').trim().slice(0,100);
 const scene=String(data.scene||'').trim().slice(0,500);
 const purpose=data.purpose==='instagram'?'instagram':'threads';
 if(!product||scene.length<5)return json(req,{ok:false,message:'상품명 및 장면 설명을 입력해 주세요.'},400);
 const prompt=[
  'Create one high-quality Korean social media lifestyle scene illustration for a shopping content creator.',
  'Vertical 4:5 composition, clean naturally lit editorial photography style, usable as a background in a graphic card.',
  'Scene: '+scene+'. Category context: '+product+'.',
  'Show an authentic everyday problem situation and relevant environment.',
  'Do not fabricate specific exact product branding, model-specific features, comparisons, performance claims or prices.',
  'No words, captions, letters, numbers, banners, logos, watermarks or people identifiable as real individuals.',
  'Leave the top third visually simple for later overlay text. Professional, attractive, realistic but not misleading.',
  purpose==='instagram'?'Suitable for Instagram carousel.':'Suitable for a Threads hook image.'
 ].join('\n');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),135000);
 try{
  const upstream=await fetch('https://api.openai.com/v1/images/generations',{
    method:'POST',
    headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({model:'gpt-image-2',prompt,size:'1088x1360',quality:'medium',output_format:'webp',n:1}),
    signal:controller.signal
  });
  const result=await upstream.json().catch(()=>({}));
  if(!upstream.ok)return json(req,{ok:false,message:'이미지 제공자 호출 오류 ('+upstream.status+'). 계정 한도/모델 권한을 확인해 주세요.'},502);
  const b64=result.data?.[0]?.b64_json;
  if(typeof b64!=='string'||!b64.length)return json(req,{ok:false,message:'이미지 응답에 파일 데이터가 없습니다.'},502);
  return json(req,{ok:true,mime:'image/webp',image:'data:image/webp;base64,'+b64,model:'gpt-image-2',purpose});
 }catch(e){
  return json(req,{ok:false,message:e.name==='AbortError'?'이미지 생성 시간 초과':'이미지 요청 실패. 서버 연결 상태를 확인하세요.'},502);
 }finally{clearTimeout(timeout)}
}

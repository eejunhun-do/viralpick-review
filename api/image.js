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
 const style=['warm-editorial','clean-minimal','bold-contrast'].includes(data.style)?data.style:'warm-editorial';
 const artDirection={
  'warm-editorial':'Bright warm home interior, natural sunlight, premium lifestyle editorial photography, inviting cream and wood colors, gentle shadows.',
  'clean-minimal':'Crisp contemporary home environment, clean geometry, neutral daylight, refined modern commercial photography.',
  'bold-contrast':'Cinematic but approachable lifestyle photography, deliberate strong subject silhouette, high clarity and striking photographic depth.'
 }[style];
 const hook=String(data.hook||'').trim().slice(0,160);
 const prompt=[
  'Create a high quality PHOTOREALISTIC VERTICAL 4:5 lifestyle photo to be used as the entire background of a Korean social media hook poster.',
  'The entire frame is one immersive believable scene, NOT a predesigned poster and NOT a card, layout or collage.',
  'Scene: '+scene+'. General product/use-case category: '+product+'.',
  'Narrative intent (DO NOT print these words): '+(hook||'show why this everyday problem matters')+'.',
  'Composition is crucial: reserve the upper 35 percent as naturally bright, gently textured, uncluttered background such as a sunlit cream wall, for large BLACK AND BURNT-ORANGE KOREAN HEADLINE TYPE that our separate renderer will place later.',
  'Place the recognizable human activity, context and any tools prominently across the middle and lower two thirds. A compelling photographic story with useful subject scale, close perspective, realistic hands, beautiful spatial depth and premium commercial lighting.',
  'The photography must continue seamlessly behind the future headline; NO big empty color rectangles, no inset frames, no horizontal image strips, no cutout panels, no decorative text boxes.',
  artDirection,
  'Do NOT generate any writing whatsoever: NO Korean, English, text, letters, symbols, prices, watermark, brand, labels or logos. The exact Korean headline will be overlaid by the app later.',
  'Avoid inventing the exact look of the real listed product, manufacturer logos, specifications, performance evidence, comparisons or claims. Depict the usage context and only generic safe visual cues.',
  'Keep the lower-left region legible for a small separate product-name overlay. Authentic credible visual, not exaggerated or misleading.',
  purpose==='instagram'?'Designed as one Instagram carousel cover background.':'Designed as one scroll-stopping Threads hook image background.'
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

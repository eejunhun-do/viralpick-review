import {session,getKeys} from '../lib/account-store.js';
import {json,preflight,checkAccess,safePayload} from '../lib/api-guard.js';
export function OPTIONS(req){return preflight(req)}
export async function POST(req){
 const problem=checkAccess(req);
 if(problem)return json(req,{ok:false,message:problem},problem.includes('설정')?503:401);
 const user=session(req);
 const key=user?(await getKeys(user)).openaiApiKey:process.env.OPENAI_API_KEY;
 if(!key)return json(req,{ok:false,message:'서버에 OPENAI_API_KEY를 설정해 주세요.'},503);
 let data;
 try{data=await safePayload(req,1200000)}catch(e){return json(req,{ok:false,message:'요청 형식 오류: '+e.message},400)}
 const product=String(data.product||'').trim().slice(0,100);
 const scene=String(data.scene||'').trim().slice(0,500);
 const purpose=data.purpose==='carousel'?'carousel':data.purpose==='instagram'?'instagram':'threads';
 const slide=Number(data.slide)||0;
 if(purpose==='carousel'&&![2,3,4,5].includes(slide))return json(req,{ok:false,message:'캐러셀 사진은 2~5번 카드만 지원합니다.'},400);
 if(!product||scene.length<5)return json(req,{ok:false,message:'상품명 및 장면 설명을 입력해 주세요.'},400);
 const style=['warm-editorial','clean-minimal','bold-contrast'].includes(data.style)?data.style:'warm-editorial';
 const artDirection={
  'warm-editorial':'Bright warm home interior, natural sunlight, premium lifestyle editorial photography, inviting cream and wood colors, gentle shadows.',
  'clean-minimal':'Crisp contemporary home environment, clean geometry, neutral daylight, refined modern commercial photography.',
  'bold-contrast':'Cinematic but approachable lifestyle photography, deliberate strong subject silhouette, high clarity and striking photographic depth.'
 }[style];
 const referenceMode=data.imageMode==='product'?'product':'scene';
 const imageData=referenceMode==='product'?String(data.referenceImage||''):'';
 const match=referenceMode==='product'?imageData.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/):null;
 if(referenceMode==='product'&&(!match||match[2].length>850000||match[2].length<300))
  return json(req,{ok:false,message:'제품 실사 모드에는 직접 사용·편집 권한이 있는 상품 사진(JPG/PNG/WebP)이 필요합니다. 600KB 이하로 축소해서 다시 시도하세요.'},400);
 const hook=String(data.hook||'').trim().slice(0,160);
 const prompt=[
  'Create a high quality PHOTOREALISTIC VERTICAL 4:5 lifestyle photo to be used as the entire background of a Korean social media hook poster.',
  'The entire frame is one immersive believable scene, NOT a predesigned poster and NOT a card, layout or collage.',
  'Scene: '+scene+'. General product/use-case category: '+product+'.',
  referenceMode==='product'?'EDIT THE PROVIDED PRODUCT REFERENCE PHOTO into a believable lifestyle scene. Retain the exact recognizable product from the uploaded photo: silhouette, proportions, color, visible labels and packaging; no invented accessories, branding or structural changes. Show natural practical usage, interaction or wearing only when consistent with the reference. If uncertain, stage a neutral tabletop/in-hand setting instead of fabricating a wearable function.':'Situation-only photo. Depict human context without inventing the actual commercial product or specific branding.',
  'Narrative intent (DO NOT print these words): '+(hook||'show why this everyday problem matters')+'.',
  'Composition is crucial: reserve the upper 35 percent as naturally bright, gently textured, uncluttered background such as a sunlit cream wall, for large BLACK AND BURNT-ORANGE KOREAN HEADLINE TYPE that our separate renderer will place later.',
  'Place the recognizable human activity, context and any tools prominently across the middle and lower two thirds. A compelling photographic story with useful subject scale, close perspective, realistic hands, beautiful spatial depth and premium commercial lighting.',
  'The photography must continue seamlessly behind the future headline; NO big empty color rectangles, no inset frames, no horizontal image strips, no cutout panels, no decorative text boxes.',
  artDirection,
  'Do NOT generate any writing whatsoever: NO Korean, English, text, letters, symbols, prices, watermark, brand, labels or logos. The exact Korean headline will be overlaid by the app later.',
  'Avoid inventing the exact look of the real listed product, manufacturer logos, specifications, performance evidence, comparisons or claims. Depict the usage context and only generic safe visual cues.',
  'Keep the lower-left region legible for a small separate product-name overlay. Authentic credible visual, not exaggerated or misleading.',
  purpose==='carousel'?'Single dedicated visual for Instagram carousel slide '+slide+' of 5. This slide has a DIFFERENT visual narrative than its cover: '+({2:'show the everyday inconvenience before the solution',3:'feature a realistic generic product-use scene, with no fake brand',4:'show an honest close-up detail of the use context',5:'show a reassuring purchasing-decision moment or tidy completed everyday scene'}[slide])+'.':'',
  purpose==='carousel'?'Designed as a dedicated Instagram carousel interior slide, NOT the cover image.':purpose==='instagram'?'Designed as one Instagram carousel cover background.':'Designed as one scroll-stopping Threads hook image background.'
 ].join('\n');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),135000);
 try{
  let upstream;
  if(referenceMode==='product'){
   const form=new FormData();
   form.append('model','gpt-image-2');form.append('prompt',prompt);
   form.append('size','1088x1360');form.append('quality','medium');form.append('output_format','webp');form.append('output_compression','75');
   form.append('n',String(purpose==='carousel'?1:2));
   const bytes=Buffer.from(match[2],'base64');
   const mime='image/'+match[1];
   form.append('image',new Blob([bytes],{type:mime}),'product-reference.'+(match[1]==='jpeg'?'jpg':match[1]));
   upstream=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:'Bearer '+key},body:form,signal:controller.signal});
  }else{
   upstream=await fetch('https://api.openai.com/v1/images/generations',{
    method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({model:'gpt-image-2',prompt,size:'1088x1360',quality:'medium',output_format:'webp',output_compression:75,n:purpose==='carousel'?1:2}),signal:controller.signal
   });
  }
  const result=await upstream.json().catch(()=>({}));
  if(!upstream.ok)return json(req,{ok:false,message:'이미지 제공자 호출 오류 ('+upstream.status+'). 계정 한도/모델 권한을 확인해 주세요.'},502);
  const images=Array.isArray(result.data)
   ?result.data.map(item=>item?.b64_json).filter(x=>typeof x==='string'&&x.length>0).slice(0,2).map(b64=>'data:image/webp;base64,'+b64)
   :[];
  const expected=purpose==='carousel'?1:2;
  if(images.length!==expected)return json(req,{ok:false,message:'생성 결과가 '+expected+'장이 아닙니다. 요금이 발생했을 수 있으니 API 사용량을 확인해 주세요.'},502);
  return json(req,{ok:true,mime:'image/webp',images,image:purpose==='carousel'?images[0]:undefined,model:'gpt-image-2',imageMode:referenceMode,purpose,slide,count:images.length});

 }catch(e){
  return json(req,{ok:false,message:e.name==='AbortError'?'이미지 생성 시간 초과':'이미지 요청 실패. 서버 연결 상태를 확인하세요.'},502);
 }finally{clearTimeout(timeout)}
}

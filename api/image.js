import {session,getKeys} from '../lib/account-store.js';
import {json,preflight,checkAccess,safePayload} from '../lib/api-guard.js';

// Only image CDN hosts, never arbitrary remote URLs or redirects.
export function referenceImageUrl(value){
 if(typeof value!=='string'||value.length>2500)return null;
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  if(!(u.hostname==='coupangcdn.com'||u.hostname.endsWith('.coupangcdn.com')))return null;
  return u.toString();
 }catch{return null}
}
async function fetchReferenceImage(url,signal){
 const response=await fetch(url,{redirect:'error',cache:'no-store',headers:{Accept:'image/jpeg,image/png,image/webp'},signal});
 if(!response.ok)throw Error('상세 이미지 CDN이 접근을 거부했습니다 (HTTP '+response.status+'). 직접 사용 권한이 있는 사진을 업로드해 주세요.');
 const ct=String(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
 if(!['image/jpeg','image/png','image/webp'].includes(ct))throw Error('선택한 주소가 지원하는 이미지 형식이 아닙니다.');
 if(Number(response.headers.get('content-length')||0)>3200000)throw Error('선택한 상세 이미지는 3MB 이하만 지원합니다.');
 const chunks=[];let total=0;
 if(!response.body)throw Error('이미지 데이터를 읽을 수 없습니다.');
 const reader=response.body.getReader();
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;
   if(total>3200000)throw Error('선택한 이미지가 너무 큽니다. 3MB 이하 이미지를 선택하세요.');
   chunks.push(value);
  }
 }finally{await reader.cancel().catch(()=>{})}
 const bytes=Buffer.concat(chunks.map(v=>Buffer.from(v)));
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!((ct==='image/png'&&png)||(ct==='image/jpeg'&&jpg)||(ct==='image/webp'&&webp)))throw Error('이미지 형식과 파일 내용이 일치하지 않습니다.');
 return {bytes,mime:ct};
}

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
 const purpose=['carousel','instagram','threads','threads-pain','threads-solve'].includes(data.purpose)?data.purpose:'threads';
 const slide=Number(data.slide)||0;
 if(purpose==='carousel'&&![1,2,3,4,5].includes(slide))return json(req,{ok:false,message:'캐러셀 사진은 1~5번 카드만 지원합니다.'},400);
 if(purpose==='carousel'&&slide<=2&&data.imageMode==='product')return json(req,{ok:false,message:'1~2번은 제품 없는 후킹·문제 장면으로 생성해야 합니다.'},400);
 if(purpose==='carousel'&&slide>=3&&data.imageMode!=='product')return json(req,{ok:false,message:'3~5번은 실제 상품 썸네일·상세 이미지·업로드 사진을 선택해야 합니다.'},400);
 if(!product||scene.length<5)return json(req,{ok:false,message:'상품명 및 장면 설명을 입력해 주세요.'},400);
 const style=['warm-editorial','clean-minimal','bold-contrast'].includes(data.style)?data.style:'warm-editorial';
 const artDirection={
  'warm-editorial':'Bright warm home interior, natural sunlight, premium lifestyle editorial photography, inviting cream and wood colors, gentle shadows.',
  'clean-minimal':'Crisp contemporary home environment, clean geometry, neutral daylight, refined modern commercial photography.',
  'bold-contrast':'Cinematic but approachable lifestyle photography, deliberate strong subject silhouette, high clarity and striking photographic depth.'
 }[style];
 const referenceMode=purpose==='threads-pain'?'scene':purpose==='threads-solve'?'product':data.imageMode==='product'?'product':'scene';
 if(purpose==='threads-solve'&&data.imageMode!=='product')return json(req,{ok:false,message:'해결 장면은 실제 상품 참조 이미지가 필요합니다.'},400);
 const imageData=referenceMode==='product'?String(data.referenceImage||''):'';
 const imageUrl=referenceMode==='product'?referenceImageUrl(data.referenceUrl):null;
 const match=referenceMode==='product'&&imageData?imageData.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/):null;
 if(referenceMode==='product'&&!data.referenceRightsConfirmed)return json(req,{ok:false,message:'선택한 제품 이미지의 상업적 이용 및 AI 편집 권한을 확인해야 합니다.'},400);
 if(referenceMode==='product'&&!(imageUrl||match))return json(req,{ok:false,message:'선택된 제품 이미지가 없습니다. 상품 썸네일·상세 이미지 또는 업로드한 사진을 선택하세요.'},400);
 if(referenceMode==='product'&&imageData&&(!match||match[2].length>850000||match[2].length<300))
  return json(req,{ok:false,message:'제품 업로드 사진은 600KB 이하 JPEG/PNG/WebP로 축소해야 합니다.'},400);
 const hook=String(data.hook||'').trim().slice(0,160);
 const prompt=[
  'Create a high quality PHOTOREALISTIC VERTICAL 4:5 lifestyle photo to be used as the entire background of a Korean social media hook poster.',
  'The entire frame is one immersive believable scene, NOT a predesigned poster and NOT a card, layout or collage.',
  'Scene: '+scene+'. General product/use-case category: '+product+'.',
  referenceMode==='product'?'EDIT THE PROVIDED PRODUCT REFERENCE PHOTO into a believable lifestyle scene. Retain the exact recognizable product from the uploaded photo: silhouette, proportions, color, visible labels and packaging; no invented accessories, branding or structural changes. Show natural practical usage, interaction or wearing only when consistent with the reference. If uncertain, stage a neutral tabletop/in-hand setting instead of fabricating a wearable function.':'Situation-only photo. Depict human context without inventing the actual commercial product or specific branding.',
  'USER-SELECTED HOOK IS THE PRIMARY STORY DIRECTION: '+(hook||'show why this everyday problem matters')+'.',
  'Show a specific real-life moment that makes this Korean hook immediately understandable without words: appropriate people, actions, surroundings, expressions and recognizable problem or solution. If the hook is about mealtime mess, depict real mealtime mess; if about a subtle scent, show a plausible cozy room or bedding moment. Do not simply pose a product for a catalog photo. Interpret figurative language conservatively; do not invent efficacy claims.',
  referenceMode==='product'?'Use the selected product reference as the visual identity of the item the person is using. Transfer that exact product into the hook-matching situation, rather than copying the source photo background or inventing a different product.':'Do not depict the advertised product in this problem-only scene; show the everyday inconvenience or curious hook BEFORE a solution is introduced.',
  'The scene description supplies additional context only. If the scene and user-selected hook conflict, let the selected hook determine the storytelling situation, while keeping the reference product faithful.',
  'Do not print any words from the hook. The application composites its own headline afterward.',
  'Composition is crucial: reserve the upper 35 percent as naturally bright, gently textured, uncluttered background such as a sunlit cream wall, for large BLACK AND BURNT-ORANGE KOREAN HEADLINE TYPE that our separate renderer will place later.',
  'Place the recognizable human activity, context and any tools prominently across the middle and lower two thirds. A compelling photographic story with useful subject scale, close perspective, realistic hands, beautiful spatial depth and premium commercial lighting.',
  'The photography must continue seamlessly behind the future headline; NO big empty color rectangles, no inset frames, no horizontal image strips, no cutout panels, no decorative text boxes.',
  artDirection,
  referenceMode==='product'?'Preserve visible existing packaging or label from the reference photo when physically plausible; do not invent or alter letters, logos, prices or claims. Never add new text.':'Do not generate text, labels, logos or watermarks. The Korean headline is rendered by the app.',
  referenceMode==='product'?'Product must remain visually faithful to the uploaded reference. If parts are obscured, do not fabricate detailed specifications.':'Avoid inventing the exact look of the real listed product, logos, features or performance. Depict generic context.',
  purpose==='threads-pain'?'Depict an unmistakable but believable PROBLEM moment ONLY. No featured product, no successful resolution, no brand or sales imagery. The second slide will show the separate solution.':'Depict the practical, credible benefit of the reference product resolving the SAME prior inconvenience. Avoid magical transformations or guaranteed results.',
  purpose==='threads-solve'?'Show the EXACT reference product naturally in use as the solution; the product should be identifiable and proportionate.':'',
  'Authentic credible visual, not exaggerated or misleading.',
  purpose==='carousel'?'Single dedicated visual for Instagram carousel slide '+slide+' of 5. Match the supplied slide headline and scene. '+({1:'a curiosity-building everyday hook before the solution, no product visible',2:'a relatable inconvenience BEFORE the product appears, no product visible',3:'introduce the recognizable photographed reference product naturally into the relevant situation',4:'show the very same reference product in a plausible benefit/use situation with matching visible features',5:'show that same reference product in another realistic useful context, positive wrap-up and no invented specifications'}[slide])+'.':'',
  purpose==='carousel'?'Designed as one Instagram carousel '+slide+'/5 image, NOT a collage or a predesigned card.':purpose==='instagram'?'Designed as one Instagram carousel cover background.':purpose==='threads-pain'?'First slide of a connected two-photo Threads story: PROBLEM scene, no product needed.':purpose==='threads-solve'?'Second slide of the connected two-photo Threads story: PRODUCT AS SOLUTION.':'Designed as one scroll-stopping Threads hook image background.'
 ].join('\n');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),135000);
 try{
  let upstream;
  if(referenceMode==='product'){
   const form=new FormData();
   form.append('model','gpt-image-2');form.append('prompt',prompt);
   form.append('size','1088x1360');form.append('quality','medium');form.append('output_format','webp');form.append('output_compression','75');
   form.append('n',String(['carousel','threads-pain','threads-solve'].includes(purpose)?1:2));
   const reference=imageUrl?await fetchReferenceImage(imageUrl,controller.signal):{bytes:Buffer.from(match[2],'base64'),mime:'image/'+match[1]};
   const {bytes,mime}=reference;
   form.append('image',new Blob([bytes],{type:mime}),'product-reference.'+(mime==='image/jpeg'?'jpg':mime.split('/')[1]));
   upstream=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:'Bearer '+key},body:form,signal:controller.signal});
  }else{
   upstream=await fetch('https://api.openai.com/v1/images/generations',{
    method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({model:'gpt-image-2',prompt,size:'1088x1360',quality:'medium',output_format:'webp',output_compression:75,n:['carousel','threads-pain','threads-solve'].includes(purpose)?1:2}),signal:controller.signal
   });
  }
  const result=await upstream.json().catch(()=>({}));
  if(!upstream.ok)return json(req,{ok:false,message:'이미지 제공자 호출 오류 ('+upstream.status+'). 계정 한도/모델 권한을 확인해 주세요.'},502);
  const images=Array.isArray(result.data)
   ?result.data.map(item=>item?.b64_json).filter(x=>typeof x==='string'&&x.length>0).slice(0,2).map(b64=>'data:image/webp;base64,'+b64)
   :[];
  const expected=['carousel','threads-pain','threads-solve'].includes(purpose)?1:2;
  if(images.length!==expected)return json(req,{ok:false,message:'생성 결과가 '+expected+'장이 아닙니다. 요금이 발생했을 수 있으니 API 사용량을 확인해 주세요.'},502);
  return json(req,{ok:true,mime:'image/webp',images,image:expected===1?images[0]:undefined,model:'gpt-image-2',imageMode:referenceMode,purpose,slide,count:images.length});

 }catch(e){
  return json(req,{ok:false,message:e.name==='AbortError'?'이미지 생성 시간 초과':'이미지 요청 실패. 서버 연결 상태를 확인하세요.'},502);
 }finally{clearTimeout(timeout)}
}

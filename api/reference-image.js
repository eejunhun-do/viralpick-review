import {json,preflight,checkAccess,safePayload} from '../lib/api-guard.js';
import {downloadPublicImage} from '../lib/remote-image.js';

export function OPTIONS(req){return preflight(req)}
export async function POST(req){
 const denied=checkAccess(req);
 if(denied)return json(req,{ok:false,message:denied},401);
 let data;
 try{data=await safePayload(req,4000)}
 catch(e){return json(req,{ok:false,message:'이미지 요청 형식 오류: '+e.message},400)}
 if(data?.rightsConfirmed!==true)return json(req,{ok:false,message:'상품 사진의 AI 편집·상업적 활용 권한을 확인해 주세요.'},400);
 try{
  const {bytes,mime}=await downloadPublicImage(data?.url);
  return json(req,{
   ok:true,imageData:'data:'+mime+';base64,'+bytes.toString('base64'),
   mediaType:mime,size:bytes.length,transport:'server-image-download'
  });
 }catch(e){
  return json(req,{ok:false,message:'상품 참조 사진 가져오기 실패: '+String(e?.message||'외부 이미지 서버에 연결할 수 없습니다.').slice(0,230)},422);
 }
}

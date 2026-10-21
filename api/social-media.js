import {randomUUID} from 'node:crypto';
import {session} from '../lib/account-store.js';
import {json,responseHeaders} from '../lib/api-guard.js';
import {put} from '@vercel/blob';
export async function POST(req){
 if(!responseHeaders(req).originAllowed||!session(req))return json(req,{ok:false,message:'로그인이 필요합니다.'},401);
 if(!process.env.BLOB_READ_WRITE_TOKEN)return json(req,{ok:false,message:'이미지 호스팅용 Vercel Blob 연결이 필요합니다.'},503);
 try{
  const len=Number(req.headers.get('content-length')||0);
  if(len>4*1024*1024)return json(req,{ok:false,message:'3.8MB 이하 사진만 등록할 수 있습니다.'},413);
  const form=await req.formData(),file=form.get('file');
  if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3.8*1024*1024||file.size<100)return json(req,{ok:false,message:'JPG·PNG·WebP 이미지 3.8MB 이하만 허용됩니다.'},400);
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  const blob=await put('social/'+randomUUID()+'.'+ext,file,{access:'public',contentType:file.type,addRandomSuffix:false});
  return json(req,{ok:true,url:blob.url});
 }catch{return json(req,{ok:false,message:'이미지 업로드에 실패했습니다.'},502)}
}

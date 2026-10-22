/* Instagram API with Instagram Login: create -> process -> publish.
 * This module is intentionally independent of the queue so it can be tested
 * without writing to a Meta account or storing actual access tokens.
 */
import {waitForMetaMedia} from './social-media-status.js';

export function validateInstagramImages(imageUrls){
 if(!Array.isArray(imageUrls)||imageUrls.length<1||imageUrls.length>10)
  throw new Error('Instagram 이미지는 1~10장 필요합니다. 2장 이상이면 캐러셀로 게시됩니다.');
 for(const [i,value] of imageUrls.entries()){
  let url;try{url=new URL(value)}catch{throw new Error((i+1)+'번 이미지의 주소가 올바르지 않습니다.')}
  if(url.protocol!=='https:'||url.username||url.password||value.length>1500)
   throw new Error((i+1)+'번 이미지는 공개 HTTPS URL이어야 합니다.');
  if(/\.(png|webp|gif|avif|heic|mpo|jps)$/i.test(url.pathname))
   throw new Error((i+1)+'번 이미지는 Instagram에서 지원하지 않는 형식입니다. JPG/JPEG로 변환해 업로드해 주세요.');
 }
 return imageUrls.length;
}
export function isInstagramProfessional(accountType){
 return ['BUSINESS','MEDIA_CREATOR','CREATOR'].includes(String(accountType||'').toUpperCase());
}
export async function publishInstagramFeed({accountId,token,imageUrls,caption,graph,stage=async()=>{},
 wait=waitForMetaMedia}){
 const count=validateInstagramImages(imageUrls);
 if(!accountId||!token||typeof graph!=='function')throw new Error('Instagram 계정 또는 API 인증 정보가 없습니다.');
 const prefix='/'+accountId;
 const ready=async(id,position)=>{
  if(!id)throw new Error('Instagram '+position+' 이미지 컨테이너 ID가 없습니다.');
  return wait('instagram',id,containerId=>
   graph('instagram','/'+containerId,token,{fields:{fields:'status_code'}}),
   {tries:18,interval:1800});
 };
 await stage('Instagram '+count+'장 이미지 컨테이너 생성 중',1);
 const children=[];
 let parent;
 if(count>1){
  for(const [i,image_url] of imageUrls.entries()){
   const child=await graph('instagram',prefix+'/media',token,{method:'POST',fields:{image_url,is_carousel_item:'true'}});
   if(!child?.id)throw new Error('Instagram '+(i+1)+'번 이미지 컨테이너 생성에 실패했습니다.');
   children.push(child.id);
  }
  await stage('Instagram '+count+'장 이미지 처리 완료 확인 중',2);
  await Promise.all(children.map((id,i)=>ready(id,String(i+1))));
  await stage('Instagram 캐러셀 결합 중',3);
  parent=await graph('instagram',prefix+'/media',token,{
   method:'POST',fields:{media_type:'CAROUSEL',children:children.join(','),caption}
  });
 }else{
  parent=await graph('instagram',prefix+'/media',token,{
   method:'POST',fields:{image_url:imageUrls[0],caption}
  });
 }
 if(!parent?.id)throw new Error('Instagram 최종 게시 컨테이너를 만들지 못했습니다.');
 await stage('Instagram 최종 이미지 발행 준비 확인 중',4);
 await ready(parent.id,'최종');
 await stage('Instagram 실제 게시 중',5);
 const result=await graph('instagram',prefix+'/media_publish',token,{method:'POST',fields:{creation_id:parent.id}});
 if(!result?.id)throw new Error('Instagram 게시 성공 응답에 게시 ID가 없습니다. 계정에서 발행 여부를 먼저 확인해 주세요.');
 return {id:result.id,imageCount:count};
}

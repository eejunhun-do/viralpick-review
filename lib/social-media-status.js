/* Reusable Media Container readiness check for Meta Threads / Instagram publishing.
 * Meta fetches publicly-hosted images asynchronously. Container creation != ready.
 */
export function mediaContainerState(platform,data){
 const raw=platform==='threads'?data?.status:data?.status_code;
 const state=String(raw||'').trim().toUpperCase();
 if(state==='FINISHED'||state==='PUBLISHED')return {ready:true,failed:false,state};
 if(state==='ERROR'||state==='EXPIRED')return {ready:false,failed:true,state,reason:String(data?.error_message||'Meta 이미지 변환 오류').slice(0,150)};
 return {ready:false,failed:false,state:state||'UNKNOWN'};
}
export async function waitForMetaMedia(platform,id,load,{
 tries=9,interval=1400,sleep=ms=>new Promise(r=>setTimeout(r,ms))
}={}){
 if(!id)throw Error('Meta 이미지 컨테이너 ID가 없습니다.');
 for(let n=0;n<tries;n++){
  const status=mediaContainerState(platform,await load(id));
  if(status.ready)return status.state;
  if(status.failed)throw Error('Meta 이미지 처리 '+status.state+': '+status.reason);
  if(n<tries-1)await sleep(interval);
 }
 throw Error('Meta 이미지 처리 대기 시간 초과. Meta 게시 내역을 확인해 주세요.');
}

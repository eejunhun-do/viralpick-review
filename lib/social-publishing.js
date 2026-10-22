import {randomBytes} from 'node:crypto';
import {session,redis,encrypt,decrypt} from './account-store.js';
import {json,responseHeaders,safePayload,preflight} from './api-guard.js';
import {waitForMetaMedia} from './social-media-status.js';

const platforms=['threads','instagram'];
const key=(u,p)=>'vp:social:v1:connection:'+u+':'+p;
const jobKey=id=>'vp:social:v1:job:'+id;
const queue='vp:social:v1:queue';
const userJobs=u=>'vp:social:v1:jobs:'+u;
const BASE={threads:'https://graph.threads.net/v1.0',instagram:'https://graph.instagram.com/v24.0'};
const app=p=>({id:process.env[p==='threads'?'META_THREADS_APP_ID':'META_INSTAGRAM_APP_ID'],secret:process.env[p==='threads'?'META_THREADS_APP_SECRET':'META_INSTAGRAM_APP_SECRET']});
const publicBase=req=>(process.env.SOCIAL_PUBLIC_BASE_URL||new URL(req.url).origin).replace(/\/$/,'');
const cb=(req,p)=>publicBase(req)+'/api/social?oauth=callback&platform='+p;
const scoped=(req)=>responseHeaders(req).originAllowed?session(req):null;
const getConnection=async(u,p)=>{const raw=await redis('GET',key(u,p));return raw?decrypt(raw):null};
const saveConnection=(u,p,c)=>redis('SET',key(u,p),encrypt(c));
const scopesForReplies=['threads_manage_replies','threads_read_replies'];
const hasThreadScope=(c,scope)=>Array.isArray(c?.scopes)&&c.scopes.includes(scope);
const replyReady=c=>scopesForReplies.every(scope=>hasThreadScope(c,scope));
const redact=(c,p)=>c?{connected:true,username:c.username||'',id:c.id,expiresAt:c.expiresAt||null,
 ...(p==='threads'?{replyReady:replyReady(c),replyPermissions:scopesForReplies.filter(x=>hasThreadScope(c,x))}:{})}:{connected:false};
const msg=e=>String(e?.message||e||'요청 실패').slice(0,340);
function getParam(req,name){return new URL(req.url).searchParams.get(name)||''}
async function graph(p,path,token,{method='GET',fields={}}={}){
 const qs=new URLSearchParams(fields);
 if(token)qs.set('access_token',token);
 const url=BASE[p]+path+(qs.size?'?'+qs:'');
 const res=await fetch(url,{method,cache:'no-store',signal:AbortSignal.timeout(15000)});
 let data={};try{data=await res.json()}catch{}
 if(!res.ok||data.error){
  const code=Number(data.error?.code)||0,subcode=Number(data.error?.error_subcode)||0;
  const userDetail=String(data.error?.error_user_msg||data.error?.error_user_title||'').slice(0,200);
  const detail=String(data.error?.message||'Meta API 오류').slice(0,160);
  const error=new Error('Meta API HTTP '+res.status+(code?' / Meta '+code:'')+
   (subcode?' ('+subcode+')':'')+' · '+detail+(userDetail?' · '+userDetail:''));
  // Structured status information, never an access token or query URL.
  error.httpStatus=res.status;error.metaCode=code;error.metaSubcode=subcode;
  error.metaTrace=String(data.error?.fbtrace_id||'').slice(0,60);
  throw error;
 }
 return data;
}

async function validConnection(user,p,connection){
 if(!connection)return null;
 if(connection.expiresAt<Date.now())return connection;
 // Long-lived Threads/Instagram User tokens can be refreshed while valid, after 24 hours.
 if(connection.expiresAt>Date.now()+7*86400000||Date.now()-(connection.refreshedAt||connection.connectedAt||0)<86400000)return connection;
 try{
  const endpoint=p==='threads'?'https://graph.threads.net/refresh_access_token':'https://graph.instagram.com/refresh_access_token';
  const grant=p==='threads'?'th_refresh_token':'ig_refresh_token';
  const response=await fetch(endpoint+'?'+new URLSearchParams({grant_type:grant,access_token:connection.accessToken}),{signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(response.ok&&data.access_token&&data.expires_in){
   const renewed={...connection,accessToken:data.access_token,expiresAt:Date.now()+Number(data.expires_in)*1000,refreshedAt:Date.now()};
   await saveConnection(user,p,renewed);return renewed;
  }
 }catch{}
 return connection;
}

async function exchange(req,p,code){
 const a=app(p),redirect=cb(req,p);
 const ep=p==='threads'?'https://graph.threads.net/oauth/access_token':'https://api.instagram.com/oauth/access_token';
 const body=new URLSearchParams({client_id:a.id,client_secret:a.secret,grant_type:'authorization_code',redirect_uri:redirect,code});
 const response=await fetch(ep,{method:'POST',body,signal:AbortSignal.timeout(15000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.access_token)throw Error(data.error_message||data.error?.message||'Meta 인증 코드 교환 실패');
 let token=data.access_token,seconds=data.expires_in||3600;
 try{
  const ex=p==='threads'
   ?await fetch('https://graph.threads.net/access_token?'+new URLSearchParams({grant_type:'th_exchange_token',client_secret:a.secret,access_token:token}),{signal:AbortSignal.timeout(15000)})
   :await fetch('https://graph.instagram.com/access_token?'+new URLSearchParams({grant_type:'ig_exchange_token',client_secret:a.secret,access_token:token}),{signal:AbortSignal.timeout(15000)});
  const l=await ex.json();if(ex.ok&&l.access_token){token=l.access_token;seconds=l.expires_in||seconds}
 }catch{}
 const profile=await graph(p,'/me',token,{fields:{fields:'id,username'}});
 let scopes=null;
 if(p==='threads'){
  try{
   const inspected=await graph(p,'/debug_token',token,{fields:{input_token:token}});
   scopes=inspected.data?.is_valid===true&&Array.isArray(inspected.data.scopes)?inspected.data.scopes:null;
  }catch{}
 }
 return {accessToken:token,expiresAt:Date.now()+Number(seconds)*1000,id:String(profile.id),
  username:String(profile.username||''),connectedAt:Date.now(),scopes};
}

const normalizeSocialBody=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
export function matchPublishedPost(job,items,now=Date.now()){
 if(!job||!normalizeSocialBody(job.text)||!Number.isFinite(Number(job.scheduledAt)))return [];
 const start=Number(job.scheduledAt)-5*60000;
 const end=Math.min(now,Number(job.scheduledAt)+12*3600000);
 return (Array.isArray(items)?items:[]).filter(x=>{
  const ts=Date.parse(x?.timestamp||'');
  return Boolean(x?.id)&&Number.isFinite(ts)&&ts>=start&&ts<=end
   &&normalizeSocialBody(x.text??x.caption)===normalizeSocialBody(job.text);
 });
}
// A late scheduled item might already have been published by Meta. Confirm
// against the provider before changing persisted status. Never infer from a timer.
async function reconcileJob(job,{force=false}={}){
 if(!job||!['scheduled','needs_review'].includes(job.status)||Number(job.scheduledAt)+60000>Date.now())return job;
 const cooldown='vp:social:v1:sync-cooldown:'+job.id;
 if(!force&&await redis('GET',cooldown))return job;
 const lock='vp:social:v1:lock:'+job.id;
 if(await redis('SET',lock,'sync','NX','EX',40)!=='OK')return job;
 try{
  const raw=await redis('GET',jobKey(job.id));
  const current=raw?JSON.parse(raw):null;
  if(!current||!['scheduled','needs_review'].includes(current.status))return current||job;
  const c=await validConnection(current.user,current.platform,await getConnection(current.user,current.platform));
  if(!c||c.expiresAt<Date.now())return {...current,syncError:'Meta 계정 연결 상태를 확인해 주세요.'};
  const endpoint='/'+c.id+(current.platform==='threads'?'/threads':'/media');
  const fields=current.platform==='threads'?'id,text,timestamp,permalink':'id,caption,timestamp,permalink';
  const data=await graph(current.platform,endpoint,c.accessToken,{fields:{fields,limit:50}});
  const matches=matchPublishedPost(current,data.data);
  if(matches.length===1){
   current.status='published';current.postId=String(matches[0].id);
   current.permalink=String(matches[0].permalink||'');
   current.reconciledAt=Date.now();current.updatedAt=Date.now();current.error=null;
   await redis('SET',jobKey(current.id),JSON.stringify(current));
   await redis('ZREM',queue,current.id);
  }else if(matches.length>1){
   current.status='needs_review';
   current.error='동일한 게시물이 여러 건 발견됐습니다. Meta에서 실제 게시 상태를 확인해 주세요.';
   current.updatedAt=Date.now();
   await redis('SET',jobKey(current.id),JSON.stringify(current));
   await redis('ZREM',queue,current.id);
  }else{
   await redis('SET',cooldown,'1','EX',90);
  }
  return current;
 }catch(e){return {...job,syncError:'Meta 게시 상태 확인 실패: '+msg(e)}}
 finally{await redis('DEL',lock)}
}

function responseRedirect(req,p,status){
 const u=new URL('/v05.html',publicBase(req));u.searchParams.set('view','scheduler');u.searchParams.set('social',status);u.searchParams.set('platform',p);
 return new Response(null,{status:302,headers:{Location:u.toString(),'Cache-Control':'no-store'}});
}
export async function socialGET(req){
 const oauth=getParam(req,'oauth'),p=getParam(req,'platform');
 if(oauth==='callback'){
  if(!platforms.includes(p))return responseRedirect(req,'threads','invalid');
  const state=getParam(req,'state'),code=getParam(req,'code');
  if(!/^[0-9a-f]{48}$/.test(state)||!code||code.length>2000)return responseRedirect(req,p,'cancelled');
  try{
   const raw=await redis('GETDEL','vp:social:v1:oauth:'+state);
   if(!raw)return responseRedirect(req,p,'expired');
   const record=JSON.parse(raw);
   if(record.platform!==p||record.expires<Date.now())return responseRedirect(req,p,'expired');
   await saveConnection(record.user,p,await exchange(req,p,code));
   return responseRedirect(req,p,'connected');
  }catch{return responseRedirect(req,p,'failed')}
 }
 const u=scoped(req);if(!u)return json(req,{ok:false,message:'로그인이 필요합니다.'},401);
 try{
  const op=getParam(req,'op')||'status';
  if(op==='status'){
   const result={};for(const platform of platforms)result[platform]=redact(await getConnection(u,platform),platform);
   return json(req,{ok:true,platforms:result,configured:Object.fromEntries(platforms.map(p=>[p,!!(app(p).id&&app(p).secret)])),blobConfigured:Boolean(process.env.BLOB_READ_WRITE_TOKEN),schedulerConfigured:Boolean(process.env.CRON_SECRET)});
  }
  if(op==='connect'){
   if(!platforms.includes(p))return json(req,{ok:false,message:'플랫폼 선택 오류'},400);
   const a=app(p);if(!a.id||!a.secret)return json(req,{ok:false,message:'Meta 개발자 앱 ID/Secret 서버 설정이 필요합니다.'},503);
   const nonce=randomBytes(24).toString('hex');
   const record={user:u,platform:p,expires:Date.now()+600000};
   const ok=await redis('SET','vp:social:v1:oauth:'+nonce,JSON.stringify(record),'EX',600,'NX');
   if(ok!=='OK')throw Error('인증 요청을 생성하지 못했습니다.');
   const scope=p==='threads'?'threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies':'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights';
   const host=p==='threads'?'https://threads.net/oauth/authorize':'https://www.instagram.com/oauth/authorize';
   const url=host+'?'+new URLSearchParams({client_id:a.id,redirect_uri:cb(req,p),scope,response_type:'code',state:nonce});
   return json(req,{ok:true,url});
  }
  if(op==='jobs'){
   const ids=await redis('ZREVRANGE',userJobs(u),0,79)||[];
   const posts=await Promise.all(ids.map(async id=>{const s=await redis('GET',jobKey(id));return s?JSON.parse(s):null}));
   const late=posts.filter(j=>j?.status==='scheduled'&&Number(j.scheduledAt)+120000<Date.now()).slice(0,2);
   const reconciled=new Map();
   for(const j of late)reconciled.set(j.id,await reconcileJob(j));
   return json(req,{ok:true,posts:posts.filter(Boolean).map(j=>{
    const latest=reconciled.get(j.id)||j;
    return {...latest,text:String(latest.text||'')};
   })});
  }
  if(op==='insights')return json(req,{ok:true,platforms:await socialInsights(u)});
  return json(req,{ok:false,message:'지원하지 않는 요청'},400);
 }catch(e){return json(req,{ok:false,message:msg(e)},503)}
}
export async function socialPOST(req){
 const u=scoped(req);if(!u)return json(req,{ok:false,message:'로그인이 필요합니다.'},401);
 let d;try{d=await safePayload(req,30000)}catch{return json(req,{ok:false,message:'잘못된 요청'},400)}
 try{
  if(d.action==='disconnect'){
   if(!platforms.includes(d.platform))return json(req,{ok:false,message:'플랫폼 오류'},400);
   await redis('DEL',key(u,d.platform));return json(req,{ok:true});
  }
  if(d.action==='reconcile'){
   if(!/^[0-9a-f-]{36}$/.test(d.id||''))return json(req,{ok:false,message:'예약 ID 오류'},400);
   const raw=await redis('GET',jobKey(d.id));const job=raw?JSON.parse(raw):null;
   if(!job||job.user!==u)return json(req,{ok:false,message:'예약을 찾지 못했습니다.'},404);
   if(Number(job.scheduledAt)>Date.now())return json(req,{ok:false,message:'예약 시각 이후에 확인할 수 있습니다.'},409);
   const latest=await reconcileJob(job,{force:true});
   return json(req,{ok:true,matched:latest.status==='published',post:{id:latest.id,status:latest.status,postId:latest.postId||null,syncError:latest.syncError||null}});
  }
  if(d.action==='update'){
   if(!/^[0-9a-f-]{36}$/.test(d.id||''))return json(req,{ok:false,message:'예약 ID 오류'},400);
   const lock='vp:social:v1:lock:'+d.id;
   if(await redis('SET',lock,'user-edit','NX','EX',30)!=='OK')
    return json(req,{ok:false,message:'발행 처리 또는 다른 수정 작업이 진행 중입니다. 새로고침 후 다시 시도해 주세요.'},409);
   try{
    const raw=await redis('GET',jobKey(d.id)),j=raw?JSON.parse(raw):null;
    if(!j||j.user!==u)return json(req,{ok:false,message:'내 예약을 찾지 못했습니다.'},404);
    if(j.status!=='scheduled')return json(req,{ok:false,message:'예약 대기 중인 콘텐츠만 수정할 수 있습니다.'},409);
    const now=Date.now(),lead=120000;
    if(Number(j.scheduledAt)<now+lead)return json(req,{ok:false,message:'기존 예약 시각까지 2분 이내이거나 시간이 지났습니다. 중복 발행 방지를 위해 수정할 수 없습니다.'},409);
    if(!Number.isSafeInteger(d.expectedUpdatedAt)||Number(d.expectedUpdatedAt)!==Number(j.updatedAt))
     return json(req,{ok:false,message:'예약이 다른 화면에서 변경됐습니다. 최신 목록을 새로고침해 주세요.'},409);
    if(!d.approved)return json(req,{ok:false,message:'수정한 본문·이미지·광고 고지를 확인한 뒤 승인해 주세요.'},400);
    const text=String(d.text||'').trim(),replyText=j.platform==='threads'?String(d.replyText||'').trim():'';
    const urls=Array.isArray(d.imageUrls)?d.imageUrls:[];
    if(!text||text.length>2200||replyText.length>500||urls.length>10)
     return json(req,{ok:false,message:'본문 길이 또는 이미지 최대 10장 제한을 확인해 주세요.'},400);
    if(j.platform==='threads'&&([...text].length>500||[...replyText].length>500))
     return json(req,{ok:false,message:'Threads 1단과 2단은 각각 500자 이하로 작성해야 합니다.'},400);
    if(urls.some(v=>{try{const a=new URL(v);return typeof v!=='string'||a.protocol!=='https:'||v.length>1500||a.username||a.password}catch{return true}}))
     return json(req,{ok:false,message:'이미지는 공개 HTTPS 주소여야 합니다.'},400);
    if(j.platform==='instagram'&&urls.length<1)return json(req,{ok:false,message:'Instagram 게시에는 이미지가 최소 1장 필요합니다.'},400);
    const at=Date.parse(String(d.scheduledAt||''));
    if(!Number.isFinite(at)||at<now+lead||at>now+90*86400000)
     return json(req,{ok:false,message:'변경 예약 시각은 현재보다 2분 이후부터 90일 이내여야 합니다.'},400);
    const c=await validConnection(u,j.platform,await getConnection(u,j.platform));
    if(!c||c.expiresAt<at+300000)return json(req,{ok:false,message:'예약 시각까지 Meta 계정 연결이 유지되지 않습니다. Meta 계정을 다시 연결해 주세요.'},409);
    if(j.platform==='threads'&&replyText&&!replyReady(c))return json(req,{ok:false,message:'Threads 답글 권한이 확인되지 않았습니다. Threads 계정을 다시 연결해 주세요.'},409);
    const original=JSON.stringify(j),updated={...j,text,replyText,imageUrls:[...urls],
     scheduledAt:at,updatedAt:now,revision:(Number(j.revision)||0)+1};
    // Keep the original job ID and protect updates using the same lock as cron.
    await redis('ZADD',queue,at,j.id);
    try{await redis('SET',jobKey(j.id),JSON.stringify(updated))}
    catch(e){
     await redis('ZADD',queue,j.scheduledAt,j.id).catch(()=>{});
     await redis('SET',jobKey(j.id),original).catch(()=>{});
     throw e;
    }
    return json(req,{ok:true,id:j.id,status:'scheduled',scheduledAt:new Date(at).toISOString(),
     updatedAt:now,revision:updated.revision,imageCount:urls.length});
   }finally{await redis('DEL',lock)}
  }
  if(d.action==='cancel'||d.action==='delete'){
   if(!/^[0-9a-f-]{36}$/.test(d.id||''))return json(req,{ok:false,message:'예약 ID 오류'},400);
   // Share the existing publishing lock: never remove a job while the cron
   // worker is sending it to Meta, even after its scheduled timestamp.
   const lock='vp:social:v1:lock:'+d.id;
   if(await redis('SET',lock,'user-remove','NX','EX',30)!=='OK')
    return json(req,{ok:false,message:'게시 처리 또는 상태 확인 중입니다. 잠시 후 목록을 다시 확인해 주세요.'},409);
   try{
    const raw=await redis('GET',jobKey(d.id));const j=raw?JSON.parse(raw):null;
    if(!j||j.user!==u)return json(req,{ok:false,message:'예약을 찾지 못했습니다.'},404);
    if(j.status==='processing')
     return json(req,{ok:false,message:'Meta 게시 처리 중에는 삭제할 수 없습니다. 실제 게시 여부를 확인해 주세요.'},409);
    if(d.action==='cancel'){
     if(j.status!=='scheduled')return json(req,{ok:false,message:'예약 대기 상태인 건만 취소할 수 있습니다.'},409);
     j.status='cancelled';j.updatedAt=Date.now();
     await redis('SET',jobKey(j.id),JSON.stringify(j));
     await redis('ZREM',queue,j.id);
     return json(req,{ok:true,status:'cancelled'});
    }
    // Delete is scoped to the logged-in user's own queue and history.
    // It never calls a Meta endpoint or deletes an already-published post.
    if(j.status==='scheduled')await redis('ZREM',queue,j.id);
    await redis('ZREM',userJobs(u),j.id);
    await redis('DEL',jobKey(j.id));
    return json(req,{ok:true,deleted:true,wasScheduled:j.status==='scheduled',metaPostUnaffected:true});
   }finally{await redis('DEL',lock)}
  }
  if(d.action!=='schedule')return json(req,{ok:false,message:'지원하지 않는 요청'},400);
  if(!platforms.includes(d.platform))return json(req,{ok:false,message:'플랫폼을 선택하세요.'},400);
  if(!d.approved)return json(req,{ok:false,message:'게시 내용과 제휴 고지를 검수·승인해 주세요.'},400);
  const text=String(d.text||'').trim(),replyText=String(d.replyText||'').trim(),urls=Array.isArray(d.imageUrls)?d.imageUrls:[];
  if(!text||text.length>2200||replyText.length>500||urls.length>10)
   return json(req,{ok:false,message:'게시 본문·답글 길이 또는 이미지 장수를 확인해 주세요.'},400);
  if(d.platform==='threads'&&([...text].length>500||[...replyText].length>500))
   return json(req,{ok:false,message:'Threads 1단·2단 각각 500자를 초과했습니다. 두 문구를 줄인 뒤 예약해 주세요.'},400);
  if(urls.some(s=>{try{const u=new URL(s);return u.protocol!=='https:'||s.length>1500||u.username||u.password}catch{return true}}))return json(req,{ok:false,message:'이미지는 공개 HTTPS URL이어야 합니다.'},400);
  if(d.platform==='instagram'&&urls.length===0)return json(req,{ok:false,message:'Instagram 게시에는 공개 HTTPS 이미지가 최소 1장 필요합니다.'},400);
  const at=Date.parse(String(d.scheduledAt||''));if(!Number.isFinite(at)||at<Date.now()+60000||at>Date.now()+90*86400000)return json(req,{ok:false,message:'현재보다 최소 1분 후부터 90일 이내로 예약할 수 있습니다.'},400);
  if(!process.env.CRON_SECRET)return json(req,{ok:false,message:'자동 예약 실행 설정(CRON_SECRET)이 미완료입니다.'},503);
  const connection=await validConnection(u,d.platform,await getConnection(u,d.platform));
  if(!connection)return json(req,{ok:false,message:'해당 플랫폼 계정을 먼저 연결해 주세요.'},409);
  if(connection.expiresAt<at+300000)return json(req,{ok:false,message:'예약 시각까지 계정 인증이 유지되지 않습니다. Meta 계정을 다시 연결해 주세요.'},409);
  if(d.platform==='threads'&&replyText&&!replyReady(connection))return json(req,{ok:false,message:'Threads 답글 권한을 확인하지 못했습니다. 자동게시 관리에서 Threads 계정을 재연결하고 관리·읽기 권한을 허용해 주세요. 1단만 발행하지 않도록 예약을 중단했습니다.'},409);
  const active=await redis('ZCARD',userJobs(u));
  if(Number(active)>500)return json(req,{ok:false,message:'예약 내역이 너무 많습니다. 정리 후 다시 시도해 주세요.'},429);
  const id=cryptoRandomUUID();
  const j={id,user:u,platform:d.platform,text,replyText: d.platform==='threads'?replyText:'',imageUrls:urls,product:String(d.product||'').slice(0,160),scheduledAt:at,createdAt:Date.now(),updatedAt:Date.now(),status:'scheduled',postId:null,error:null};
  await redis('SET',jobKey(id),JSON.stringify(j));
  await redis('ZADD',userJobs(u),Date.now(),id);
  await redis('ZADD',queue,at,id);
  return json(req,{ok:true,id,status:'scheduled',scheduledAt:new Date(at).toISOString()});
 }catch(e){return json(req,{ok:false,message:msg(e)},503)}
}
function cryptoRandomUUID(){return [randomBytes(4).toString('hex'),randomBytes(2).toString('hex'),randomBytes(2).toString('hex'),randomBytes(2).toString('hex'),randomBytes(6).toString('hex')].join('-')}
async function published(p,c,j,stage=async()=>{}){
 const t=c.accessToken,me='/'+c.id;
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const waitMedia=async id=>waitForMetaMedia(p,id,containerId=>
  graph(p,'/'+containerId,t,{fields:{fields:p==='threads'?'status,error_message':'status_code'}})
 );
 if(p==='threads'){
  let container;
  let firstImageAt=0;
  if(j.imageUrls.length>1){
   await stage('이미지 컨테이너 생성 중',1);
   const children=[];
   for(const [i,image_url] of j.imageUrls.entries()){
    const item=await graph(p,me+'/threads',t,{method:'POST',fields:{media_type:'IMAGE',image_url,is_carousel_item:'true'}});
    if(!item.id)throw Error('Meta 이미지 '+(i+1)+'번 컨테이너 응답에 ID가 없습니다.');
    if(!firstImageAt)firstImageAt=Date.now();
    children.push(item.id);
   }
   // Threads' individual IMAGE carousel items are created, not published.
   // Do not probe child status endpoints: those GET requests can return Meta 100
   // even when image container creation succeeded. Wait before creating parent.
   await stage('이미지 '+children.length+'장 Meta 변환 대기 중 · 약 30초',2);
   await sleep(Math.max(0,30000-(Date.now()-firstImageAt)));
   await stage('Threads 이미지 캐러셀 결합 중',2);
   container=await graph(p,me+'/threads',t,{method:'POST',fields:{media_type:'CAROUSEL',children:children.join(','),text:j.text}});
  }else{
   await stage(j.imageUrls.length?'이미지 게시물 준비 중':'텍스트 게시물 준비 중',1);
   const fields={media_type:j.imageUrls.length?'IMAGE':'TEXT',text:j.text};
   if(j.imageUrls.length)fields.image_url=j.imageUrls[0];
   container=await graph(p,me+'/threads',t,{method:'POST',fields});
   if(j.imageUrls.length)firstImageAt=Date.now();
  }
  if(!container?.id)throw Error('Meta 게시 컨테이너를 생성하지 못했습니다.');
  if(j.imageUrls.length){
   await stage('Meta 게시 이미지 최종 준비 상태 확인 중',3);
   try{
    await waitMedia(container.id);
   }catch(e){
    if(e.httpStatus!==400||e.metaCode!==100)throw e;
    // Only fallback for an unsupported container status GET; never swallow a
    // CAROUSEL creation or threads_publish error. Do not claim success yet.
    await stage('Meta 상태 조회 제한(100) · 안전 대기 후 게시 요청',3);
    await sleep(Math.max(5000,30000-(Date.now()-firstImageAt)));
   }
  }
  await stage('Meta에 실제 게시 요청 중',4);
  const result=await graph(p,me+'/threads_publish',t,{method:'POST',fields:{creation_id:container.id}});
  if(!result.id)throw Error('Meta 발행 응답에 게시 ID가 없습니다.');
  let replyId=null,replyError=null;
  if(j.replyText){
   try{
    await stage('첫 게시물 발행 완료 · 2단 답글 발행 중',5);
    const replyContainer=await graph(p,me+'/threads',t,{method:'POST',fields:{media_type:'TEXT',text:j.replyText,reply_to_id:result.id}});
    if(!replyContainer.id)throw Error('Meta 답글 컨테이너 응답 오류');
    const reply=await graph(p,me+'/threads_publish',t,{method:'POST',fields:{creation_id:replyContainer.id}});
    replyId=reply.id;
   }catch(e){replyError=msg(e)}
  }
  return {id:result.id,replyId,replyError};
 }
 await stage('Instagram 이미지 컨테이너 생성 중',1);
 const children=[];
 if(j.imageUrls.length>1){
  for(const image_url of j.imageUrls){
   const res=await graph(p,me+'/media',t,{method:'POST',fields:{image_url,is_carousel_item:'true'}});
   if(!res.id)throw Error('Instagram 카드 생성 결과에 ID가 없습니다.');
   children.push(res.id);
  }
  await stage('Instagram 이미지 변환 완료 대기 중',2);
  await Promise.all(children.map(waitMedia));
 }
 const fields=children.length?{media_type:'CAROUSEL',children:children.join(','),caption:j.text}:{image_url:j.imageUrls[0],caption:j.text};
 const container=await graph(p,me+'/media',t,{method:'POST',fields});
 if(!container.id)throw Error('Instagram 게시물 컨테이너 생성 오류');
 await stage('Instagram 게시 이미지 최종 처리 대기 중',3);
 await waitMedia(container.id);
 await stage('Instagram에 실제 게시 요청 중',4);
 const result=await graph(p,me+'/media_publish',t,{method:'POST',fields:{creation_id:container.id}});
 if(!result.id)throw Error('Instagram 발행 응답에 게시 ID가 없습니다.');
 return {id:result.id};
}
export async function runQueue(req){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!=='Bearer '+secret)return json(req,{ok:false,message:'작업 실행 권한 없음'},401);
 const ids=await redis('ZRANGEBYSCORE',queue,'-inf',Date.now(),'LIMIT',0,1)||[];
 let done=0,failed=0;
 for(const id of ids){
  const lock=await redis('SET','vp:social:v1:lock:'+id,'1','NX','EX',180);
  if(lock!=='OK')continue;
  try{
   const raw=await redis('GET',jobKey(id));const j=raw?JSON.parse(raw):null;
   if(!j||j.status!=='scheduled'){
    if(j&&j.status==='processing'){j.status='needs_review';j.error='이전 게시 작업이 중단됐을 수 있습니다. Meta에서 중복 발행 여부를 확인해 주세요.';await redis('SET',jobKey(id),JSON.stringify(j));}
    await redis('ZREM',queue,id);continue;
   }
   j.status='processing';j.mediaStage='Meta 게시 준비 중';j.mediaPhase=0;j.updatedAt=Date.now();await redis('SET',jobKey(id),JSON.stringify(j));
   try{
    const c=await validConnection(j.user,j.platform,await getConnection(j.user,j.platform));
    if(!c||c.expiresAt<Date.now())throw Error('계정 인증 만료 또는 연결 해제');
    if(j.platform==='threads'&&j.replyText&&!replyReady(c))throw Error('Threads 답글 권한이 없어 1단 발행을 중단했습니다. Threads 계정을 재연결하고 답글 관리·읽기 권한을 허용해 주세요.');
    const created=await published(j.platform,c,j,async(label,phase)=>{
     j.mediaStage=label;j.mediaPhase=phase;j.updatedAt=Date.now();
     await redis('SET',jobKey(id),JSON.stringify(j));
    });
    j.postId=created.id;j.replyId=created.replyId||null;j.mediaStage='Meta 게시 완료';j.mediaPhase=6;
    j.status=created.replyError?'published_reply_failed':'published';
    if(created.replyError)j.error='첫 게시글은 발행됐지만 2단 답글을 발행하지 못했습니다: '+created.replyError;
    done++;
   }catch(e){j.status='needs_review';j.error='['+(j.mediaStage||'게시 실행')+'] '+msg(e);failed++}
   j.updatedAt=Date.now();await redis('SET',jobKey(id),JSON.stringify(j));await redis('ZREM',queue,id);
  }finally{await redis('DEL','vp:social:v1:lock:'+id)}
 }
 return json(req,{ok:true,published:done,needsReview:failed});
}
const metricsThreads=['views','likes','replies','reposts','quotes','shares'];
async function socialInsights(u){
 const out={};
 for(const p of platforms){
  const c=await validConnection(u,p,await getConnection(u,p));
  if(!c){out[p]={connected:false,posts:[]};continue}
  const cacheKey='vp:social:v1:insights:'+u+':'+p;
  const cached=await redis('GET',cacheKey);
  if(cached){out[p]=JSON.parse(cached);continue}
  try{
   const fields=p==='threads'?'id,text,timestamp,permalink':'id,caption,timestamp,permalink,like_count,comments_count,media_type';
   const endpoint=p==='threads'?'/'+c.id+'/threads':'/'+c.id+'/media';
   const data=await graph(p,endpoint,c.accessToken,{fields:{fields,limit:12}});
   const posts=[];
   for(const x of (data.data||[]).slice(0,12)){
    const post={id:x.id,text:(x.text||x.caption||'').slice(0,120),timestamp:x.timestamp||'',permalink:x.permalink||'',likes:x.like_count??null,replies:x.comments_count??null,views:null,reach:null,saved:null,shares:null,reposts:null};
    try{
     const m=p==='threads'?metricsThreads.join(','):'reach,views,saved,shares';
     const update=result=>{for(const v of result.data||[]){const raw=v.values?.[0]?.value??v.total_value?.value??v.value;const val=Number(raw);if(raw!==undefined&&raw!==null&&Number.isFinite(val)){if(v.name==='comments')post.replies=val;else if(v.name in post)post[v.name]=val}}};
     try{update(await graph(p,'/'+x.id+'/insights',c.accessToken,{fields:{metric:m}}))}
     catch{
      const alternatives=p==='threads'?['views,likes,replies,reposts','views']:['reach','views','saved','shares'];
      let found=false;
      for(const metric of alternatives){try{update(await graph(p,'/'+x.id+'/insights',c.accessToken,{fields:{metric}}));found=true}catch{}}
      if(!found)post.insightsError='이 게시물의 인사이트 조회 권한 또는 지표 미지원';
     }
    }catch(e){post.insightsError='일부 지표 권한 또는 유형 미지원'}
    posts.push(post);
   }
   out[p]={connected:true,username:c.username,posts};
   await redis('SET',cacheKey,JSON.stringify(out[p]),'EX',900);
  }catch(e){out[p]={connected:true,username:c.username,posts:[],error:msg(e)}}
 }
 return out;
}
export {preflight};

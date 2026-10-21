import {randomBytes} from 'node:crypto';
import {session,redis,encrypt,decrypt} from './account-store.js';
import {json,responseHeaders,safePayload,preflight} from './api-guard.js';

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
const redact=c=>c?{connected:true,username:c.username||'',id:c.id,expiresAt:c.expiresAt||null}:{connected:false};
const msg=e=>String(e?.message||e||'요청 실패').slice(0,180);
function getParam(req,name){return new URL(req.url).searchParams.get(name)||''}
async function graph(p,path,token,{method='GET',fields={}}={}){
 const qs=new URLSearchParams(fields);
 if(token)qs.set('access_token',token);
 const url=BASE[p]+path+(qs.size?'?'+qs:'');
 const res=await fetch(url,{method,cache:'no-store',signal:AbortSignal.timeout(15000)});
 let data={};try{data=await res.json()}catch{}
 if(!res.ok||data.error)throw Error(data.error?.message||'Meta API 오류 ('+res.status+')');
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
 return {accessToken:token,expiresAt:Date.now()+Number(seconds)*1000,id:String(profile.id),username:String(profile.username||''),connectedAt:Date.now()};
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
   const result={};for(const platform of platforms)result[platform]=redact(await getConnection(u,platform));
   return json(req,{ok:true,platforms:result,configured:Object.fromEntries(platforms.map(p=>[p,!!(app(p).id&&app(p).secret)])),blobConfigured:Boolean(process.env.BLOB_READ_WRITE_TOKEN),schedulerConfigured:Boolean(process.env.CRON_SECRET)});
  }
  if(op==='connect'){
   if(!platforms.includes(p))return json(req,{ok:false,message:'플랫폼 선택 오류'},400);
   const a=app(p);if(!a.id||!a.secret)return json(req,{ok:false,message:'Meta 개발자 앱 ID/Secret 서버 설정이 필요합니다.'},503);
   const nonce=randomBytes(24).toString('hex');
   const record={user:u,platform:p,expires:Date.now()+600000};
   const ok=await redis('SET','vp:social:v1:oauth:'+nonce,JSON.stringify(record),'EX',600,'NX');
   if(ok!=='OK')throw Error('인증 요청을 생성하지 못했습니다.');
   const scope=p==='threads'?'threads_basic,threads_content_publish,threads_manage_insights':'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights';
   const host=p==='threads'?'https://threads.net/oauth/authorize':'https://www.instagram.com/oauth/authorize';
   const url=host+'?'+new URLSearchParams({client_id:a.id,redirect_uri:cb(req,p),scope,response_type:'code',state:nonce});
   return json(req,{ok:true,url});
  }
  if(op==='jobs'){
   const ids=await redis('ZREVRANGE',userJobs(u),0,79)||[];
   const posts=await Promise.all(ids.map(async id=>{const s=await redis('GET',jobKey(id));return s?JSON.parse(s):null}));
   return json(req,{ok:true,posts:posts.filter(Boolean).map(j=>({...j,text:j.text.slice(0,200)}))});
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
  if(d.action==='cancel'){
   if(!/^[0-9a-f-]{36}$/.test(d.id||''))return json(req,{ok:false,message:'예약 ID 오류'},400);
   const raw=await redis('GET',jobKey(d.id));const j=raw?JSON.parse(raw):null;
   if(!j||j.user!==u)return json(req,{ok:false,message:'예약을 찾지 못했습니다.'},404);
   if(j.status!=='scheduled')return json(req,{ok:false,message:'대기 상태인 예약만 취소할 수 있습니다.'},409);
   j.status='cancelled';j.updatedAt=Date.now();
   await redis('SET',jobKey(j.id),JSON.stringify(j));await redis('ZREM',queue,j.id);
   return json(req,{ok:true});
  }
  if(d.action!=='schedule')return json(req,{ok:false,message:'지원하지 않는 요청'},400);
  if(!platforms.includes(d.platform))return json(req,{ok:false,message:'플랫폼을 선택하세요.'},400);
  if(!d.approved)return json(req,{ok:false,message:'게시 내용과 제휴 고지를 검수·승인해 주세요.'},400);
  const text=String(d.text||'').trim(),replyText=String(d.replyText||'').trim(),urls=Array.isArray(d.imageUrls)?d.imageUrls:[];
  if(!text||text.length>2000||replyText.length>500||urls.length>10)return json(req,{ok:false,message:'본문은 1~2000자, 이미지는 최대 10장입니다.'},400);
  if(urls.some(s=>{try{const u=new URL(s);return u.protocol!=='https:'||s.length>1500||u.username||u.password}catch{return true}}))return json(req,{ok:false,message:'이미지는 공개 HTTPS URL이어야 합니다.'},400);
  if(d.platform==='instagram'&&urls.length===0)return json(req,{ok:false,message:'Instagram 게시에는 공개 HTTPS 이미지가 최소 1장 필요합니다.'},400);
  if(d.platform==='instagram'&&urls.length>1&&urls.length<2)return json(req,{ok:false,message:'캐러셀은 2장 이상이어야 합니다.'},400);
  const at=Date.parse(String(d.scheduledAt||''));if(!Number.isFinite(at)||at<Date.now()+60000||at>Date.now()+90*86400000)return json(req,{ok:false,message:'현재보다 최소 1분 후부터 90일 이내로 예약할 수 있습니다.'},400);
  if(!process.env.CRON_SECRET)return json(req,{ok:false,message:'자동 예약 실행 설정(CRON_SECRET)이 미완료입니다.'},503);
  const connection=await validConnection(u,d.platform,await getConnection(u,d.platform));
  if(!connection)return json(req,{ok:false,message:'해당 플랫폼 계정을 먼저 연결해 주세요.'},409);
  if(connection.expiresAt<at+300000)return json(req,{ok:false,message:'예약 시각까지 계정 인증이 유지되지 않습니다. Meta 계정을 다시 연결해 주세요.'},409);
  const id=cryptoRandomUUID();
  const j={id,user:u,platform:d.platform,text,replyText: d.platform==='threads'?replyText:'',imageUrls:urls,product:String(d.product||'').slice(0,160),scheduledAt:at,createdAt:Date.now(),updatedAt:Date.now(),status:'scheduled',postId:null,error:null};
  await redis('SET',jobKey(id),JSON.stringify(j));
  await redis('ZADD',userJobs(u),Date.now(),id);
  await redis('ZADD',queue,at,id);
  return json(req,{ok:true,id,status:'scheduled',scheduledAt:new Date(at).toISOString()});
 }catch(e){return json(req,{ok:false,message:msg(e)},503)}
}
function cryptoRandomUUID(){return [randomBytes(4).toString('hex'),randomBytes(2).toString('hex'),randomBytes(2).toString('hex'),randomBytes(2).toString('hex'),randomBytes(6).toString('hex')].join('-')}
async function published(p,c,j){
 const t=c.accessToken,me='/'+c.id;
 if(p==='threads'){
  let container;
  if(j.imageUrls.length>1){
   const children=[];
   for(const image_url of j.imageUrls){const a=await graph(p,me+'/threads',t,{method:'POST',fields:{media_type:'IMAGE',image_url,is_carousel_item:'true'}});children.push(a.id)}
   container=await graph(p,me+'/threads',t,{method:'POST',fields:{media_type:'CAROUSEL',children:children.join(','),text:j.text}});
  }else{
   const fields={media_type:j.imageUrls.length?'IMAGE':'TEXT',text:j.text};
   if(j.imageUrls.length)fields.image_url=j.imageUrls[0];
   container=await graph(p,me+'/threads',t,{method:'POST',fields});
  }
  const result=await graph(p,me+'/threads_publish',t,{method:'POST',fields:{creation_id:container.id}});
  let replyId=null,replyError=null;
  if(j.replyText){
   try{
    const replyContainer=await graph(p,me+'/threads',t,{method:'POST',fields:{media_type:'TEXT',text:j.replyText,reply_to_id:result.id}});
    const reply=await graph(p,me+'/threads_publish',t,{method:'POST',fields:{creation_id:replyContainer.id}});
    replyId=reply.id;
   }catch(e){replyError=msg(e)}
  }
  return {id:result.id,replyId,replyError};
 }
 const children=[];
 if(j.imageUrls.length>1){
  for(const image_url of j.imageUrls){const res=await graph(p,me+'/media',t,{method:'POST',fields:{image_url,is_carousel_item:'true'}});children.push(res.id)}
 }
 const fields=children.length?{media_type:'CAROUSEL',children:children.join(','),caption:j.text}:{image_url:j.imageUrls[0],caption:j.text};
 const container=await graph(p,me+'/media',t,{method:'POST',fields});
 // Graph may need time to process hosted images.
 for(let i=0;i<6;i++){
  const status=await graph(p,'/'+container.id,t,{fields:{fields:'status_code'}});
  if(status.status_code==='FINISHED')break;
  if(status.status_code==='ERROR'||status.status_code==='EXPIRED')throw Error('Meta에서 이미지 처리가 실패했습니다.');
  await new Promise(resolve=>setTimeout(resolve,1800));
  if(i===5)throw Error('이미지 처리 지연으로 보류되었습니다. 게시 여부를 확인 후 재예약하세요.');
 }
 const result=await graph(p,me+'/media_publish',t,{method:'POST',fields:{creation_id:container.id}});
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
    if(j&&j.status==='processing'&&Date.now()-j.updatedAt>300000){j.status='needs_review';j.error='이전 게시 작업이 중단됐을 수 있습니다. Meta에서 중복 발행 여부를 확인해 주세요.';await redis('SET',jobKey(id),JSON.stringify(j));}
    await redis('ZREM',queue,id);continue;
   }
   j.status='processing';j.updatedAt=Date.now();await redis('SET',jobKey(id),JSON.stringify(j));
   try{
    const c=await validConnection(j.user,j.platform,await getConnection(j.user,j.platform));
    if(!c||c.expiresAt<Date.now())throw Error('계정 인증 만료 또는 연결 해제');
    const created=await published(j.platform,c,j);
    j.postId=created.id;j.replyId=created.replyId||null;
    j.status=created.replyError?'published_reply_failed':'published';
    if(created.replyError)j.error='첫 게시글은 발행됐지만 2단 답글을 발행하지 못했습니다: '+created.replyError;
    done++;
   }catch(e){j.status='needs_review';j.error=msg(e);failed++}
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

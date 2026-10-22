import test from 'node:test';
import assert from 'node:assert/strict';
import {makeToken,encrypt} from '../lib/account-store.js';
import {GET,POST} from '../api/social.js';

test('Threads permissions and reply-only recovery avoid republishing first post',async()=>{
 const oldFetch=globalThis.fetch,backup={};
 for(const name of ['VIRALPICK_APP_SECRET','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','META_THREADS_APP_ID','META_THREADS_APP_SECRET']){
  backup[name]=process.env[name];
 }
 process.env.VIRALPICK_APP_SECRET='unit-test-only-secret-with-at-least-32-characters';
 process.env.UPSTASH_REDIS_REST_URL='https://redis.test';
 process.env.UPSTASH_REDIS_REST_TOKEN='mock';
 process.env.META_THREADS_APP_ID='test-client';
 process.env.META_THREADS_APP_SECRET='test-secret';
 const kv=new Map(),user='tester',id='12345678-1234-1234-1234-123456789abc',parent='1234567890';
 const now=Date.now();
 const job={id,user,platform:'threads',status:'published_reply_failed',postId:parent,replyId:null,
  text:'이미지가 포함된 1단 원문',replyText:'2단의 실제 답글 내용',
  imageUrls:['https://images.test/a.jpg'],scheduledAt:now-60000,updatedAt:now-60000,error:'Meta 403'};
 const store='vp:social:v1:job:'+id,conn='vp:social:v1:connection:'+user+':threads';
 kv.set(store,JSON.stringify(job));
 const connection={accessToken:'test-user-token',id:'123',username:'test_profile',
  connectedAt:now,expiresAt:now+40*86400000,
  scopes:['threads_basic','threads_content_publish','threads_manage_replies','threads_read_replies']};
 kv.set(conn,encrypt(connection));
 let createCalls=0,replyPublishes=0,replies=[];
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 globalThis.fetch=async(url,options={})=>{
  if(String(url)==='https://redis.test'){
   const [command,key,a,b]=JSON.parse(options.body);
   if(command==='GET')return json({result:kv.get(key)??null});
   if(command==='SET'){
    if(b==='NX'&&kv.has(key))return json({result:null});
    kv.set(key,a);return json({result:'OK'});
   }
   if(command==='DEL')return json({result:kv.delete(key)?1:0});
   throw Error('Unexpected redis: '+command);
  }
  const parsed=new URL(String(url));
  if(parsed.hostname!=='graph.threads.net')throw Error('Unexpected external call: '+parsed.origin);
  if(parsed.pathname.endsWith('/'+parent+'/replies'))
   return json({data:replies,paging:{}});
  if(parsed.pathname.endsWith('/123/threads')&&options.method==='POST'){
   assert.equal(parsed.searchParams.get('reply_to_id'),parent);
   assert.equal(parsed.searchParams.get('text'),job.replyText);
   createCalls++;return json({id:'container2'});
  }
  if(parsed.pathname.endsWith('/123/threads_publish')&&options.method==='POST'){
   assert.equal(parsed.searchParams.get('creation_id'),'container2');
   replyPublishes++;return json({id:'reply333'});
  }
  throw Error('Unexpected Graph endpoint: '+parsed.pathname);
 };
 const authed=()=>({Authorization:'Bearer '+makeToken(user)});
 const post=async(payload,username=user)=>{
  const response=await POST(new Request('https://viralpick-review.vercel.app/api/social',{method:'POST',
   headers:{Authorization:'Bearer '+makeToken(username),'Content-Type':'application/json'},
   body:JSON.stringify(payload)}));
  return {status:response.status,body:await response.json()};
 };
 try{
  let response=await GET(new Request('https://viralpick-review.vercel.app/api/social?op=status',{headers:authed()}));
  let status=await response.json();
  assert.equal(status.platforms.threads.replyReady,true);
  // Reconnect link must request both permissions.
  response=await GET(new Request('https://viralpick-review.vercel.app/api/social?op=connect&platform=threads',{headers:authed()}));
  const connect=await response.json();
  assert.match(connect.url,/threads_manage_replies/);
  assert.match(connect.url,/threads_read_replies/);
  // Fail closed without token scope, with no external Graph publishing calls.
  const missing={...connection,scopes:['threads_basic','threads_content_publish']};
  kv.set(conn,encrypt(missing));
  let r=await post({action:'retry_reply',id});
  assert.equal(r.status,409);
  assert.equal(createCalls,0);
  kv.set(conn,encrypt(connection));
  // Cannot retry another user's post.
  r=await post({action:'retry_reply',id},'intruder');
  assert.equal(r.status,404);
  // Existing matching reply must be recognized; never create duplicate.
  replies=[{id:'existing222',text:job.replyText,is_reply_owned_by_me:true,username:'test_profile'}];
  r=await post({action:'retry_reply',id});
  assert.equal(r.status,200,JSON.stringify(r.body));
  assert.equal(r.body.alreadyPublished,true);
  assert.equal(createCalls,0);
  assert.equal(JSON.parse(kv.get(store)).status,'published');
  // Reset to previously failed record for genuine reply-only recovery.
  kv.set(store,JSON.stringify(job));replies=[];
  r=await post({action:'retry_reply',id});
  assert.equal(r.status,200,JSON.stringify(r.body));
  assert.equal(r.body.alreadyPublished,false);
  assert.equal(createCalls,1);
  assert.equal(replyPublishes,1);
  const saved=JSON.parse(kv.get(store));
  assert.equal(saved.postId,parent,'original parent post must not change');
  assert.equal(saved.replyId,'reply333');
  assert.equal(saved.status,'published');
  r=await post({action:'retry_reply',id});
  assert.equal(r.status,409,'already restored reply must not be published again');
  assert.equal(createCalls,1);
 }finally{
  globalThis.fetch=oldFetch;
  for(const [k,v] of Object.entries(backup)){if(v===undefined)delete process.env[k];else process.env[k]=v}
 }
});

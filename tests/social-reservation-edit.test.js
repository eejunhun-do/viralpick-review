import test from 'node:test';
import assert from 'node:assert/strict';
import {makeToken,encrypt} from '../lib/account-store.js';
import {POST} from '../api/social.js';

test('Editing Meta reservation updates same ID safely and blocks stale, unauthorized and processing changes',async()=>{
 const originalFetch=globalThis.fetch,env={};
 for(const k of ['VIRALPICK_APP_SECRET','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN']){
  env[k]=process.env[k];
 }
 process.env.VIRALPICK_APP_SECRET='development-test-key-keep-private-123456';
 process.env.UPSTASH_REDIS_REST_URL='https://fake-redis.testing';
 process.env.UPSTASH_REDIS_REST_TOKEN='test-token';
 const kv=new Map(),sorted=new Map(),user='editor',id='12345678-1234-1234-1234-123456789abc';
 const now=Date.now(),base=now+3600000,updated=now-10000;
 const job={id,user,platform:'threads',status:'scheduled',scheduledAt:base,updatedAt:updated,
  text:'게시 전 원본',replyText:'1단 답글',imageUrls:['https://cdn.test/original.jpg'],
  product:'생활용품',createdAt:now-300000,postId:null,error:null};
 const q='vp:social:v1:queue',record='vp:social:v1:job:'+id;
 kv.set(record,JSON.stringify(job));
 kv.set('vp:social:v1:connection:'+user+':threads',encrypt({
  accessToken:'example-test-token',id:'123',username:'example',expiresAt:now+60*86400000,connectedAt:now,scopes:['threads_basic','threads_content_publish','threads_manage_replies','threads_read_replies']
 }));
 sorted.set(q,new Map([[id,base]]));
 globalThis.fetch=async(url,options)=>{
  if(url!=='https://fake-redis.testing')throw Error('Unexpected external fetch: '+url);
  const [command,key,a,b,c]=JSON.parse(options.body),z=sorted.get(key)||new Map();
  let result=null;
  switch(command){
   case 'GET':result=kv.get(key)??null;break;
   case 'SET':
    if(b==='NX'&&kv.has(key))result=null;
    else {kv.set(key,a);result='OK'}break;
   case 'DEL':result=kv.delete(key)?1:0;break;
   case 'ZADD':z.set(b,Number(a));sorted.set(key,z);result=1;break;
   case 'ZREM':result=z.delete(a)?1:0;sorted.set(key,z);break;
   default:throw Error('Unexpected Redis command '+command);
  }
  return new Response(JSON.stringify({result}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const request=async(changes,actor=user)=>{
  const token=makeToken(actor);
  const response=await POST(new Request('https://viralpick-review.vercel.app/api/social',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify(changes)
  }));
  return {status:response.status,data:await response.json()};
 };
 const edit={
  action:'update',id,expectedUpdatedAt:updated,approved:true,
  text:'후킹\n불편한 상황\n상황을 바꾸는 방법',replyText:'수정된 답글',
  imageUrls:['https://cdn.test/original.jpg','https://cdn.test/second.jpg'],
  scheduledAt:new Date(base+600000).toISOString()
 };
 try{
  let result=await request(edit,'intruder');
  assert.equal(result.status,404);
  assert.equal(JSON.parse(kv.get(record)).text,'게시 전 원본');
  result=await request({...edit,expectedUpdatedAt:updated-1});
  assert.equal(result.status,409);
  result=await request({...edit,approved:false});
  assert.equal(result.status,400);
  result=await request(edit);
  assert.equal(result.status,200,JSON.stringify(result.data));
  assert.equal(result.data.id,id);
  assert.equal(result.data.imageCount,2);
  assert.equal(sorted.get(q).size,1,'same ID is rescheduled, not duplicated');
  assert.equal(sorted.get(q).get(id),base+600000);
  assert.equal(JSON.parse(kv.get(record)).text,edit.text);
  assert.equal(JSON.parse(kv.get(record)).imageUrls.length,2);
  result=await request(edit);
  assert.equal(result.status,409,'stale revision must not overwrite a saved edit');
  const published=JSON.parse(kv.get(record));
  published.status='processing';kv.set(record,JSON.stringify(published));
  result=await request({...edit,expectedUpdatedAt:published.updatedAt});
  assert.equal(result.status,409,'job already processing must not be edited');
  assert.equal(JSON.parse(kv.get(record)).status,'processing');
 }finally{
  globalThis.fetch=originalFetch;
  for(const [k,v] of Object.entries(env)){if(v===undefined)delete process.env[k];else process.env[k]=v}
 }
});

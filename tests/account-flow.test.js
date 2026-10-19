import test from 'node:test';
import assert from 'node:assert/strict';
process.env.VIRALPICK_ACCESS_KEY='bootstrap-secret-for-tests-only';
process.env.VIRALPICK_APP_SECRET='test-secret-long-and-private-1234567890-abcdef';
process.env.UPSTASH_REDIS_REST_URL='https://redis.test.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN='test-token';
const store=new Map();
globalThis.fetch=async (_url,options)=>{
 const [command,key,...args]=JSON.parse(options.body);
 let result=null;
 if(command==='GET')result=store.get(key)??null;
 else if(command==='SET'){const [value,mode]=args;if(mode==='NX'&&store.has(key))result=null;else{store.set(key,value);result='OK'}}
 else if(command==='INCR'){result=Number(store.get(key)||0)+1;store.set(key,String(result))}
 else if(command==='EXPIRE')result=1;
 else if(command==='DEL'){result=store.delete(key)?1:0}
 else throw Error('Unsupported mock command: '+command);
 return new Response(JSON.stringify({result}),{status:200,headers:{'content-type':'application/json'}});
};
const account=await import('../api/account.js');
const credentials=await import('../api/credentials.js');
const req=(path,body,token)=>new Request('https://viralpick-review.vercel.app'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
const getReq=(path,token)=>new Request('https://viralpick-review.vercel.app'+path,{headers:token?{Authorization:'Bearer '+token}:{}});
test('admin setup, user isolation and credential masking',async()=>{
 const initial=await (await account.GET(getReq('/api/account'))).json();
 assert.equal(initial.initialized,false);
 const setup=await (await account.POST(req('/api/account',{action:'setup',user:'admin',password:'strong-password-for-admin',bootstrap:process.env.VIRALPICK_ACCESS_KEY}))).json();
 assert.equal(setup.ok,true);
 const second=await account.POST(req('/api/account',{action:'setup',user:'another',password:'another-secret-long',bootstrap:process.env.VIRALPICK_ACCESS_KEY}));
 assert.equal(second.status,409);
 const login=await (await account.POST(req('/api/account',{action:'login',user:'admin',password:'strong-password-for-admin'}))).json();
 assert.equal(login.role,'admin');
 const created=await (await account.POST(req('/api/account',{action:'create_user',user:'creator01',password:'unique-strong-pass-123'},login.token))).json();
 assert.equal(created.ok,true);
 const userLogin=await (await account.POST(req('/api/account',{action:'login',user:'creator01',password:'unique-strong-pass-123'}))).json();
 assert.equal(userLogin.role,'user');
 const denied=await account.POST(req('/api/account',{action:'create_user',user:'creator02',password:'another-strong-password'},userLogin.token));
 assert.equal(denied.status,403);
 const a=await (await credentials.POST(req('/api/credentials',{coupangAccessKey:'admin-private-key'},login.token))).json();
 const b=await (await credentials.POST(req('/api/credentials',{coupangAccessKey:'user-private-key'},userLogin.token))).json();
 assert.equal(a.ok,true);assert.equal(b.ok,true);
 const adminKeys=await (await credentials.GET(getReq('/api/credentials',login.token))).json();
 const userKeys=await (await credentials.GET(getReq('/api/credentials',userLogin.token))).json();
 assert.equal(adminKeys.configured.coupangAccessKey,true);
 assert.equal(userKeys.configured.coupangAccessKey,true);
 assert.ok(!JSON.stringify(userKeys).includes('admin-private-key'));
 assert.ok(!JSON.stringify(adminKeys).includes('user-private-key'));
 assert.ok(![...store.values()].some(x=>typeof x==='string'&&x.includes('user-private-key')));
 const removed=await (await credentials.POST(req('/api/credentials',{coupangAccessKey:null},userLogin.token))).json();
 assert.equal(removed.configured.coupangAccessKey,false);
 assert.equal((await (await credentials.GET(getReq('/api/credentials',login.token))).json()).configured.coupangAccessKey,true);
});

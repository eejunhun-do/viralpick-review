import {createHash} from 'node:crypto';
import {json,preflight,safePayload,responseHeaders} from '../lib/api-guard.js';
import {accountReady,session,getAdmin,createAdmin,getAccount,hashPassword,makeToken,redis,newSalt,isName} from '../lib/account-store.js';
export function OPTIONS(req){return preflight(req)}
export async function GET(req){
 if(!responseHeaders(req).originAllowed)return json(req,{ok:false,message:'출처 제한'},403);
 if(!accountReady())return json(req,{ok:false,ready:false,message:'계정 저장소 서버 설정이 필요합니다.',diagnostics:{appSecretPresent:Boolean(process.env.VIRALPICK_APP_SECRET),appSecretLengthValid:Boolean((process.env.VIRALPICK_APP_SECRET||'').length>=32),redisUrlPresent:Boolean(process.env.UPSTASH_REDIS_REST_URL||process.env.UPSTASH_KV_REST_API_URL),redisTokenPresent:Boolean(process.env.UPSTASH_REDIS_REST_TOKEN||process.env.UPSTASH_KV_REST_API_TOKEN)}},503);
 try{
 const admin=await getAdmin(),user=session(req);
 const record=user?await getAccount(user):null;
 return json(req,{ok:true,initialized:!!admin,loggedIn:!!record,user:record?.user||null,role:record?.role||null});
 }catch{return json(req,{ok:false,message:'계정 저장소에 연결할 수 없습니다.'},503)}
}
export async function POST(req){
 if(!responseHeaders(req).originAllowed)return json(req,{ok:false,message:'출처 제한'},403);
 if(!accountReady())return json(req,{ok:false,message:'계정 저장소 서버 설정이 필요합니다.'},503);
 let d;try{d=await safePayload(req,3000)}catch{return json(req,{ok:false,message:'잘못된 요청'},400)}
 const user=String(d.user||'').trim(),password=String(d.password||'');
 try{
 if(d.action==='setup'){
 const account=await createAdmin(user,password,String(d.bootstrap||''));
 return json(req,{ok:true,user:account.user,token:makeToken(account.user)});
 }
 if(d.action==='create_user'){
 const actor=session(req),admin=actor?await getAccount(actor):null;
 if(admin?.role!=='admin')return json(req,{ok:false,message:'관리자 전용 기능입니다.'},403);
 if(!isName(user)||password.length<12||password.length>128)return json(req,{ok:false,message:'아이디 또는 비밀번호 형식이 올바르지 않습니다.'},400);
 const salt=newSalt(),account={user,salt,hash:hashPassword(password,salt),role:'user'};
 const created=await redis('SET','viralpick:accounts:v1:user:'+user,JSON.stringify(account),'NX');
 if(created!=='OK')return json(req,{ok:false,message:'이미 사용 중인 아이디입니다.'},409);
 return json(req,{ok:true,user,role:'user'});
 }
 if(d.action==='login'){
 const identity=createHash('sha256').update(user).digest('hex');
 const key='viralpick:auth:attempt:'+identity;
 const attempts=Number(await redis('INCR',key));
 if(attempts===1)await redis('EXPIRE',key,900);
 if(attempts>10)return json(req,{ok:false,message:'로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.'},429);
 const record=await getAccount(user);
 const a=record?.hash||'0'.repeat(128),salt=record?.salt||'0'.repeat(32);
 const expected=hashPassword(password.slice(0,128),salt);
 const {timingSafeEqual}=await import('node:crypto');
 const valid=timingSafeEqual(Buffer.from(a),Buffer.from(expected));
 if(!valid||!record||password.length>128)return json(req,{ok:false,message:'아이디 또는 비밀번호가 일치하지 않습니다.'},401);
 await redis('DEL',key);
 return json(req,{ok:true,user,role:record.role,token:makeToken(user)});
 }
 return json(req,{ok:false,message:'지원되지 않는 동작'},400);
 }catch(e){return json(req,{ok:false,message:e.message},d.action==='setup'?409:503)}
}

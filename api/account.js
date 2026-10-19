import {json,preflight,safePayload,responseHeaders} from '../lib/api-guard.js';
import {accountReady,session,getAdmin,createAdmin,getAccount,hashPassword,makeToken,redis} from '../lib/account-store.js';
export function OPTIONS(req){return preflight(req)}
export async function GET(req){
 if(!responseHeaders(req).originAllowed)return json(req,{ok:false,message:'출처 제한'},403);
 if(!accountReady())return json(req,{ok:false,ready:false,message:'계정 저장소 서버 설정이 필요합니다.'},503);
 try{
 const admin=await getAdmin(),user=session(req);
 return json(req,{ok:true,initialized:!!admin,loggedIn:!!user,user:user||null,role:user?'admin':null});
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
 if(d.action==='login'){
 const record=await getAccount(user);
 const a=record?.hash||'0'.repeat(128),salt=record?.salt||'0'.repeat(32);
 const expected=hashPassword(password.slice(0,128),salt);
 const {timingSafeEqual}=await import('node:crypto');
 const valid=timingSafeEqual(Buffer.from(a),Buffer.from(expected));
 if(!valid||!record||password.length>128)return json(req,{ok:false,message:'아이디 또는 비밀번호가 일치하지 않습니다.'},401);
 return json(req,{ok:true,user,token:makeToken(user)});
 }
 return json(req,{ok:false,message:'지원되지 않는 동작'},400);
 }catch(e){return json(req,{ok:false,message:e.message},d.action==='setup'?409:503)}
}

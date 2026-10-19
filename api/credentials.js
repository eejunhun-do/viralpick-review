import {json,preflight,safePayload,responseHeaders} from '../lib/api-guard.js';
import {session,getKeys,setKeys,accountReady} from '../lib/account-store.js';
const ALLOWED=['coupangAccessKey','coupangSecretKey','tossApiKey','openaiApiKey'];
export function OPTIONS(req){return preflight(req)}
function authorize(req){return responseHeaders(req).originAllowed&&session(req)}
export async function GET(req){
 const user=authorize(req);if(!user)return json(req,{ok:false,message:'로그인이 필요합니다.'},401);
 try{const keys=await getKeys(user);return json(req,{ok:true,user,configured:Object.fromEntries(ALLOWED.map(k=>[k,Boolean(keys[k])]))})}
 catch{return json(req,{ok:false,message:'암호화 저장소 접속 실패'},503)}
}
export async function POST(req){
 const user=authorize(req);if(!user)return json(req,{ok:false,message:'로그인이 필요합니다.'},401);
 let d;try{d=await safePayload(req,12000)}catch{return json(req,{ok:false,message:'요청 형식 오류'},400)}
 const updates={};for(const [k,v] of Object.entries(d||{})){
 if(!ALLOWED.includes(k)||!(v===null||(typeof v==='string'&&v.length>=4&&v.length<=500)))return json(req,{ok:false,message:'입력 필드/값을 확인하세요.'},400);
 updates[k]=typeof v==='string'?v.trim():null;
 }
 if(!Object.keys(updates).length)return json(req,{ok:false,message:'저장할 값이 없습니다.'},400);
 try{const keys=await setKeys(user,updates);return json(req,{ok:true,configured:Object.fromEntries(ALLOWED.map(k=>[k,Boolean(keys[k])]))})}
 catch{return json(req,{ok:false,message:'API 키 저장 실패'},503)}
}

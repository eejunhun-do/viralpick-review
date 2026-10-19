import {createHmac,createHash,randomBytes,scryptSync,timingSafeEqual,createCipheriv,createDecipheriv} from 'node:crypto';
const PREFIX='viralpick:accounts:v1:';
const secret=()=>process.env.VIRALPICK_APP_SECRET||'';
export const accountReady=()=>Boolean(secret().length>=32&&process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN);
export async function redis(...args){
 if(!accountReady())throw Error('계정 저장소 환경변수가 설정되지 않았습니다.');
 const base=process.env.UPSTASH_REDIS_REST_URL;
 const res=await fetch(base.replace(/\/$/,'') ,{method:'POST',headers:{Authorization:'Bearer '+process.env.UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!res.ok)throw Error('계정 저장소 접속 실패');
 const data=await res.json();if(data.error)throw Error('계정 저장소 오류');return data.result;
}
const digest=s=>createHash('sha256').update(s).digest();
const safe=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
export const isName=name=>/^[a-zA-Z0-9_-]{3,32}$/.test(name);
export const hashPassword=(pass,salt)=>scryptSync(pass,Buffer.from(salt,'hex'),64).toString('hex');
export const newSalt=()=>randomBytes(16).toString('hex');
export function makeToken(user){
 const payload=Buffer.from(JSON.stringify({u:user,e:Date.now()+12*3600000})).toString('base64url');
 const signature=createHmac('sha256',secret()).update(payload).digest('base64url');
 return payload+'.'+signature;
}
export function session(req){
 if(!accountReady())return null;
 const bearer=req.headers.get('authorization')||'';
 const token=bearer.startsWith('Bearer ')?bearer.slice(7):'';
 const [p,s,...rest]=token.split('.');if(!p||!s||rest.length)return null;
 const expected=createHmac('sha256',secret()).update(p).digest('base64url');
 if(!safe(s,expected))return null;
 try{const data=JSON.parse(Buffer.from(p,'base64url').toString());return data.e>Date.now()&&isName(data.u)?data.u:null}catch{return null}
}
export async function getAccount(user){const r=await redis('GET',PREFIX+'user:'+user);return r?JSON.parse(r):null}
export async function createAdmin(user,password,bootstrap){
 if(!isName(user)||typeof password!=='string'||password.length<12||password.length>128)throw Error('계정은 영문/숫자 3~32자, 비밀번호는 12자 이상이어야 합니다.');
 const root=process.env.VIRALPICK_ACCESS_KEY||'';
 if(root.length<16||!safe(bootstrap||'',root))throw Error('초기 관리자 등록 암호가 일치하지 않습니다.');
 const salt=newSalt();const account={user,salt,hash:hashPassword(password,salt),role:'admin'};
 const ok=await redis('SET',PREFIX+'admin',JSON.stringify(account),'NX');
 if(ok!=='OK')throw Error('관리자 계정이 이미 생성되었습니다.');
 await redis('SET',PREFIX+'user:'+user,JSON.stringify(account));
 return account;
}
export async function getAdmin(){const raw=await redis('GET',PREFIX+'admin');return raw?JSON.parse(raw):null}
function encryptionKey(){return digest(secret()+':credentials:v1')}
export function encrypt(obj){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
 const data=Buffer.concat([cipher.update(JSON.stringify(obj)),cipher.final()]);
 return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');
}
export function decrypt(s){
 const [v,t,d]=String(s).split('.');if(!v||!t||!d)throw Error('암호문 형식 오류');
 const cipher=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(v,'base64url'));
 cipher.setAuthTag(Buffer.from(t,'base64url'));
 return JSON.parse(Buffer.concat([cipher.update(Buffer.from(d,'base64url')),cipher.final()]).toString());
}
export async function getKeys(user){
 const raw=await redis('GET',PREFIX+'keys:'+user);return raw?decrypt(raw):{};
}
export async function setKeys(user,updates){
 const current=await getKeys(user);for(const [name,value] of Object.entries(updates)){if(value===null)delete current[name];else current[name]=value}
 await redis('SET',PREFIX+'keys:'+user,encrypt(current));return current;
}

// Download PUBLIC HTTPS product-reference images server-side; no browser CORS dependency.
// DNS results are validated and pinned to the TLS connection to prevent SSRF / DNS rebinding.
import {lookup as dnsLookup} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';

const MAX_BYTES=3000000;
export function imageSourceUrl(value){
 if(typeof value!=='string'||value.length>2400)return null;
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.hash||url.hostname.length>250)return null;
  const host=url.hostname.toLowerCase();
  if(isIP(host)||!host.includes('.')||host==='localhost'||/\.(?:localhost|local|internal|test|invalid|example)$/i.test(host))return null;
  return url;
 }catch{return null}
}
export function isPublicIPv4(value){
 const match=String(value||'').match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
 if(!match)return false;
 const [a,b,c,d]=match.slice(1).map(Number);
 if([a,b,c,d].some(x=>x>255))return false;
 if(a===0||a===10||a===127||a>=224||a===169&&b===254||
   a===100&&b>=64&&b<=127||
   a===172&&b>=16&&b<=31||
   a===192&&(b===168||b===0&&c===0||b===0&&c===2||b===88&&c===99)||
   a===198&&(b===18||b===19||b===51&&c===100)||
   a===203&&b===0&&c===113)return false;
 return true;
}
function verifiedMime(bytes){
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 return null;
}
export async function downloadPublicImage(raw,{lookup=dnsLookup,request=httpsRequest}={}){
 const url=imageSourceUrl(raw);
 if(!url)throw Error('이미지 주소는 공개 HTTPS URL이어야 합니다. 직접 업로드한 사진도 사용할 수 있습니다.');
 let addresses;
 try{addresses=await lookup(url.hostname,{all:true,family:4,verbatim:true})}
 catch{throw Error('이미지 서버의 공개 DNS 주소를 찾지 못했습니다. 다른 사진을 선택해 주세요.')}
 if(!Array.isArray(addresses)||!addresses.length||addresses.some(a=>!isPublicIPv4(a.address)))
  throw Error('공개 인터넷 이미지 서버가 아닌 주소는 사용할 수 없습니다.');
 const pinned=addresses[0].address;
 const response=await new Promise((resolve,reject)=>{
  const req=request(url,{
   method:'GET',agent:false,
   signal:AbortSignal.timeout(14000),
   headers:{Accept:'image/jpeg,image/png,image/webp'},
   lookup:(_hostname,_options,callback)=>callback(null,pinned,4)
  },resolve);
  req.once('error',reject);
  req.end();
 });
 if(response.statusCode!==200){
  response.resume();
  if([301,302,303,307,308].includes(response.statusCode))
   throw Error('원본 사진 URL이 다른 주소로 이동합니다. 리디렉션 없는 이미지 주소를 사용해 주세요.');
  throw Error('외부 이미지 서버가 접근을 거부했습니다 (HTTP '+response.statusCode+'). 직접 업로드하거나 다른 상세 이미지를 선택해 주세요.');
 }
 const mime=String(response.headers['content-type']||'').split(';')[0].trim().toLowerCase();
 if(!['image/png','image/jpeg','image/webp'].includes(mime)){
  response.destroy();
  throw Error('사진 대신 다른 파일이 전달되었습니다. 지원 형식은 JPEG·PNG·WebP입니다.');
 }
 if(Number(response.headers['content-length']||0)>MAX_BYTES){
  response.destroy();throw Error('사진 파일 크기가 3MB를 초과합니다. 다른 사진을 사용해 주세요.');
 }
 const chunks=[];let total=0;
 try{
  for await(const chunk of response){
   total+=chunk.length;
   if(total>MAX_BYTES)throw Error('사진 파일 크기가 3MB를 초과합니다. 다른 사진을 사용해 주세요.');
   chunks.push(chunk);
  }
 }catch(e){response.destroy();throw e}
 const bytes=Buffer.concat(chunks,total),verified=verifiedMime(bytes);
 if(!verified||verified!==mime)throw Error('이미지 파일 형식이 응답 정보와 다릅니다. 다른 사진을 사용해 주세요.');
 if(bytes.length<100)throw Error('참조 사진이 너무 작거나 비어 있습니다.');
 return {bytes,mime};
}

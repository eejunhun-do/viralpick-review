import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {imageSourceUrl,isPublicIPv4,downloadPublicImage} from '../lib/remote-image.js';
import {POST as fetchImageReference} from '../api/reference-image.js';

test('public image URL permits HTTPS retailers without accepting local or private hosts',()=>{
 for(const invalid of [
  'http://pictures.example.net/image.png',
  'https://localhost/image.png',
  'https://127.0.0.1/image.png',
  'https://10.0.0.4/photo.png',
  'https://169.254.169.254/latest/meta-data/',
  'https://admin:password@photos.example.net/photo.jpg',
  'https://photos.example.net:8443/photo.jpg',
  'https://photos.example.net/image.jpg#fragment',
  'https://api.internal/photo.jpg'
 ])assert.equal(imageSourceUrl(invalid),null);
 assert.equal(imageSourceUrl('https://images.shop-example.net/products/photo.jpg?size=500')?.hostname,'images.shop-example.net');
});
test('DNS resolved addresses must be routable public IPv4',()=>{
 for(const address of ['127.0.0.1','10.0.0.1','172.31.1.1','192.168.1.7','100.64.0.1','169.254.169.254','192.0.2.1','198.51.100.2','203.0.113.12','224.0.0.1','::1'])
  assert.equal(isPublicIPv4(address),false,address);
 for(const address of ['8.8.8.8','1.1.1.1','54.10.2.1'])
  assert.equal(isPublicIPv4(address),true,address);
});
test('server pins verified DNS address, accepts only actual images and limits size',async()=>{
 const png=Buffer.alloc(145);Buffer.from([137,80,78,71,13,10,26,10]).copy(png,0);
 let pinned='';
 const mockHttps=(url,options,onResponse)=>{
  assert.equal(url.hostname,'images.shop-example.net');
  // Reproduce Node/Vercel autoSelectFamily; lookup({all:true}) needs an ARRAY.
  options.lookup(url.hostname,{all:true},(_err,addresses)=>{
   assert.equal(_err,null);
   assert.ok(Array.isArray(addresses),'Node all:true must return an array of address records');
   assert.deepEqual(addresses,[{address:'8.8.4.4',family:4}]);
   pinned=addresses[0].address;
  });
  // Other Node callers still expect the ordinary (ip,family) signature.
  options.lookup(url.hostname,{all:false},(_err,ip,family)=>{
   assert.equal(_err,null);
   assert.equal(ip,'8.8.4.4');
   assert.equal(family,4);
  });
  const req=new EventEmitter();
  req.end=()=>{
   const stream=Readable.from([png]);
   stream.statusCode=200;stream.headers={'content-type':'image/png','content-length':String(png.length)};
   onResponse(stream);
  };
  return req;
 };
 const result=await downloadPublicImage('https://images.shop-example.net/photo.png',{
  lookup:async()=>[{address:'8.8.4.4',family:4}],request:mockHttps
 });
 assert.equal(pinned,'8.8.4.4');
 assert.equal(result.mime,'image/png');
 assert.equal(result.bytes.length,145);
 await assert.rejects(()=>downloadPublicImage('https://images.shop-example.net/photo.png',{
  lookup:async()=>[{address:'127.0.0.1',family:4}],request:mockHttps
 }),/공개 인터넷 이미지 서버/);
});
test('authenticated reference route rejects absent consent before doing network work',async()=>{
 const req=new Request('https://viralpick-review.vercel.app/api/reference-image',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({url:'https://images.shop-example.net/pic.jpg',rightsConfirmed:false})
 });
 // Security gate can reject a non-authenticated user even earlier.
 const response=await fetchImageReference(req);
 assert.ok([400,401].includes(response.status));
});

function mockedRedirectFetch(routes,dnsEntries={}){
 const calls=[],dnsCalls=[];
 const validImage=Buffer.alloc(145);
 Buffer.from([137,80,78,71,13,10,26,10]).copy(validImage);
 const request=(url,options,onResponse)=>{
  calls.push({url:url.toString(),host:url.hostname});
  options.lookup(url.hostname,{all:true},(err,addresses)=>{
   assert.equal(err,null);
   assert.deepEqual(addresses,[{address:dnsEntries[url.hostname]||'8.8.4.4',family:4}]);
  });
  const req=new EventEmitter();
  req.end=()=>{
   const route=routes[url.toString()];
   assert.ok(route,'Unexpected HTTPS URL: '+url.toString());
   const response=Readable.from(route.body===undefined?[]:[route.body==='image'?validImage:Buffer.from(route.body)]);
   response.statusCode=route.status;
   response.headers={'content-type':route.contentType||'image/png',...(route.location?{location:route.location}:{})};
   onResponse(response);
  };
  return req;
 };
 const lookup=async host=>{
  dnsCalls.push(host);
  return [{address:dnsEntries[host]||'8.8.4.4',family:4}];
 };
 return {request,lookup,calls,dnsCalls};
}
test('follows same-host and cross-host HTTPS redirects and checks each DNS hop',async()=>{
 const routes={
  'https://images.shop-example.net/original.png':{status:302,location:'/moved.png'},
  'https://images.shop-example.net/moved.png':{status:301,location:'https://cdn.shop-example.net/actual.png'},
  'https://cdn.shop-example.net/actual.png':{status:200,body:'image'}
 };
 const deps=mockedRedirectFetch(routes);
 const result=await downloadPublicImage('https://images.shop-example.net/original.png',deps);
 assert.equal(result.mime,'image/png');
 assert.equal(result.bytes.length,145);
 assert.deepEqual(deps.dnsCalls,['images.shop-example.net','images.shop-example.net','cdn.shop-example.net']);
 assert.equal(deps.calls.length,3);
});
test('rejects redirect to private resolved address, HTTP downgrade and credentials',async()=>{
 const start='https://images.shop-example.net/image.png';
 for(const [target,dnsEntries,expected] of [
  ['https://internal.shop-example.net/private.png',{'internal.shop-example.net':'10.0.0.4'},/공개 인터넷 이미지 서버/],
  ['http://cdn.shop-example.net/image.png',{},/공개 HTTPS 이미지 주소/],
  ['https://127.0.0.1/image.png',{},/공개 HTTPS 이미지 주소/],
  ['https://user:secret@cdn.shop-example.net/image.png',{},/공개 HTTPS 이미지 주소/]
 ]){
  const deps=mockedRedirectFetch({[start]:{status:302,location:target}},dnsEntries);
  await assert.rejects(()=>downloadPublicImage(start,deps),expected);
  assert.equal(deps.calls.length,1,'unsafe redirect must not be fetched');
 }
});
test('stops redirect loops and redirect chains longer than four moves',async()=>{
 const origin='https://images.shop-example.net';
 const loop=mockedRedirectFetch({
  [origin+'/a']:{status:302,location:'/b'},
  [origin+'/b']:{status:302,location:'/a'}
 });
 await assert.rejects(()=>downloadPublicImage(origin+'/a',loop),/반복 이동/);
 assert.equal(loop.calls.length,2);
 const routes={};
 for(let i=0;i<6;i++)routes[origin+'/slide'+i]={status:302,location:'/slide'+(i+1)};
 const tooMany=mockedRedirectFetch(routes);
 await assert.rejects(()=>downloadPublicImage(origin+'/slide0',tooMany),/이동 횟수/);
 assert.equal(tooMany.calls.length,5);
});
test('redirected HTTP 200 must still be a real image',async()=>{
 const a='https://images.shop-example.net/a.jpg',b='https://cdn.shop-example.net/end.jpg';
 const bad=mockedRedirectFetch({
  [a]:{status:302,location:b},
  [b]:{status:200,body:'<html>not an image</html>',contentType:'text/html'}
 });
 await assert.rejects(()=>downloadPublicImage(a,bad),/사진 대신 다른 파일/);
});

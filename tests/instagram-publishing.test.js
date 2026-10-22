import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publishInstagramFeed,validateInstagramImages,isInstagramProfessional} from '../lib/instagram-publishing.js';

test('Instagram accepts professional Business/Creator, never personal accounts',()=>{
 assert.equal(isInstagramProfessional('BUSINESS'),true);
 assert.equal(isInstagramProfessional('MEDIA_CREATOR'),true);
 assert.equal(isInstagramProfessional('CREATOR'),true);
 assert.equal(isInstagramProfessional('PERSONAL'),false);
 assert.equal(isInstagramProfessional(null),false);
});

test('Instagram media preflight requires public HTTPS JPEG and 1-10 images',()=>{
 assert.equal(validateInstagramImages(['https://cdn.example/photo.jpg']),1);
 assert.equal(validateInstagramImages(Array.from({length:10},(_,i)=>'https://cdn.example/'+i+'.jpeg')),10);
 for(const urls of [[],Array(11).fill('https://cdn.example/a.jpg'),['http://insecure.example/a.jpg'],
  ['https://cdn.example/a.png'],['https://cdn.example/a.webp'],['https://cdn.example/a.gif'],['bad-url']]){
  assert.throws(()=>validateInstagramImages(urls));
 }
});

test('five-card Instagram carousel creates children, waits until ready, and publishes exactly once',async()=>{
 const order=[],ids=[],caption='일상 불편 해결 · 광고 포함';
 const photos=Array.from({length:5},(_,i)=>'https://assets.example/slide'+(i+1)+'.jpg');
 const graph=async(platform,path,token,options)=>{
  assert.equal(platform,'instagram');assert.equal(token,'fake-ig-token');
  assert.equal(options.method,'POST');
  order.push([path,options.fields]);
  if(path==='/ig_123/media'&&options.fields.is_carousel_item==='true'){
   ids.push('child-'+ids.length);return {id:ids.at(-1)};
  }
  if(path==='/ig_123/media'&&options.fields.media_type==='CAROUSEL'){
   assert.equal(options.fields.children,ids.join(','));
   assert.equal(options.fields.caption,caption);
   return {id:'parent'};
  }
  if(path==='/ig_123/media_publish'){
   assert.equal(options.fields.creation_id,'parent');
   return {id:'published_456'};
  }
  throw Error('Unexpected Graph request '+path);
 };
 const waited=[],stages=[];
 const wait=async(platform,id,load,config)=>{
  waited.push(id);
  assert.equal(platform,'instagram');
  assert.ok(config.tries>=10);
  return 'FINISHED';
 };
 const result=await publishInstagramFeed({accountId:'ig_123',token:'fake-ig-token',imageUrls:photos,caption,graph,wait,
  stage:async(message)=>stages.push(message)});
 assert.deepEqual(result,{id:'published_456',imageCount:5});
 assert.equal(ids.length,5);
 assert.deepEqual(waited,['child-0','child-1','child-2','child-3','child-4','parent']);
 assert.equal(order.filter(x=>x[0]==='/ig_123/media_publish').length,1);
 assert.match(stages.join(' '),/최종 이미지/);
});
test('Instagram single-photo feed uses one container and no CAROUSEL',async()=>{
 const graphCalls=[];
 const graph=async(p,path,t,options)=>{
  graphCalls.push(options.fields);
  if(path.endsWith('/media_publish'))return {id:'123'};
  return {id:'single-container'};
 };
 const wait=async()=>true;
 const result=await publishInstagramFeed({accountId:'ig_123',token:'fake',imageUrls:['https://x.example/a.jpg'],caption:'short',graph,wait});
 assert.equal(result.imageCount,1);
 assert.equal(graphCalls.length,2);
 assert.equal(graphCalls[0].image_url,'https://x.example/a.jpg');
 assert.equal(graphCalls[0].media_type,undefined);
});
test('Meta image processing errors never publish Instagram prematurely',async()=>{
 let published=0;
 const graph=async(p,path,t,options)=>{
  if(path.endsWith('media_publish')){published++;return{id:'bad'}}
  return{id:'child'};
 };
 await assert.rejects(()=>publishInstagramFeed({accountId:'ig',token:'fake',imageUrls:['https://x.example/a.jpg','https://x.example/b.jpg'],
  caption:'text',graph,wait:async()=>{throw Error('Meta media ERROR: unreachable image')}}),/unreachable image/);
 assert.equal(published,0);
});

test('Instagram preparation is wired to actual app image storage and OAuth metadata',()=>{
 const html=readFileSync(new URL('../v05.html',import.meta.url),'utf8');
 const social=readFileSync(new URL('../lib/social-publishing.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../social-publishing-ui.js',import.meta.url),'utf8');
 assert.match(html,/vpInstagramPrepareForReservation=prepareInstagramCarouselForReservation/);
 assert.match(html,/carouselPhotoAssets|carouselImageForSlide/);
 assert.match(html,/빈 템플릿은 업로드하지 않습니다/);
 assert.match(social,/account_type/);
 assert.match(social,/isInstagramProfessional\(profile\.account_type\)/);
 assert.match(social,/validateInstagramImages\(urls\)/);
 assert.match(social,/publishInstagramFeed\(\{accountId:c\.id/);
 assert.match(ui,/vpIgSetupStatus/);
 assert.match(ui,/vpInstagramPrepareForReservation/);
});

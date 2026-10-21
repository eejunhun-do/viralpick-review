import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=source('v05.html'),api=source('api/image.js'),creator=source('creator-assets.js'),feed=source('instagram-feed-preview.js'),css=source('instagram-feed-preview.css'),story=source('instagram-single-story.js');

test('all five card photographs are individually generated and saved',()=>{
 assert.match(html,/runCarouselArtworkGeneration\(\[1,2,3,4,5\]\)/);
 assert.match(html,/for\(const slide of \[1,2,3,4,5\]\)/);
 assert.match(html,/carouselImageForSlide\(1\)\?\.image/);
 assert.match(html,/slide<=2\?\{imageMode:'scene'\}/);
 assert.match(html,/vpCreatorReferencePayloadForInstagramSlide\(slide\)/);
 assert.match(html,/purpose:'carousel',slide/);
 assert.match(html,/selected\.id!==targetId/);
 assert.match(html,/캐러셀 1~5번 일괄 이미지 생성/);
});
test('image API explicitly gates problem scenes and product reference edits',()=>{
 assert.match(api,/!\[1,2,3,4,5\]\.includes\(slide\)/);
 assert.match(api,/slide<=2&&data\.imageMode==='product'/);
 assert.match(api,/slide>=3&&data\.imageMode!=='product'/);
 assert.match(api,/referenceRightsConfirmed/);
 assert.match(api,/purpose==='carousel'&&slide<=2/);
 assert.match(creator,/function payloadForInstagramSlide\(/);
 assert.match(creator,/vpCreatorReferencePayloadForInstagramSlide=payloadForInstagramSlide/);
});
test('Instagram uses product source picker instead of duplicate real-life background generator',()=>{
 assert.match(creator,/insta\.querySelector\('\.vpCreatorHookStep'\)\?\.remove\(\)/);
 assert.match(creator,/insta\.querySelector\('\.vpCreatorSceneRow'\)\?\.remove\(\)/);
 assert.match(creator,/상품 썸네일 · 상세 이미지 선택/);
 assert.match(story,/vpSingleSceneAdvanced/);
 assert.match(story,/이미지 연출 고급 수정/);
 assert.match(css,/vpInstagramPhotoPicker/);
});
test('Instagram-style preview is the same on both image and final review steps',()=>{
 assert.doesNotThrow(()=>new Script(feed));
 assert.doesNotThrow(()=>new Script(story));
 assert.doesNotThrow(()=>new Script(creator));
 assert.match(feed,/vpInstagramFeedVisual/);
 assert.match(feed,/vpInstagramFeedFinal/);
 assert.match(feed,/function makeFeed\(id\)/);
 assert.match(feed,/vpInstagramFeedCounter/);
 assert.match(feed,/getCurrentInstagramCaption/);
 assert.match(feed,/goInstagramSlide/);
 assert.match(html,/window\.vpInstagramFeedRefresh\?\.\(\)/);
 assert.match(html,/instagram-feed-preview\.js\?v=1/);
 assert.match(html,/instagram-feed-preview\.css\?v=2/);
});

test('external visible thumbnails are transferred through the server without browser CORS',async()=>{
 const start=creator.indexOf('function isSupportedReferenceUrl(');
 const end=creator.indexOf('function hookKey(platform){',start);
 assert.ok(start>0&&end>start);
 const create=new Function('getReference','assets','state','vpResizeReferenceImage','backendRequest','validImageURL',
  creator.slice(start,end)+';return {isSupportedReferenceUrl,payloadForInstagramSlide};');
 const first={id:'thumb',type:'remote',src:'https://pictures.example.org/catalog/product.jpg',label:'쿠팡 대표 썸네일'};
 const alternate={id:'detail:0',type:'remote',src:'https://image7.coupangcdn.com/product.jpg',label:'상세 이미지 1'};
 const seen=[];
 const backend=async(path,req)=>{
  assert.equal(path,'/api/reference-image');
  assert.equal(req.method,'POST');
  const body=JSON.parse(req.body);
  assert.equal(body.rightsConfirmed,true);
  seen.push(body.url);
  return {ok:true,imageData:'data:image/jpeg;base64,QUJDREVGR0g='};
 };
 const harness=create(()=>first,()=>[first,alternate],{instagram:{rights:true}},async image=>image,backend,url=>url.startsWith('https://'));
 assert.equal(harness.isSupportedReferenceUrl(first.src),false);
 assert.equal(harness.isSupportedReferenceUrl(alternate.src),true);
 assert.equal(harness.isSupportedReferenceUrl('https://image7.coupangcdn.com.attacker.tld/image.jpg'),false);
 for(const number of [3,4,5]){
  const payload=await harness.payloadForInstagramSlide(number);
  assert.equal(payload.imageMode,'product');
  assert.equal(payload.referenceImage,'data:image/jpeg;base64,QUJDREVGR0g=');
  assert.equal(payload.referenceRightsConfirmed,true);
  assert.equal(payload.referenceUrl,undefined);
 }
 assert.deepEqual(seen,[first.src,alternate.src]);
 assert.doesNotMatch(creator,/fetch\(url,\{mode:'cors'/);
});
test('a blocked origin produces a clear, early error before paid image generation',async()=>{
 const start=creator.indexOf('function isSupportedReferenceUrl(');
 const end=creator.indexOf('function hookKey(platform){',start);
 const first={id:'thumb',type:'remote',src:'https://pictures.example.org/product.jpg',label:'대표 사진'};
 const create=new Function('getReference','assets','state','vpResizeReferenceImage','backendRequest','validImageURL',
  creator.slice(start,end)+';return payloadForInstagramSlide;');
 const payload=create(()=>first,()=>[first],{instagram:{rights:true}},async image=>image,
  async()=>{throw Error('외부 서버 HTTP 403')},url=>url.startsWith('https://'));
 await assert.rejects(()=>payload(3),/선택된 상품 사진을 서버에서 가져오지 못했습니다/);
 assert.match(html,/Validate and prepare ALL product-reference inputs before any paid image generation/);
 assert.match(html,/payloads\.set\(slide,await window\.vpCreatorReferencePayloadForInstagramSlide\(slide\)\)/);
});
test('batch skips completed image cards and single-card retry can replace exactly one image',()=>{
 assert.match(html,/slides\.filter\(n=>!carouselImageForSlide\(n,targetId\)\?\.data\)/);
 assert.match(html,/const pending=replace\?slides/);
 assert.match(html,/runCarouselArtworkGeneration\(\[slide\],\{replace:true\}\)/);
 assert.match(html,/이미 5장 이미지가 준비되어 있습니다/);
 assert.match(html,/failed\.push\(slide\+'번:/);
});

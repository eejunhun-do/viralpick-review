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

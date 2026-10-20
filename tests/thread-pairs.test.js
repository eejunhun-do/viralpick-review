import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {validatePairs} from '../api/thread-hook-pairs.js';

const html=readFileSync(new URL('../v05.html',import.meta.url),'utf8');
const frontend=readFileSync(new URL('../thread-pairs.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../api/image.js',import.meta.url),'utf8');
const pairApi=readFileSync(new URL('../api/thread-hook-pairs.js',import.meta.url),'utf8');
const studio=readFileSync(new URL('../studio-layout.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../creator-assets.css',import.meta.url),'utf8');

test('five distinct linked hook pairs required',()=>{
 const good=Array.from({length:5},(_,i)=>({pain:'불편한 상황 '+i+' 생겨서 귀찮아',solve:'확인된 기능 '+i+' 통해 더 편해질 듯'}));
 assert.equal(validatePairs(good)?.length,5);
 assert.equal(validatePairs(good.slice(0,4)),null);
 assert.equal(validatePairs(good.map(x=>({pain:x.pain,solve:x.pain}))),null);
 assert.equal(validatePairs(good.map(x=>({...x,pain:'똑같은 불편한 상황 계속 반복함'}))),null);
 assert.equal(validatePairs(good.map((x,i)=>i===0?{...x,solve:'꼭 구매하세요'}:x)),null);
});
test('client script parses and is loaded only after the existing creator gallery',()=>{
 assert.doesNotThrow(()=>new Script(frontend));
 assert.match(html,/creator-assets\.js\?v=3"><\/script>\s*<script src="\/thread-pairs\.js\?v=4"/);
 assert.match(frontend,/window\.vpCreatorReferencePayload\('threads'\)/);
 assert.match(frontend,/purpose:slot==='pain'\?'threads-pain':'threads-solve'/);
 assert.match(frontend,/slot==='solve'\?await window\.vpCreatorReferencePayload\('threads'\):\{imageMode:'scene'\}/);
});
test('image API generates one scene-only pain photo and one reference-based solve photo',()=>{
 assert.match(api,/threads-pain/);
 assert.match(api,/threads-solve/);
 assert.match(api,/purpose==='threads-pain'\?'scene'/);
 assert.match(api,/purpose==='threads-solve'\?'product'/);
 assert.match(api,/includes\(purpose\)\?1:2/);
 assert.match(pairApi,/근거 없는 상품 기능/);
 assert.match(pairApi,/JSON 객체/);
});
test('independent photos feed first and second Threads canvas and social review',()=>{
 assert.match(html,/vpThreadPairArtworkForSlide\?\.\(slide\)/);
 assert.match(html,/showProduct:pair\.showProduct/);
 assert.match(html,/vpThreadPairExport/);
 assert.match(frontend,/selectedIndex/);
 assert.match(frontend,/window\.vpThreadPairArtworkForSlide=canvasData/);
 assert.match(frontend,/\.vpFirstPost/);
 assert.match(frontend,/\.vpSecondPost/);
 assert.match(frontend,/vpThreadPairExport=exportTwo/);
 assert.match(css,/\.vpPairFinalMedia/);
 assert.match(studio,/불편·해결 이미지 2장 ZIP 저장/);
});
test('image storage is browser local IndexedDB rather than localStorage large base64',()=>{
 assert.match(frontend,/indexedDB\.open\(PAIR_DB,1\)/);
 assert.match(frontend,/createObjectStore\(STORE\)/);
 assert.match(frontend,/tx\.objectStore\(STORE\)\.put\(value,key\)/);
 assert.ok(frontend.includes("delete r.images[index+':'+slot];"));
});

test('story stages are nested in the correct creator container and both hooks can update Threads post opening lines',()=>{
 assert.match(frontend,/const container=root\.querySelector\('\.vpCreatorReference'\)\|\|root/);
 assert.match(frontend,/container\.append\(pair,problem,photo,finish\)/);
 assert.match(frontend,/function applyHooksToPosts\(/);
 assert.match(frontend,/customThreadEdits\[threadEditKey\(\)\]=first/);
 assert.match(frontend,/saveThreadReply\(second\)/);
});

test('Threads visual and final previews show both problem and solution images in the FIRST post only',()=>{
 const creator=readFileSync(new URL('../creator-assets.js',import.meta.url),'utf8');
 assert.match(creator,/panel\.id='vpThreadVisualReview'/);
 assert.match(creator,/visual\.insertBefore\(panel,visual\.children\[1\]\|\|null\)/);
 assert.match(creator,/for\(const root of \[\$\('#vpThreadSocialReview'\),\$\('#vpThreadVisualReview'\)\]/);
 assert.match(frontend,/for\(const panelId of \['vpThreadVisualReview','vpThreadSocialReview'\]\)/);
 assert.match(frontend,/const first=panel\?\.querySelector\('\.vpFirstPost \.vpPreviewBody'\)/);
 assert.match(frontend,/gallery\.className='vpPairGallery'/);
 assert.match(frontend,/for\(const \[slot,label\] of \[\['pain','1번 · 불편 상황'\],\['solve','2번 · 제품 해결'\]\]\)/);
 assert.match(frontend,/first\.after\(gallery\)/);
 assert.match(frontend,/\.vpSecondPost \.vpPairFinalMedia/);
 assert.match(frontend,/if\(replyMedia\)replyMedia\.remove\(\)/);
 assert.match(frontend,/imageNode\('solve',first\.querySelector\('\[data-pair-photo="solve"\]'\)\)/);
 assert.match(css,/#vpThreadVisualReview \.vpPreviewMedia/);
});
test('Threads steps are in strict DOM and CSS order 01,02,03,04 and final stage shows both image previews',()=>{
 assert.match(frontend,/container\.append\(pair,problem,photo,finish\)/);
 for(const [cls,number] of [['vpPairHookStage',0],['vpPairStagePain',1],['vpCreatorPhotoStep',2],['vpPairFinish',3]]){
  assert.ok(css.includes('vpThreadPairMode .'+cls+'{order:'+number+'}'));
 }
 assert.match(frontend,/vpPairFinishGallery/);
 assert.match(frontend,/vpPairFinishPain/);
 assert.match(frontend,/vpPairFinishSolve/);
});

test('paired images are suppressed in multiple-products mode',()=>{
 assert.match(frontend,/gallery\.hidden=multi/);
 assert.match(frontend,/if\(multi\)continue/);
 assert.match(css,/\.vpPairGallery\[hidden\]\{display:none!important\}/);
});

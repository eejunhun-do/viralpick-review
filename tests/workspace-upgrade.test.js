import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {validProductImage} from '../lib/coupang-partners.js';
import {referenceImageUrl} from '../api/image.js';

const html=readFileSync(new URL('../v05.html',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../workspace-upgrade.js',import.meta.url),'utf8');
const performance=readFileSync(new URL('../performance-dashboard.js',import.meta.url),'utf8');
const performanceCss=readFileSync(new URL('../performance-dashboard.css',import.meta.url),'utf8');
const studio=readFileSync(new URL('../studio-layout.js',import.meta.url),'utf8');
const creator=readFileSync(new URL('../creator-assets.js',import.meta.url),'utf8');
const hooks=readFileSync(new URL('../api/hooks.js',import.meta.url),'utf8');
const copy=readFileSync(new URL('../api/copy.js',import.meta.url),'utf8');
const image=readFileSync(new URL('../api/image.js',import.meta.url),'utf8');

test('new dashboard and creator assets are linked and parse',()=>{
 assert.match(html,/workspace-upgrade\.js\?v=4/);
 assert.match(html,/workspace-upgrade\.css\?v=2/);
 assert.doesNotThrow(()=>new Script(workspace));
 assert.doesNotThrow(()=>new Script(performance));
 assert.match(html,/performance-dashboard\.js\?v=1/);
 assert.match(html,/performance-dashboard\.css\?v=1/);
 assert.doesNotThrow(()=>new Script(studio));
 assert.doesNotThrow(()=>new Script(creator));
 assert.match(html,/creator-assets\.js\?v=4/);
});
test('dashboard report is not populated from prototype metrics',()=>{
 assert.match(workspace,/PERFORMANCE CENTER/);
 assert.match(workspace,/vpPerformanceDashboard/);
 assert.doesNotMatch(workspace,/vpRecordForm|성과 기록 추가|vpDeleteReport/);
 assert.match(performance,/이번 달 수익/);
 assert.match(performance,/이번 주 수익/);
 assert.match(performance,/오늘 수익/);
 assert.match(performance,/vpSocialPostRows/);
 assert.match(performanceCss,/@media\(max-width:540px\)/);
 assert.doesNotMatch(workspace,/analyticsScenario|analyticsSets/);
});
test('selected product evidence and two-part Threads are available',()=>{
 assert.match(html,/function getThreadReplyText\(/);
 assert.match(html,/function copyThreadPart\(/);
 assert.match(studio,/vpThreadReplyEditor/);
 assert.match(copy,/response_format/);
 assert.match(copy,/THREADS_TONE_RULES/);
 const tone=readFileSync(new URL('../lib/copy-tone.js',import.meta.url),'utf8');
 assert.match(tone,/광고.*첫 줄에 단독으로 쓰지 마라/);
});
test('reference-based image editing is separate from scene generation',()=>{
 assert.match(image,/\/v1\/images\/edits/);
 assert.match(image,/\/v1\/images\/generations/);
 assert.match(studio,/vpAssetStudio/);
 assert.match(creator,/vpAssetGrid/);
 assert.match(creator,/vpHookChoices/);
 assert.match(creator,/vpThreadFeed/);
 assert.match(hooks,/hooks\.length!==5/);
});
test('Coupang CDN product thumbnails are upgraded to HTTPS',()=>{
 assert.equal(validProductImage('http://thumbnail.coupangcdn.com/x.png'),'https://thumbnail.coupangcdn.com/x.png');
 assert.equal(validProductImage('https://thumbnail.coupangcdn.com/y.png'),'https://thumbnail.coupangcdn.com/y.png');
 assert.equal(validProductImage('http://other.example/x.png'),null);
});

test('product reference fetch allows only exact HTTPS Coupang CDN domains',()=>{
 assert.equal(referenceImageUrl('https://thumbnail.coupangcdn.com/ab/image.jpg'),'https://thumbnail.coupangcdn.com/ab/image.jpg');
 assert.equal(referenceImageUrl('http://thumbnail.coupangcdn.com/ab/image.jpg'),null);
 assert.equal(referenceImageUrl('https://thumbnail.coupangcdn.com.evil.example/a.jpg'),null);
 assert.equal(referenceImageUrl('https://127.0.0.1/private'),null);
 assert.equal(referenceImageUrl('https://thumbnail.coupangcdn.com:4443/a.jpg'),null);
 assert.equal(referenceImageUrl('https://user:pass@thumbnail.coupangcdn.com/a.jpg'),null);
});

test('visual creation follows hook -> product image -> three layouts',()=>{
 const studio=readFileSync(new URL('../studio-layout.js',import.meta.url),'utf8');
 const creator=readFileSync(new URL('../creator-assets.js',import.meta.url),'utf8');
 assert.match(studio,/stages\.visual\.insertBefore\(assetsRoot/);
 assert.match(studio,/stages\.visual\.appendChild\(legacyLayouts\)/);
 assert.match(creator,/root\.prepend\(hookStep\);root\.appendChild\(photoStep\)/);
 assert.match(creator,/vpCreatorHookStep/);
 assert.match(creator,/vpCreatorPhotoStep/);
 assert.match(creator,/vpCreatorStylePicker/);
 const html=readFileSync(new URL('../v05.html',import.meta.url),'utf8');
 const image=readFileSync(new URL('../api/image.js',import.meta.url),'utf8');
 assert.match(html,/Photograph the real everyday situation described by this Korean hook/);
 assert.doesNotMatch(html,/hints\[selected\.id\]/);
 assert.match(image,/USER-SELECTED HOOK IS THE PRIMARY STORY DIRECTION/);
 assert.match(image,/Transfer that exact product into the hook-matching situation/);
});

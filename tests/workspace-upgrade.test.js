import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {validProductImage} from '../lib/coupang-partners.js';

const html=readFileSync(new URL('../v05.html',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../workspace-upgrade.js',import.meta.url),'utf8');
const studio=readFileSync(new URL('../studio-layout.js',import.meta.url),'utf8');
const copy=readFileSync(new URL('../api/copy.js',import.meta.url),'utf8');
const image=readFileSync(new URL('../api/image.js',import.meta.url),'utf8');

test('new dashboard and creator assets are linked and parse',()=>{
 assert.match(html,/workspace-upgrade\.js\?v=2/);
 assert.match(html,/workspace-upgrade\.css\?v=2/);
 assert.doesNotThrow(()=>new Script(workspace));
 assert.doesNotThrow(()=>new Script(studio));
});
test('dashboard report is not populated from prototype metrics',()=>{
 assert.match(workspace,/PERFORMANCE CENTER/);
 assert.match(workspace,/실제 수동 입력 기준/);
 assert.match(workspace,/viralpick-performance-v2/);
 assert.doesNotMatch(workspace,/analyticsScenario|analyticsSets/);
});
test('selected product evidence and two-part Threads are available',()=>{
 assert.match(html,/function getThreadReplyText\(/);
 assert.match(html,/function copyThreadPart\(/);
 assert.match(studio,/vpThreadReplyEditor/);
 assert.match(copy,/response_format/);
 assert.match(copy,/첫 줄에 단독으로 광고라고 쓰지 않는다/);
});
test('reference-based image editing is separate from scene generation',()=>{
 assert.match(image,/\/v1\/images\/edits/);
 assert.match(image,/\/v1\/images\/generations/);
 assert.match(studio,/vpProductRefUpload/);
 assert.match(studio,/vpImageMode/);
});
test('Coupang CDN product thumbnails are upgraded to HTTPS',()=>{
 assert.equal(validProductImage('http://thumbnail.coupangcdn.com/x.png'),'https://thumbnail.coupangcdn.com/x.png');
 assert.equal(validProductImage('https://thumbnail.coupangcdn.com/y.png'),'https://thumbnail.coupangcdn.com/y.png');
 assert.equal(validProductImage('http://other.example/x.png'),null);
});

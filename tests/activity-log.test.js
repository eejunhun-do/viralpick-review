import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('v05.html'),source=read('activity-log.js'),css=read('activity-log.css');
function makeLogger(){
 const storage=new Map();
 const window={};
 const sessionStorage={
  getItem:key=>storage.get(key)||null,
  setItem:(key,val)=>storage.set(key,val)
 };
 const document={readyState:'loading',addEventListener(){},querySelector(){return null}};
 const sandbox={document,window,sessionStorage,Date,Map,URL,JSON,String,Number,Array};
 runInNewContext(source,sandbox);
 return {api:window.vpActivity,history:()=>JSON.parse(storage.get('vp-activity-log-v1')||'[]')};
}
test('logo and mobile bottom nav link to real existing dashboard rather than mock analytics',()=>{
 assert.match(html,/mobileTopBrandButton" onclick="show\('dashboard'\)"/);
 assert.match(html,/brandHomeButton" onclick="show\('dashboard'\)"/);
 assert.match(html,/data-quick-view="dashboard" onclick="show\('dashboard'\)"/);
 assert.doesNotMatch(html,/data-quick-view="analytics"/);
 assert.doesNotMatch(html,/<button data-view="analytics">/);
 assert.match(html,/if\(id==='analytics'\)id='dashboard'/);
 assert.match(html,/activity-log\.js\?v=2/);
 assert.match(html,/activity-log\.css\?v=1/);
 assert.equal([...html.matchAll(/data-quick-view=/g)].length,4);
 assert.match(css,/bottom:calc\(75px \+ env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(css,/\.vpActivityPanel\[hidden\]/);
});
test('tracker classifies generative tasks, product research and commerce separately',()=>{
 const {api}=makeLogger();
 assert.match(api.classifyRequest('/api/image',{method:'POST',body:JSON.stringify({purpose:'carousel',slide:3})}).label,/3\/5번 카드 이미지/);
 assert.match(api.classifyRequest('/api/copy',{method:'POST',body:'{"action":"product-research"}'}).label,/웹조사/);
 assert.match(api.classifyRequest('/api/copy',{method:'POST',body:'{"platform":"Threads"}'}).label,/Threads AI 문구/);
 assert.match(api.classifyRequest('/api/instagram-story').label,/캐러셀 문구/);
 assert.match(api.classifyRequest('/api/hooks').label,/후킹/);
 assert.match(api.classifyRequest('/api/reports').label,/실적/);
 assert.match(api.classifyRequest('/api/blog',{method:'POST',body:'{"action":"plan"}'}).label,/SEO 8유형/);
 assert.match(api.classifyRequest('/api/blog',{method:'POST',body:'{"action":"draft"}'}).label,/본문 작성/);
});
test('simultaneous tasks persist event history but never record raw API payloads',async()=>{
 const {api,history}=makeLogger();
 let resolveImage;const gate=new Promise(r=>{resolveImage=r});
 const imagePromise=api.trackRequest('/api/image',{method:'POST',body:JSON.stringify({purpose:'carousel',slide:4,prompt:'PRIVATE_TEXT'})},()=>gate);
 const copyPromise=api.trackRequest('/api/copy',{method:'POST',body:'{"platform":"Threads","password":"private-value"}'},async()=>({ok:true}));
 await copyPromise;
 resolveImage({ok:true});await imagePromise;
 const log=history();
 assert.ok(log.some(row=>row.label.includes('Threads AI 문구')&&row.level==='success'));
 assert.ok(log.some(row=>row.label.includes('4/5번 카드')&&row.level==='success'));
 assert.ok(log.every(row=>!JSON.stringify(row).includes('PRIVATE_TEXT')));
 assert.ok(log.every(row=>!JSON.stringify(row).includes('private-value')));
});
test('request failures are recorded and thrown back to callers',async()=>{
 const {api,history}=makeLogger();
 await assert.rejects(()=>api.trackRequest('/api/reference-image',{},async()=>{throw Error('서버 HTTP 403')}),/HTTP 403/);
 assert.ok(history().some(row=>row.level==='error'&&row.label.includes('상품 참조 사진')));
});
test('activity history is bounded and redacts URLs and token-like secrets',()=>{
 const {api,history}=makeLogger();
 for(let i=0;i<90;i++)api.info('작업 '+i,'링크 https://example.org/secret '+i);
 assert.equal(history().length,55);
 assert.ok(history().every(row=>!row.detail.includes('example.org')));
 assert.doesNotThrow(()=>new Script(source));
});
test('carousel lifecycle includes preparation, per-card update and final event',()=>{
 assert.match(html,/vpActivity\?\.begin\('Instagram 캐러셀 일괄 제작'/);
 assert.match(html,/vpActivity\?\.update\(activityId,slide\+'번 카드 이미지 생성 중/);
 assert.match(html,/vpActivity\?\.end\(activityId,/);
 assert.match(html,/vpActivity\.trackRequest\(path,options,execute\)/);
 assert.match(html,/window\.vpActivity\?\.info\('작업 알림'/);
});

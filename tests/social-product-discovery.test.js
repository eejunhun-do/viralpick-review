import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext,Script} from 'node:vm';

const core=readFileSync(new URL('../social-discovery-core.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../social-product-discovery.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../v05.html',import.meta.url),'utf8');

test('social-problem discovery scripts load after existing workspace and parse',()=>{
 assert.doesNotThrow(()=>new Script(core));
 assert.doesNotThrow(()=>new Script(ui));
 assert.match(html,/social-discovery-core\.js\?v=2/);
 assert.match(html,/social-product-discovery\.js\?v=2/);
 assert.match(html,/일상의 불편을 해결하는 SNS 상품 찾기/);
});
function contextWith(options={}){
 const kv=options.kv||new Map(),elements={};
 for(const id of ['#vpAiDescription','#vpAiReviews','#vpReviewMarkdown']){
  elements[id]={value:options[id]||'',addEventListener(){}};
 }
 let ready=()=>{};
 const window={
  selectProduct:()=>{},saveCurrentWorkspace(){},
  vpProductResearchRefresh(){},
  backendRequest:()=>{throw Error('Product APIs must only be used on explicit search')}
 };
 const document={
  readyState:'loading',
  querySelector:query=>elements[query]||null,
  addEventListener(type,fn){if(type==='DOMContentLoaded')ready=fn}
 };
 const localStorage={
  getItem:key=>kv.get(key)||null,
  setItem:(key,value)=>{kv.set(key,value)}
 };
 const sandbox=createContext({window,document,localStorage,Date,Number,Object,JSON,String,
  setTimeout,clearTimeout,console});
 runInContext("const products=[{id:101,source:'manual',name:'첫 상품',price:9000},{id:202,source:'manual',name:'둘째 상품',price:12000}];"+
  "let selected=products[0];let remoteProducts=[];"+
  "window.selectProduct=function(id){selected=products.find(x=>x.id===id)};",sandbox);
 runInContext(core+'\n'+ui,sandbox);
 ready();
 return {sandbox,kv,elements};
}
test('SNS score requires an actual matching name, never invented products',()=>{
 const s=createContext({window:{}});
 runInContext(core,s);
 const engine=s.window.vpSocialDiscoveryCore;
 assert.equal(engine.pickScenarios('all').length,6);
 const vacuum=engine.scenarios.find(x=>x.id==='vacuum');
 const product={id:'345',name:'휴대용 무선 미니 청소기',price:18000,imageUrl:'https://example.com/image.jpg',productUrl:'https://example.com/p'};
 const score=engine.score(product,vacuum);
 assert.ok(score.score>=60&&score.score<=95);
 assert.ok(score.threads>0&&score.instagram>0);
 assert.equal(engine.score({...product,name:'행사용 커튼'},vacuum),null);
 assert.ok(engine.pickScenarios('pets').every(x=>x.category==='pets'));
});
test('switching products preserves individual notes and recent-work order',()=>{
 const {sandbox,kv,elements}=contextWith({'#vpAiDescription':'상품 A 분석'});
 runInContext('window.selectProduct(202)',sandbox);
 assert.equal(elements['#vpAiDescription'].value,'');
 elements['#vpAiDescription'].value='상품 B 분석';
 runInContext('window.selectProduct(101)',sandbox);
 assert.equal(elements['#vpAiDescription'].value,'상품 A 분석');
 const data=JSON.parse(kv.get('viralpick-product-work-history-v1'));
 assert.deepEqual(Array.from(data.map(x=>x.id)),['101','202']);
 const drafts=JSON.parse(kv.get('viralpick-product-work-notes-v1'));
 assert.equal(drafts['202'].description,'상품 B 분석');
});
test('saved product memo is loaded on a new page without another manual search',()=>{
 const kv=new Map();
 const first=contextWith({kv,'#vpAiDescription':'새로고침 전 저장한 작업 메모'});
 const second=contextWith({kv,'#vpAiDescription':''});
 assert.equal(first.elements['#vpAiDescription'].value,'새로고침 전 저장한 작업 메모');
 assert.equal(second.elements['#vpAiDescription'].value,'새로고침 전 저장한 작업 메모');
});
test('API query is never triggered merely by opening product discovery',()=>{
 assert.doesNotThrow(()=>contextWith());
 assert.match(ui,/window\.backendRequest\('\/api\/products\?q='/);
 assert.match(ui,/vpSocialRecoRun'\)\.onclick=\(\)=>void findRecommendations\(\)/);
});

test('200-item searches are bounded, category relevant and use real API query plans',()=>{
 const scope=createContext({window:{}});runInContext(core,scope);
 const engine=scope.window.vpSocialDiscoveryCore;
 assert.ok(engine.searchPlans('all',20).length>0);
 assert.ok(engine.searchPlans('all',200).length>engine.searchPlans('all',20).length);
 assert.ok(engine.searchPlans('all',200).length<=160);
 const pet=engine.searchPlans('pets',200);
 assert.ok(pet.length>8);
 assert.ok(pet.every(x=>engine.scenarios.find(s=>s.id===x.scenarioId)?.category==='pets'));
 const unique=new Set(pet.map(p=>p.query+'|'+p.scenarioId));
 assert.equal(unique.size,pet.length);
});
test('SNS recommendation amounts and 50-item pagination are available',()=>{
 for(const count of [20,50,100,200])assert.match(ui,new RegExp('<option value="'+count+'">'+count+'개<\\/option>'));
 assert.match(ui,/const MAX_HISTORY=35,MAX_NOTES=24,PAGE_SIZE=50/);
 assert.match(ui,/recommendations\.slice\(start,start\+PAGE_SIZE\)/);
 assert.match(ui,/function renderRecommendationPages/);
 assert.match(ui,/vpSocialRecoPages/);
 assert.match(ui,/이전/);
 assert.match(ui,/다음/);
 assert.match(ui,/&limit=10/);
 assert.match(ui,/상품.*검색 오류/);
 assert.match(ui,/중복|dedup|const unique=new Map/);
});

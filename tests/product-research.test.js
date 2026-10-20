import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {normalizeProductResearch,citedUrls} from '../lib/product-research.js';

const main=readFileSync(new URL('../v05.html',import.meta.url),'utf8');
const frontend=readFileSync(new URL('../product-research.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../lib/product-research.js',import.meta.url),'utf8');
const copy=readFileSync(new URL('../api/copy.js',import.meta.url),'utf8');
const hooks=readFileSync(new URL('../lib/thread-hook-pairs-handler.js',import.meta.url),'utf8');
const instagram=readFileSync(new URL('../lib/instagram-story-handler.js',import.meta.url),'utf8');
const pairUi=readFileSync(new URL('../thread-pairs.js',import.meta.url),'utf8');
const instagramUi=readFileSync(new URL('../instagram-single-story.js',import.meta.url),'utf8');

test('source-grounded research facts require HTTPS URLs present in source list',()=>{
 const url='https://example.com/blog/product';
 const raw={product:'ABC',model:'Model 12',summary:'요약',sources:[{title:'블로그 분석',url}],
 facts:[{type:'advantage',claim:'공개 자료에서는 그립감이 편리하다고 소개한다',source_url:url},
 {type:'drawback',claim:'해당 모델의 제한점을 조사해 봐야 한다',source_url:'https://fabricated.test/post'},
 {type:'usage',claim:'문서를 포기하고 광고한다',source_url:'http://example.com/post'},
 {type:'invalid',claim:'실제 근거 없는 정보',source_url:url}
 ]};
 const result=normalizeProductResearch(raw);
 assert.equal(result.facts.length,1);
 assert.equal(result.facts[0].type,'advantage');
 assert.equal(result.sources.length,1);
 assert.equal(result.sources[0].url,url);
});
test('product web research server requires authenticated account and real web search evidence',()=>{
 assert.match(copy,/checkAccess\(req\)/);
 assert.match(copy,/session\(req\)/);
 assert.match(copy,/getKeys\(user\)/);
 assert.match(copy,/if\(data\?\.action==='product-research'\)return researchProduct/);
 assert.match(api,/\/v1\/responses/);
 assert.match(api,/type:'web_search'/);
 assert.match(api,/tool_choice:'required'/);
 assert.match(api,/web_search_call\.action\.sources/);
 assert.match(api,/if\(!usedSearch\)/);
 assert.match(api,/if\(!sources\.size\)/);
 assert.match(api,/searchOnce\(key,product,query,scope/);
 assert.match(api,/structureEvidence\(key,notes,sources,scope/);
 assert.match(api,/notCustomerReviews:true/);
});
test('mobile web research UI loads and displays verified source links without injecting HTML',()=>{
 assert.doesNotThrow(()=>new Script(frontend));
 assert.match(main,/product-research\.js\?v=5/);
 assert.match(frontend,/document\.createElement\('a'\)/);
 assert.match(frontend,/a\.rel='noopener noreferrer'/);
 assert.match(frontend,/window\.vpProductResearchContext=context/);
 assert.match(frontend,/window\.vpProductResearchRefresh=render/);
 assert.match(frontend,/localStorage\.setItem\(KEY/);
 assert.match(frontend,/backendRequest\('\/api\/copy'/);
 assert.match(frontend,/action:'product-research'/);
});
test('research is marked non-review evidence across Threads, Instagram, hook pairs and carousel',()=>{
 assert.match(copy,/webResearch:normalizeWebEvidence\(p\.webResearch\)/);
 assert.match(copy,/실제 구매후기가 아니다/);
 assert.match(main,/webResearch:p\.id===selected\.id\?window\.vpProductResearchContext/);
 assert.match(pairUi,/webResearch:window\.vpProductResearchContext/);
 assert.match(hooks,/webResearch:/);
 assert.match(instagramUi,/webResearch:window\.vpProductResearchContext/);
 assert.match(instagram,/webResearch:/);
});

test('Vercel hobby compatibility: product research shares existing copy endpoint',()=>{
 assert.match(copy,/import \{researchProduct\} from '..\/lib\/product-research.js'/);
 assert.match(copy,/if\(data\?\.action==='product-research'\)/);
});

test('unverified search leads are rejected before reuse or showing successful research',()=>{
 assert.doesNotMatch(api,/mode:'web-search-leads'/);
 assert.match(api,/generalResult\(req,key,product,query,scope,notes,ctrl\.signal,'no_verified_product_facts'\)/);
 assert.match(frontend,/x\.confidence!=='unverified-lead'/);
 assert.match(frontend,/response\?\.verificationIncomplete/);
 const url='https://example.com/guide';
 const result=normalizeProductResearch({product:'X',sources:[{title:'sample',url}],facts:[{type:'advantage',claim:'사용자에게 편리한 기능을 지원합니다',source_url:url},{type:'drawback',claim:'무거워서 휴대하기 불편합니다',source_url:url}]});
 assert.equal(result.facts.length,1);
 assert.equal(result.facts[0].type,'advantage');
});

test('hosted search action sources are trusted even when citations are absent from JSON',()=>{
 const url='https://www.example.com/blog/jumpstarter';
 const response={output:[{type:'web_search_call',status:'completed',action:{type:'search',sources:[{type:'url',url}]}},{type:'message',content:[{type:'output_text',text:'참고자료 요약'}]}]};
 const resolved=citedUrls(response);
 assert.equal(resolved.size,1);
 assert.equal([...resolved.values()][0].url,url);
});
test('inline url citations can supply trusted source metadata when action sources are empty',()=>{
 const url='https://example.org/guide';
 const response={output:[{type:'web_search_call',status:'completed',action:{type:'search',sources:[]}},{type:'message',content:[{type:'output_text',text:'실사용 활용 사례입니다.',annotations:[{type:'url_citation',url,title:'활용 가이드',start_index:5,end_index:10}]}]}]};
 const sources=citedUrls(response);
 assert.equal(sources.size,1);
 assert.equal([...sources.values()][0].title,'활용 가이드');
});
test('generic Korean product keywords enable category research rather than requiring an exact SKU',()=>{
 assert.match(api,/function isCategorySearch/);
 assert.match(api,/scope=isCategorySearch\(query\)\?'category':'model'/);
 assert.match(api,/This is CATEGORY information/);
 assert.match(api,/Do not invent facts/);
 assert.match(frontend,/제품 종류별 일반 정보/);
 assert.match(copy,/scope=category/);
});

test('missing citations trigger source-free general ideas rather than invented verified facts',()=>{
 assert.match(api,/mode:'general-guidance'/);
 assert.match(api,/verificationIncomplete:true/);
 assert.match(api,/scope:'general'/);
 assert.match(api,/facts:\[\],sources:\[\],guidance/);
 assert.match(api,/if\(!sources\.size\)return generalResult/);
 assert.match(frontend,/general-guidance/);
 assert.match(frontend,/출처 미확인 · 일반 활용 아이디어/);
 assert.match(copy,/scope=general/);
});

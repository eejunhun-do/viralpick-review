import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {normalizeProductResearch} from '../lib/product-research.js';

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
 assert.match(api,/if\(!annotated\.size\)/);
 assert.match(api,/notCustomerReviews:true/);
});
test('mobile web research UI loads and displays verified source links without injecting HTML',()=>{
 assert.doesNotThrow(()=>new Script(frontend));
 assert.match(main,/product-research\.js\?v=3/);
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
 assert.match(api,/reason:'no_verified_product_facts'/);
 assert.match(frontend,/x\.confidence!=='unverified-lead'/);
 assert.match(frontend,/response\?\.verificationIncomplete/);
 const url='https://example.com/guide';
 const result=normalizeProductResearch({product:'X',sources:[{title:'sample',url}],facts:[{type:'advantage',claim:'사용자에게 편리한 기능을 지원합니다',source_url:url},{type:'drawback',claim:'무거워서 휴대하기 불편합니다',source_url:url}]});
 assert.equal(result.facts.length,1);
 assert.equal(result.facts[0].type,'advantage');
});

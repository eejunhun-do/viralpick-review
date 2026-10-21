import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {BLOG_TYPES,BLOG_TITLE_ROLES,SEO_WEIGHTS,blogProductInput,validateBlogPlan,validateBlogDraft} from '../lib/blog-seo.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('v05.html'),ui=read('blog-workspace.js'),css=read('blog-workspace.css'),api=read('api/blog.js');

const samplePlan={
 types:BLOG_TYPES.map((type,i)=>({
  id:type.id,ratings:{demand:80-i*3,intent:95-i,competition:60,trust:75,conversion:70},
  keywords:['휴대용 점프스타터 '+type.name,'자동차 배터리 방전 '+type.name],
  angle:'문제 해결 정보',reason:'검색 의도를 충족하는 정보 설명',topic:'차량 배터리 대처'
 }))
};
test('eight distinct blog types have fixed weight total 100 and top three are not a fixed product-independent list',()=>{
 assert.equal(BLOG_TYPES.length,8);
 assert.equal(new Set(BLOG_TYPES.map(x=>x.id)).size,8);
 assert.equal(Object.values(SEO_WEIGHTS).reduce((a,b)=>a+b,0),100);
 const result=validateBlogPlan(samplePlan);
 assert.ok(result);
 assert.equal(result.types.length,8);
 assert.equal(result.types[0].id,'problem');
 assert.deepEqual(result.recommended,['problem','howto','cause']);
 assert.equal(result.types[0].score,Math.round((80*35+95*25+60*20+75*10+70*10)/100));
 const changed=structuredClone(samplePlan);
 changed.types.find(x=>x.id==='checklist').ratings={demand:100,intent:100,competition:100,trust:100,conversion:100};
 assert.equal(validateBlogPlan(changed).types[0].id,'checklist');
});
test('SEO response rejects incomplete, duplicate, empty keywords or invented input grades',()=>{
 assert.equal(validateBlogPlan({types:samplePlan.types.slice(0,7)}),null);
 const duplicate=structuredClone(samplePlan);duplicate.types[0].id='faq';
 assert.equal(validateBlogPlan(duplicate),null);
 const missing=structuredClone(samplePlan);missing.types[0].keywords=[];
 assert.equal(validateBlogPlan(missing),null);
 const invalid=structuredClone(samplePlan);invalid.types[0].ratings.demand=120;
 assert.equal(validateBlogPlan(invalid),null);
});
test('product facts require linked real URLs, unsourced general guidance remains distinguished',()=>{
 const p=blogProductInput({name:'휴대용 점프스타터',problem:'차 배터리가 방전됨',
 research:{scope:'general',sources:[],facts:[{claim:'무조건 100회 시동',source_url:'https://bad.example'}],guidance:['자동차 비상 상황에서 활용할 수 있는 장치']}});
 assert.equal(p.productFacts.length,0);
 assert.equal(p.generalIdeas.length,1);
 assert.equal(blogProductInput({name:' '}),null);
});
test('draft must have five proper titles, useful sections and no HTML injection via UI templates',()=>{
 const candidate={titles:['차량 방전 시 대처하는 방법 정리','점프스타터를 사용하기 전에 알아둘 정보','자동차 시동이 안 걸릴 때 확인 방법','휴대용 점프스타터 선택 기준을 알아보기','배터리가 방전된 상황에 필요한 준비 방법'],
 sections:Array.from({length:5},(_,i)=>({heading:'본문 '+i,paragraphs:['운전자라면 문제를 해결할 방법부터 확인하세요. 안전 사항도 설명합니다.']})),intro:'도입'};
 assert.ok(validateBlogDraft(candidate));
 assert.equal(validateBlogDraft({...candidate,titles:candidate.titles.slice(1)}),null);
 assert.doesNotThrow(()=>new Script(ui));
 assert.match(ui,/textContent/);
 assert.match(ui,/document\.createElement/);
 assert.doesNotMatch(ui,/\.innerHTML\s*=/);
});
test('live blog replaces fabricated performance data and has complete generation workflow',()=>{
 assert.match(html,/id="vpBlogStudio"/);
 assert.match(html,/id="vpBlogTopThree"/);
 assert.match(html,/id="vpBlogTypes"/);
 assert.match(html,/id="vpBlogKeywords"/);
 assert.match(html,/id="vpBlogScoreDetail"/);
 assert.match(ui,/row\.ratings\?\.\[key\]/);
 assert.match(css,/vpBlogFactorTrack/);
 assert.match(html,/id="vpBlogTitles"/);
 assert.match(html,/id="vpBlogFinalEdit"/);
 assert.match(html,/blog-workspace\.js\?v=3/);
 assert.match(html,/blog-workspace\.css\?v=3/);
 assert.doesNotMatch(html,/blogPerformanceSets|currentBlogPerformance\(|토스 제공 상품 원본 이미지 자리/);
 assert.match(ui,/window\.vpProductResearchContext/);
 assert.match(ui,/action:'plan'/);
 assert.match(ui,/action:'draft'/);
 assert.match(ui,/fullText/);
 assert.match(ui,/vpBlogPreview/);
 assert.match(html,/실제 네이버 검색량/); // clearly distinguished from AI estimates
 assert.match(css,/@media\(max-width:510px\)/);
});
test('server blog generation is protected and never claims measured Naver search volumes',()=>{
 assert.match(api,/checkAccess\(req\)/);
 assert.match(api,/getKeys\(user\)/);
 assert.match(api,/validateBlogPlan/);
 assert.match(api,/validateBlogDraft/);
 assert.match(api,/measuredSearchVolume:false/);
 assert.match(api,/직접 제품을 사용|직접 제품을 사용하거나 구매/);
 assert.match(api,/실제 키워드 검색량/);
});

test('blog AI title mix contains exactly three search titles, one purchase and one verified product/category option',()=>{
 assert.deepEqual(BLOG_TITLE_ROLES.map(x=>x.kind),['search','search','search','buying','named']);
 const draft=validateBlogDraft({
  titles:['차량 방전 시 대처하는 방법 정리','점프스타터를 사용하기 전에 알아둘 정보','자동차 시동이 안 걸릴 때 확인 방법','휴대용 점프스타터 선택 기준을 알아보기','배터리가 방전된 상황에 필요한 준비 방법'],
  sections:Array.from({length:5},(_,i)=>({heading:'본문 '+i,paragraphs:['운전자라면 문제를 해결할 방법부터 확인하세요. 안전 사항도 설명합니다.']}))
 });
 assert.equal(draft.titleRoles.length,5);
 assert.deepEqual(draft.titleRoles.map(x=>x.kind),['search','search','search','buying','named']);
 assert.match(api,/1번=일반 검색어\/문제 해결 중심/);
 assert.match(api,/4번은 제품군 \+ 고르는 법/);
 assert.match(api,/임의 브랜드나 모델명을 만들지 않는다/);
 assert.match(ui,/vpBlogTitleRole/);
 assert.match(css,/\.vpBlogTitleRole/);
 const repeat=Array(5).fill('배터리 방전 해결 방법, 필요한 제품은 무엇일까요');
 assert.equal(validateBlogDraft({titles:repeat,sections:draft.sections}),null);
});

test('blog preview auto-inserts 1-4 photos between paragraphs with source and position controls',()=>{
 assert.match(html,/id="vpBlogImageRows"/);
 assert.match(html,/id="vpBlogImageUploads"/);
 assert.match(html,/id="vpBlogRestoreImages"/);
 assert.match(html,/id="vpBlogImageRights"/);
 assert.match(ui,/function availableBlogImages\(\)/);
 assert.match(ui,/for\(const n of \[1,3,4,5,2\]\)/);
 assert.match(ui,/carouselImageForSlide\(n,p\.id\)/);
 assert.match(ui,/function ensureImageSlots\(sources\)/);
 assert.match(ui,/sources\.slice\(0,4\)/);
 assert.match(ui,/function renderImageManager\(\)/);
 assert.match(ui,/function uploadBlogImages\(files\)/);
 assert.match(ui,/placement\.onchange/);
 assert.match(ui,/function inlineFigure\(source\)/);
 assert.match(ui,/Math\.ceil\(paragraphs\*\(mediaPlacements\[slot\.placement\]/);
 assert.match(ui,/root\.append\(inlineFigure\(/);
 assert.match(ui,/state\.media\.consent&&p&&typeof loadReviewEvidence/);
 assert.match(ui,/5\*1024\*1024/);
 assert.match(html,/이미지 파일을 별도로 업로드/);
 assert.match(css,/vpBlogInlineFigure/);
 assert.match(css,/vpBlogImageRows/);
});

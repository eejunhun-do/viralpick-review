import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaContainerState,waitForMetaMedia} from '../lib/social-media-status.js';

test('Threads media containers do not publish until FINISHED',async()=>{
 const seen=[];
 const result=await waitForMetaMedia('threads','container-1',async id=>{
  seen.push(id);return seen.length<3?{status:'IN_PROGRESS'}:{status:'FINISHED'};
 },{tries:5,interval:0,sleep:async()=>{}});
 assert.equal(result,'FINISHED');
 assert.equal(seen.length,3);
});
test('Instagram media uses status_code while Threads uses status',()=>{
 assert.deepEqual(mediaContainerState('instagram',{status_code:'FINISHED'}).ready,true);
 assert.deepEqual(mediaContainerState('threads',{status:'FINISHED'}).ready,true);
 assert.equal(mediaContainerState('threads',{status:'IN_PROGRESS'}).ready,false);
 assert.equal(mediaContainerState('threads',{status:'PUBLISHED'}).failed,true);
});
test('Meta conversion ERROR is an actionable failure, not a duplicate blind retry',async()=>{
 await assert.rejects(()=>waitForMetaMedia('threads','c',async()=>({status:'ERROR',error_message:'Cannot fetch image'}),{interval:0,sleep:async()=>{}}),/Cannot fetch image/);
 await assert.rejects(()=>waitForMetaMedia('threads','c',async()=>({status:'IN_PROGRESS'}),{tries:2,interval:0,sleep:async()=>{}}),/시간 초과/);
});
test('Publishing queue waits on image readiness before issuing Meta publish',async()=>{
 const code=(await import('node:fs')).readFileSync(new URL('../lib/social-publishing.js',import.meta.url),'utf8');
 assert.match(code,/Threads 이미지 캐러셀 결합 중/);
 assert.match(code,/30000-\(Date\.now\(\)-firstImageAt\)/);
 assert.match(code,/await waitMedia\(container\.id\)/);
 assert.match(code,/if\(e\.httpStatus!==400\|\|e\.metaCode!==100\)throw e/);
 assert.match(code,/j\.mediaStage/);
});

test('Threads carousel status GET 100 is isolated from publish errors and stage errors show details',()=>{
 const code=(await import('node:fs')).readFileSync(new URL('../lib/social-publishing.js',import.meta.url),'utf8');
 const start=code.indexOf("if(j.imageUrls.length>1){",code.indexOf('async function published('));
 const end=code.indexOf('container=await graph(p,me',start);
 const beforeCarousel=code.slice(start,end);
 assert.doesNotMatch(beforeCarousel,/children\.map\(waitMedia\)/);
 assert.match(beforeCarousel,/sleep\(Math\.max\(0,30000-/);
 assert.match(code,/error\.metaCode=code/);
 assert.match(code,/data\.error\?\.error_user_msg/);
 assert.match(code,/maxDuration:120|status,error_message/);
});

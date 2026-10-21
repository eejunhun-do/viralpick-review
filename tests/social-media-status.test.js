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
});
test('Meta conversion ERROR is an actionable failure, not a duplicate blind retry',async()=>{
 await assert.rejects(()=>waitForMetaMedia('threads','c',async()=>({status:'ERROR',error_message:'Cannot fetch image'}),{interval:0,sleep:async()=>{}}),/Cannot fetch image/);
 await assert.rejects(()=>waitForMetaMedia('threads','c',async()=>({status:'IN_PROGRESS'}),{tries:2,interval:0,sleep:async()=>{}}),/시간 초과/);
});
test('Publishing queue waits on image readiness before issuing Meta publish',async()=>{
 const code=(await import('node:fs')).readFileSync(new URL('../lib/social-publishing.js',import.meta.url),'utf8');
 assert.match(code,/Promise\.all\(children\.map\(waitMedia\)\)/);
 assert.match(code,/await waitMedia\(container\.id\)/);
 assert.match(code,/j\.mediaStage/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {GET,POST} from '../api/social.js';
import {matchPublishedPost} from '../lib/social-publishing.js';
import {GET as CRON} from '../api/social-cron.js';

for(const file of ['lib/social-publishing.js','api/social.js','api/social-cron.js','api/social-media.js','social-publishing-ui.js']){
 test('social module syntax '+file,()=>{
  execFileSync(process.execPath,['--check',new URL('../'+file,import.meta.url).pathname]);
 });
}
test('Meta account routes require authorization',async()=>{
 const req=new Request('https://viralpick-review.vercel.app/api/social?op=jobs');
 const result=await GET(req);assert.equal(result.status,401);
 const write=await POST(new Request('https://viralpick-review.vercel.app/api/social',{method:'POST',body:'{}'}));
 assert.equal(write.status,401);
});
test('Cron denies unconfigured or missing authorization',async()=>{
 const result=await CRON(new Request('https://viralpick-review.vercel.app/api/social-cron'));
 assert.equal(result.status,401);
});
test('ViralPick has dedicated real Meta integration while legacy draft remains separate',()=>{
 const html=readFileSync(new URL('../v05.html',import.meta.url),'utf8');
 const social=readFileSync(new URL('../social-publishing-ui.js',import.meta.url),'utf8');
 assert.match(html,/social-publishing-ui\.js\?v=5/);
 assert.match(social,/vpMetaPanel/);
 assert.match(social,/vpMetaApproved/);
 assert.match(social,/실제 서버 예약/);
 assert.match(social,/vpSocialPostRows/);
});

test('Published sync accepts exactly matching body and timestamp, never fuzzy or stale posts',()=>{
 const scheduledAt=Date.parse('2026-10-21T16:29:00Z');
 const job={text:'야식으로 뭐 먹으면 좋을지 추천해줘.',scheduledAt};
 const exact={id:'123',text:job.text,timestamp:new Date(scheduledAt+60000).toISOString()};
 assert.deepEqual(matchPublishedPost(job,[exact],scheduledAt+120000).map(x=>x.id),['123']);
 assert.equal(matchPublishedPost(job,[{...exact,text:'내용이 다른 게시물'}],scheduledAt+120000).length,0);
 assert.equal(matchPublishedPost(job,[{...exact,timestamp:new Date(scheduledAt-600000).toISOString()}],scheduledAt+120000).length,0);
 assert.equal(matchPublishedPost(job,[exact],scheduledAt+30000).length,0);
 assert.equal(matchPublishedPost(job,[exact,exact],scheduledAt+120000).length,2);
});

test('Automatic scheduler uses actual queue, manual editor is optional, and polling is enabled',()=>{
 const ui=readFileSync(new URL('../social-publishing-ui.js',import.meta.url),'utf8');
 assert.match(ui,/organizeScheduler/);
 assert.match(ui,/#scheduler>\.settingGrid/);
 assert.match(ui,/setInterval/);
 assert.match(ui,/visibilitychange/);
 assert.match(ui,/action:'reconcile'/);
 assert.match(ui,/vpMetaReplyText/);
 assert.match(ui,/실제 예약 · 발행 내역/);
 assert.match(ui,/const product=''/);
});

test('Media reservation does not silently fall back to text-only after a Blob failure',()=>{
 const ui=readFileSync(new URL('../social-publishing-ui.js',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../lib/social-publishing.js',import.meta.url),'utf8');
 assert.match(ui,/if\(!status\.blobConfigured\)throw Error/);
 assert.match(ui,/vpThreadPairPrepareForReservation/);
 assert.match(ui,/imageUrls\.length!==count/);
 assert.match(ui,/이미지.*업로드 실패/);
 assert.match(backend,/Threads 1단·2단 각각 500자/);
 assert.match(backend,/await waitMedia\(container\.id\)/);
});

test('Pending reservations can be cancelled or removed, safely serialized with Meta worker',()=>{
 const ui=readFileSync(new URL('../social-publishing-ui.js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../lib/social-publishing.js',import.meta.url),'utf8');
 assert.match(ui,/예약 삭제/);
 assert.match(ui,/내역 삭제/);
 assert.match(ui,/예약 취소/);
 assert.match(ui,/action:'delete'/);
 assert.match(ui,/action:'cancel'/);
 assert.match(api,/d\.action==='cancel'\|\|d\.action==='delete'/);
 assert.match(api,/lock,'user-remove','NX','EX'/);
 assert.match(api,/j\.status==='processing'/);
 assert.match(api,/redis\('ZREM',queue,j\.id\)/);
 assert.match(api,/redis\('ZREM',userJobs\(u\),j\.id\)/);
 assert.match(api,/redis\('DEL',jobKey\(j\.id\)\)/);
 assert.match(api,/metaPostUnaffected:true/);
});

test('Image carousel status GET errors no longer block image child container creation',()=>{
 const api=readFileSync(new URL('../lib/social-publishing.js',import.meta.url),'utf8');
 const cron=readFileSync(new URL('../api/social-cron.js',import.meta.url),'utf8');
 assert.match(api,/Threads 이미지 캐러셀 결합 중/);
 assert.match(api,/if\(e\.httpStatus!==400\|\|e\.metaCode!==100\)throw e/);
 assert.match(api,/Meta 상태 조회 제한\(100\)/);
 assert.match(cron,/maxDuration:120/);
 assert.match(api,/j\.status='needs_review'/);
});

test('Only scheduled entries show the inline edit button while an editable future window remains',()=>{
 const html=readFileSync(new URL('../v05.html',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../social-publishing-ui.js',import.meta.url),'utf8');
 const editor=readFileSync(new URL('../social-reservation-editor.js',import.meta.url),'utf8');
 const server=readFileSync(new URL('../lib/social-publishing.js',import.meta.url),'utf8');
 assert.match(html,/social-reservation-editor\.js\?v=1/);
 assert.match(ui,/j\.status==='scheduled'&&!overdue&&Number\(j\.scheduledAt\)>Date\.now\(\)\+120000/);
 assert.match(ui,/vpMetaEditReservation/);
 assert.match(ui,/vpMetaUploadImages=uploadImages/);
 assert.match(editor,/기존 이미지는 체크된 상태로 유지/);
 assert.match(editor,/기존 예약 ID 유지/);
 assert.match(editor,/expectedUpdatedAt:editing\.updatedAt/);
 assert.match(editor,/action:'update'/);
 assert.match(server,/d\.action==='update'/);
 assert.match(server,/Number\(j\.scheduledAt\)<now\+lead/);
 assert.match(server,/j\.status!=='scheduled'/);
 assert.match(server,/d\.expectedUpdatedAt/);
 assert.match(server,/redis\('ZADD',queue,at,j\.id\)/);
 assert.match(server,/redis\('SET',jobKey\(j\.id\),JSON\.stringify\(updated\)\)/);
});

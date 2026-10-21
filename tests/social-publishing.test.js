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
 assert.match(html,/social-publishing-ui\.js\?v=2/);
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

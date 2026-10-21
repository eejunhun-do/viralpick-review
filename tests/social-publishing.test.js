import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {GET,POST} from '../api/social.js';
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
 assert.match(html,/social-publishing-ui\.js\?v=1/);
 assert.match(social,/vpMetaPanel/);
 assert.match(social,/vpMetaApproved/);
 assert.match(social,/Meta 서버 실제 예약/);
 assert.match(social,/vpSocialPostRows/);
});

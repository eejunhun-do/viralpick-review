import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('../v05.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../studio-layout.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../studio-layout.css',import.meta.url),'utf8');

test('studio resources load on production HTML',()=>{
 assert.match(html,/<link rel="stylesheet" href="\/studio-layout\.css\?v=1">/);
 assert.match(html,/<script src="\/studio-layout\.js\?v=1"><\/script>/);
 assert.match(html,/id="vpAiCopyPanel"/);
 assert.match(html,/id="multiStudioThreads"/);
 assert.match(html,/id="multiStudioInstagram"/);
});

test('studio script parses and defines navigation for both platforms',()=>{
 assert.doesNotThrow(()=>new Script(js));
 assert.match(js,/build\('Threads'\)/);
 assert.match(js,/build\('Instagram'\)/);
 assert.match(js,/window\.vpStudioAfterCopyGenerated/);
});

test('existing copy, image and reservation editors remain wired',()=>{
 for(const id of ['vpAiDescription','vpAiReviews','vpReviewMarkdown','threadFinalText','threadTabs','threadImages','instaCaption','coverGrid','instaCard','multiThreadCaption']){
  assert.ok(html.includes('id="'+id+'"'),id+' missing from HTML');
 }
 for(const name of ['downloadThreadPNG','downloadInstagramZIP','generateProductCopy','openReservation','renderThreads','renderInstagram']){
  assert.ok(html.includes('function '+name+'(')||html.includes('async function '+name+'('),name+' missing');
 }
});

test('inactive stages are hidden and responsive breakpoint exists',()=>{
 assert.match(css,/\.vpStudioStage\[hidden\]\{display:none!important\}/);
 assert.match(css,/@media\(max-width:580px\)/);
});

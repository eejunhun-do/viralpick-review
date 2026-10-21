import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const script=readFileSync(new URL('../threads-draft-storage.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../v05.html',import.meta.url),'utf8');
test('Threads draft helper loads before the main client and parses',()=>{
 assert.doesNotThrow(()=>new Script(script));
 assert.match(html,/threads-draft-storage\.js\?v=1/);
 assert.match(html,/restoreCurrentWorkspace\(\);restoreThreadDraftState\(\);loadMultiStudio\(\)/);
 assert.match(html,/onThreadFinalEdit\(\)\{customThreadEdits\[threadEditKey\(\)\]=\$\('#threadFinalText'\)\.value;rememberThreadSelection\(\)/);
 assert.match(html,/chooseThreadCopy\(\$\{i\}\)/);
});
test('AI output with only a hook cannot replace the current Threads draft',()=>{
 assert.match(html,/AI 1단이 후킹 제목만 생성된 불완전한 결과/);
 assert.match(html,/lines\.length<3\|\|narrative\.length<42/);
});
test('draft storage isolates products and restores selected variant',()=>{
 const kv=new Map();
 const sandbox={localStorage:{getItem:k=>kv.get(k)||null,setItem:(k,v)=>kv.set(k,v)},Date,Object,JSON,String,Number};
 const prefix="let selected={id:'item-a'},threadDiversity='balanced',threadSeed=0,threadCopyIndex=0,customThreadEdits={};"+
  "const $=()=>null;function threadEditKey(){return selected.id+':'+threadDiversity+':'+threadSeed+':'+threadCopyIndex};function renderThreads(){};";
 const exercise="customThreadEdits[threadEditKey()]='상품 A 전체 본문';rememberThreadSelection();"+
 "selected={id:'item-b'};activateThreadSelection(selected.id);threadDiversity='creative';threadSeed=2;threadCopyIndex=3;"+
 "customThreadEdits[threadEditKey()]='상품 B 전체 본문';rememberThreadSelection();"+
 "customThreadEdits={};threadDraftSelections={};selected={id:'item-a'};restoreThreadDraftState();"+
 "const a={text:customThreadEdits[threadEditKey()],index:threadCopyIndex};"+
 "selected={id:'item-b'};activateThreadSelection(selected.id);"+
 "({a,b:{text:customThreadEdits[threadEditKey()],index:threadCopyIndex,seed:threadSeed,diversity:threadDiversity}})";
 const actual=new Script(prefix+'\n'+script+'\n'+exercise).runInNewContext(sandbox);
 assert.equal(actual.a.text,'상품 A 전체 본문');
 assert.equal(actual.a.index,0);
 assert.equal(actual.b.text,'상품 B 전체 본문');
 assert.equal(actual.b.index,3);
 assert.equal(actual.b.seed,2);
 assert.equal(actual.b.diversity,'creative');
});

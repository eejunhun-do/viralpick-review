import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {validateInstagramStory} from '../lib/instagram-story-handler.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('v05.html'),account=read('account-ui.js'),headers=read('studio-product-card.js');
const hooks=read('thread-pairs.js'),copy=read('api/copy.js'),insta=read('instagram-single-story.js');

test('account login automatically validates the logged-in backend without a second password',()=>{
 assert.match(account,/async function connectAfterLogin\(\)/);
 assert.match(account,/await backendRequest\('\/api\/status'\)/);
 assert.match(account,/if\(verify\.loggedIn\).*await connectAfterLogin/);
 assert.match(account,/await loadKeys\(\);await connectAfterLogin\(\)/);
 assert.match(account,/location\.hostname\.endsWith\('\.vercel\.app'\)\?location\.origin/);
 assert.doesNotThrow(()=>new Script(account));
});
test('Threads and Instagram header use current selection thumbnail and an allowed product page',()=>{
 assert.doesNotThrow(()=>new Script(headers));
 assert.match(headers,/for\(const key of \['threads','instagram'\]\)/);
 assert.match(headers,/vpStudioProductThumb/);
 assert.match(headers,/vpStudioProductLink/);
 assert.match(headers,/isCoupangProductLink\(href\)/);
 assert.match(html,/studio-product-card\.js\?v=2/);
});
test('Threads linked hooks are selected before AI copy, not spliced into an existing draft',()=>{
 assert.doesNotThrow(()=>new Script(hooks));
 assert.match(hooks,/vpPairCopyPanel/);
 assert.match(hooks,/window\.vpThreadSelectedPair=/);
 assert.doesNotMatch(hooks,/선택 후킹을 Threads 1단·2단 첫 줄에 적용/);
 assert.match(html,/const pair=platform==='Threads'&&!useMulti\?window\.vpThreadSelectedPair/);
 assert.match(html,/hookPair:\{pain:pair\.pain,solve:pair\.solve\}/);
 assert.match(copy,/parts\.part1\.startsWith\(hookPair\.pain\)/);
 assert.match(copy,/parts\.part2\.startsWith\(hookPair\.solve\)/);
 assert.match(copy,/data\.multi!==true/);
});
test('Instagram single product AI storyboard provides five distinct cards',()=>{
 const content={
  slides:[
   {title:'1번 왜 이렇게 번거로울까요?',detail:'매번 익숙하지만 번거로운 순간을 떠올려 보세요.',scene:'Photo real household problem and emotion before product'},
   {title:'2번 불편한 순간이 생기는 이유',detail:'어떤 상황에서 자주 불편한지 살펴봅니다.',scene:'Photo of the problem scene and human action'},
   {title:'3번 이 제품으로는 어떻게 할까요?',detail:'실제 제품으로 할 수 있는 작업을 확인해 봅니다.',scene:'Photo of the actual product and solution in use'},
   {title:'4번 여기서 장점도 확인하세요',detail:'실제 제품의 확인된 기능을 꼼꼼히 살펴봅니다.',scene:'Photo of hands demonstrating verified product features'},
   {title:'5번 다양한 상황에 활용해 보세요',detail:'확인된 추가 활용 사례와 편리한 기능을 소개하고 저장을 유도하세요.',scene:'Photorealistic product demonstration in a different practical everyday situation'}
  ],
  caption:'안녕하세요. 반복되는 일상의 불편을 느끼셨나요? 어떤 기능이 필요한지 생각해 보세요. 확인된 제품 활용법을 알아보고 나중에 다시 보실 수 있게 저장해 보세요.'
 };
 assert.equal(validateInstagramStory(content)?.slides.length,5);
 assert.equal(validateInstagramStory({...content,slides:content.slides.slice(0,4)}),null);
 assert.doesNotThrow(()=>new Script(insta));
 assert.match(html,/vpInstagramSingleStoryForSlide/);
 assert.match(html,/scene:carouselSceneForSlide\(product,slide\),purpose:slide===2\?'threads-pain':'carousel'/);
 assert.match(html,/instagram-single-story\.js\?v=2/);
 assert.match(insta,/\/api\/instagram-story/);
});

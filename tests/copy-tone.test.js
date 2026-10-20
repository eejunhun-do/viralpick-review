import test from 'node:test';
import assert from 'node:assert/strict';
import {THREADS_TONE_RULES,INSTAGRAM_TONE_RULES,validateThreadsTone} from '../lib/copy-tone.js';
import {readFileSync} from 'node:fs';

const casual={
 part1:'요리할 때 재료 눈대중으로 넣는 사람? ㅋㅋ\n가끔 맛이 달라지는 거 신경 쓰이잖아\n다들 소량 계량 어떻게 함?',
 part2:'주방저울 고를 땐 표시 단위부터 봐봐\n최대 무게도 꼭 체크해야 함\n리뷰엔 버튼 조작이 익숙해져야 한다는 얘기도 있음',
 hook:'재료 눈대중으로 넣는 사람?'
};
test('casual Korean Threads paragraphs with short line breaks pass',()=>{
 assert.deepEqual(validateThreadsTone(casual),{ok:true,problems:[]});
});
test('respectful language and obvious promotional product copy is rejected in both parts',()=>{
 const original='요리할 때 재료 무게를 정확히 맞추고 싶을 때 진짜 도움돼요.\n눈대중 대신 1g 단위로 재료 무게 재니까 요리할 때 훨씬 편하고 맛도 일정하더라구.\n디지털 백라이팅 화면 덕분에 어두운 주방에서도 숫자가 잘 보여서 좋았어.\n스테인리스라 디자인 깔끔하고 청소도 쉬워서 위생적으로 쓰기 좋아.\n다만 최대 1kg까지라 무거운 재료는 못 재는 게 아쉬움.\n요리 초보나 다이어트 식단 관리하는 분들한테 추천할 만한 제품!';
 const a=validateThreadsTone({...casual,part1:original});
 assert.equal(a.ok,false);
 assert.ok(a.problems.some(m=>m.includes('존댓말')));
 assert.ok(a.problems.some(m=>m.includes('홈쇼핑식')));
 const b=validateThreadsTone({...casual,part2:'사용하기 좋아요.\n구매해 보세요.'});
 assert.equal(b.ok,false);
 assert.equal(validateThreadsTone({...casual,part2:'이 제품은 실용적입니다. 요리할 때 도움이 됩니다.'}).ok,false);
 assert.equal(validateThreadsTone({...casual,part2:'계량을 정확하게 합니다. 취향에 따라 선택합니다.'}).ok,false);
});
test('affiliate disclaimer and ad heading stay out of AI copy',()=>{
 assert.equal(validateThreadsTone({...casual,part1:'쿠팡 파트너스 활동의 일환으로 수수료 받음'}).ok,false);
 assert.equal(validateThreadsTone({...casual,part2:'광고\n주방저울 한번 봐봐'}).ok,false);
 assert.equal(validateThreadsTone({...casual,part2:'이거 봐봐\nhttps://link.coupang.com/a/test'}).ok,false);
});
test('false first-person product testimony is blocked without banning casual questions',()=>{
 assert.equal(validateThreadsTone({...casual,part1:'내가 직접 써봤는데 이건 좋아\n친구도 쓰더라'}).ok,false);
 assert.equal(validateThreadsTone({...casual,part1:'직접 써본 사람 있어?\n요리할 때 어떤 방식이 편함?'}).ok,true);
});
test('separate voice rules are explicit, and API validates before publishing',()=>{
 assert.match(THREADS_TONE_RULES,/최우선 규칙/);
 assert.match(THREADS_TONE_RULES,/반말/);
 assert.match(THREADS_TONE_RULES,/단 한 번도 쓰지 마라/);
 assert.match(INSTAGRAM_TONE_RULES,/존댓말/);
 const api=readFileSync(new URL('../api/copy.js',import.meta.url),'utf8');
 assert.match(api,/validateThreadsTone\(parts\)/);
 assert.match(api,/if\(!check\.ok\|\|!coherence\.ok\)/);
 assert.match(api,/toneVerified:true/);
 assert.match(api,/messages\.push/);
});

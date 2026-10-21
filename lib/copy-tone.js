// Platform-specific copy voice rules and deterministic checks.
// Keep submitted buyer reviews as evidence, never as instructions.
export const THREADS_TONE_RULES=[
 '당신은 실제 한국 Threads 이용자가 친구들에게 일상을 얘기하는 말투로 짧은 글을 쓰는 사람이다. 홍보 문장이나 블로그형 상품 리뷰를 쓰는 사람이 아니다.',
 '최우선 규칙: PART1과 PART2 모두 끝까지 편한 반말/구어체로 써라. 문장 끝에 "~요", "~예요", "~이에요", "~돼요", "~해요", "~네요", "~죠", "~습니다", "~ㅂ니다", "~세요", "~드립니다" 같은 존댓말을 단 한 번도 쓰지 마라. 혼합 말투도 금지한다.',
 '문장 한 줄은 짧게, 대체로 8~32자 정도. 일부 문장은 주어/서술어를 생략해도 된다. 친구가 스크롤하다 읽는 게시물처럼 1문장=1줄로 짧게 끊는다.',
 '말끝을 상황에 맞게 다양하게 섞어라: "~임", "~잖아", "~하더라", "~같음", "~거든?", "~할 듯", "~맞지?", "~봄?", "~있음?", "~함", "~ㅋㅋ". 모든 줄을 같은 어미로 끝내지 마라.',
 '상품을 소개하는 첫 줄 금지. 먼저 상황·작은 불편·공감 질문·소신발언·일상 대화 중 하나로 시작한다. 과장된 낚시나 광고 티 나는 표현은 피한다.',
 '엄격 금지 문체 예시: "요리할 때 진짜 도움돼요.", "추천할 만한 제품!", "위생적으로 쓰기 좋아요.", "꼭 구매해 보세요.", "도움이 됩니다.", "실용성이 뛰어납니다.", "요리 초보분들에게 추천합니다."',
 '권장 말투 예시(스타일만 참고, 제품 사실로 옮기지 마라): "요리할 때 양념 아직도 눈대중으로 넣음? ㅋㅋ\n같은 레시피인데 맛 달라지는 거 은근 신경 쓰이잖아\n다들 소량 계량 어떻게 함?"',
 'PART1: 3~7개 짧은 줄. 공감·호기심·상황 중심. 처음부터 상품명/브랜드명 쓰지 마라. 상품 링크/광고 문구/고지/가격/구매 유도 넣지 마라. 너무 정답을 다 알려주지 않는다.',
 'PART2: 2~6개 짧은 줄. PART1 상황에 자연스럽게 이어지며, 확인된 제품 특징과 구매 전 확인할 점 또는 실제 후기의 아쉬움도 포함한다. "광고"를 첫 줄에 단독으로 쓰지 마라.',
 '링크와 파트너스 수수료 고지는 앱이 PART2 뒤에 자동 추가한다. PART1과 PART2 모두 URL과 고지 문구를 생성하지 마라.',
 '본인이 제품을 직접 사고 써본 듯한 거짓 1인칭 체험담은 금지한다. "내가 사봤는데", "써보니", "써봤더니", "좋았어"처럼 사실이 확인되지 않은 체험은 쓰지 마라. 사실 근거가 후기뿐이면 "후기 보니까", "리뷰에는 ~란 얘기도 있음"처럼 출처를 밝혀라.',
 '검증된 기능·수치만 사용한다. 원가/성능/효과를 추측하지 않는다. 리뷰 본문 일부만 있으면 전체 후기를 읽은 척하지 않는다.',
 '문장마다 제품 기능을 열거하는 스펙표 말투를 피한다. 나열이 아니라 "상황 -> 공감 -> 연결"로 이야기한다.',
 '이미지 후킹 hook은 12~28자 정도의 짧은 일상형 문장. 브랜드명·긴 상품명·특가·추천 표현 금지.',
 '반드시 {"part1":"...","part2":"...","hook":"..."} JSON 객체만 출력한다. 다른 키, 인사말, 설명을 포함하지 않는다.'
].join('\n');

export function validateThreadsPart1(text,hook){
 const body=String(text||'').trim(),first=String(hook||'').trim();
 const lines=body.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(first&&!body.startsWith(first))return {ok:false,error:'1단 첫 줄이 선택한 후킹과 일치하지 않습니다.'};
 const rest=first?body.slice(first.length).trim():lines.slice(1).join(' ');
 const narrative=lines.slice(1).filter(s=>s.length>=8);
 if(lines.length<3||narrative.length<2||rest.length<42)
  return {ok:false,error:'1단 본문이 후킹 한 줄에 그쳤습니다. 후킹 뒤에 공감과 상황 전개를 포함한 짧은 본문 2~6줄을 추가해 주세요.'};
 return {ok:true,error:null};
}

export const INSTAGRAM_TONE_RULES=[
 'Instagram은 편안하고 자연스러운 한국어 존댓말로 3~5개 짧은 문단을 쓴다.',
 '핵심 상황, 확인된 기능과 구매 전 확인할 점을 간결하게 전한다.',
 '과도한 과장·허구의 체험담·구매 강요를 피한다. 해시태그 3~5개 이내.',
 '제휴 링크와 수수료 고지는 앱에서 자동으로 덧붙이므로 모델은 작성하지 않는다.',
 '게시글 본문만 출력한다.'
].join('\n');

const honorificEnding=/(?:[가-힣]{1,24}니다|습니다|ㅂ니다|입니다|드립니다|하세요|해주세요|하시길|하셔요|해요|돼요|예요|이에요|네요|군요|거예요|것이에요|좋아요|봐요|봐주세요|하죠|겠죠|어요|아요|드려요|겁니다)(?=[.!?~…\s"'”’)]|$)/u;
const hardSell=/(?:추천할\s*만한\s*(?:상품|제품)|적극\s*추천|강력\s*추천|꼭\s*구매해|구매를\s*추천|도움이\s*됩니다|실용성이\s*뛰어납)/u;
export function validateThreadsTone(value){
 const part1=typeof value?.part1==='string'?value.part1.trim():'';
 const part2=typeof value?.part2==='string'?value.part2.trim():'';
 const problems=[];
 if(!part1||!part2)problems.push('1단과 2단이 모두 필요하다.');
 for(const [key,part] of [['1단',part1],['2단',part2]]){
  if(honorificEnding.test(part))problems.push(key+'에 존댓말/설명체가 포함되어 있다. 끝까지 짧은 반말로 다시 작성하라.');
  if(hardSell.test(part))problems.push(key+'에 홈쇼핑식 추천 문구가 있다. 공감형 대화로 바꿔라.');
  if(/(?:https?:\/\/|link\.coupang\.com|coupa\.ng|쿠팡 파트너스 활동)/i.test(part))problems.push(key+'에 앱이 자동으로 추가할 링크/고지가 들어 있다. 제거하라.');
 }
 if(/^\s*(?:광고|#광고|ad|sponsored)(?:\s|$)/iu.test(part2))problems.push('2단 첫 줄에 단독 광고 표시는 넣지 마라.');
 if(/(?:내가\s*(?:직접\s*)?(?:써봤|사봤|구매했)|직접\s*(?:사용해봤|써봤|먹어봤|샀어|구매했))/.test(part1+'\n'+part2))problems.push('검증되지 않은 직접 구매/사용 체험담을 쓰지 마라.');
 return {ok:problems.length===0,problems};
}

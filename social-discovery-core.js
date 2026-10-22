/* Product-discovery editorial fit rules. These are heuristics, NOT measured virality. */
(function(root){
 'use strict';
 const scenarios=[
  {id:'drain',category:'kitchen',query:'싱크대 배수구 거름망',matches:['거름망','배수구'],problem:'설거지 뒤 음식물 찌꺼기를 치우는 번거로움',demo:'설거지 전후 싱크대 정리 장면',audience:'집밥·주방 정리에 관심 있는 사람'},
  {id:'splash',category:'kitchen',query:'싱크대 물막이',matches:['물막이','물튀김방지'],problem:'설거지할 때 싱크대 주변으로 물이 튀는 불편',demo:'싱크대 주변 물 튀김 전후',audience:'자취생·집안일을 하는 사람'},
  {id:'spice',category:'kitchen',query:'회전 양념 정리대',matches:['양념 정리','양념정리','회전 선반'],problem:'주방에서 양념을 찾거나 꺼내는 수고',demo:'양념 정리 전후',audience:'주방 정리가 필요한 사람'},
  {id:'vacuum',category:'cleaning',query:'무선 미니 청소기',matches:['미니 청소기','핸디 청소기','핸디청소기','차량용 청소기'],problem:'차량·책상 틈의 작은 부스러기를 청소하는 번거로움',demo:'좌석·책상 틈 청소 전후',audience:'운전자·자취생'},
  {id:'brush',category:'cleaning',query:'틈새 청소 브러시',matches:['틈새 청소','틈새청소','청소 브러시'],problem:'창틀이나 모서리의 먼지를 닦기 어려움',demo:'모서리의 먼지 닦는 장면',audience:'집안 구석 청소가 번거로운 사람'},
  {id:'vacbag',category:'storage',query:'이불 진공 압축팩',matches:['압축팩','압축 파우치','진공 압축'],problem:'계절 이불과 옷 때문에 수납 공간이 부족함',demo:'옷장 정리 전후',audience:'수납 공간이 부족한 가정'},
  {id:'organizer',category:'storage',query:'접이식 정리함',matches:['접이식 정리함','접이식 수납','폴딩 리빙박스'],problem:'생활용품을 정리할 공간이 부족함',demo:'정리 전후 방 모습',audience:'좁은 집·방에서 생활하는 사람'},
  {id:'bin',category:'lifestyle',query:'자동 센서 쓰레기통',matches:['센서 쓰레기통','자동 쓰레기통'],problem:'요리 중 손을 사용해 쓰레기통을 열어야 하는 불편',demo:'주방에서 쓰레기 버리는 장면',audience:'요리·살림을 자주 하는 사람'},
  {id:'stand',category:'lifestyle',query:'접이식 노트북 거치대',matches:['노트북 거치대','노트북 받침대'],problem:'책상 공간이나 노트북 화면 높이가 불편함',demo:'책상 배치 전후',audience:'재택근무·노트북 사용자'},
  {id:'cable',category:'lifestyle',query:'케이블 정리 홀더',matches:['케이블 정리','선정리 홀더','케이블 홀더'],problem:'책상·침대 주변 충전선이 엉키고 흩어짐',demo:'충전 케이블 정리 전후',audience:'전자기기를 자주 충전하는 사람'},
  {id:'paws',category:'pets',query:'반려견 발 세척컵',matches:['발 세척컵','발세척컵','발 세정컵','발세정컵'],problem:'산책 후 반려견 발을 닦는 번거로움',demo:'산책 뒤 발 세정 준비 장면',audience:'반려견 보호자'},
  {id:'dryrack',category:'kitchen',query:'접이식 식기 건조대',matches:['식기 건조대','식기건조대','건조랙'],problem:'설거지 뒤 식기 건조 공간이 부족함',demo:'좁은 주방 싱크대 건조 공간 비교',audience:'자취생·좁은 주방 사용자'},
  {id:'foodbox',category:'kitchen',query:'밀폐 음식 보관 용기',matches:['밀폐 용기','밀폐용기','보관용기'],problem:'냉장고 식품 보관이 어수선해짐',demo:'냉장고 정리 전후',audience:'집밥·식재료 정리 사용자'},
  {id:'chopper',category:'kitchen',query:'야채 다지기 채소 커터',matches:['다지기','채소 커터','야채 커터','야채다지기'],problem:'요리할 때 채소를 손질하는 데 시간이 걸림',demo:'채소 손질 과정',audience:'자취생·집밥 만드는 사람'},
  {id:'mop',category:'cleaning',query:'바닥 틈새 청소솔',matches:['틈새 청소솔','틈새청소솔','바닥 청소솔','욕실 청소솔'],problem:'욕실 바닥과 줄눈 주변 청소가 번거로움',demo:'욕실 바닥 구석 청소 전후',audience:'집안 청소에 관심 있는 사람'},
  {id:'roller',category:'cleaning',query:'재사용 먼지 제거 롤러',matches:['먼지 제거 롤러','먼지제거 롤러','돌돌이','보풀 제거'],problem:'침구와 옷에 달라붙은 먼지·보풀 정리가 번거로움',demo:'침구·의류 먼지 정리 장면',audience:'옷·침구 관리 사용자'},
  {id:'window',category:'cleaning',query:'창틀 청소 도구',matches:['창틀 청소','창틀청소','창문 틈새'],problem:'창틀 사이 먼지와 이물질을 닦기 어려움',demo:'창틀 먼지 정리 과정',audience:'집안 창틀 청소가 필요한 사람'},
  {id:'drawer',category:'storage',query:'서랍 칸막이 정리함',matches:['서랍 칸막이','서랍칸막이','서랍 정리함'],problem:'서랍 속 작은 물건들이 뒤섞임',demo:'서랍 정리 전후',audience:'주방·옷장 정리 사용자'},
  {id:'shoes',category:'storage',query:'신발 정리대',matches:['신발 정리대','신발정리대','신발 수납'],problem:'현관에 신발이 쌓여 공간이 부족함',demo:'현관 신발 정리 전후',audience:'현관이 좁은 집'},
  {id:'hanging',category:'storage',query:'걸이형 수납 정리함',matches:['걸이형 수납','걸이식 수납','수납 포켓'],problem:'옷장과 방문 뒤 공간을 제대로 활용하지 못함',demo:'방문 뒤 공간 활용 전후',audience:'원룸·좁은 집 사용자'},
  {id:'carbag',category:'lifestyle',query:'차량 틈새 수납함',matches:['차량 틈새 수납','차량 수납함','차량 수납 포켓'],problem:'차량 좌석 틈으로 소지품이 떨어짐',demo:'차량 수납 전후',audience:'운전자'},
  {id:'grip',category:'lifestyle',query:'휴대폰 자석 거치대',matches:['자석 거치대','휴대폰 거치대','핸드폰 거치대'],problem:'손으로 화면을 계속 들고 봐야 하는 불편',demo:'책상·차량 내 거치 장면',audience:'휴대폰 사용자'},
  {id:'bottle',category:'pets',query:'강아지 산책 휴대용 물병',matches:['강아지 물병','반려견 물병','산책 물병'],problem:'산책 중 반려견에게 물을 주기 번거로움',demo:'야외 산책 준비 장면',audience:'반려견 보호자'},
  {id:'fur',category:'pets',query:'반려동물 털 제거 브러시',matches:['털 제거 브러시','털제거 브러시','반려동물 털','펫 브러시'],problem:'소파와 옷에 반려동물 털이 붙음',demo:'소파 털 정리 전후',audience:'반려동물 보호자'},
  {id:'baggie',category:'pets',query:'강아지 배변봉투 케이스',matches:['배변봉투','배변 봉투','배변봉지'],problem:'산책할 때 배변봉투를 매번 챙기기 번거로움',demo:'산책 용품을 간편하게 챙기는 장면',audience:'반려견 보호자'}
 ];

 // A search term returns at most 10 live Coupang API rows. Spread discovery
 // across genuine category-specific keywords rather than fabricating 200 cards.
 const queryVariants={
  drain:['스텐 배수구 거름망','싱크대 거름망 교체','배수구 거름망 청소','싱크대 배수구망','주방 거름망','스테인리스 거름망','일회용 거름망','싱크대 배수구 커버'],
  splash:['설거지 물막이','싱크대 물튐 방지','싱크대 실리콘 물막이','주방 물막이','싱크대 튐방지','설거지 물튐 방지','씽크대 물막이','실리콘 물막이'],
  spice:['양념 정리 선반','주방 회전 선반','회전 양념통 정리','양념통 수납','양념 수납 정리대','주방 양념 정리','양념 거치대','양념정리랙'],
  vacuum:['차량용 미니 청소기','핸디 무선 청소기','차량용 청소기','소형 무선 청소기','책상 미니 청소기','충전식 핸디 청소기','휴대용 청소기','차량 핸디청소기','책상 틈새 미니 청소기'],
  brush:['청소 브러시 틈새','욕실 틈새 청소 브러시','창문 틈새 청소','좁은 틈새 청소솔','틈새청소 브러쉬','주방 틈새 청소','틈새 브러시','물때 틈새 청소 브러시'],
  vacbag:['옷 압축팩','이불 진공팩','여행용 압축팩','옷장 압축팩','진공 압축 파우치','이불 압축 포장','대형 압축팩','의류 압축팩'],
  organizer:['접이식 수납함','폴딩 리빙박스','접이식 수납박스','접이식 정리박스','폴딩 정리함','접이식 리빙 박스','접는 수납함','다용도 접이식 정리함'],
  bin:['주방 센서 쓰레기통','자동 개폐 쓰레기통','센서 휴지통','자동 열림 쓰레기통','무선 센서 쓰레기통','소형 자동 쓰레기통','모션 센서 쓰레기통','스마트 센서 휴지통'],
  stand:['접이식 노트북 받침대','휴대용 노트북 거치대','높이조절 노트북 거치대','알루미늄 노트북 거치대','노트북 받침대 각도','노트북 거치대 책상','접이식 노트북 스탠드','노트북 받침대 접이식'],
  cable:['충전선 정리 홀더','책상 케이블 정리','선정리 클립','자석 케이블 홀더','케이블 선정리','충전 케이블 정리대','전선 정리 홀더','케이블 고정 클립'],
  paws:['강아지 발세척컵','반려견 발 세정컵','실리콘 발 세척컵','강아지 발 세정기','산책 발 세척컵','강아지 발씻기 컵','강아지 발 세척 도구','반려견 발씻기 컵'],
  dryrack:['싱크대 식기 건조대','식기건조랙','접이식 건조대','롤업 식기 건조대','주방 건조랙','식기 건조 선반','미니 식기건조대','접시 건조대'],
  foodbox:['냉장고 밀폐 용기','반찬 밀폐용기','식재료 보관 용기','소분 밀폐 용기','음식 보관 용기','냉장고 정리 밀폐용기','진공 밀폐 용기','플라스틱 보관용기'],
  chopper:['수동 야채 다지기','전동 야채다지기','채소 다지기','양파 다지기','미니 야채 커터','채소 커터','야채 다지기 도구','채소 손질 다지기'],
  mop:['욕실 바닥 청소솔','타일 청소솔','욕실 틈새 청소솔','줄눈 청소솔','화장실 청소솔','바닥 청소 브러시','욕실 청소 브러쉬','바닥 틈새 청소'],
  roller:['옷 먼지 제거 롤러','털제거 롤러','먼지 제거 돌돌이','보풀 제거 롤러','침구 먼지 제거','재사용 돌돌이','휴대용 먼지 제거 롤러','먼지 제거 브러시 롤러'],
  window:['창틀 청소솔','창틀 청소 브러시','창틀 먼지 청소','창문 틈새 청소솔','창틀 청소기','창문 창틀 청소 도구','창틀 청소 브러쉬','창틀 먼지 제거'],
  drawer:['속옷 서랍 칸막이','양말 서랍 정리함','서랍 정리 칸막이','접이식 서랍 정리함','주방 서랍 칸막이','서랍 칸막이 분리형','플라스틱 서랍 정리함','서랍 수납 칸막이'],
  shoes:['현관 신발 정리대','신발 수납 정리대','2단 신발 정리대','접이식 신발 정리대','신발장 정리대','좁은 현관 신발 수납','신발 정리 선반','신발 정리 슬롯'],
  hanging:['걸이형 수납포켓','방문 걸이형 수납','옷장 걸이 수납함','벽걸이 수납 포켓','도어 수납 포켓','문걸이 수납 정리함','걸이식 수납함','다용도 걸이형 수납'],
  carbag:['차량 틈새 수납함','차량 시트 수납 포켓','자동차 수납함','시트 사이 수납함','차량 정리 포켓','자동차 틈새 수납','차량 사이드 수납함','차량 시트 틈새 포켓'],
  grip:['휴대폰 거치대 자석','차량 자석 거치대','책상 휴대폰 거치대','자석 핸드폰 거치대','핸드폰 거치대 접이식','휴대폰 거치대 높이조절','차량 휴대폰 거치대','맥세이프 거치대'],
  bottle:['강아지 휴대용 물병','반려견 산책 물통','강아지 산책 물병','강아지 외출 물병','강아지 물병 휴대용','반려동물 휴대용 물병','반려견 산책 물병','강아지 급수 물병'],
  fur:['반려동물 털제거 브러시','강아지 털 제거 브러시','고양이 털 제거 브러시','펫 털 제거','쇼파 털 제거 브러시','반려동물 털 청소','고양이 털 제거기','펫 브러시'],
  baggie:['강아지 배변봉투','휴대용 배변봉투 케이스','반려견 배변봉투','배변봉투 리필','강아지 산책 배변봉투','배변봉투 홀더','강아지 배변봉지','강아지 배변봉투 파우치']
 };
 function searchPlans(category,target=20){
  const picks=(category==='all'?scenarios:scenarios.filter(s=>s.category===category));
  const candidates=picks.flatMap(s=>[{scenarioId:s.id,query:s.query},...(queryVariants[s.id]||[]).map(query=>({scenarioId:s.id,query}))]);
  // Round-robin by scenario to avoid only finding one product category.
  const groups=picks.map(s=>candidates.filter(c=>c.scenarioId===s.id)),plan=[];
  const max={20:22,50:38,100:72,200:160}[Number(target)]||22;
  for(let i=0;plan.length<max&&groups.some(g=>g.length);i++){
   for(const group of groups){if(group.length&&plan.length<max)plan.push(group.shift())}
  }
  return plan;
 }

 const labels={all:'전체',kitchen:'주방',cleaning:'청소',storage:'수납',lifestyle:'생활',pets:'반려동물'};
 function pickScenarios(category){
  if(category==='all')return ['drain','vacuum','vacbag','bin','stand','paws'].map(id=>scenarios.find(s=>s.id===id));
  return scenarios.filter(s=>s.category===category).slice(0,4);
 }
 function matches(item,scenario){
  const name=String(item?.name||'').toLowerCase().replace(/\s+/g,' ');
  return Boolean(scenario&&scenario.matches.some(s=>name.includes(s.toLowerCase())));
 }
 function score(item,scenario){
  if(!matches(item,scenario))return null;
  const name=String(item.name||'');
  const price=Number(item.price);
  const fit=51+
   (scenario.matches.filter(s=>name.toLowerCase().includes(s.toLowerCase())).length>1?7:0)+
   (/자동|무선|접이|센서|회전|진공|실리콘|분리|휴대|세척/.test(name)?9:0)+
   (Number.isFinite(price)&&price>=3000&&price<=50000?13:price<=120000&&price>0?7:0)+
   (typeof item.imageUrl==='string'&&/^https:\/\//.test(item.imageUrl)?10:0)+
   (typeof item.productUrl==='string'&&/^https:\/\//.test(item.productUrl)?3:0);
  const value=Math.min(95,fit);
  return {score:value,threads:Math.min(95,value+2),instagram:Math.min(95,value+(item.imageUrl?3:-9)),
    scenarioId:scenario.id,category:scenario.category,query:scenario.query,problem:scenario.problem,
    demo:scenario.demo,audience:scenario.audience};
 }
 root.vpSocialDiscoveryCore={scenarios,labels,pickScenarios,searchPlans,matches,score};
})(typeof window!=='undefined'?window:globalThis);

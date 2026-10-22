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
  {id:'paws',category:'pets',query:'반려견 발 세척컵',matches:['발 세척컵','발세척컵','발 세정컵','발세정컵'],problem:'산책 후 반려견 발을 닦는 번거로움',demo:'산책 뒤 발 세정 준비 장면',audience:'반려견 보호자'}
 ];
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
 root.vpSocialDiscoveryCore={scenarios,labels,pickScenarios,matches,score};
})(typeof window!=='undefined'?window:globalThis);

/* ViralPick live performance dashboard: affiliate income and independent social engagement. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const DAY=86400000, EARLIEST='20181101', keys=['clicks','orders','cancels','commission'];
const fmt=v=>Number(v||0).toLocaleString('ko-KR');
const money=v=>fmt(v)+'원';
const state={overview:null,history:null,range:null,loaded:false,busy:false,request:0,shown:30,subId:'',errors:[]};
const cache=new Map();
function kstToday(){return new Date(Date.now()+9*3600000).toISOString().slice(0,10).replace(/-/g,'')}
function parseDay(s){return new Date(Date.UTC(Number(s.slice(0,4)),Number(s.slice(4,6))-1,Number(s.slice(6,8))))}
function iso(s){return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)}
function ymd(d){return d.toISOString().slice(0,10).replace(/-/g,'')}
function shift(s,days){return ymd(new Date(parseDay(s).getTime()+days*DAY))}
function monthStart(s){return s.slice(0,6)+'01'}
function monthEnd(s){return shift(ymd(new Date(Date.UTC(Number(s.slice(0,4)),Number(s.slice(4,6)),1))),-1)}
function weekStart(s){return shift(s,-((parseDay(s).getUTCDay()+6)%7))}
function number(row,...names){for(const n of names){const v=row?.[n];if(v===undefined||v===null||v==='')continue;const x=Number(typeof v==='string'?v.replace(/[,₩원\s]/g,''):v);if(Number.isFinite(x))return x}return 0}
function dateValue(x){const m=String(x||'').match(/^(\d{4})-?(\d{2})-?(\d{2})/);return m?m[1]+m[2]+m[3]:null}
function chunks(from,to){
 const all=[];for(let a=from;a<=to;){const b=shift(a,29),end=b<to?b:to;all.push([a,end]);a=shift(end,1)}return all;
}
function presetRange(){
 const now=kstToday(),type=$('#vpPerfPeriod')?.value||'month',year=now.slice(0,4);
 let from=monthStart(now),to=now;
 if(type==='7')from=shift(now,-6);
 if(type==='30')from=shift(now,-29);
 if(type==='prevmonth'){from=monthStart(shift(monthStart(now),-1));to=monthEnd(from)}
 if(type==='year')from=year+'0101';
 if(type==='lastyear'){from=String(Number(year)-1)+'0101';to=String(Number(year)-1)+'1231'}
 if(type==='custom'){from=($('#vpPerfFrom')?.value||'').replace(/-/g,'');to=($('#vpPerfTo')?.value||'').replace(/-/g,'')}
 return {from,to,type};
}
function validateRange(r){
 if(!/^\d{8}$/.test(r.from)||!/^\d{8}$/.test(r.to)||ymd(parseDay(r.from))!==r.from||ymd(parseDay(r.to))!==r.to)throw Error('시작일과 종료일을 선택해 주세요.');
 const count=(parseDay(r.to)-parseDay(r.from))/DAY;
 if(r.from<EARLIEST||r.to>kstToday()||count<0)throw Error('2018년 11월 이후부터 오늘까지의 기간을 선택해 주세요.');
 if(count>365)throw Error('한 번에 최대 366일까지 조회할 수 있습니다. 기간을 나눠 선택해 주세요.');
}
function cleanRows(input){return keys.reduce((o,k)=>(o[k]=Array.isArray(input?.[k])?input[k]:[],o),{})}
async function segment(from,to,subId,force){
 const id=from+':'+to+':'+subId;
 if(!force&&cache.has(id))return cache.get(id);
 const reports={clicks:[],orders:[],cancels:[],commission:[]},errors={},incomplete={};
 for(let page=0;page<20;page++){
  const params=new URLSearchParams({startDate:from,endDate:to,page:String(page)});
  if(subId)params.set('subId',subId);
  const res=await backendRequest('/api/reports?'+params.toString(),{method:'GET'});
  const rows=cleanRows(res.reports);
  for(const kind of keys){
   if(res.errors?.[kind])errors[kind]=res.errors[kind];
   if(Array.isArray(res.reports?.[kind]))reports[kind].push(...rows[kind]);
  }
  const hasMore=Object.values(res.hasMore||{}).some(Boolean);
  if(!hasMore)break;
  if(page===19){for(const k of keys)if(res.hasMore?.[k])incomplete[k]='페이지 제한으로 일부 데이터 누락';}
 }
 const result={reports,errors:{...errors,...incomplete}};
 if(!Object.keys(result.errors).length)cache.set(id,result);
 return result;
}
async function loadRange(from,to,subId,progress,force){
 const parts=chunks(from,to),results=new Array(parts.length);
 // Two concurrent chunks avoid burst rate limits while keeping annual queries responsive.
 for(let i=0;i<parts.length;i+=2){
  const batch=parts.slice(i,i+2);
  const current=await Promise.all(batch.map(async ([a,b],j)=>{
   try{return await segment(a,b,subId,force)}
   catch(e){return {reports:{},errors:Object.fromEntries(keys.map(k=>[k,String(e.message||e).slice(0,110)]))}}
  }));
  current.forEach((v,j)=>results[i+j]=v);
  if(typeof progress==='function')progress(Math.min(i+2,parts.length),parts.length);
 }
 const daily=new Map(),valid=Object.fromEntries(keys.map(k=>[k,true])),counts=Object.fromEntries(keys.map(k=>[k,0]));
 const observed=Object.fromEntries(keys.map(k=>[k,new Set()]));
 const problems=[];
 for(let i=0;i<results.length;i++){
  const result=results[i];
  for(const type of keys){
   if(result.errors?.[type]||!Array.isArray(result.reports?.[type])){valid[type]=false;problems.push(iso(parts[i][0])+' '+type+' '+(result.errors?.[type]||'조회 실패'));continue}
   for(const row of result.reports[type]){
    const date=dateValue(row.date||row.orderDate);
    if(!date||date<from||date>to)continue;
    counts[type]++;
    observed[type].add(date);
    if(!daily.has(date))daily.set(date,{date,clicks:0,orders:0,gmv:0,cancels:0,commission:0});
    const d=daily.get(date);
    if(type==='clicks')d.clicks+=number(row,'click','clicks');
    if(type==='orders'){d.orders+=number(row,'quantity','order','orders');d.gmv+=number(row,'gmv','orderAmount','salesAmount')}
    if(type==='cancels')d.cancels+=number(row,'quantity','cancel','cancels');
    if(type==='commission')d.commission+=number(row,'commission','commissionAmount');
   }
  }
 }
 return {from,to,daily,valid,counts,observed,problems};
}
function sum(data,from,to,field){
 if(!data||!data.valid[field==='gmv'?'orders':field])return null;
 let total=0;for(const [day,row] of data.daily){if(day>=from&&day<=to)total+=row[field]||0}
 return total;
}
// Display newest records first: the running total must follow the same visible order.
function dailyCommissionLedger(data){
 if(!data)return [];
 let running=0;
 return [...data.daily.keys()].sort().reverse().map(date=>{
  const row=data.daily.get(date);
  running+=Number(row.commission)||0;
  return {...row,date,cumulativeCommission:data.valid.commission?running:null};
 });
}
function kpi(id,value,sub){
 const a=$('#'+id),b=$('#'+id+'Note');
 if(a)a.textContent=value;if(b)b.textContent=sub||'';
}
function renderOverview(){
 const d=state.overview,now=kstToday(),month=monthStart(now),prev=monthStart(shift(month,-1));
 const same=prev.slice(0,6)+String(Math.min(Number(now.slice(6)),Number(monthEnd(prev).slice(6)))).padStart(2,'0');
 const prevValue=sum(d,prev,same,'commission'),monthValue=sum(d,month,now,'commission');
 const weekValue=sum(d,weekStart(now),now,'commission'),todayValue=sum(d,now,now,'commission');
 const present=(v,range)=>!d?'—':v===null?'조회 불완전':d.counts.commission===0?'내역 없음':money(v);
 const delta=monthValue===null||prevValue===null?'전월 비교 준비 중':d.counts.commission===0?'비교 내역 없음':prevValue===0?'전월 동기간 수익 0원':((monthValue-prevValue)/Math.abs(prevValue)*100).toFixed(1)+'% '+(monthValue>=prevValue?'증가':'감소')+' · 전월 동기간 '+money(prevValue);
 kpi('vpMonthProfit',present(monthValue),'전월 동기간 대비: '+delta);
 kpi('vpWeekProfit',present(weekValue),'이번 주 월요일부터 오늘까지');
 kpi('vpTodayProfit',!d?'—':d.observed.commission.has(now)?present(todayValue):'집계 대기','당일 실적은 쿠팡 갱신 이후 반영될 수 있습니다');
 const status=$('#vpOverviewNote');
 if(status)status.textContent=d?(d.problems.length?'일부 쿠팡 자료 누락 · 새로고침을 눌러 재시도하세요':'쿠팡 파트너스 실제 API 기준 · 전월 비교는 같은 날짜까지'):'로그인 후 실적을 불러옵니다.';
}
function financialCells(data){
 const from=data?.from,to=data?.to;
 return ['clicks','orders','gmv','commission'].map(k=>{
  if(!data)return '—';
  const value=sum(data,from,to,k),base=k==='gmv'?'orders':k;
  return value===null?'조회 불완전':!data.counts[base]?'내역 없음':(k==='gmv'||k==='commission'?money(value):fmt(value));
 });
}
function renderPlatforms(){
 const tbody=$('#vpPlatformRows');if(!tbody)return;
 tbody.replaceChildren();
 const entries=[['쿠팡 파트너스','API 연결','connected',financialCells(state.history)],['토스쇼핑','연동 예정','pending',['—','—','—','—']]];
 for(const [name,status,cls,cells] of entries){
  const tr=document.createElement('tr');const td=document.createElement('td');
  const b=document.createElement('strong');b.textContent=name;td.append(b);
  const small=document.createElement('small');small.className='vpPlatformStatus '+cls;small.textContent=status;td.append(small);tr.append(td);
  for(const value of cells){const cell=document.createElement('td');cell.textContent=value;tr.append(cell)}
  tbody.append(tr);
 }
 const total=$('#vpPlatformTotal');if(total){
  const cells=financialCells(state.history);
  total.replaceChildren();
  const label=document.createElement('td');label.textContent='연결된 플랫폼 합계';total.append(label);
  for(const value of cells){const td=document.createElement('td');td.textContent=value;total.append(td)}
 }
 const label=$('#vpPlatformFoot');if(label)label.textContent='합계는 실제 연동된 쇼핑 제휴 플랫폼만 포함합니다. 토스쇼핑은 연동 후 합산되며, SNS 조회·노출은 금액에 포함되지 않습니다.';
}
function bars(points){
 const root=$('#vpRevenueChart');if(!root)return;root.replaceChildren();
 if(!state.history){root.textContent='조회 기간을 선택하면 실제 수익 흐름을 표시합니다.';return}
 if(!state.history.valid.commission){root.textContent='일부 수수료 자료 조회가 실패했습니다. 재조회 후 그래프를 확인해 주세요.';return}
 if(!points.length){root.textContent='표시할 수익 기록이 없습니다.';return}
 const width=900,height=238,left=18,right=18,top=22,bottom=43,base=height-bottom;
 const values=points.map(p=>p.value),max=Math.max(1,...values),minimum=Math.min(0,...values);
 const span=Math.max(1,max-minimum),usable=base-top;
 const zero=base-(-minimum/span)*usable;
 const sw=(width-left-right)/points.length;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 '+width+' '+height);
 svg.setAttribute('role','group');
 svg.setAttribute('aria-label','기간별 수수료 막대그래프. 막대에 마우스를 올리거나 터치하면 날짜와 금액을 확인할 수 있습니다.');
 const make=(tag,attrs,text)=>{
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [k,v] of Object.entries(attrs||{}))node.setAttribute(k,String(v));
  if(text!==undefined)node.textContent=text;svg.append(node);return node;
 };
 make('line',{x1:left,y1:zero,x2:width-right,y2:zero,stroke:'#dce3eb','stroke-width':1});
 const tooltip=document.createElement('div');
 tooltip.className='vpChartTooltip';
 tooltip.hidden=true;tooltip.setAttribute('role','status');
 const selection=document.createElement('div');
 selection.className='vpChartSelection';
 selection.setAttribute('aria-live','polite');
 selection.textContent='막대에 마우스를 올리거나 터치하면 날짜별 수수료를 확인할 수 있습니다.';
 const barShapes=[];
 let pinned=-1;
 function activate(index,event,pin=false){
  const p=points[index];if(!p)return;
  if(pin)pinned=index;
  const bar=barShapes[index];
  for(const item of barShapes)item.setAttribute('fill',item===bar?(p.value<0?'#bd4c4c':'#2d50b2'):(item.dataset.negative==='true'?'#e67d7d':'#5472e6'));
  tooltip.replaceChildren();
  const date=document.createElement('span');date.textContent=p.label;
  const amount=document.createElement('strong');amount.textContent=money(p.value);
  tooltip.append(date,amount);tooltip.hidden=false;
  const box=root.getBoundingClientRect(),barBox=bar.getBoundingClientRect();
  const loc=event&&Number.isFinite(event.clientX)?event.clientX-box.left:(barBox.left+barBox.width/2-box.left);
  tooltip.style.left=Math.max(64,Math.min(Math.max(64,box.width-64),loc))+'px';
  tooltip.style.top=Math.max(0,barBox.top-box.top-57)+'px';
  if(pin)selection.textContent=p.label+' 수수료 '+money(p.value);
 }
 const step=Math.max(1,Math.ceil(points.length/11));
 points.forEach((p,i)=>{
  const x=left+i*sw+sw*.18,y=base-((p.value-minimum)/span)*usable;
  const barY=Math.min(y,zero),barH=Math.max(2,Math.abs(zero-y));
  const rect=make('rect',{x,y:barY,width:Math.max(2,sw*.64),height:barH,rx:Math.min(4,sw*.15),fill:p.value<0?'#e67d7d':'#5472e6'});
  rect.dataset.negative=String(p.value<0);barShapes.push(rect);
  const nativeTitle=document.createElementNS('http://www.w3.org/2000/svg','title');
  nativeTitle.textContent=p.label+' 수수료 '+money(p.value);rect.append(nativeTitle);
  if(i%step===0||i===points.length-1)make('text',{x:left+i*sw+sw*.5,y:height-19,'text-anchor':'middle','font-size':11,fill:'#7b8799'},p.short);
  // Full-column transparent hit areas make short bars and zero-income days touch-friendly.
  const hit=make('rect',{x:left+i*sw,y:top,width:sw,height:usable+3,fill:'transparent','pointer-events':'all'});
  hit.setAttribute('tabindex','0');hit.setAttribute('role','button');
  hit.setAttribute('aria-label',p.label+' 수수료 '+money(p.value));
  hit.addEventListener('pointerenter',e=>activate(i,e));
  hit.addEventListener('pointermove',e=>activate(i,e));
  hit.addEventListener('click',e=>activate(i,e,true));
  hit.addEventListener('focus',()=>activate(i,null));
  hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(i,null,true)}});
 });
 svg.addEventListener('pointerleave',()=>{
  tooltip.hidden=true;
  for(const rect of barShapes)rect.setAttribute('fill',rect.dataset.negative==='true'?'#e67d7d':'#5472e6');
 });
 svg.addEventListener('focusout',e=>{if(!svg.contains(e.relatedTarget))tooltip.hidden=true});
 root.append(svg,tooltip,selection);
}
function renderHistory(){
 const d=state.history,table=$('#vpDailyRows'),status=$('#vpPerfStatus');if(!table)return;
 renderPlatforms();
 if(!d){table.innerHTML='<tr><td colspan="6">아직 실적을 조회하지 않았습니다.</td></tr>';bars([]);return}
 if(status)status.textContent=(d.problems.length?'일부 데이터 조회 실패: '+d.problems.slice(0,3).join(' / '):'쿠팡 실제 API 데이터 조회 완료')+' · '+iso(d.from)+' ~ '+iso(d.to);
 const dates=[...d.daily.keys()].sort(),monthly=(parseDay(d.to)-parseDay(d.from))/DAY>45;
 const chart=new Map();
 if(d.valid.commission){
  if(monthly){let month=monthStart(d.from);while(month<=d.to){chart.set(month.slice(0,6),0);month=monthStart(shift(monthEnd(month),1))}}
  else{for(let day=d.from;day<=d.to;day=shift(day,1))chart.set(day,0)}
 }
 for(const date of dates){
  const id=monthly?date.slice(0,6):date,p=d.daily.get(date);
  chart.set(id,(chart.get(id)||0)+p.commission);
 }
 bars([...chart.entries()].map(([date,value])=>({label:monthly?date.slice(0,4)+'-'+date.slice(4):iso(date),short:monthly?date.slice(4)+'월':date.slice(4,6)+'/'+date.slice(6),value})));
 const total=sum(d,d.from,d.to,'commission');
 const overall=$('#vpHistoryTotal');if(overall)overall.textContent=total===null?'부분 조회':!d.counts.commission?'내역 없음':'기간 수수료 '+money(total);
 const ledger=dailyCommissionLedger(d),shown=ledger.slice(0,state.shown);
 table.replaceChildren();
 if(!shown.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.textContent='선택한 기간에 확인된 실적이 없습니다.';tr.append(td);table.append(tr)}
 for(const r of shown){
  const tr=document.createElement('tr');
  [iso(r.date),fmt(r.clicks),fmt(r.orders),money(r.gmv),fmt(r.cancels),d.valid.commission?money(r.commission):'조회 불완전',r.cumulativeCommission===null?'조회 불완전':money(r.cumulativeCommission)].forEach((val,i)=>{
   const td=document.createElement('td');td.textContent=val;td.dataset.label=['날짜','클릭','주문','거래액','취소','일별 수수료','최신일부터 누적'][i];tr.append(td)
  });
  table.append(tr);
 }
 const more=$('#vpPerfMore');if(more){more.hidden=ledger.length<=state.shown;more.textContent='이전 날짜 더보기 ('+Math.min(30,ledger.length-state.shown)+'일)'}
}
function createView(){
 const root=$('#vpPerformanceDashboard');if(!root||root.dataset.ready)return;
 root.dataset.ready='1';
 root.innerHTML=
 '<div class="vpDashHead"><div><span class="vpEyebrow">PERFORMANCE OVERVIEW</span><h1>성과 대시보드</h1><p>쇼핑 제휴 수익은 실제 API로, SNS는 콘텐츠 반응 지표로 구분해 분석합니다.</p></div><span class="vpLiveTag">● 쿠팡 파트너스 API</span></div>'+
 '<div class="vpSectionLabel">수익 한눈에 보기 <small id="vpOverviewNote">실적을 불러오는 중입니다.</small></div>'+
 '<div class="vpProfitGrid">'+
 '<article class="vpProfitCard main"><small>이번 달 수익 · 제휴 합계</small><strong id="vpMonthProfit">—</strong><span id="vpMonthProfitNote">전월 동기간 비교</span></article>'+
 '<article class="vpProfitCard"><small>이번 주 수익</small><strong id="vpWeekProfit">—</strong><span id="vpWeekProfitNote">월요일부터 오늘까지</span></article>'+
 '<article class="vpProfitCard"><small>오늘 수익</small><strong id="vpTodayProfit">—</strong><span id="vpTodayProfitNote">쿠팡 집계 기준</span></article></div>'+
 '<section class="vpReportControls"><div class="vpReportHead"><div><h2>쇼핑 제휴 실적</h2><p>쿠팡 API의 조회 기간을 선택하면 플랫폼별 기록과 흐름표가 같이 변경됩니다.</p></div><button class="btn primary" type="button" id="vpPerfRefresh">↻ 실적 새로고침</button></div>'+
 '<div class="vpReportFilters"><label>조회 기간<select id="vpPerfPeriod"><option value="month">이번 달</option><option value="prevmonth">지난달</option><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="year">올해 전체</option><option value="lastyear">작년 전체</option><option value="custom">직접 날짜 선택</option></select></label>'+
 '<label class="vpCustomDate" hidden>시작일<input type="date" id="vpPerfFrom"></label><label class="vpCustomDate" hidden>종료일<input type="date" id="vpPerfTo"></label>'+
 '<label>쿠팡 Sub ID (선택)<input type="text" id="vpPerfSubId" maxlength="48" placeholder="전체 채널"></label>'+
 '<button class="btn" type="button" id="vpPerfApply">기간 적용</button></div><p class="vpReportStatus" id="vpPerfStatus" role="status">로그인 후 실제 실적을 불러옵니다.</p></section>'+
 '<section class="vpDataPanel"><div class="vpPanelHeading"><h2>플랫폼별 실적</h2><small>클릭 · 주문 · 주문 거래액 · 수수료 수익</small></div><div class="vpTableScroll"><table class="vpFinanceTable"><thead><tr><th>플랫폼</th><th>클릭</th><th>주문</th><th>주문 거래액</th><th>수수료 수익</th></tr></thead><tbody id="vpPlatformRows"></tbody><tfoot><tr id="vpPlatformTotal"></tr></tfoot></table></div><p class="vpTableFoot" id="vpPlatformFoot"></p></section>'+
 '<section class="vpDataPanel"><div class="vpPanelHeading"><h2>수수료 수익 흐름</h2><small>기간에 따라 일별 / 월별 자동 전환</small></div><div class="vpRevenueChart" id="vpRevenueChart" role="group"></div></section>'+
 '<section class="vpDataPanel"><div class="vpPanelHeading"><h2>날짜별 실적 및 누적 수익</h2><div class="vpPanelTools"><small id="vpHistoryTotal">—</small><button class="btn" type="button" id="vpPerfCsv">CSV 저장</button></div></div><div class="vpTableScroll"><table class="vpFinanceTable vpDailyTable"><thead><tr><th>날짜</th><th>클릭</th><th>주문</th><th>거래액</th><th>취소</th><th>일별 수수료</th><th>최신일부터 누적</th></tr></thead><tbody id="vpDailyRows"></tbody></table></div><p class="vpTableFoot">일별 수수료는 해당 날짜의 금액만 표시합니다. 누적 수수료는 표의 최신 날짜부터 아래로 내려가며 합산됩니다. 전체 기간 합계는 위의 ‘기간 수수료’를 확인하세요.</p><button class="btn vpMoreButton" id="vpPerfMore" type="button" hidden>이전 날짜 더보기</button></section>'+
 '<div class="vpSectionLabel social">SNS 콘텐츠 성과 <small>금액 지표와 별개로 관리합니다.</small></div><div class="vpSocialGrid">'+
 '<section class="vpSocialCard"><div><h3>Threads</h3><span>연동 준비 중</span></div><div class="vpSocialMetrics"><p>조회수 <b>—</b></p><p>좋아요 <b>—</b></p><p>답글 <b>—</b></p><p>리포스트 <b>—</b></p></div><small>계정·인사이트 API 연결 시 실제 지표가 표시됩니다.</small></section>'+
 '<section class="vpSocialCard"><div><h3>Instagram</h3><span>연동 준비 중</span></div><div class="vpSocialMetrics"><p>조회수 <b>—</b></p><p>노출·도달 <b>—</b></p><p>좋아요·댓글 <b>—</b></p><p>저장·공유 <b>—</b></p></div><small>인사이트 API 연결 시 게시물별 성과를 볼 수 있습니다.</small></section></div>'+
 '<section class="vpDataPanel vpSocialPosts"><div class="vpPanelHeading"><h2>게시물별 SNS 성과</h2><small>Threads · Instagram 향후 연동</small></div><div class="vpTableScroll"><table class="vpFinanceTable"><thead><tr><th>플랫폼 / 게시물</th><th>조회수</th><th>노출·도달</th><th>좋아요</th><th>댓글·답글</th><th>저장·공유</th></tr></thead><tbody id="vpSocialPostRows"><tr><td colspan="6"><div class="vpNoPosts">게시물 인사이트 연동 후 업로드별 조회·노출·반응이 여기에 표시됩니다. 현재는 실제 연동 데이터가 없습니다.</div></td></tr></tbody></table></div></section>'+ 
 '<p class="vpAccountingNote">* 제휴 수익은 쿠팡이 보고한 수수료로 실제 입금액과 차이가 있을 수 있습니다. 쿠팡 실적은 일반적으로 오후에 갱신됩니다. 오늘 수익이 미집계라면 0원으로 단정하지 않습니다. SNS 수치와 토스쇼핑 수익은 아직 자동 연동되지 않았습니다.</p>';
 const now=kstToday();$('#vpPerfFrom').value=iso(monthStart(now));$('#vpPerfTo').value=iso(now);
 $('#vpPerfPeriod').onchange=()=>{
  const custom=$('#vpPerfPeriod').value==='custom';
  document.querySelectorAll('#vpPerformanceDashboard .vpCustomDate').forEach(n=>n.hidden=!custom);
  if(!custom)void refreshHistory(false);
 };
 $('#vpPerfRefresh').onclick=()=>void refresh(true);
 $('#vpPerfApply').onclick=()=>{const next=$('#vpPerfSubId')?.value.trim()||'';if(next!==state.subId)void refresh(true);else void refreshHistory(false)};
 $('#vpPerfMore').onclick=()=>{state.shown+=30;renderHistory()};
 $('#vpPerfCsv').onclick=exportCsv;
 renderOverview();renderHistory();
 if(window.vpAccountLoggedIn?.())void refresh(false);
}
function exportCsv(){
 const d=state.history;if(!d)return;
 const rows=[['날짜','클릭','주문','주문거래액','취소','일별수수료','최신일부터누적수수료']];
 for(const r of dailyCommissionLedger(d)){
  rows.push([iso(r.date),r.clicks,r.orders,r.gmv,r.cancels,d.valid.commission?r.commission:'조회 불완전',r.cumulativeCommission===null?'조회 불완전':r.cumulativeCommission]);
 }
 const csv='\uFEFF'+rows.map(r=>r.map(s=>'"'+String(s).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='viralpick-제휴실적-'+d.from+'-'+d.to+'.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
}
async function refreshHistory(force){
 if(state.busy)return;
 const r=presetRange();try{validateRange(r)}catch(e){$('#vpPerfStatus').textContent=e.message;return}
 const subId=$('#vpPerfSubId')?.value.trim()||'';
 if(subId&&!/^[a-zA-Z0-9_-]{1,48}$/.test(subId)){$('#vpPerfStatus').textContent='Sub ID는 영문·숫자·_·-만 입력할 수 있습니다.';return}
 state.range=r;state.subId=subId;state.shown=30;state.history=null;renderHistory();
 state.busy=true;const btn=$('#vpPerfRefresh');btn.disabled=true;const request=++state.request;
 try{
  state.history=await loadRange(r.from,r.to,subId,(i,n)=>{$('#vpPerfStatus').textContent='선택 기간 조회 중 '+i+' / '+n+' 구간'},force);
  if(request!==state.request)return;renderHistory();
 }catch(e){if(request===state.request)$('#vpPerfStatus').textContent='조회 실패: '+String(e.message||e)}
 finally{state.busy=false;btn.disabled=false}
}
async function refresh(force){
 if(state.busy)return;
 if(force)cache.clear();
 const now=kstToday(),prev=monthStart(shift(monthStart(now),-1));
 const subId=$('#vpPerfSubId')?.value.trim()||'';
 if(subId&&!/^[a-zA-Z0-9_-]{1,48}$/.test(subId)){$('#vpPerfStatus').textContent='Sub ID 형식이 올바르지 않습니다.';return}
 state.overview=null;state.history=null;renderOverview();renderHistory();
 state.busy=true;const btn=$('#vpPerfRefresh');btn.disabled=true;
 try{
  state.overview=await loadRange(prev,now,subId,(i,n)=>{$('#vpOverviewNote').textContent='이번 달 및 전월 비교자료 조회 중 '+i+' / '+n+' 구간'},force);
  renderOverview();
 }catch(e){$('#vpOverviewNote').textContent='수익 요약 조회 실패: '+String(e.message||e)}
 finally{state.busy=false;btn.disabled=false}
 await refreshHistory(force);
}
window.vpSetupPerformanceDashboard=createView;
window.vpPerformanceOnShow=()=>{if($('#vpPerformanceDashboard')&&!$('#vpPerformanceDashboard').dataset.ready)createView()};
window.vpPerformanceOnLogin=()=>{cache.clear();if($('#vpPerformanceDashboard'))void refresh(true)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',createView,{once:true});else createView();
})();
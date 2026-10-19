/* Unified ViralPick discovery and real-data dashboard. */
(function(){
'use strict';
const KEY='viralpick-performance-v2';
const channels=['Threads','Instagram','쿠팡파트너스','토스 쉐어링크'];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Number(v||0).toLocaleString('ko-KR');
function stored(){try{const r=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(r)?r.filter(v=>channels.includes(v.channel)).slice(-500):[]}catch{return[]}}
function persist(rows){try{localStorage.setItem(KEY,JSON.stringify(rows.slice(-500)));return true}catch{return false}}
function filtered(){
 const days=Number($('#vpDays')?.value)||30;
 const cutoff=days===9999?'0000-01-01':new Date(Date.now()-(days-1)*86400000).toISOString().slice(0,10);
 return stored().filter(v=>v.date>=cutoff).sort((a,b)=>b.date.localeCompare(a.date));
}
function dashboard(){
 const root=$('#dashboard');if(!root)return;
 root.innerHTML='<div class="vpDashHead"><div><span class="badge blue">PERFORMANCE CENTER</span><h1>성과 대시보드</h1><p>Threads·Instagram·쿠팡파트너스·토스 쉐어링크를 한눈에 확인하세요.</p></div><span class="vpOrigin">실제 수동 입력 기준 · API 자동 연동 아님</span></div>'+
 '<div class="vpDashActions"><label>조회 기간 <select id="vpDays"><option value="7">최근 7일</option><option value="30" selected>최근 30일</option><option value="9999">전체</option></select></label><button class="btn" id="vpCsv">CSV 다운로드</button></div>'+
 '<div class="vpSummary" id="vpSummary"></div><div class="vpChannelGrid" id="vpChannelGrid"></div>'+
 '<div class="vpDashColumns"><section class="panel"><div class="panelHead"><h2>수수료 수익 흐름</h2></div><div class="pad" id="vpTrend"></div></section>'+
 '<section class="panel"><div class="panelHead"><h2>성과 기록 추가</h2><span class="badge">수동 기록</span></div><div class="pad"><p class="queueHint">공식 실적 API는 아직 연결되지 않았습니다. 실제 조회·클릭·주문·수수료 내역을 입력하세요.</p>'+
 '<form id="vpRecordForm" class="vpRecordForm"><label>일자<input type="date" name="date" required></label><label>채널<select name="channel">'+channels.map(s=>'<option>'+s+'</option>').join('')+'</select></label>'+
 '<label>조회·도달<input type="number" name="views" min="0" value="0"></label><label>클릭<input type="number" name="clicks" min="0" value="0"></label>'+
 '<label>주문<input type="number" name="orders" min="0" value="0"></label><label>수수료 (원)<input type="number" name="commission" min="0" value="0"></label>'+
 '<label class="wide">출처·게시글 메모<input type="text" name="note" maxlength="120" placeholder="실적 출처"></label><button class="btn primary wide">성과 저장</button></form><p class="queueHint" id="vpSaveStatus">이 브라우저에만 저장됩니다.</p></div></section></div>'+
 '<section class="panel"><div class="panelHead"><h2>입력 내역</h2><span class="badge" id="vpRecordCount">0건</span></div><div class="pad vpDataTable"><table><thead><tr><th>날짜</th><th>채널</th><th>도달</th><th>클릭</th><th>주문</th><th>수수료</th><th></th></tr></thead><tbody id="vpRecordRows"></tbody></table></div></section><div id="dashProducts" hidden></div>';
 const date=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);$('#vpRecordForm').elements.date.value=date;
 $('#vpDays').onchange=render;
 $('#vpRecordForm').onsubmit=e=>{
  e.preventDefault();const d=new FormData(e.target);
  const row={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),date:String(d.get('date')||''),channel:String(d.get('channel')||''),
   views:Math.max(0,Number(d.get('views'))||0),clicks:Math.max(0,Number(d.get('clicks'))||0),
   orders:Math.max(0,Number(d.get('orders'))||0),commission:Math.max(0,Number(d.get('commission'))||0),note:String(d.get('note')||'').slice(0,120)};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!channels.includes(row.channel))return;
  $('#vpSaveStatus').textContent=persist([...stored(),row])?'성과 기록을 저장했습니다.':'브라우저 저장 공간 부족';
  render();
 };
 $('#vpCsv').onclick=()=>{
  const lines=[['일자','채널','조회','클릭','주문','수수료','메모'],...filtered().map(x=>[x.date,x.channel,x.views,x.clicks,x.orders,x.commission,x.note])];
  const csv=lines.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='viralpick-성과리포트.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 window.vpDeleteReport=id=>{if(!confirm('이 기록을 삭제할까요?'))return;persist(stored().filter(x=>x.id!==id));render()};
 render();
}
function render(){
 const rows=filtered(),sum=key=>rows.reduce((a,x)=>a+(Number(x[key])||0),0);
 const summary=[['수수료 수익',fmt(sum('commission'))+'원'],['조회·도달',fmt(sum('views'))],['클릭',fmt(sum('clicks'))],['주문',fmt(sum('orders'))],['CTR',sum('views')?(sum('clicks')/sum('views')*100).toFixed(2)+'%':'—']];
 $('#vpSummary').innerHTML=summary.map(([k,v])=>'<div class="vpStat"><small>'+k+'</small><strong>'+v+'</strong><span>'+(rows.length?'직접 입력 기준':'데이터 없음')+'</span></div>').join('');
 $('#vpChannelGrid').innerHTML=channels.map(ch=>{
  const group=rows.filter(x=>x.channel===ch),calc=k=>group.reduce((a,x)=>a+x[k],0);
  return '<div class="vpChannel"><b>'+esc(ch)+'</b><strong>'+fmt(calc('commission'))+'원</strong><small>클릭 '+fmt(calc('clicks'))+' · 주문 '+fmt(calc('orders'))+'</small><span>'+(group.length?group.length+'건 기록':'미연동 · 기록 없음')+'</span></div>';
 }).join('');
 const dates={};for(const x of [...rows].reverse())dates[x.date]=(dates[x.date]||0)+x.commission;
 const pairs=Object.entries(dates).slice(-12),max=Math.max(1,...pairs.map(x=>x[1]));
 $('#vpTrend').innerHTML=pairs.length?'<div class="vpBars">'+pairs.map(([day,val])=>'<div class="vpBar"><span>'+fmt(val)+'</span><i style="height:'+Math.max(4,Math.round(val/max*125))+'px"></i><small>'+day.slice(5)+'</small></div>').join('')+'</div>':'<p class="vpEmpty">실제 성과를 등록하면 이곳에 변화 추이가 표시됩니다.</p>';
 $('#vpRecordCount').textContent=rows.length+'건';
 $('#vpRecordRows').innerHTML=rows.slice(0,30).map(x=>'<tr><td>'+x.date+'</td><td>'+esc(x.channel)+'</td><td>'+fmt(x.views)+'</td><td>'+fmt(x.clicks)+'</td><td>'+fmt(x.orders)+'</td><td>'+fmt(x.commission)+'원</td><td><button class="btn" onclick="vpDeleteReport('+"'"+x.id+"'"+')">삭제</button></td></tr>').join('')||'<tr><td colspan="7">저장된 성과 기록이 없습니다.</td></tr>';
}
function lookup(){
 const status=$('#vpLinkStatus'),raw=$('#vpProductURL')?.value.trim()||'',name=$('#vpProductTitle')?.value.trim()||'';
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||!['www.coupang.com','m.coupang.com','coupang.com','link.coupang.com','coupa.ng'].includes(u.hostname))throw Error('쿠팡 HTTPS 링크만 허용됩니다.');
  const id=u.pathname.match(/\/(?:vp\/products|products)\/(\d+)/)?.[1]||u.searchParams.get('productId')||'';
  if(!/^\d{5,18}$/.test(id)){
   status.textContent='단축링크에서 상품 ID를 확인할 수 없습니다. 상품명으로 검색한 뒤 결과에서 선택해 주세요.';
   if(name){$('#tossSearch').value=name;window.fetchCoupangProducts()}return;
  }
  const localId=makeCoupangItemId(id),exists=products.find(p=>p.id===localId&&p.coupangProductId===id);
  if(exists){window.selectProduct(localId);status.textContent='기존 상품을 선택했습니다.';return}
  if(!name){status.textContent='상품 ID '+id+' 확인됨. 신규 등록에는 상품명을 입력해 주세요. URL만으로 상품명·가격을 검증할 수는 없습니다.';return}
  const p={id:localId,source:'coupang',coupangProductId:id,name:name.slice(0,120),price:0,old:0,discount:0,viral:0,thread:0,insta:0,blog:0,ad:0,
   type:'쿠팡 URL 등록',reason:'사용자가 입력한 상품 URL · 가격과 스펙 미검증',problem:'구매 목적을 확인하세요',novel:'기능 검증 필요',audience:'대상 확인 필요',visual:'실생활 사용 상황',
   originalUrl:raw,affiliateUrl:isPartnerLink(raw)?raw:null,checkedAt:Date.now()};
  products.push(p);saveCoupangDrafts();renderProductLists();window.selectProduct(localId);
  status.textContent='링크 상품을 등록했습니다. 가격·이미지·상세정보는 아직 검증되지 않았습니다.';
 }catch(e){status.textContent=e.message}
}
function discovery(){
 const root=$('#discover'),source=$('#integrations');if(!root||!source)return;
 const oldTop=root.querySelector(':scope > .top');
 if(oldTop)oldTop.innerHTML='<div><span class="badge blue">COUPANG DISCOVERY</span><h1>상품 발굴 · 가져오기</h1><p>이름 검색 / 상품 링크 / 발굴 유형 / 카테고리별 조회를 한곳에서 진행합니다.</p></div>';
 const panel=[...source.querySelectorAll('.panel')].find(x=>x.querySelector('#importedProducts'));
 if(panel){
  panel.querySelector('.panelHead h2').textContent='쿠팡 파트너스 상품 가져오기';
  const controls=panel.querySelector('.pad');
  const link=document.createElement('div');link.className='vpLinkInput';
  link.innerHTML='<b>상품 URL로 조회 · 등록</b><p>상품 ID가 포함된 원본 링크라면 기존 상품을 찾거나 상품명과 함께 등록합니다. 짧은 제휴링크는 상품명 검색을 사용하세요.</p><div class="vpLinkFields"><input id="vpProductURL" type="url" placeholder="https://www.coupang.com/vp/products/..." aria-label="쿠팡 상품 URL"><input id="vpProductTitle" placeholder="상품명 (신규 URL 등록 시 필요)" aria-label="등록할 상품명"><button class="btn primary" type="button" id="vpLookup">링크 확인</button></div><p id="vpLinkStatus" class="queueHint"></p>';
  controls.prepend(link);$('#vpLookup').onclick=lookup;
  const current=panel.querySelector('#tossSearch')?.closest('.field');if(current)current.querySelector('label').textContent='이름으로 상품 검색';
  root.insertBefore(panel,root.querySelector('#discoverProducts')?.closest('.panel')||null);
 }
 const storedPanel=root.querySelector('#discoverProducts')?.closest('.panel');if(storedPanel)storedPanel.querySelector('.panelHead h2').textContent='조회·저장한 상품 후보';
 const manual=[...source.querySelectorAll('.panel')].find(x=>x.querySelector('#manualName'));
 if(manual){const extra=document.createElement('details');extra.className='vpExtra';extra.innerHTML='<summary>직접 상품 정보 입력 · 수정</summary>';extra.append(manual);root.append(extra)}
 if($('#vpCatalogStatus'))$('#vpCatalogStatus').textContent='검색 결과에서 상품을 선택하세요. 기존 예상 점수는 실측 인기·판매 순위가 아닙니다.';
}
function init(){
 for(const tab of ['integrations','lab','analytics'])document.querySelector('.nav [data-view="'+tab+'"]')?.remove();
 const foot=$('.sideFoot');if(foot)foot.textContent='대시보드는 실제 기록만 표시합니다. 쿠팡 상품 검색은 상품 발굴 메뉴에 통합되었습니다.';
 dashboard();discovery();
 const nativeShow=window.show;
 if(typeof nativeShow==='function')window.show=function(id){nativeShow(['integrations','lab','analytics'].includes(id)?'discover':id);if(id==='dashboard')render()};
 const originalSelect=window.selectProduct;
 if(typeof originalSelect==='function')window.selectProduct=function(id){originalSelect(id);window.show('threads');window.vpStudioGo?.('threads','source')};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
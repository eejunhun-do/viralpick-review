/* Real Coupang Partners performance dashboard; no simulated metrics. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const fmt=n=>Number(n||0).toLocaleString('ko-KR');
const num=(x,...keys)=>{for(const k of keys){if(x?.[k]!=null&&Number.isFinite(Number(x[k])))return Number(x[k]);}return 0};
const today=()=>{const d=new Date(Date.now()+9*3600000);return d.toISOString().slice(0,10).replace(/-/g,'')};
function dateBefore(days){const d=new Date(Date.now()+9*3600000-days*86400000);return d.toISOString().slice(0,10).replace(/-/g,'')}
function el(tag,content){const node=document.createElement(tag);if(content!=null)node.textContent=content;return node}
function totals(rows,type){
 return rows.reduce((a,r)=>{
  if(type==='clicks')a.clicks+=num(r,'click','clicks');
  if(type==='orders'){a.orders+=num(r,'quantity','order','orders');a.gmv+=num(r,'gmv','orderAmount','salesAmount')}
  if(type==='cancels')a.cancels+=num(r,'quantity','cancel','cancels');
  if(type==='commission'){a.commission+=num(r,'commission','commissionAmount');a.commissionOrders+=num(r,'order','orders');a.commissionClicks+=num(r,'click','clicks');a.commissionGmv+=num(r,'gmv');}
  return a;
 },{clicks:0,orders:0,gmv:0,cancels:0,commission:0,commissionOrders:0,commissionClicks:0,commissionGmv:0})
}
function dayRows(reports){
 const days=new Map();
 for(const [type,rows] of Object.entries(reports)){
  for(const r of rows){
   const raw=String(r.date||r.orderDate||'');if(!/^\d{8}$/.test(raw))continue;
   if(!days.has(raw))days.set(raw,{date:raw,clicks:0,orders:0,gmv:0,cancels:0,commission:0});
   const v=days.get(raw);
   if(type==='clicks')v.clicks+=num(r,'click','clicks');
   if(type==='orders'){v.orders+=num(r,'quantity','order','orders');v.gmv+=num(r,'gmv','orderAmount')}
   if(type==='cancels')v.cancels+=num(r,'quantity','cancel','cancels');
   if(type==='commission')v.commission+=num(r,'commission','commissionAmount');
  }
 }
 return [...days.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
function display(data){
 const reports=data.reports||{};
 const click=totals(reports.clicks||[],'clicks'),order=totals(reports.orders||[],'orders'),cancel=totals(reports.cancels||[],'cancels'),commission=totals(reports.commission||[],'commission');
 const values={clicks:click.clicks,orders:order.orders,gmv:order.gmv,cancels:cancel.cancels,commission:commission.commission};
 for(const [key,value] of Object.entries(values))$('#vpReport'+key[0].toUpperCase()+key.slice(1)).textContent=reports[key==='gmv'?'orders':key]?' '+fmt(value)+(key==='gmv'||key==='commission'?'원':''):'조회 실패';
 const table=$('#vpReportRows');table.replaceChildren();
 const rows=dayRows(reports);
 if(!rows.length){const tr=el('tr'),td=el('td','해당 기간에 표시할 실적이 없습니다.');td.colSpan=6;tr.append(td);table.append(tr)}
 for(const r of rows){const tr=el('tr');for(const [i,v] of [r.date,r.clicks,r.orders,r.gmv,r.cancels,r.commission].entries()){const cell=el('td',i===0?v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6):fmt(v)+(i===3||i===5?'원':''));cell.dataset.label=['날짜','클릭','주문 수량','거래액','취소 수량','수수료'][i];tr.append(cell)}table.append(tr)}
 const failed=Object.entries(data.errors||{}).map(([k,v])=>k+': '+v);
 $('#vpReportStatus').textContent=(failed.length?'일부 조회 실패 — '+failed.join(' / '):'쿠팡 파트너스 실제 리포트 조회 완료')+' · 기간 '+data.startDate+' ~ '+data.endDate+' · 실적은 지연 반영될 수 있습니다.';
}
async function refresh(){
 const days=Number($('#vpReportPeriod')?.value||7),subId=$('#vpReportSubId')?.value.trim()||'';
 const end=dateBefore(1),start=dateBefore(days);
 const status=$('#vpReportStatus'),btn=$('#vpReportRefresh');
 if(!status||!btn)return;
 btn.disabled=true;status.textContent='쿠팡 파트너스 클릭·주문·취소·수익 조회 중…';
 try{
  const params=new URLSearchParams({startDate:start,endDate:end});if(subId)params.set('subId',subId);
  const response=await (typeof backendRequest==='function'
   ?backendRequest('/api/reports?'+params.toString(),{method:'GET'})
   :Promise.reject(Error('백엔드 연결이 준비되지 않았습니다.')));
  if(!response?.ok)throw Error(response?.message||'조회에 실패했습니다.');
  display(response);
 }catch(e){status.textContent='실제 리포트를 조회하지 못했습니다: '+String(e.message||e).slice(0,210)}
 finally{btn.disabled=false}
}
function init(){const btn=$('#vpReportRefresh');if(btn)btn.addEventListener('click',refresh)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.vpRefreshCoupangReports=refresh;
})();

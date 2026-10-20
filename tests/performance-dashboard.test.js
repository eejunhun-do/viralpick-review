import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const dashboard=readFileSync(new URL('../performance-dashboard.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../api/reports.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../v05.html',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../workspace-upgrade.js',import.meta.url),'utf8');

function harness(mock){
 const window={};
 const document={readyState:'loading',addEventListener(){}};
 const text=dashboard.replace(/\}\)\(\);\s*$/,'window.__tests={chunks,shift,monthStart,monthEnd,loadRange,sum};})();');
 runInNewContext(text,{document,window,Date,Map,Promise,URLSearchParams,Number,Math,Set,RegExp,backendRequest:mock});
 return window.__tests;
}
test('historical year is partitioned into consecutive reports of no more than 30 days',()=>{
 const h=harness(async()=>{throw Error('no request')});
 const parts=h.chunks('20250101','20251231');
 assert.equal(parts.length,13);
 assert.equal(parts[0][0],'20250101');
 assert.equal(parts.at(-1)[1],'20251231');
 for(let i=0;i<parts.length;i++){
  const [start,end]=parts[i];
  const delta=(Date.parse(end.slice(0,4)+'-'+end.slice(4,6)+'-'+end.slice(6,8))-Date.parse(start.slice(0,4)+'-'+start.slice(4,6)+'-'+start.slice(6,8)))/86400000;
  assert.ok(delta>=0&&delta<=29);
  if(i)assert.equal(start,h.shift(parts[i-1][1],1));
 }
});
test('daily affiliate totals are kept separate from social metrics and source failures',async()=>{
 let count=0;
 const h=harness(async path=>{
  count++;
  const u=new URL('https://example.test'+path),day=u.searchParams.get('startDate');
  return {ok:true,reports:{
   clicks:[{date:day,click:7}],
   orders:[{date:day,quantity:2,gmv:30000}],
   cancels:[],
   commission:[{date:day,commission:1500,order:2}]
  },hasMore:{},errors:{}};
 });
 const period=await h.loadRange('20250101','20250131','',null,false);
 assert.equal(count,2);
 assert.equal(period.daily.size,2);
 assert.equal(h.sum(period,'20250101','20250131','commission'),3000);
 assert.equal(h.sum(period,'20250101','20250131','clicks'),14);
 assert.equal(h.sum(period,'20250101','20250131','gmv'),60000);
 await h.loadRange('20250101','20250131','',null,false);
 assert.equal(count,2,'identical range should reuse in-memory cache');
});
test('incomplete commission retrieval must never be shown as confirmed zero',async()=>{
 const h=harness(async path=>{
  if(path.includes('startDate=20250131'))return {ok:true,reports:{clicks:[],orders:[],cancels:[]},errors:{commission:'API unavailable'}};
  return {ok:true,reports:{clicks:[],orders:[],cancels:[],commission:[{date:'20250101',commission:500}]}};
 });
 const period=await h.loadRange('20250101','20250131','',null,false);
 assert.equal(period.valid.commission,false);
 assert.equal(h.sum(period,'20250101','20250131','commission'),null);
});
test('dashboard includes lifetime date selector without manual recording or fabricated SNS income',()=>{
 assert.match(api,/pageValue/);
 assert.match(api,/20181101/);
 assert.match(dashboard,/작년 전체/);
 assert.match(dashboard,/직접 날짜 선택/);
 assert.match(dashboard,/전월 동기간 대비/);
 assert.match(dashboard,/Threads/);
 assert.match(dashboard,/Instagram/);
 assert.match(dashboard,/vpSocialPostRows/);
 assert.doesNotMatch(workspace,/vpRecordForm|viralpick-performance-v2/);
 assert.match(html,/performance-dashboard\.js\?v=1/);
});

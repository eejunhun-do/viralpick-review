import {session} from '../lib/account-store.js';
import {json,preflight,checkAccess} from '../lib/api-guard.js';
import {partnerRequest} from '../lib/coupang-partners.js';
const ROOT='/v2/providers/affiliate_open_api/apis/openapi/v1/reports/';
const KINDS=['clicks','orders','cancels','commission'];
export function OPTIONS(req){return preflight(req)}
function validDate(s){if(!/^\d{8}$/.test(s))return false;const d=new Date(s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10).replace(/-/g,'')===s}
export async function GET(req){
 const denied=checkAccess(req);if(denied)return json(req,{ok:false,message:denied},401);
 const u=new URL(req.url),start=u.searchParams.get('startDate')||'',end=u.searchParams.get('endDate')||'';
 if(!validDate(start)||!validDate(end))return json(req,{ok:false,message:'날짜는 YYYYMMDD 형식이어야 합니다.'},400);
 const a=Date.parse(start.slice(0,4)+'-'+start.slice(4,6)+'-'+start.slice(6,8)+'T00:00:00Z');
 const b=Date.parse(end.slice(0,4)+'-'+end.slice(4,6)+'-'+end.slice(6,8)+'T00:00:00Z');
 if(b<a||b-a>29*86400000||b>Date.now())return json(req,{ok:false,message:'조회 기간은 최대 30일이며 미래 날짜는 조회할 수 없습니다.'},400);
 const subId=u.searchParams.get('subId')||'';
 if(subId&&!/^[A-Za-z0-9_-]{1,48}$/.test(subId))return json(req,{ok:false,message:'subId 형식이 올바르지 않습니다.'},400);
 const query=new URLSearchParams({startDate:start,endDate:end,page:'0'});if(subId)query.set('subId',subId);
 const reports={},errors={};
 // Make independent requests: one failed report must not fabricate zero-valued performance.
 const outcome=await Promise.all(KINDS.map(async kind=>{
  try{
   const response=await partnerRequest('GET',ROOT+kind+'?'+query.toString(),undefined,session(req));
   const rows=Array.isArray(response?.data)?response.data:Array.isArray(response?.data?.data)?response.data.data:Array.isArray(response?.data?.items)?response.data.items:null;
   if(!rows)throw Error('리포트 데이터 형식을 확인하지 못했습니다.');
   return {kind,rows:rows.slice(0,1000)};
  }catch(e){return {kind,error:String(e.message||'조회 실패').slice(0,200)}}
 }));
 for(const x of outcome){if(x.error)errors[x.kind]=x.error;else reports[x.kind]=x.rows}
 return json(req,{ok:Object.keys(reports).length>0,partial:Object.keys(errors).length>0,startDate:start,endDate:end,reports,errors,source:'coupang-partners',notice:'쿠팡 파트너스 실적은 지연 집계될 수 있으며 주문·취소·수익의 확정 기준이 다를 수 있습니다.'},Object.keys(reports).length?200:502);
}

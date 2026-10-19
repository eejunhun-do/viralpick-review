import {session} from '../lib/account-store.js';
import {json,preflight,checkAccess} from '../lib/api-guard.js';
import {partnerRequest,isConfigured,validProductUrl} from '../lib/coupang-partners.js';

const ROOT='/v2/providers/affiliate_open_api/apis/openapi/products';
const CATEGORIES={
 '1001':'여성패션','1002':'남성패션','1010':'뷰티','1011':'출산/유아동','1012':'식품',
 '1013':'주방용품','1014':'생활용품','1015':'홈인테리어','1016':'가전디지털',
 '1017':'스포츠/레저','1018':'자동차용품','1019':'도서/음반/DVD','1020':'완구/취미',
 '1021':'문구/오피스','1024':'헬스/건강식품','1025':'국내여행','1026':'해외여행',
 '1029':'반려동물용품','1030':'유아동패션'
};
const PL_BRANDS=new Set(['1001','1002','1003','1004','1006','1007','1008','1010','1011']);
export function OPTIONS(req){return preflight(req)}
export async function GET(req){
 const denied=checkAccess(req);
 if(denied)return json(req,{ok:false,message:denied},denied.includes('설정')?503:401);
 if(!session(req)&&!isConfigured())return json(req,{ok:false,message:'쿠팡 파트너스 API 키를 Vercel에 먼저 등록해 주세요.'},503);
 const u=new URL(req.url),kind=u.searchParams.get('kind')||'category';
 const limit=Math.max(1,Math.min(100,Number(u.searchParams.get('limit')||20)||20));
 const subId=(u.searchParams.get('subId')||'').trim();
 if(subId&&!/^[a-zA-Z0-9_-]{1,48}$/.test(subId))return json(req,{ok:false,message:'subId 형식이 올바르지 않습니다.'},400);
 const query=new URLSearchParams({limit:String(limit)});
 if(subId)query.set('subId',subId);
 let path;
 if(kind==='category'){
  const categoryId=u.searchParams.get('categoryId')||'1014';
  if(!Object.prototype.hasOwnProperty.call(CATEGORIES,categoryId))return json(req,{ok:false,message:'지원되지 않는 카테고리 코드입니다.'},400);
  path=ROOT+'/bestcategories/'+categoryId;
 }else if(kind==='goldbox'){
  path=ROOT+'/goldbox';query.delete('limit');
 }else if(kind==='pl'){
  path=ROOT+'/coupangPL';
 }else if(kind==='brand'){
  const brandId=u.searchParams.get('brandId')||'1001';
  if(!PL_BRANDS.has(brandId))return json(req,{ok:false,message:'지원하지 않는 쿠팡 PL 브랜드 코드입니다.'},400);
  path=ROOT+'/coupangPL/'+brandId;
 }else return json(req,{ok:false,message:'지원되지 않는 조회 유형입니다.'},400);
 try{
  const raw=await partnerRequest('GET',path+(query.size?'?'+query.toString():''),undefined,session(req));
  const rows=Array.isArray(raw.data)?raw.data:Array.isArray(raw.data?.productData)?raw.data.productData:null;
  if(!rows)return json(req,{ok:false,message:'API 상품 목록 형식이 예상과 다릅니다.'},502);
  const products=rows.slice(0,100).map(p=>({
   id:p.productId==null?null:String(p.productId),
   name:String(p.productName||'').slice(0,200),
   price:Number.isFinite(Number(p.productPrice))?Number(p.productPrice):null,
   imageUrl:typeof p.productImage==='string'&&/^https?:\/\//i.test(p.productImage)?p.productImage.slice(0,2000):null,
   productUrl:validProductUrl(p.productUrl),
   isRocket:!!p.isRocket,isFreeShipping:!!p.isFreeShipping,
   categoryName:typeof p.categoryName==='string'?p.categoryName.slice(0,80):'',
   provider:'coupang-partners'
  })).filter(p=>p.id&&p.name&&p.price!==null);
  return json(req,{ok:true,provider:'coupang-partners',kind,products,
    notice:'API 응답에 제공된 상품 정보이며 가격은 변경될 수 있습니다. 실적 추적용 링크와 이미지 권한을 게시 전에 확인하세요.'});
 }catch(e){return json(req,{ok:false,message:e.message||'쿠팡 상품 조회 실패'},e.status===503?503:502)}
}
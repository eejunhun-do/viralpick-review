/* Unified ViralPick discovery and real-data dashboard. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
function dashboard(){
 const root=$('#dashboard');if(!root)return;
 root.innerHTML='<div id="vpPerformanceDashboard"></div><div id="dashProducts" hidden></div>';
 if(typeof window.vpSetupPerformanceDashboard==='function')window.vpSetupPerformanceDashboard();
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
  const current=panel.querySelector('#tossSearch')?.closest('.field');if(current){const label=current.querySelector('label');if(label&&label.firstChild&&label.firstChild.nodeType===3)label.firstChild.textContent='이름으로 상품 검색';}
  root.insertBefore(panel,root.querySelector('#discoverProducts')?.closest('.panel')||null);
 }
 const storedPanel=root.querySelector('#discoverProducts')?.closest('.panel');if(storedPanel)storedPanel.querySelector('.panelHead h2').textContent='조회·저장한 상품 후보';
 const manual=[...source.querySelectorAll('.panel')].find(x=>x.querySelector('#manualName'));
 if(manual){const extra=document.createElement('details');extra.className='vpExtra';extra.innerHTML='<summary>직접 상품 정보 입력 · 수정</summary>';extra.append(manual);root.append(extra)}
 if($('#vpCatalogStatus'))$('#vpCatalogStatus').textContent='검색 결과에서 상품을 선택하세요. 기존 예상 점수는 실측 인기·판매 순위가 아닙니다.';
}
function init(){
 for(const tab of ['integrations','lab','analytics'])document.querySelector('.nav [data-view="'+tab+'"]')?.remove();
 const foot=$('.sideFoot');if(foot)foot.textContent='수익은 실제 제휴 API를 기준으로 표시하고, Threads와 Instagram은 비금전 성과를 별도로 분석합니다.';
 dashboard();discovery();
 const nativeShow=window.show;
 if(typeof nativeShow==='function')window.show=function(id){nativeShow(['integrations','lab','analytics'].includes(id)?'discover':id);if(id==='dashboard')window.vpPerformanceOnShow?.()};
 const originalSelect=window.selectProduct;
 if(typeof originalSelect==='function')window.selectProduct=function(id){originalSelect(id);window.show('threads');window.vpStudioGo?.('threads','source')};
 const current=document.querySelector('.view.active')?.id;
 if(['integrations','lab','analytics'].includes(current))window.show('dashboard');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
/* ViralPick official Meta connection, queue and performance. No demo metrics. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={threads:'Threads',instagram:'Instagram'};
const digits=v=>v===null||v===undefined?'—':Number(v).toLocaleString('ko-KR');
const state={connected:{},busy:false};
function note(s){const e=$('#vpSocialNotice');if(e)e.textContent=s;try{window.vpActivityLog?.('소셜 예약',s)}catch{}}
function backend(path,opt){return window.backendRequest(path,opt)}
async function get(path){return backend('/api/social?'+path)}
async function post(body){return backend('/api/social',{method:'POST',body:JSON.stringify(body)})}
function dateDefault(){
 const d=new Date(Date.now()+2*3600000+9*3600000).toISOString();
 return {date:d.slice(0,10),time:d.slice(11,16)};
}
function render(){
 const root=$('#scheduler');if(!root||$('#vpMetaPanel'))return;
 const p=document.createElement('section');p.id='vpMetaPanel';p.className='panel';p.innerHTML=
 '<div class="panelHead"><h2>Meta 공식 API · 계정 연동 / 실제 예약 게시</h2><span class="badge blue">계정별 보안 연결</span></div>'+
 '<div class="pad"><p id="vpSocialNotice" role="status">Meta 연결 상태를 확인하세요. 이 영역에서 등록한 예약만 실제 서버 큐에 저장됩니다.</p>'+
 '<div class="vpMetaAccounts">'+Object.entries(labels).map(([k,n])=>'<div class="vpMetaAccount"><b>'+n+'</b><span id="vpMetaState-'+k+'">확인 중</span> <button class="btn" type="button" data-meta-connect="'+k+'">공식 계정 연결</button> <button class="btn" type="button" data-meta-disconnect="'+k+'">연결 해제</button></div>').join('')+'</div>'+
 '<h3>검수 완료 콘텐츠 서버 예약</h3><div class="vpMetaForm">'+
 '<label>플랫폼<select id="vpMetaPlatform"><option value="threads">Threads</option><option value="instagram">Instagram</option></select></label>'+
 '<label>게시일 (한국시간)<input id="vpMetaDate" type="date"></label>'+
 '<label>게시 시각 (한국시간)<input id="vpMetaTime" type="time"></label>'+
 '<label style="grid-column:1/-1">최종 게시 본문<textarea id="vpMetaText" rows="5" maxlength="2000" placeholder="게시 문구를 검토한 뒤 입력하세요"></textarea></label>'+
 '<label style="grid-column:1/-1">공개 HTTPS 이미지 URL (한 줄에 한 장, 최대 10장)<textarea id="vpMetaUrls" rows="3" placeholder="https://.../photo.jpg"></textarea></label>'+
 '<label style="grid-column:1/-1">이미지 파일 업로드 (선택, Vercel Blob 연결 필요)<input id="vpMetaUpload" type="file" multiple accept="image/jpeg,image/png,image/webp"></label></div>'+
 '<p class="queueHint">Instagram은 공개 이미지가 최소 1장 필요하며 2장 이상이면 캐러셀로 게시합니다. Threads는 본문만 또는 이미지와 함께 게시할 수 있습니다. 기존 브라우저 모의예약과 별개로 이 화면에서 서버 예약을 등록하세요.</p>'+
 '<label class="vpMetaApproval"><input type="checkbox" id="vpMetaApproved"> 본문·상품 정보·이미지 권리·제휴 링크 및 광고 고지를 확인했고 자동 게시를 승인합니다.</label>'+
 '<div class="btnrow"><button class="btn" id="vpMetaImport">현재 제작 문구 불러오기</button><button class="btn primary" id="vpMetaSchedule">✓ 실제 서버 예약 등록</button><button class="btn" id="vpMetaReload">예약 / 연동 새로고침</button></div>'+
 '<h3>서버 예약 게시 큐</h3><div id="vpMetaJobs" aria-live="polite">로그인 후 예약을 불러옵니다.</div>'+
 '<p class="queueHint">Meta 앱 설정·계정 권한·예약 실행 스케줄러가 준비되어야 자동 발행됩니다. 실패 시 중복 게시하지 않고 수동 검토 상태로 남깁니다.</p></div>';
 const first=root.querySelector('.top');first?.after(p);
 const s=document.createElement('style');s.textContent=
 '#vpMetaPanel{scroll-margin-top:55px}#vpMetaPanel .pad>h3{margin:24px 0 12px}.vpMetaAccounts{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px;margin:15px 0}.vpMetaAccount{padding:14px;border:1px solid #dbe0e8;border-radius:12px;display:flex;gap:9px;align-items:center;flex-wrap:wrap}.vpMetaAccount span{flex:1;min-width:100px;font-size:12px}.vpMetaForm{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.vpMetaForm label{font-size:12px;font-weight:700}.vpMetaForm input,.vpMetaForm textarea,.vpMetaForm select{width:100%;padding:10px;border:1px solid #dbe0e8;border-radius:8px;margin-top:5px}.vpMetaApproval{display:block;margin:16px 0;font-size:13px}.vpMetaApproval input{margin-right:8px}.vpMetaQueueRow{border-top:1px solid #e5e7ed;padding:11px 0;font-size:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.vpMetaQueueRow span{flex:1;min-width:180px}.vpMetaQueueRow a{color:#3462af}@media(max-width:700px){.vpMetaForm{grid-template-columns:1fr}}';
 document.head.append(s);
 const d=dateDefault();$('#vpMetaDate').value=d.date;$('#vpMetaTime').value=d.time;
 p.querySelectorAll('[data-meta-connect]').forEach(b=>b.onclick=()=>connect(b.dataset.metaConnect));
 p.querySelectorAll('[data-meta-disconnect]').forEach(b=>b.onclick=()=>disconnect(b.dataset.metaDisconnect));
 $('#vpMetaImport').onclick=importCurrent;
 $('#vpMetaSchedule').onclick=schedule;
 $('#vpMetaReload').onclick=refresh;
 const social=new URLSearchParams(location.search).get('social');
 if(social){note(social==='connected'?'Meta 계정 인증 완료. 연결 상태를 새로고침합니다.':'Meta 인증 결과: '+social);history.replaceState(null,'',location.pathname+'?view=scheduler')}
 if(sessionStorage.getItem('vp_session'))void refresh();
}
async function connect(platform){
 try{note(labels[platform]+' 공식 인증 페이지를 여는 중…');const d=await get('op=connect&platform='+platform);location.assign(d.url)}
 catch(e){note('계정 연결 준비 실패: '+e.message)}
}
async function disconnect(platform){
 if(!confirm(labels[platform]+' 연결을 해제할까요? 이미 승인한 미게시 예약도 앞으로 발행되지 않습니다.'))return;
 try{await post({action:'disconnect',platform});note(labels[platform]+' 연결 해제됨');await refresh()}catch(e){note(e.message)}
}
function importCurrent(){
 const platform=$('#vpMetaPlatform').value;
 const source=platform==='threads'?$('#threadFinalText')?.value:$('#instaCaption')?.value;
 const alternate=platform==='threads'?$('#multiThreadCaption')?.value:$('#multiInstagramCaption')?.value;
 $('#vpMetaText').value=String(source||alternate||'').slice(0,2000);
 note($('#vpMetaText').value?'현재 제작 문구를 불러왔습니다. 광고 고지 및 이미지를 다시 확인하세요.':'작성된 문구를 찾지 못했습니다. 먼저 제작 메뉴에서 본문을 작성하세요.');
}
async function uploadImages(files){
 const urls=[];for(const file of files){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3.8*1024*1024)throw Error('사진은 JPG/PNG/WebP, 3.8MB 이하여야 합니다.');
  const form=new FormData();form.append('file',file);
  const base=location.hostname.endsWith('.vercel.app')?location.origin:(typeof persistBackendUrl==='function'?persistBackendUrl():location.origin);
  const token=sessionStorage.getItem('vp_session')||'';
  const res=await fetch(base+'/api/social-media',{method:'POST',headers:{Authorization:'Bearer '+token},body:form});
  const d=await res.json().catch(()=>({}));if(!res.ok||!d.ok)throw Error(d.message||'사진 업로드 실패');
  urls.push(d.url);
 }return urls;
}
async function schedule(){
 if(state.busy)return;
 const button=$('#vpMetaSchedule');state.busy=true;button.disabled=true;
 try{
  const platform=$('#vpMetaPlatform').value;
  const datetime=$('#vpMetaDate').value+'T'+$('#vpMetaTime').value+':00+09:00';
  const timestamp=new Date(datetime).toISOString();
  const base=$('#vpMetaUrls').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const files=[...$('#vpMetaUpload').files];
  if(!$('#vpMetaApproved').checked)throw Error('게시 내용을 검토하고 승인 항목에 체크해 주세요.');
  if(platform==='instagram'&&!base.length&&!files.length)throw Error('Instagram은 최소 1장 이상 이미지를 선택해 주세요.');
  if(base.length+files.length>10)throw Error('이미지는 최대 10장입니다.');
  if(files.length){note('예약 사진 '+files.length+'장 업로드 중…');base.push(...await uploadImages(files))}
  const product=typeof selected!=='undefined'?selected?.name||'':'';
  note('Meta 서버 예약을 등록하는 중…');
  const d=await post({action:'schedule',platform,text:$('#vpMetaText').value,imageUrls:base,scheduledAt:timestamp,approved:true,product});
  note('실제 서버 예약 등록 완료 · '+new Date(d.scheduledAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}));
  $('#vpMetaApproved').checked=false;$('#vpMetaUpload').value='';await refresh();
 }catch(e){note('예약 실패: '+e.message)}finally{state.busy=false;button.disabled=false}
}
async function refresh(){
 if(!sessionStorage.getItem('vp_session')){note('ViralPick 로그인이 필요합니다.');return}
 try{
  const [status,jobs]=await Promise.all([get('op=status'),get('op=jobs')]);
  state.connected=status.platforms;
  for(const p of Object.keys(labels)){
   const c=status.platforms[p],el=$('#vpMetaState-'+p);
   el.textContent=c?.connected?'연결됨 · @'+(c.username||'계정'):(status.configured[p]?'미연결':'Meta 앱 서버 설정 필요');
  }
  if(!status.schedulerConfigured)note('예약 실행용 CRON_SECRET이 서버에 설정되지 않았습니다. 등록된 예약은 자동 실행되지 않습니다.');
  showJobs(jobs.posts||[]);
 }catch(e){note('연결 상태 확인 실패: '+e.message)}
}
function showJobs(posts){
 const root=$('#vpMetaJobs');root.replaceChildren();
 if(!posts.length){root.textContent='서버에 저장된 예약이 없습니다.';return}
 for(const j of posts){
  const row=document.createElement('div');row.className='vpMetaQueueRow';
  const name=document.createElement('span');
  const statuses={scheduled:'예약 대기',processing:'발행 중',published:'발행 완료',cancelled:'취소됨',needs_review:'실패 · 수동 확인 필요'};
  name.textContent=labels[j.platform]+' · '+(statuses[j.status]||j.status)+' · '+new Date(j.scheduledAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' · '+(j.product||j.text.slice(0,36));
  row.append(name);
  if(j.error){const err=document.createElement('small');err.textContent=j.error;row.append(err)}
  if(j.postId){const tag=document.createElement('small');tag.textContent='게시 ID: '+j.postId;row.append(tag)}
  if(j.status==='scheduled'){const b=document.createElement('button');b.className='btn';b.textContent='예약 취소';b.onclick=async()=>{if(!confirm('예약을 취소할까요?'))return;try{await post({action:'cancel',id:j.id});await refresh()}catch(e){note(e.message)}};row.append(b)}
  root.append(row);
 }
}
async function renderMetrics(){
 const root=$('#vpPerformanceDashboard');
 if(!root||!sessionStorage.getItem('vp_session'))return;
 const rows=$('#vpSocialPostRows');if(!rows)return;
 try{
  const data=await get('op=insights');
  const posts=[];
  const cards=root.querySelectorAll('.vpSocialCard');
  for(const [i,p] of Object.keys(labels).entries()){
   const d=data.platforms[p]||{},card=cards[i];
   if(card){
    const caption=card.querySelector('span');if(caption)caption.textContent=d.connected?'연동됨 @'+(d.username||'계정'):'계정 미연결';
    const sub=card.querySelector('small');if(sub)sub.textContent=d.error?'API 오류: '+d.error:'공식 Meta 게시물 통계 · 최근 12건';
    const all=d.posts||[],sums=key=>all.reduce((s,x)=>s+(Number(x[key])||0),0);
    const fields=card.querySelectorAll('.vpSocialMetrics b');
    if(fields.length===4){const keys=p==='threads'?['views','likes','replies','reposts']:['views','reach','likes','saved'];keys.forEach((k,j)=>fields[j].textContent=d.connected&&all.some(x=>x[k]!==null)?digits(sums(k)):'—')}
   }
   for(const x of d.posts||[])posts.push({...x,platform:p});
  }
  rows.replaceChildren();
  posts.sort((a,b)=>String(b.timestamp).localeCompare(String(a.timestamp)));
  if(!posts.length){const tr=rows.insertRow();const td=tr.insertCell();td.colSpan=6;td.textContent='Meta 게시물 통계가 없거나 연결 권한이 없습니다.';return}
  for(const x of posts){
   const tr=rows.insertRow();
   for(const t of [labels[x.platform]+' · '+x.text.slice(0,42),digits(x.views),digits(x.reach),digits(x.likes),digits(x.replies),digits(x.saved??x.shares)]){
    const td=tr.insertCell();td.textContent=t;
   }
   if(x.permalink){const a=document.createElement('a');a.href=x.permalink;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' ↗';tr.cells[0].append(a)}
  }
 }catch(e){
  const foot=root.querySelector('.vpSocialPosts .vpPanelHeading small');if(foot)foot.textContent='Meta 통계 조회 실패: '+e.message;
 }
}
function boot(){
 render();
 const original=window.vpPerformanceOnShow;
 window.vpPerformanceOnShow=function(){if(original)original();void renderMetrics()};
 const onLogin=window.vpPerformanceOnLogin;
 window.vpPerformanceOnLogin=function(){if(onLogin)onLogin();void refresh();void renderMetrics()};
 document.querySelectorAll('#threads .finalActions, #instagram .finalActions').forEach(el=>{
  const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Meta 서버 실제 예약';
  b.onclick=()=>{const p=el.closest('#threads')?'threads':'instagram';window.show('scheduler');$('#vpMetaPlatform').value=p;importCurrent();$('#vpMetaPanel')?.scrollIntoView({behavior:'smooth'});};
  el.querySelector('.pad')?.append(b);
 });
 if($('#vpPerformanceDashboard'))void renderMetrics();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
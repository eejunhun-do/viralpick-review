/* ViralPick official Meta connection, queue and performance. No demo metrics. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={threads:'Threads',instagram:'Instagram'};
const digits=v=>v===null||v===undefined?'—':Number(v).toLocaleString('ko-KR');
const state={connected:{},busy:false,refreshing:null};
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

function organizeScheduler(){
 const root=$('#scheduler'),panel=$('#vpMetaPanel');if(!root||!panel)return;
 const top=root.querySelector('.top'),header=top?.querySelector('h1'),subtitle=top?.querySelector('p');
 if(header)header.textContent='자동게시 관리';
 if(subtitle)subtitle.textContent='실제 연결 계정과 예약·발행 결과를 한곳에서 확인하세요. 제작 화면에서 예약하면 완성 이미지도 함께 전송됩니다.';
 top?.querySelector('.btnrow')?.remove(); 
 const pad=panel.querySelector('.pad');
 const titles=[...pad.querySelectorAll(':scope > h3')];
 const manualTitle=titles.find(x=>x.textContent.includes('검수 완료 콘텐츠'));
 const queueTitle=titles.find(x=>x.textContent.includes('서버 예약 게시 큐'));
 const jobs=$('#vpMetaJobs');
 const manualForm=pad.querySelector('.vpMetaForm');
 const consent=pad.querySelector('.vpMetaApproval');
 const buttons=$('#vpMetaSchedule')?.closest('.btnrow');
 const manualHint=manualForm?.nextElementSibling;
 if(manualTitle&&manualForm&&consent&&buttons){
  const details=document.createElement('details');details.className='vpMetaManual';
  const summary=document.createElement('summary');summary.textContent='직접 작성해서 예약하기 (선택 기능)';details.append(summary);
  const help=document.createElement('p');help.className='queueHint';help.textContent='제작한 콘텐츠는 Threads·Instagram 제작 화면에서 예약하세요. 이곳은 직접 글이나 외부 이미지를 등록할 때만 사용합니다.';
  details.append(help,manualForm);
  const reply=document.createElement('label');reply.textContent='Threads 2단 답글 (선택)';
  reply.className='vpMetaWide';reply.id='vpMetaReplyWrap';
  const replyInput=document.createElement('textarea');replyInput.id='vpMetaReplyText';replyInput.maxLength=500;replyInput.rows=2;replyInput.placeholder='첫 게시물에 연결할 답글';
  reply.append(replyInput);manualForm.append(reply);
  const advanced=document.createElement('details');advanced.className='vpMetaAdvanced';
  const advTitle=document.createElement('summary');advTitle.textContent='외부 이미지 직접 등록 (선택)';advanced.append(advTitle);
  for(const selector of ['#vpMetaUrls','#vpMetaUpload']){
   const label=manualForm.querySelector(selector)?.closest('label');if(label)advanced.append(label);
  }
  details.append(advanced,consent,buttons);
  if(manualHint)manualHint.remove();
  manualTitle.replaceWith(details);
  $('#vpMetaPlatform').onchange=()=>{reply.hidden=$('#vpMetaPlatform').value!=='threads'};
 }
 if(queueTitle&&jobs){
  pad.insertBefore(queueTitle,pad.querySelector('.vpMetaManual')||null);
  pad.insertBefore(jobs,pad.querySelector('.vpMetaManual')||null);
  queueTitle.textContent='실제 예약 · 발행 내역';
  const updated=document.createElement('small');updated.id='vpMetaUpdated';updated.textContent='30초마다 상태 자동 갱신';queueTitle.append(updated);
 }
 const go=document.createElement('div');go.className='vpMetaStudio';
 const label=document.createElement('span');label.textContent='제작한 콘텐츠의 이미지까지 자동 예약하려면';
 const t=document.createElement('button');t.className='btn';t.type='button';t.textContent='Threads 제작';t.onclick=()=>window.show?.('threads');
 const ig=document.createElement('button');ig.className='btn';ig.type='button';ig.textContent='Instagram 제작';ig.onclick=()=>window.show?.('instagram');
 go.append(label,t,ig);
 panel.querySelector('.vpMetaAccounts')?.after(go);
 const s=document.createElement('style');s.textContent=
 '#scheduler>.panel:not(#vpMetaPanel),#scheduler>.settingGrid,#scheduler>.twocol{display:none!important}'+
 '#vpMetaPanel .pad{padding:18px 20px}#vpMetaPanel .vpMetaAccounts{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:12px;margin:14px 0}'+
 '#vpMetaPanel .vpMetaAccount{padding:14px;border:1px solid #e2e6ed;border-radius:12px;background:#fff;display:flex;gap:8px;flex-wrap:wrap;align-items:center}'+
 '#vpMetaPanel .vpMetaAccount span{flex:1;min-width:105px}'+
 '#vpMetaPanel .vpMetaStudio{padding:14px;background:#f4f7fc;border-radius:12px;margin:18px 0 24px;display:flex;align-items:center;flex-wrap:wrap;gap:9px;font-size:12px}'+
 '#vpMetaPanel .vpMetaStudio span{flex:1;min-width:200px;color:#576578}'+
 '#vpMetaPanel #vpMetaUpdated{display:block;font-size:11px;color:#788597;font-weight:400;margin-top:5px}'+
 '#vpMetaPanel #vpMetaJobs{margin:12px 0 22px}'+
 '#vpMetaPanel .vpMetaQueueRow{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;border-bottom:1px solid #e8edf2;padding:14px 2px}'+
 '#vpMetaPanel .vpMetaJobMain{flex:1;min-width:195px}#vpMetaPanel .vpMetaJobMain p{font-size:13px;line-height:1.6;margin:8px 0 4px;white-space:pre-wrap;overflow-wrap:anywhere}'+
 '#vpMetaPanel .vpMetaJobMain small{font-size:11px;color:#7b8594}#vpMetaPanel .vpMetaJobError{display:block;color:#a84835!important;margin-top:5px}'+
 '#vpMetaPanel .vpMetaJobActions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}'+
 '#vpMetaPanel .vpMetaStatus{display:inline-block;font-size:11px;font-weight:750;padding:5px 9px;border-radius:9px;background:#eef1f6;color:#506070}'+
 '#vpMetaPanel .vpMetaStatus.published{background:#e7f5ec;color:#217651}#vpMetaPanel .vpMetaStatus.needs_review{background:#fff0e6;color:#a85721}'+
 '#vpMetaPanel .vpMetaManual{margin:22px 0 6px;border:1px solid #e0e5ed;border-radius:11px;padding:0 15px 16px}'+
 '#vpMetaPanel .vpMetaManual>summary{cursor:pointer;font-size:13px;font-weight:750;padding:15px 0}'+
 '#vpMetaPanel .vpMetaAdvanced{border:1px solid #e3e9ef;border-radius:9px;padding:12px;margin:15px 0}'+
 '#vpMetaPanel .vpMetaAdvanced summary{cursor:pointer;font-size:12px;font-weight:700}'+
 '#vpMetaPanel .vpMetaAdvanced label{display:block;margin-top:12px;font-size:12px;font-weight:700}'+
 '#vpMetaPanel .vpMetaAdvanced input,#vpMetaPanel .vpMetaAdvanced textarea,#vpMetaPanel #vpMetaReplyText{width:100%;box-sizing:border-box;padding:10px;border:1px solid #dbe1e8;border-radius:9px;margin-top:6px}'+
 '@media(max-width:700px){#vpMetaPanel .pad{padding:14px}}';
 document.head.append(s);
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
  const product=''; // Manual text entry is not automatically associated with the selected product.
  note('Meta 서버 예약을 등록하는 중…');
  const d=await post({action:'schedule',platform,text:$('#vpMetaText').value,replyText:platform==='threads'?$('#vpMetaReplyText').value:'',imageUrls:base,scheduledAt:timestamp,approved:true,product});
  note('실제 서버 예약 등록 완료 · '+new Date(d.scheduledAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}));
  $('#vpMetaApproved').checked=false;$('#vpMetaUpload').value='';await refresh();
 }catch(e){note('예약 실패: '+e.message)}finally{state.busy=false;button.disabled=false}
}
async function refresh(announce=false){
 if(!sessionStorage.getItem('vp_session')){note('ViralPick 로그인이 필요합니다.');return}
 if(state.refreshing)return state.refreshing;
 state.refreshing=(async()=>{
  try{
   const [status,jobs]=await Promise.all([get('op=status'),get('op=jobs')]);
   state.connected=status.platforms||{};
   for(const p of Object.keys(labels)){
    const c=state.connected[p]||{},el=$('#vpMetaState-'+p);
    if(el)el.textContent=c.connected?'연결됨 · @'+(c.username||'계정'):(status.configured?.[p]?'계정 연결 필요':'Meta 앱 설정 필요');
    const disconnect=document.querySelector('[data-meta-disconnect="'+p+'"]');
    if(disconnect)disconnect.hidden=!c.connected;
    const connect=document.querySelector('[data-meta-connect="'+p+'"]');
    if(connect)connect.textContent=c.connected?'다시 연결':'계정 연결';
   }
   if(!status.schedulerConfigured)note('예약 실행용 서버 설정이 필요합니다.');
   else if(announce)note('최신 예약 상태를 불러왔습니다.');
   showJobs(jobs.posts||[]);
   const updated=$('#vpMetaUpdated');if(updated)updated.textContent='최근 갱신 '+new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'})+' · 30초마다 자동 갱신';
  }catch(e){note('상태 새로고침 실패: '+e.message)}
  finally{state.refreshing=null}
 })();
 return state.refreshing;
}
async function confirmPublished(id){
 try{
  note('Meta 공식 게시 내역과 비교하는 중입니다.');
  const result=await post({action:'reconcile',id});
  note(result.matched?'실제 게시물 확인 완료. 발행 상태를 갱신했습니다.':result.post?.syncError||'일치하는 게시물을 찾지 못했습니다. 계정에서 실제 게시 여부를 확인해 주세요.');
 }catch(e){note('확인 실패: '+e.message)}
 await refresh();
}
function showJobs(posts){
 const root=$('#vpMetaJobs');root.replaceChildren();
 if(!posts.length){root.textContent='아직 실제 서버 예약 내역이 없습니다.';return}
 const statuses={scheduled:'예약 대기',processing:'발행 처리 중',published:'발행 완료',published_reply_failed:'1단 완료 · 2단 실패',cancelled:'취소됨',needs_review:'수동 확인 필요'};
 for(const j of posts){
  const row=document.createElement('div');row.className='vpMetaQueueRow';
  const main=document.createElement('div');main.className='vpMetaJobMain';
  const title=document.createElement('div');
  const platform=document.createElement('b');platform.textContent=labels[j.platform]||j.platform;
  const badge=document.createElement('span');badge.className='vpMetaStatus '+j.status;
  const overdue=j.status==='scheduled'&&Number(j.scheduledAt)+120000<Date.now();
  badge.textContent=overdue?'예약 시간 경과 · 확인 중':statuses[j.status]||j.status;
  title.append(platform,' · ',badge);main.append(title);
  const content=document.createElement('p');content.textContent=j.text||j.product||'';main.append(content);
  const when=document.createElement('small');when.textContent=new Date(j.scheduledAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});main.append(when);
  if(j.error||j.syncError){const err=document.createElement('small');err.className='vpMetaJobError';err.textContent=j.error||j.syncError;main.append(err)}
  const actions=document.createElement('div');actions.className='vpMetaJobActions';
  if(j.permalink){try{const u=new URL(j.permalink);if(u.protocol==='https:'){const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='게시물 보기 ↗';a.className='btn';actions.append(a)}}catch{}}
  if(j.postId&&!j.permalink){const small=document.createElement('small');small.textContent='게시 ID: '+j.postId;actions.append(small)}
  if(overdue||j.status==='needs_review'){
   const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='발행 여부 확인';
   b.onclick=async()=>{b.disabled=true;await confirmPublished(j.id)};actions.append(b);
  }
  if(j.status==='scheduled'&&!overdue){
   const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='예약 취소';
   b.onclick=async()=>{if(!confirm('아직 발행되지 않은 예약을 취소할까요?'))return;try{await post({action:'cancel',id:j.id});await refresh()}catch(e){note(e.message)}};actions.append(b);
  }
  row.append(main,actions);root.append(row);
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

async function realReservation(){
 if(state.busy)return;
 const ids=['reserveApproved','reserveProductCheck','reserveLinkCheck'];
 if(!ids.every(id=>$('#'+id)?.checked)){const e=$('#reserveWarning');if(e)e.textContent='게시글·상품·제휴 정보를 모두 검수해야 합니다.';return}
 const p=$('#reservePlatform')?.textContent?.toLowerCase();
 const platform=p==='instagram'?'instagram':'threads';
 const text=$('#reserveText')?.value||'';
 const date=$('#reserveDate')?.value,time=$('#reserveTime')?.value;
 const e=$('#reserveWarning'),button=$('#confirmReserveBtn');
 const show=s=>{if(e)e.textContent=s;note(s)};
 if(typeof selected!=='undefined'&&selected?.source==='sample'){show('시연용 예시 상품은 실제 자동 게시할 수 없습니다. 상품 발굴에서 실제 상품을 선택해 주세요.');return}
 if(!text.trim()||!date||!time){show('본문과 게시 날짜·시간을 입력하세요.');return}
 if(/쿠팡|파트너스|제휴|https?:/i.test(text)&&!/수수료|광고|파트너스 활동/.test(text+(typeof getThreadReplyText==='function'?getThreadReplyText():''))){show('제휴 또는 광고 콘텐츠에는 광고·수수료 고지가 필요합니다.');return}
 let replyText='';
 if(platform==='threads'&&typeof getThreadReplyText==='function'){
  replyText=String(getThreadReplyText()||'');
  if(replyText.includes('단축 링크 미발급')){show('Threads 2단 쿠팡 단축 링크가 미발급됐습니다. 링크 발급 후 예약하세요.');return}
 }
 state.busy=true;if(button)button.disabled=true;
 try{
  let imageUrls=[];
  const images=[];
  const count=platform==='instagram'?Math.min(10,typeof multiSlideCount==='function'&&typeof isMultiMode==='function'&&isMultiMode('Instagram')?multiSlideCount():5):
    typeof window.vpThreadPairArtworkForSlide==='function'&&window.vpThreadPairArtworkForSlide(1)?2:1;
  if(typeof buildContentCanvas!=='function')throw Error('현재 브라우저에서 제작 이미지를 내보낼 수 없습니다.');
  const status=await get('op=status');
  if(!status.platforms?.[platform]?.connected)throw Error(labels[platform]+' 계정을 먼저 연결해 주세요.');
  if(!status.blobConfigured){
   if(platform==='instagram')throw Error('Instagram 카드 이미지를 업로드할 Vercel Blob 연결이 필요합니다. 자동게시 설정에서 공개 이미지 URL을 직접 넣을 수도 있습니다.');
   if(!confirm('사진 호스팅이 연결되지 않았습니다. Threads를 이미지 없이 본문만 예약할까요?'))return;
  }else{
   show('제작 이미지 '+count+'장 인코딩 및 서버 업로드 중…');
   for(let i=0;i<count;i++){
    const canvas=buildContentCanvas(platform==='instagram'?'Instagram':'Threads',i,platform==='instagram'?(typeof coverIndex!=='undefined'?coverIndex:0):(typeof threadImageIndex!=='undefined'?threadImageIndex:0));
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.76));
    if(!blob)throw Error('이미지를 JPEG로 변환하지 못했습니다.');
    images.push(new File([blob],platform+'-'+(i+1)+'.jpg',{type:'image/jpeg'}));
   }
   imageUrls=await uploadImages(images);
  }
  const when=new Date(date+'T'+time+':00+09:00').toISOString();
  const response=await post({action:'schedule',platform,text,replyText,scheduledAt:when,approved:true,imageUrls,product:$('#reserveProduct')?.textContent||''});
  if(typeof window.closeReservation==='function')window.closeReservation();
  window.show?.('scheduler');await refresh();
  show('실제 서버 예약 등록 완료 · '+new Date(response.scheduledAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}));
 }catch(error){show('실제 게시 예약 실패: '+error.message)}
 finally{state.busy=false;if(button)button.disabled=false}
}

function boot(){
 render();organizeScheduler();
 window.confirmReservation=realReservation;
 const original=window.vpPerformanceOnShow;
 window.vpPerformanceOnShow=function(){if(original)original();void renderMetrics()};
 const onLogin=window.vpPerformanceOnLogin;
 window.vpPerformanceOnLogin=function(){if(onLogin)onLogin();void refresh();void renderMetrics()};
 const priorShow=window.show;
 if(typeof priorShow==='function')window.show=function(view){priorShow(view);if(view==='scheduler')void refresh()};
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&$('#scheduler')?.classList.contains('active'))void refresh();
 });
 window.addEventListener('focus',()=>{if($('#scheduler')?.classList.contains('active'))void refresh()});
 setInterval(()=>{if(document.visibilityState==='visible'&&$('#scheduler')?.classList.contains('active'))void refresh()},30000);
 if($('#vpPerformanceDashboard'))void renderMetrics();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
/* ViralPick — edit an existing, not-yet-due Meta server reservation in place. */
(function(){
 'use strict';
 const $=s=>document.querySelector(s);
 let editing=null,submitting=false;
 const stamp=t=>new Date(Number(t)+9*3600000).toISOString();
 const count=value=>Array.from(String(value||'')).length;
 function notify(message,error=false){
  const p=$('#vpMetaEditStatus');
  if(p){p.textContent=message;p.style.color=error?'#a63825':'#386184'}
 }
 function ensurePanel(){
  const base=$('#vpMetaPanel');if(!base)return null;
  let panel=$('#vpMetaEditor');
  if(panel)return panel;
  panel=document.createElement('section');panel.id='vpMetaEditor';panel.className='vpMetaEditor';panel.hidden=true;
  panel.innerHTML=
   '<div class="vpMetaEditHead"><div><h3>예약 콘텐츠 수정</h3><p id="vpMetaEditPlatform" class="queueHint"></p></div>'+
   '<button id="vpMetaEditClose" type="button" class="btn">닫기</button></div>'+
   '<div class="vpMetaEditFields"><label class="vpMetaFull">게시 본문<textarea id="vpMetaEditText" rows="6" maxlength="2200"></textarea></label>'+
   '<label class="vpMetaFull" id="vpMetaEditReplyRow">Threads 2단 답글<textarea id="vpMetaEditReply" rows="3" maxlength="500"></textarea></label>'+
   '<label>게시 날짜 (한국시간)<input type="date" id="vpMetaEditDate"></label>'+
   '<label>게시 시각 (한국시간)<input type="time" id="vpMetaEditTime"></label></div>'+
   '<div class="vpMetaEditMedia"><h4>예약 이미지</h4>'+
   '<p class="queueHint">기존 이미지는 체크된 상태로 유지됩니다. 제외할 이미지만 체크 해제하세요. 순서는 기존 순서를 유지합니다.</p>'+
   '<div id="vpMetaEditImageList" class="vpMetaEditImageList"></div>'+
   '<label>이미지 파일 추가 (선택)<input id="vpMetaEditUpload" type="file" multiple accept="image/jpeg,image/png,image/webp"></label>'+
   '<details><summary>외부 HTTPS 이미지 주소 추가 (선택)</summary>'+
   '<textarea id="vpMetaEditUrls" placeholder="https://.../photo.jpg" rows="2"></textarea></details></div>'+
   '<label class="vpMetaEditApprove"><input type="checkbox" id="vpMetaEditApproved"> 수정한 문구·이미지 사용 권한·광고 및 제휴 고지를 확인하고 발행을 승인합니다.</label>'+
   '<p class="vpMetaEditStatus" role="status" id="vpMetaEditStatus"></p>'+
   '<div class="vpMetaEditButtons"><button type="button" class="btn" id="vpMetaEditCancel">수정 취소</button>'+
   '<button type="button" class="btn primary" id="vpMetaEditSave">변경사항 저장</button></div>';
  const heading=base.querySelector('#vpMetaUpdated')?.closest('h3');
  (heading||$('#vpMetaJobs'))?.before(panel);
  $('#vpMetaEditClose').onclick=close;
  $('#vpMetaEditCancel').onclick=close;
  $('#vpMetaEditSave').onclick=()=>void save();
  const styles=document.createElement('style');
  styles.textContent=
   '#vpMetaEditor[hidden]{display:none!important}'+
   '#vpMetaEditor{border:1px solid #d7e2f2;border-radius:14px;background:#f7f9fd;padding:16px;margin:16px 0}'+
   '#vpMetaEditor h3{font-size:16px;margin:0 0 4px}#vpMetaEditor h4{font-size:13px;margin:14px 0 8px}'+
   '#vpMetaEditor .vpMetaEditHead{display:flex;align-items:start;justify-content:space-between;gap:10px}'+
   '#vpMetaEditor .vpMetaEditFields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}'+
   '#vpMetaEditor .vpMetaFull{grid-column:1/-1}#vpMetaEditor label{display:block;font-size:12px;font-weight:750}'+
   '#vpMetaEditor textarea,#vpMetaEditor input[type=date],#vpMetaEditor input[type=time],#vpMetaEditor input[type=file]{width:100%;box-sizing:border-box;border:1px solid #d4e0eb;background:#fff;border-radius:9px;margin:6px 0 0;padding:10px}'+
   '#vpMetaEditor .vpMetaEditImageList{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 14px}'+
   '#vpMetaEditor .vpMetaEditImage{border:1px solid #dce5ef;background:#fff;border-radius:10px;padding:10px;max-width:140px}'+
   '#vpMetaEditor .vpMetaEditImage img{display:block;width:100px;height:116px;object-fit:cover;border-radius:7px;margin-bottom:8px}'+
   '#vpMetaEditor .vpMetaEditMedia details{font-size:12px;margin:12px 0}#vpMetaEditor summary{font-weight:700;cursor:pointer}'+
   '#vpMetaEditor .vpMetaEditApprove{font-weight:500;line-height:1.6;margin:14px 0}'+
   '#vpMetaEditor .vpMetaEditStatus{color:#3b5d80;font-size:12px;line-height:1.65;white-space:pre-wrap}'+
   '#vpMetaEditor .vpMetaEditButtons{display:flex;justify-content:flex-end;gap:8px}'+
   '@media(max-width:650px){#vpMetaEditor .vpMetaEditFields{grid-template-columns:1fr}}';
  document.head.append(styles);
  return panel;
 }
 function close(){
  if(submitting)return;
  editing=null;
  const panel=$('#vpMetaEditor');if(panel)panel.hidden=true;
 }
 function open(job){
  if(!job||job.status!=='scheduled')return;
  if(Number(job.scheduledAt)<=Date.now()+120000){
   window.alert('예약 시각까지 2분 이내이거나 시각이 지났습니다. 발행 여부 확인 후 다른 예약으로 등록해 주세요.');
   return;
  }
  const panel=ensurePanel();if(!panel)return;
  editing={id:job.id,platform:job.platform,updatedAt:Number(job.updatedAt),scheduledAt:Number(job.scheduledAt),
   imageUrls:Array.isArray(job.imageUrls)?[...job.imageUrls]:[]};
  $('#vpMetaEditPlatform').textContent=(job.platform==='threads'?'Threads':'Instagram')+
   ' · 기존 예약 ID 유지 · 발행 2분 전까지 수정 가능';
  $('#vpMetaEditText').value=String(job.text||'');
  $('#vpMetaEditReply').value=String(job.replyText||'');
  $('#vpMetaEditReplyRow').hidden=job.platform!=='threads';
  $('#vpMetaEditText').maxLength=job.platform==='threads'?500:2200;
  const date=stamp(job.scheduledAt);
  $('#vpMetaEditDate').value=date.slice(0,10);$('#vpMetaEditTime').value=date.slice(11,16);
  $('#vpMetaEditUpload').value='';$('#vpMetaEditUrls').value='';$('#vpMetaEditApproved').checked=false;
  const root=$('#vpMetaEditImageList');root.replaceChildren();
  if(!editing.imageUrls.length){
   const p=document.createElement('p');p.textContent='기존 이미지 없음 · 텍스트 게시 예약';p.className='queueHint';root.append(p);
  }
  for(const [index,url] of editing.imageUrls.entries()){
   const label=document.createElement('label');label.className='vpMetaEditImage';
   const img=document.createElement('img');img.src=url;img.alt='기존 이미지 '+(index+1);
   img.loading='lazy';img.referrerPolicy='no-referrer';
   const check=document.createElement('input');check.type='checkbox';check.checked=true;check.dataset.imageIndex=String(index);
   const name=document.createElement('span');name.textContent=' '+(index+1)+'번 유지';
   label.append(img,check,name);root.append(label);
  }
  panel.hidden=false;notify('기존 이미지는 그대로 유지됩니다. 변경사항을 확인한 뒤 저장해 주세요.');
  panel.scrollIntoView({behavior:'smooth',block:'start'});
  $('#vpMetaEditText').focus({preventScroll:true});
 }
 function mediaUrls(){
  const keep=[...document.querySelectorAll('#vpMetaEditImageList input[data-image-index]')]
   .filter(x=>x.checked)
   .map(x=>editing.imageUrls[Number(x.dataset.imageIndex)]);
  const external=$('#vpMetaEditUrls').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  for(const url of external){
   const parsed=new URL(url);
   if(parsed.protocol!=='https:'||url.length>1500||parsed.username||parsed.password)
    throw Error('추가 이미지 주소는 공개 HTTPS URL만 사용할 수 있습니다.');
  }
  return [...keep,...external];
 }
 async function save(){
  if(!editing||submitting)return;
  const button=$('#vpMetaEditSave');
  submitting=true;button.disabled=true;
  try{
   if(!$('#vpMetaEditApproved').checked)throw Error('변경된 게시 내용과 광고 고지를 검수하고 승인해 주세요.');
   const text=$('#vpMetaEditText').value.trim(),replyText=editing.platform==='threads'?$('#vpMetaEditReply').value.trim():'';
   if(!text)throw Error('게시 본문을 입력해 주세요.');
   if(editing.platform==='threads'&&(count(text)>500||count(replyText)>500))throw Error('Threads 1단과 2단은 각각 500자 이내입니다.');
   if(editing.platform==='instagram'&&count(text)>2200)throw Error('Instagram 본문은 2,200자 이내입니다.');
   let urls=mediaUrls();
   const files=[...$('#vpMetaEditUpload').files];
   if(urls.length+files.length>10)throw Error('이미지는 최대 10장입니다. 일부 이미지를 제외해 주세요.');
   if(editing.platform==='instagram'&&urls.length+files.length===0)throw Error('Instagram에는 이미지가 최소 1장 필요합니다.');
   if(files.length){
    if(typeof window.vpMetaUploadImages!=='function')throw Error('이미지 업로드 기능이 준비되지 않았습니다.');
    notify('추가 이미지 '+files.length+'장 Blob 업로드 중…');
    const uploaded=await window.vpMetaUploadImages(files,(index,total,phase)=>
     notify('추가 이미지 '+index+'/'+total+'장 '+(phase==='uploaded'?'업로드 완료':'업로드 중…')));
    urls=urls.concat(uploaded);
   }
   const date=$('#vpMetaEditDate').value,time=$('#vpMetaEditTime').value;
   if(!date||!time)throw Error('변경할 게시 날짜와 시간을 선택해 주세요.');
   const iso=new Date(date+'T'+time+':00+09:00').toISOString();
   if(Date.parse(iso)<Date.now()+120000)throw Error('예약 시각은 현재보다 2분 이후여야 합니다.');
   notify('예약 콘텐츠 및 게시 시각을 서버에 저장 중…');
   const changed=await window.backendRequest('/api/social',{method:'POST',body:JSON.stringify({
    action:'update',id:editing.id,expectedUpdatedAt:editing.updatedAt,
    text,replyText,imageUrls:urls,scheduledAt:iso,approved:true
   })});
   if(!changed.ok||changed.id!==editing.id)throw Error('서버 수정 확인에 실패했습니다. 목록을 확인해 주세요.');
   const savedId=editing.id;
   submitting=false;button.disabled=false;close();
   window.vpActivityLog?.('소셜 예약','예약 내용 수정 완료 · '+savedId);
   if(typeof window.vpMetaRefresh==='function')await window.vpMetaRefresh(true);
   const notice=$('#vpSocialNotice');if(notice)notice.textContent='예약 콘텐츠 변경 완료 · 기존 예약 ID 유지 · 이미지 '+urls.length+'장';
  }catch(e){notify('수정 실패: '+String(e?.message||e),true)}
  finally{submitting=false;button.disabled=false}
 }
 window.vpMetaEditReservation=open;
})();

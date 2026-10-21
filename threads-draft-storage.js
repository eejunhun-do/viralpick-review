/* ViralPick: reliable product-scoped Threads draft persistence (same browser). */
const THREAD_DRAFT_STORE='viralpick-threads-drafts-v1';
let threadDraftSelections={},threadDraftSavedAt=0,threadDraftStorageError='';
function threadDraftNotice(message){
 const el=typeof $==='function'?$('#vpThreadDraftStatus'):null;
 if(el)el.textContent=message;
}
function saveThreadDraftState(){
 try{
  const entries=Object.entries(customThreadEdits)
   .filter(([key,value])=>key.length<180&&typeof value==='string'&&value.length<=12000).slice(-100);
  const choices=Object.entries(threadDraftSelections)
   .filter(([key,value])=>key.length<120&&value&&typeof value==='object').slice(-100);
  const savedAt=Date.now();
  localStorage.setItem(THREAD_DRAFT_STORE,JSON.stringify({
   drafts:Object.fromEntries(entries),selection:Object.fromEntries(choices),savedAt
  }));
  threadDraftSavedAt=savedAt;
  threadDraftStorageError='';
  threadDraftNotice('Threads 1단·2단 문구를 자동 저장했습니다. 새로고침 후 현재 상품에 복원됩니다.');
  return true;
 }catch(e){
  threadDraftStorageError=String(e?.message||'저장 용량 부족 또는 저장 권한이 없습니다.').slice(0,160);
  threadDraftNotice('문구 자동 저장 실패: '+threadDraftStorageError+' · 새로고침 전에 문구를 복사해 주세요.');
  return false;
 }
}
function rememberThreadSelection(){
 if(!selected?.id)return false;
 threadDraftSelections[String(selected.id)]={diversity:threadDiversity,seed:threadSeed,index:threadCopyIndex};
 return saveThreadDraftState();
}
function activateThreadSelection(id){
 const chosen=threadDraftSelections[String(id)];
 if(!chosen||typeof chosen!=='object'){
  threadDiversity='balanced';threadSeed=0;threadCopyIndex=0;return;
 }
 threadDiversity=['balanced','stable','creative'].includes(chosen.diversity)?chosen.diversity:'balanced';
 threadSeed=Number.isSafeInteger(chosen.seed)&&chosen.seed>=0&&chosen.seed<=100000?chosen.seed:0;
 threadCopyIndex=Number.isInteger(chosen.index)&&chosen.index>=0&&chosen.index<=5?chosen.index:0;
}
function restoreThreadDraftState(){
 try{
  const saved=JSON.parse(localStorage.getItem(THREAD_DRAFT_STORE)||'null');
  if(saved&&typeof saved==='object'){
   if(saved.drafts&&typeof saved.drafts==='object'&&!Array.isArray(saved.drafts)){
    customThreadEdits=Object.fromEntries(Object.entries(saved.drafts)
     .filter(([key,value])=>key.length<180&&typeof value==='string'&&value.length<=12000).slice(-100));
   }
   if(saved.selection&&typeof saved.selection==='object'&&!Array.isArray(saved.selection)){
    threadDraftSelections=Object.fromEntries(Object.entries(saved.selection)
     .filter(([key,value])=>key.length<120&&value&&typeof value==='object').slice(-100));
   }
   threadDraftSavedAt=Number(saved.savedAt)||0;
  }
 }catch(e){threadDraftStorageError='저장된 Threads 초안을 읽지 못했습니다.'}
 activateThreadSelection(selected?.id);
}
function updateThreadDraftNotice(){
 if(threadDraftStorageError)threadDraftNotice('Threads 저장·복원 오류: '+threadDraftStorageError);
 else if(Object.prototype.hasOwnProperty.call(customThreadEdits,threadEditKey()))
  threadDraftNotice('이 상품의 Threads 문구를 복원했습니다. 이후 수정도 자동 저장됩니다.');
 else threadDraftNotice('AI 생성·수정한 Threads 1단·2단 문구를 상품별로 자동 저장합니다.');
}
function chooseThreadCopy(index){
 if(!Number.isInteger(index)||index<0||index>5)return;
 threadCopyIndex=index;rememberThreadSelection();renderThreads();
}

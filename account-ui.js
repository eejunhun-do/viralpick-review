(function(){
 const $=s=>document.querySelector(s);
 const state={token:sessionStorage.getItem('vp_session')||'',user:''};
 const styles=document.createElement('style');styles.textContent=`
 #vpAuthGate{position:fixed;inset:0;background:#10151deE;z-index:99999;display:none;align-items:center;justify-content:center;padding:20px}
 #vpAuthGate.visible{display:flex}#vpAuthGate .vpBox{background:white;border-radius:18px;padding:28px;width:min(420px,96vw);box-shadow:0 25px 80px #0005}
 .vpBox h2{margin-top:0}.vpBox input{display:block;width:100%;margin:10px 0;padding:12px;border:1px solid #ccd4e0;border-radius:9px}
 .vpBox button,.vpKeyActions button{border:0;border-radius:9px;padding:12px;background:#151a23;color:white;font-weight:bold;cursor:pointer}
 .vpBox p{font-size:12px;color:#536275;line-height:1.5}#vpKeyGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
 #vpKeyGrid label{display:block;font-size:12px;font-weight:bold}#vpKeyGrid input{width:100%;margin-top:6px;padding:11px;border:1px solid #cfd6de;border-radius:9px}
 @media(max-width:650px){#vpKeyGrid{grid-template-columns:1fr}}
 `;document.head.append(styles);
 styles.textContent+=' .vpNewUserGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.vpNewUserGrid input{width:100%;padding:11px;margin-top:6px;border:1px solid #cfd6de;border-radius:9px}@media(max-width:650px){.vpNewUserGrid{grid-template-columns:1fr}}';
 const gate=document.createElement('div');gate.id='vpAuthGate';gate.innerHTML=`<form class="vpBox" id="vpLoginForm"><h2>ViralPick 관리자 로그인</h2><p id="vpAuthTip">계정 확인 중…</p><input id="vpUsername" autocomplete="username" placeholder="관리자 아이디 (예: viralpickadmin)" required minlength="3" maxlength="32" pattern="[A-Za-z0-9_-]{3,32}" title="영문, 숫자, 밑줄, 하이픈만 사용하세요" autocapitalize="off" spellcheck="false"><input id="vpPassword" type="password" autocomplete="current-password" placeholder="비밀번호 (12자 이상)" required minlength="12"><input id="vpBootstrap" type="password" placeholder="최초 등록용 서버 연결 암호" style="display:none"><button type="submit" id="vpLoginButton">로그인</button><p id="vpAuthError" role="alert"></p></form>`;document.body.append(gate);
 const nav=$('.nav');if(nav){const btn=document.createElement('button');btn.dataset.view='apiSettings';btn.textContent='🔐 내 API 등록';btn.onclick=()=>{if(!state.token){gate.classList.add('visible');return}show('apiSettings');loadKeys()};nav.append(btn)}
 const root=document.createElement('section');root.id='apiSettings';root.className='view';root.innerHTML=`<div class="top"><div><span class="badge blue">개인정보 암호화 저장</span><h1>내 API 등록</h1><p>로그인한 계정별로 API 키를 암호화해 서버에 저장합니다. 저장한 키 원문은 화면에 다시 표시되지 않습니다.</p></div></div><div class="panel"><div class="pad"><p id="vpAccountLabel">계정 확인 중</p><div id="vpKeyGrid"><label>쿠팡 파트너스 Access Key<input autocomplete="off" id="vpCoupangAccess" type="password" placeholder="새 키 입력"></label><label>쿠팡 파트너스 Secret Key<input autocomplete="off" id="vpCoupangSecret" type="password" placeholder="새 키 입력"></label><label>토스 API Key (추후 API 연동용)<input autocomplete="off" id="vpTossKey" type="password" placeholder="새 키 입력"></label><label>OpenAI API Key<input autocomplete="off" id="vpOpenAIKey" type="password" placeholder="새 키 입력"></label></div><p id="vpKeysStatus" aria-live="polite">등록 상태 확인 중</p><div class="vpKeyActions"><button type="button" id="vpKeysSave">입력한 키 저장</button> <select id="vpDeleteSelect" aria-label="삭제할 API 키"><option value="coupangAccessKey">쿠팡 Access</option><option value="coupangSecretKey">쿠팡 Secret</option><option value="tossApiKey">토스</option><option value="openaiApiKey">OpenAI</option></select> <button type="button" id="vpKeyDelete">선택한 키 삭제</button> <button type="button" id="vpLogout">로그아웃</button></div><div id="vpAdminUsers" style="display:none;margin-top:25px;border-top:1px solid #e2e7ed;padding-top:16px"><h3>사용자 계정 추가 (관리자)</h3><div class="vpNewUserGrid"><label>새 사용자 아이디<input id="vpNewUser" autocomplete="off" placeholder="영문/숫자 3~32자"></label><label>임시 비밀번호<input id="vpNewPassword" type="password" autocomplete="new-password" placeholder="12자 이상"></label></div><p class="queueHint">생성된 사용자는 자신의 아이디로 로그인해 독립된 API 키를 등록할 수 있습니다. 계정 비밀번호는 화면에 다시 표시되지 않습니다.</p><button type="button" id="vpCreateUser" class="btn primary">계정 생성</button><p id="vpUserStatus" role="status"></p></div><p class="queueHint">빈 칸은 기존 저장 값을 유지합니다. 삭제는 등록 상태에서 삭제를 선택하세요. 각 API는 제공자 정책 및 별도 승인에 따라 작동합니다.</p></div></div>`;$('.main')?.append(root);
 // Move the legacy server connection panel out of product/image integration.
 const oldPanel=[...document.querySelectorAll('#integrations .panel')].find(el=>el.querySelector('#apiBase'));
 if(oldPanel){
  const legacyWrap=document.createElement('div');
  legacyWrap.id='vpLegacyConnectionPanel';
  legacyWrap.style.marginTop='22px';
  oldPanel.querySelector('.panelHead h2')?.replaceChildren(document.createTextNode('서버 연결 관리 (고급 · 기존 연결 방식)'));
  oldPanel.querySelector('.queueHint')?.replaceChildren(document.createTextNode('로그인 계정의 API 키는 위의 내 API 등록에서 관리합니다. 이 설정은 기존 서버 연결 방식을 사용할 때만 필요합니다.'));
  legacyWrap.append(oldPanel);root.append(legacyWrap);
 }
 const note=document.createElement('p');note.className='queueHint';note.textContent='API 연결 및 등록은 내 API 등록 탭에서 관리합니다.';
 document.querySelector('#integrations .top')?.append(note);

 const original=backendRequest;
 backendRequest=async function(path,options={}){
 if(!state.token)return original(path,options);
 // Account login selects the same site's API automatically; no separate access password.
 const base=location.hostname.endsWith('.vercel.app')?location.origin:persistBackendUrl();
 const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),150000);
 try{const res=await fetch(base+path,{...options,headers:{...(options.headers||{}),Authorization:'Bearer '+state.token,...(options.body?{'Content-Type':'application/json'}:{})},signal:ctl.signal,cache:'no-store'});
 const data=await res.json().catch(()=>({}));
 if(!res.ok||!data.ok)throw Error(data.message||'요청 실패 ('+res.status+')');return data
 }finally{clearTimeout(tm)}
 };
 window.vpAccountLoggedIn=()=>Boolean(state.token);
 const API='/api/account';
 async function request(path,method='GET',body){
 const res=await fetch(path,{method,headers:{'Content-Type':'application/json',...(state.token?{Authorization:'Bearer '+state.token}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw Error(data.message||'서버 오류');return data;
 }
 async function connectAfterLogin(){
  if(!state.token)return;
  // Finish any legacy vault restoration before marking the authenticated API connected.
  if(typeof connectionRestoreTask!=='undefined')await Promise.resolve(connectionRestoreTask).catch(()=>{});
  try{
   const status=await backendRequest('/api/status');
   const label='로그인 계정 '+state.user+' · 서버 자동 연결됨 · OpenAI '+(status.imageReady?'등록됨':'키 미등록')+' · 쿠팡 '+(status.coupangConfigured?'등록됨':'키 미등록');
   if(typeof showBackendState==='function')showBackendState('connected',label);
   const health=$('#apiHealth');if(health)health.title=label;
   const connect=$('#vpAutoConnectedNote');if(connect)connect.textContent=label;
   if(typeof refreshCoupangCatalog==='function')void refreshCoupangCatalog();
   if(typeof window.vpPerformanceOnLogin==='function')window.vpPerformanceOnLogin();
  }catch(e){
   if(typeof showBackendState==='function')showBackendState('disconnected','로그인은 되었으나 계정 API 확인 실패: '+e.message);
   const connect=$('#vpAutoConnectedNote');if(connect)connect.textContent='API 연결 확인 실패: '+e.message;
  }
 }
 const connectedNote=document.createElement('p');
 connectedNote.id='vpAutoConnectedNote';connectedNote.className='queueHint';
 connectedNote.textContent='로그인하면 계정의 API 설정을 자동 연결합니다. 별도 서버 연결 암호를 입력하지 않습니다.';
 root.querySelector('.top')?.append(connectedNote);
 // The manual shared-password connector is for pre-account legacy use only.
 if(oldPanel){const wrapper=document.getElementById('vpLegacyConnectionPanel');if(wrapper)wrapper.hidden=true}
 let initialSetup=false;
 async function initialize(){
 try{const result=await request(API);initialSetup=!result.initialized;$('#vpLoginButton').disabled=false;$('#vpAuthError').textContent='';
 if(state.token){const verify=await request(API);if(verify.loggedIn){state.user=verify.user;state.role=verify.role;gate.classList.remove('visible');await connectAfterLogin();return}state.token='';sessionStorage.removeItem('vp_session')}
 $('#vpAuthTip').textContent=initialSetup?'관리자 계정을 최초 생성합니다. 기존 서버 연결 암호를 확인한 후 관리자 비밀번호를 설정하세요.':'아이디와 비밀번호로 로그인하세요.';
 $('#vpBootstrap').style.display=initialSetup?'block':'none';$('#vpLoginButton').textContent=initialSetup?'관리자 계정 생성':'로그인';gate.classList.add('visible');
 }catch(e){$('#vpAuthTip').textContent='로그인 서버 연결 실패: Redis 환경변수 및 배포 상태를 확인해 주세요.';$('#vpAuthError').textContent='서버 응답: '+e.message;$('#vpLoginButton').disabled=true;$('#vpLoginButton').textContent='서버 확인 중';gate.classList.add('visible');}
 }
 $('#vpLoginForm').addEventListener('submit',async e=>{
 e.preventDefault();$('#vpAuthError').textContent='';
 if(!/^[A-Za-z0-9_-]{3,32}$/.test($('#vpUsername').value)){ $('#vpAuthError').textContent='사이트 주소가 아닌 영문 관리자 아이디를 입력해 주세요.';return; }
 const button=$('#vpLoginButton');button.disabled=true;button.textContent='처리 중…';
 try{const data=await request(API,'POST',{action:initialSetup?'setup':'login',user:$('#vpUsername').value,password:$('#vpPassword').value,...(initialSetup?{bootstrap:$('#vpBootstrap').value}:{})});
 state.token=data.token;state.user=data.user;state.role=data.role||'admin';sessionStorage.setItem('vp_session',data.token);$('#vpPassword').value='';$('#vpBootstrap').value='';gate.classList.remove('visible');show('apiSettings');await loadKeys();await connectAfterLogin();
 }catch(e){$('#vpAuthError').textContent=e.message}
 finally{const b=$('#vpLoginButton');b.disabled=false;b.textContent=initialSetup?'관리자 계정 생성':'로그인'}
 });
 async function loadKeys(){
 if(!state.token)return;$('#vpAccountLabel').textContent='로그인: '+state.user;
 try{const d=await request('/api/credentials');const labels={coupangAccessKey:'쿠팡 Access',coupangSecretKey:'쿠팡 Secret',tossApiKey:'토스',openaiApiKey:'OpenAI'};
 $('#vpKeysStatus').textContent=Object.keys(labels).map(k=>labels[k]+': '+(d.configured[k]?'등록됨':'미등록')).join(' · ');
 }catch(e){$('#vpKeysStatus').textContent=e.message}
 }
 $('#vpKeysSave').onclick=async()=>{
 const fields={coupangAccessKey:'#vpCoupangAccess',coupangSecretKey:'#vpCoupangSecret',tossApiKey:'#vpTossKey',openaiApiKey:'#vpOpenAIKey'};
 const updates={};for(const [k,sel] of Object.entries(fields)){const v=$(sel).value.trim();if(v)updates[k]=v}
 if(!Object.keys(updates).length){$('#vpKeysStatus').textContent='입력한 값이 없습니다.';return}
 try{await request('/api/credentials','POST',updates);Object.values(fields).forEach(sel=>$(sel).value='');await loadKeys();await connectAfterLogin();$('#vpKeysStatus').textContent+=' · 저장 완료'}catch(e){$('#vpKeysStatus').textContent=e.message}
 };
 $('#vpCreateUser').onclick=async()=>{try{const data=await request('/api/account','POST',{action:'create_user',user:$('#vpNewUser').value.trim(),password:$('#vpNewPassword').value});$('#vpNewPassword').value='';$('#vpUserStatus').textContent='사용자 '+data.user+' 계정 생성 완료'}catch(e){$('#vpUserStatus').textContent=e.message}};
 $('#vpKeyDelete').onclick=async()=>{const key=$('#vpDeleteSelect').value;if(!confirm('선택한 API 키를 서버에서 삭제할까요?'))return;try{await request('/api/credentials','POST',{[key]:null});await loadKeys();await connectAfterLogin()}catch(e){$('#vpKeysStatus').textContent=e.message}};
 $('#vpLogout').onclick=()=>{state.token='';state.user='';state.role='';sessionStorage.removeItem('vp_session');if(typeof showBackendState==='function')showBackendState('disconnected','로그아웃됨');const note=$('#vpAutoConnectedNote');if(note)note.textContent='로그인하면 서버가 자동 연결됩니다.';gate.classList.add('visible');show('dashboard')};
 initialize();
})();
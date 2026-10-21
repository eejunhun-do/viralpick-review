import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../account-ui.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../v05.html',import.meta.url),'utf8');
function element(){
 const listeners={};
 const node={
  value:'',textContent:'',innerHTML:'',disabled:false,style:{},dataset:{},
  classList:{add(){},remove(){}},
  append(){},appendChild(){},replaceChildren(){},
  querySelector:()=>node,querySelectorAll:()=>[],
  addEventListener(type,fn){listeners[type]=fn},
  setAttribute(){},focus(){},
  get listeners(){return listeners}
 };
 return node;
}
test('Login session automatically checks the authenticated API without waiting for old password vault',async()=>{
 const map=new Map(),statuses=[],urls=[],intervals=[];
 const node=selector=>{if(!map.has(selector))map.set(selector,element());return map.get(selector)};
 const window={addEventListener(){},setInterval(fn,ms){intervals.push({fn,ms})}};
 const document={
  head:element(),body:element(),visibilityState:'visible',
  createElement:element,querySelector:node,querySelectorAll:()=>[],
  addEventListener(){}
 };
 const sessionStorage={getItem:k=>k==='vp_session'?'valid-session':null,setItem(){},removeItem(){}};
 const fetch=async (url,options={})=>{
  urls.push({url,auth:options.headers?.Authorization});
  if(url==='/api/account')return {ok:true,json:async()=>({ok:true,initialized:true,loggedIn:true,user:'demo',role:'admin'})};
  if(url==='https://viralpick-review.vercel.app/api/status')return {ok:true,json:async()=>({ok:true,imageReady:true,coupangConfigured:true})};
  throw Error('Unexpected test URL: '+url);
 };
 const sandbox={
  document,window,sessionStorage,fetch,location:{hostname:'viralpick-review.vercel.app',origin:'https://viralpick-review.vercel.app'},
  backendRequest:async()=>{throw Error('legacy request should not run')},
  persistBackendUrl:()=>{throw Error('legacy URL should not be used')},
  showBackendState:(state)=>statuses.push(state),
  show(){},connectionRestoreTask:new Promise(()=>{}),
  AbortController,setTimeout,clearTimeout,console
 };
 vm.runInNewContext(source,sandbox,{filename:'account-ui.js'});
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(window.vpAccountLoggedIn(),true);
 assert.ok(statuses.includes('connecting'));
 assert.equal(statuses.at(-1),'connected');
 assert.ok(urls.some(x=>x.url.endsWith('/api/status')&&x.auth==='Bearer valid-session'));
 assert.equal(typeof window.vpAccountReconnect,'function');
 assert.ok(intervals.some(x=>x.ms===120000));
 await window.vpAccountReconnect();
 assert.equal(statuses.at(-1),'connected');
});
test('Header button rechecks failed account connection and cache-busted browser code loads',()=>{
 assert.match(html,/window\.vpAccountReconnect\(\)/);
 assert.match(html,/account-ui\.js\?v=4/);
});

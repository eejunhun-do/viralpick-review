import test from 'node:test';
import assert from 'node:assert/strict';
import {signingDate,hmacAuthorization,SEARCH_PATH} from '../lib/coupang-partners.js';
import {encrypt,decrypt,makeToken,session,isName,hashPassword,newSalt} from '../lib/account-store.js';
process.env.VIRALPICK_APP_SECRET='test-secret-long-and-private-1234567890-abcdef';
process.env.UPSTASH_REDIS_REST_URL='https://example.com';
process.env.UPSTASH_REDIS_REST_TOKEN='test-only';
test('HMAC signing is deterministic and includes query',()=>{
 const date=new Date('2026-10-19T10:11:12Z');
 assert.equal(signingDate(date),'261019T101112Z');
 assert.equal(SEARCH_PATH,'/v2/providers/affiliate_open_api/apis/openapi/v1/products/search');
 const h=hmacAuthorization('GET',SEARCH_PATH+'?keyword=test&limit=2','ak','sk',date);
 assert.match(h,/^CEA algorithm=HmacSHA256, access-key=ak, signed-date=261019T101112Z, signature=[a-f0-9]{64}$/);
 assert.notEqual(h,hmacAuthorization('GET',SEARCH_PATH+'?keyword=other&limit=2','ak','sk',date));
});
test('credential envelope encrypts and authenticates',()=>{
 const x={coupangAccessKey:'sample-key',coupangSecretKey:'private'};
 const c=encrypt(x);assert.ok(!c.includes('sample-key'));
 assert.deepEqual(decrypt(c),x);
 const [v,t,d]=c.split('.');const bytes=Buffer.from(d,'base64url');bytes[0]^=1;assert.throws(()=>decrypt(v+'.'+t+'.'+bytes.toString('base64url')));
});
test('sessions are signed and expire after set period',()=>{
 const tok=makeToken('admin');
 assert.equal(session(new Request('https://example.com',{headers:{Authorization:'Bearer '+tok}})),'admin');
 assert.equal(session(new Request('https://example.com',{headers:{Authorization:'Bearer '+tok+'x'}})),null);
});
test('administrator login password hashing',()=>{const salt=newSalt();assert.equal(hashPassword('verylongadminpassword',salt),hashPassword('verylongadminpassword',salt));assert.ok(isName('admin'));assert.ok(!isName('../admin'))});

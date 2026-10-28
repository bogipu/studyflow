const H={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(x,s=200,h={})=>new Response(JSON.stringify(x),{status:s,headers:{...H,...h}});
const name='__Host-studyflow_finance';
const enc=new TextEncoder();
async function sign(secret,value){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0}
async function authorized(req,env){const m=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-studyflow_finance=([^;]+)/);if(!m)return false;const parts=m[1].split('.');if(parts.length!==2||!/^[0-9]{13}$/.test(parts[0])||Number(parts[0])<=Date.now())return false;return equal(parts[1],await sign(env.FINANCE_PASSWORD,parts[0]))}
async function setup(db){await db.prepare('CREATE TABLE IF NOT EXISTS finance_balances (id INTEGER PRIMARY KEY CHECK(id=1), income INTEGER NOT NULL DEFAULT 0, spending INTEGER NOT NULL DEFAULT 0, initialized INTEGER NOT NULL DEFAULT 0, auto_start TEXT)').run();await db.prepare('INSERT OR IGNORE INTO finance_balances (id) VALUES (1)').run();try{await db.prepare('ALTER TABLE finance_balances ADD COLUMN auto_start TEXT').run()}catch(e){if(!String(e.message||e).includes('duplicate column name'))throw e}await db.prepare('CREATE TABLE IF NOT EXISTS finance_entries (id TEXT PRIMARY KEY, day TEXT NOT NULL, kind TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();await db.prepare('CREATE INDEX IF NOT EXISTS finance_day_idx ON finance_entries(day)').run();await db.prepare('CREATE TABLE IF NOT EXISTS finance_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL)').run()}
const money=x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000000000;
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T12:00:00').toISOString().slice(0,10)===s;
async function attemptKey(req,secret){return sign(secret,req.headers.get('CF-Connecting-IP')||'unknown')}
// Automatikus hétfői átvezetés: az első következő pénzügyi API-kéréskor kerül könyvelésre.
// A D1 batch tranzakció egyben tartja az egyenlegmódosítást és a naplóbejegyzést.
async function applyMondayTransfers(db){
 const state=await db.prepare('SELECT income,initialized,auto_start FROM finance_balances WHERE id=1').first();
 if(!state?.initialized||!state.auto_start)return {posted:0,pending:0};
 const now=new Date(new Date().toLocaleString('en-US',{timeZone:'Europe/Budapest'}));
 const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 const monday=new Date(today+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
 const first=new Date(state.auto_start+'T12:00:00Z');
 // Kezdőegyenleg beállítása után csak a következő hétfőtől indul az automatika.
 first.setUTCDate(first.getUTCDate()+((8-first.getUTCDay())%7||7));
 let posted=0,pending=0;
 for(let day=first;day<=monday;day.setUTCDate(day.getUTCDate()+7)){
  const date=day.toISOString().slice(0,10),id='weekly-transfer-'+date;
  const existing=await db.prepare('SELECT id FROM finance_entries WHERE id=?').bind(id).first();if(existing)continue;
  const balance=await db.prepare('SELECT income FROM finance_balances WHERE id=1').first();
  if(Number(balance.income)<25000){pending++;break}
  await db.batch([
   db.prepare('UPDATE finance_balances SET income=income-25000,spending=spending+25000 WHERE id=1 AND income>=25000 AND NOT EXISTS(SELECT 1 FROM finance_entries WHERE id=?)').bind(id),
   db.prepare("INSERT INTO finance_entries(id,day,kind,amount) SELECT ?,?,'transfer',25000 WHERE changes()>0").bind(id,date)
  ]);
  posted++;
 }
 return {posted,pending};
}
export async function onRequest({request,env}){
 if(!env.DB||typeof env.FINANCE_PASSWORD!=='string'||env.FINANCE_PASSWORD.length<12)return reply({error:'A FINANCE_PASSWORD titkos változó hiányzik vagy túl rövid (minimum 12 karakter).'},503);
 const method=request.method,url=new URL(request.url),action=url.searchParams.get('action')||'';
 if(method!=='GET'&&method!=='POST')return reply({error:'Nem támogatott kérés.'},405);
 if(method==='POST'&&request.headers.get('Origin')!==url.origin)return reply({error:'Érvénytelen kérés.'},403);
 try{
 await setup(env.DB);
 if(action==='login'&&method==='POST'){
 const key=await attemptKey(request,env.FINANCE_PASSWORD),now=Date.now();const record=await env.DB.prepare('SELECT count,until FROM finance_attempts WHERE key=?').bind(key).first();
 if(record&&record.until>now&&record.count>=5)return reply({error:'Túl sok próbálkozás. Várj 15 percet.'},429);
 const body=await request.json();if(!equal(body.password,env.FINANCE_PASSWORD)){
 await env.DB.prepare('INSERT INTO finance_attempts(key,count,until) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=CASE WHEN until<? THEN ? ELSE until END').bind(key,now+900000,now,now,now+900000).run();return reply({error:'Hibás pénzügyi jelszó.'},401)}
 await env.DB.prepare('DELETE FROM finance_attempts WHERE key=?').bind(key).run();const expiry=String(now+3600000),signature=await sign(env.FINANCE_PASSWORD,expiry);
 return reply({ok:true},200,{'Set-Cookie':`${name}=${expiry}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`});
 }
 if(action==='logout'&&method==='POST')return reply({ok:true},200,{'Set-Cookie':`${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
 if(!await authorized(request,env))return reply({error:'Pénzügyi jelszó szükséges.'},401);
 if(method==='GET'){
 const auto=await applyMondayTransfers(env.DB);
 const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return reply({error:'Érvénytelen hónap.'},400);
 const balance=await env.DB.prepare('SELECT income,spending,initialized FROM finance_balances WHERE id=1').first();
 const rows=await env.DB.prepare('SELECT id,day,kind,amount FROM finance_entries WHERE day>=? AND day<? ORDER BY day DESC,created_at DESC').bind(month+'-01',month+'-32').all();
 return reply({balance,entries:rows.results||[],auto});
 }
 const body=await request.json();
 if(action==='balances'){
 if(!money(body.income)||!money(body.spending))return reply({error:'Érvénytelen egyenleg.'},400);
 await env.DB.prepare("UPDATE finance_balances SET income=?,spending=?,initialized=1,auto_start=COALESCE(auto_start, date('now')) WHERE id=1").bind(body.income,body.spending).run();return reply({ok:true});
 }
 if(action==='entry'){
 const {kind,amount,day}=body;
 if(!['expense','income','transfer','saving','loan','dorm'].includes(kind)||!money(amount)||amount===0||!validDay(day))return reply({error:'Érvénytelen tétel.'},400);
 const deltaIncome=kind==='income'?amount:kind==='transfer'?-amount:0;
 const deltaSpending=kind==='transfer'?amount:kind==='income'?0:-amount;
 const id=crypto.randomUUID();
 const batch=await env.DB.batch([
 env.DB.prepare('UPDATE finance_balances SET income=income+?,spending=spending+? WHERE id=1 AND initialized=1 AND income+?>=0 AND spending+?>=0').bind(deltaIncome,deltaSpending,deltaIncome,deltaSpending),
 ]);
 if(!batch[0]?.meta?.changes)return reply({error:'Először állítsd be az egyenlegeket, vagy nincs elég fedezet.'},400);
 await env.DB.prepare('INSERT INTO finance_entries(id,day,kind,amount) VALUES (?,?,?,?)').bind(id,day,kind,amount).run();return reply({ok:true});
 }
 return reply({error:'Ismeretlen művelet.'},404);
 }catch(e){return reply({error:'Nem sikerült a művelet. Ellenőrizd a dátumot és próbáld újra.'},500)}
}

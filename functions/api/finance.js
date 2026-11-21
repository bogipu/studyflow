const H={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(x,s=200,h={})=>new Response(JSON.stringify(x),{status:s,headers:{...H,...h}});
const name='__Host-studyflow_finance';
const enc=new TextEncoder();
async function sign(secret,value){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0}
async function authorized(req,env){const m=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-studyflow_finance=([^;]+)/);if(!m)return false;const parts=m[1].split('.');if(parts.length!==2||!/^[0-9]{13}$/.test(parts[0])||Number(parts[0])<=Date.now())return false;return equal(parts[1],await sign(env.FINANCE_PASSWORD,parts[0]))}
async function setup(db){await db.prepare('CREATE TABLE IF NOT EXISTS finance_balances (id INTEGER PRIMARY KEY CHECK(id=1), income INTEGER NOT NULL DEFAULT 0, spending INTEGER NOT NULL DEFAULT 0, savings INTEGER NOT NULL DEFAULT 0, initialized INTEGER NOT NULL DEFAULT 0, auto_start TEXT)').run();await db.prepare('INSERT OR IGNORE INTO finance_balances (id) VALUES (1)').run();for(const column of ['auto_start TEXT','savings INTEGER NOT NULL DEFAULT 0']){try{await db.prepare('ALTER TABLE finance_balances ADD COLUMN '+column).run()}catch(e){if(!String(e.message||e).includes('duplicate column name'))throw e}}await db.prepare('CREATE TABLE IF NOT EXISTS finance_entries (id TEXT PRIMARY KEY, day TEXT NOT NULL, kind TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();await db.prepare('CREATE INDEX IF NOT EXISTS finance_day_idx ON finance_entries(day)').run();for(const col of ['balance_applied INTEGER']){try{await db.prepare('ALTER TABLE finance_entries ADD COLUMN '+col).run()}catch(e){if(!String(e.message||e).includes('duplicate column name'))throw e}}
 await db.prepare("UPDATE finance_entries SET balance_applied=CASE WHEN id LIKE 'weekly-transfer-%' OR id LIKE 'monthly-savings-%' THEN 1 WHEN day<substr(created_at,1,10) THEN 0 ELSE 1 END WHERE balance_applied IS NULL").run();await db.prepare('CREATE TABLE IF NOT EXISTS finance_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL)').run()}
const money=x=>Number.isSafeInteger(x)&&x>=0&&x<=1000000000000;
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T12:00:00').toISOString().slice(0,10)===s;
async function attemptKey(req,secret){return sign(secret,req.headers.get('CF-Connecting-IP')||'unknown')}
// Automatikus hétfői átvezetés: az első következő pénzügyi API-kéréskor kerül könyvelésre.
// A D1 batch tranzakció egyben tartja az egyenlegmódosítást és a naplóbejegyzést.
async function applyScheduledTransfers(db){
 const state=await db.prepare('SELECT initialized,auto_start FROM finance_balances WHERE id=1').first();
 if(!state?.initialized||!state.auto_start)return {posted:0,pending:0};
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const part=k=>parts.find(x=>x.type===k).value;
 const today=`${part('year')}-${part('month')}-${part('day')}`;
 const start=new Date(state.auto_start+'T12:00:00Z'),last=new Date(today+'T12:00:00Z');
 const events=[];
 // Mindkét automatikus átvezetés az egyenlegek első beállítása UTÁN indul.
 for(let d=new Date(start);d<=last;d.setUTCDate(d.getUTCDate()+1)){
  if(d.getTime()===start.getTime())continue;
  const day=d.toISOString().slice(0,10);
  if(d.getUTCDay()===1)events.push({day,id:'weekly-transfer-'+day,kind:'transfer',amount:25000,to:'spending'});
  if(d.getUTCDate()===1)events.push({day,id:'monthly-savings-'+day,kind:'savings_transfer',amount:20000,to:'savings'});
 }
 let posted=0,pending=0;
 for(const event of events){
  const existing=await db.prepare('SELECT id FROM finance_entries WHERE id=?').bind(event.id).first();
  if(existing)continue;
  // Egy tranzakcióban könyveljük a két számlamozgást és a naplóbejegyzést.
  const result=await db.batch([
   db.prepare(`UPDATE finance_balances SET income=income-?,${event.to}=${event.to}+? WHERE id=1 AND initialized=1 AND income>=? AND NOT EXISTS(SELECT 1 FROM finance_entries WHERE id=?)`).bind(event.amount,event.amount,event.amount,event.id),
   db.prepare('INSERT INTO finance_entries(id,day,kind,amount) SELECT ?,?,?,? WHERE changes()>0').bind(event.id,event.day,event.kind,event.amount)
  ]);
  if(result[1]?.meta?.changes)posted++;else pending++;
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
 const auto=await applyScheduledTransfers(env.DB);
 const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return reply({error:'Érvénytelen hónap.'},400);
 const balance=await env.DB.prepare('SELECT income,spending,savings,initialized FROM finance_balances WHERE id=1').first();
 const rows=await env.DB.prepare('SELECT id,day,kind,amount,balance_applied FROM finance_entries WHERE day>=? AND day<? ORDER BY day DESC,created_at DESC').bind(month+'-01',month+'-32').all();
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=k=>parts.find(x=>x.type===k).value;const today=`${part('year')}-${part('month')}-${part('day')}`;
 const start='2026-10-01';const sums=await env.DB.prepare("SELECT kind,COALESCE(SUM(amount),0) AS total FROM finance_entries WHERE day>=? AND day<=? AND kind IN ('income','expense','saving','loan','dorm') GROUP BY kind").bind(start,today).all();const totals=Object.fromEntries((sums.results||[]).map(r=>[r.kind,Number(r.total)]));
 const first=new Date(start+'T12:00:00Z'),last=new Date(today+'T12:00:00Z');const weeks=new Set(),months=new Set();for(let d=new Date(first);d<=last;d.setUTCDate(d.getUTCDate()+1)){const mon=d.toISOString().slice(0,7);months.add(mon);const monday=new Date(d);monday.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);weeks.add(monday.toISOString().slice(0,10))}
 const inc=totals.income||0,exp=(totals.expense||0)+(totals.saving||0)+(totals.loan||0)+(totals.dorm||0);const round=n=>Math.round(n);const averages={weeklyExpense:round(exp/weeks.size),monthlyExpense:round(exp/months.size),weeklyIncome:round(inc/weeks.size),monthlyIncome:round(inc/months.size)};
 return reply({balance,entries:rows.results||[],auto,averages});
 }
 const body=await request.json();
 if(action==='balances'){
 if(!money(body.income)||!money(body.spending)||!money(body.savings))return reply({error:'Érvénytelen egyenleg.'},400);
 await env.DB.prepare("UPDATE finance_balances SET income=?,spending=?,savings=?,initialized=1,auto_start=COALESCE(auto_start, date('now')) WHERE id=1").bind(body.income,body.spending,body.savings).run();return reply({ok:true});
 }
 if(action==='delete'){
 const id=body?.id;
 if(typeof id!=='string'||id.length>100||!id||id.startsWith('weekly-transfer-')||id.startsWith('monthly-savings-'))return reply({error:'Ez a tétel nem törölhető.'},400);
 const old=await env.DB.prepare('SELECT id,kind,amount,day,balance_applied FROM finance_entries WHERE id=?').bind(id).first();
 if(!old)return reply({error:'A tétel már nem található. Frissítsd az oldalt.'},404);
 const amount=Number(old.amount);let di=0,ds=0,dv=0;
 if(old.balance_applied){if(old.kind==='income')di=-amount;else if(old.kind==='transfer'){di=amount;ds=-amount}else if(old.kind==='savings_transfer'){di=amount;dv=-amount}else ds=amount}
 const result=await env.DB.batch([
 env.DB.prepare('UPDATE finance_balances SET income=income+?,spending=spending+?,savings=savings+? WHERE id=1 AND initialized=1 AND income+?>=0 AND spending+?>=0 AND savings+?>=0 AND EXISTS(SELECT 1 FROM finance_entries WHERE id=? AND kind=? AND amount=? AND day=?)').bind(di,ds,dv,di,ds,dv,id,old.kind,amount,old.day),
 env.DB.prepare('DELETE FROM finance_entries WHERE id=? AND kind=? AND amount=? AND day=? AND changes()>0').bind(id,old.kind,amount,old.day)
 ]);
 if(!result[1]?.meta?.changes)return reply({error:'Nem törölhető: időközben megváltozott a tétel, vagy az egyenleg negatívvá válna. Frissítsd az oldalt.'},409);
 return reply({ok:true});
 }
 if(action==='edit'){
 const {id,kind,amount,day}=body;
 if(typeof id!=='string'||id.length>100||!['expense','income','transfer','savings_transfer','saving','loan','dorm'].includes(kind)||!money(amount)||amount===0||!validDay(day))return reply({error:'Érvénytelen tétel.'},400);
 if(id.startsWith('weekly-transfer-')||id.startsWith('monthly-savings-'))return reply({error:'Az automatikus átvezetések nem szerkeszthetők.'},400);
 const old=await env.DB.prepare('SELECT id,kind,amount,day,balance_applied FROM finance_entries WHERE id=?').bind(id).first();
 if(!old)return reply({error:'A tétel nem található. Frissítsd az oldalt.'},404);
 const delta=(k,v)=>({income:k==='income'?v:k==='transfer'||k==='savings_transfer'?-v:0,spending:k==='transfer'?v:k==='income'||k==='savings_transfer'?0:-v,savings:k==='savings_transfer'?v:0});
 const before=delta(old.kind,old.amount),after=delta(kind,amount);
 const di=old.balance_applied?after.income-before.income:0,ds=old.balance_applied?after.spending-before.spending:0,dv=old.balance_applied?after.savings-before.savings:0;
 const result=await env.DB.batch([
  env.DB.prepare('UPDATE finance_balances SET income=income+?,spending=spending+?,savings=savings+? WHERE id=1 AND initialized=1 AND income+?>=0 AND spending+?>=0 AND savings+?>=0 AND EXISTS(SELECT 1 FROM finance_entries WHERE id=? AND kind=? AND amount=? AND day=?)').bind(di,ds,dv,di,ds,dv,id,old.kind,old.amount,old.day),
  env.DB.prepare('UPDATE finance_entries SET kind=?,amount=?,day=? WHERE id=? AND kind=? AND amount=? AND day=? AND changes()>0').bind(kind,amount,day,id,old.kind,old.amount,old.day)
 ]);
 if(!result[1]?.meta?.changes)return reply({error:'Nem sikerült menteni: időközben változott a tétel, vagy nincs elég fedezet. Frissítsd az oldalt.'},409);
 return reply({ok:true});
 }
 if(action==='entry'){
 const {kind,amount,day}=body;
 if(!['expense','income','transfer','saving','loan','dorm'].includes(kind)||!money(amount)||amount===0||!validDay(day))return reply({error:'Érvénytelen tétel.'},400);
 // A korábbi napra rögzített tételek történeti naplóbejegyzések:
 // nem módosítják újra a jelenlegi, banki egyenleg alapján beállított összegeket.
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const part=k=>parts.find(x=>x.type===k).value;
 const today=`${part('year')}-${part('month')}-${part('day')}`;
 if(day<today){
  const balance=await env.DB.prepare('SELECT initialized FROM finance_balances WHERE id=1').first();
  if(!balance?.initialized)return reply({error:'Először állítsd be az egyenlegeket.'},400);
  await env.DB.prepare('INSERT INTO finance_entries(id,day,kind,amount,balance_applied) VALUES (?,?,?,?,0)').bind(crypto.randomUUID(),day,kind,amount).run();
  return reply({ok:true,historical:true});
 }
 const deltaIncome=kind==='income'?amount:kind==='transfer'?-amount:0;
 const deltaSpending=kind==='transfer'?amount:kind==='income'?0:-amount;
 const id=crypto.randomUUID();
 // Egy tranzakcióban frissítjük az egyenleget és rögzítjük a tételt.
 const batch=await env.DB.batch([
  env.DB.prepare('UPDATE finance_balances SET income=income+?,spending=spending+? WHERE id=1 AND initialized=1 AND income+?>=0 AND spending+?>=0').bind(deltaIncome,deltaSpending,deltaIncome,deltaSpending),
  env.DB.prepare('INSERT INTO finance_entries(id,day,kind,amount,balance_applied) SELECT ?,?,?,?,1 WHERE changes()>0').bind(id,day,kind,amount)
 ]);
 if(!batch[0]?.meta?.changes)return reply({error:'Először állítsd be az egyenlegeket, vagy nincs elég fedezet.'},400);
 if(!batch[1]?.meta?.changes)return reply({error:'Nem sikerült a tétel rögzítése.'},500);
 return reply({ok:true});
 }
 return reply({error:'Ismeretlen művelet.'},404);
 }catch(e){return reply({error:'Nem sikerült a művelet. Ellenőrizd a dátumot és próbáld újra.'},500)}
}

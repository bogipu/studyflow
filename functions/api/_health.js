// StudyFlow single-PIN authentication. Sessions are random tokens stored hashed in D1.
const enc=new TextEncoder();
const cookieName='__Host-studyflow_session';
const headers={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
export const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{...headers,...extra}});
export const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00'))&&new Date(s+'T12:00:00').toISOString().slice(0,10)===s;
export function configProblems(env){const p=[];if(!env.DB)p.push('DB adatbázis-kötés hiányzik');if(typeof env.STUDYFLOW_PIN!=='string')p.push('STUDYFLOW_PIN hiányzik');else if(!/^\d{6}$/.test(env.STUDYFLOW_PIN))p.push('STUDYFLOW_PIN nem pontosan 6 számjegy');return p}
export const configured=env=>configProblems(env).length===0;
export function sameOrigin(request){try{return new URL(request.headers.get('Origin')).origin===new URL(request.url).origin}catch{return false}}
async function sha(s){const h=await crypto.subtle.digest('SHA-256',enc.encode(s));return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=enc.encode(a),y=enc.encode(b);let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);return diff===0}
export const checkPassword=equal;
export const clearCookie=()=>`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export async function ensure(db){
 await db.prepare('CREATE TABLE IF NOT EXISTS health_days (day TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS health_login_attempts (ip_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS studyflow_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)').run();
}
export async function signedCookie(env){
 await ensure(env.DB);
 const token=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const expiry=Date.now()+7*86400000;
 await env.DB.prepare('INSERT INTO studyflow_sessions (token_hash,expires_at) VALUES (?,?)').bind(await sha(token),expiry).run();
 return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
}
function tokenFrom(request){const m=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-studyflow_session=([a-f0-9]{64})(?:;|$)/);return m?.[1]||null}
export async function authenticated(request,env){
 if(!configured(env))return false;const token=tokenFrom(request);if(!token)return false;
 try{const row=await env.DB.prepare('SELECT expires_at FROM studyflow_sessions WHERE token_hash=?').bind(await sha(token)).first();return !!row&&row.expires_at>Date.now()}catch{return false}
}
export async function revoke(request,env){const token=tokenFrom(request);if(token&&env.DB)await env.DB.prepare('DELETE FROM studyflow_sessions WHERE token_hash=?').bind(await sha(token)).run()}
export async function rateKey(_env,request){return sha('studyflow-login-ip:'+ (request.headers.get('CF-Connecting-IP')||'unknown'))}
export async function blocked(db,key){const now=Date.now();const rows=await Promise.all([db.prepare('SELECT attempts,reset_at FROM health_login_attempts WHERE ip_hash=?').bind(key).first(),db.prepare('SELECT attempts,reset_at FROM health_login_attempts WHERE ip_hash=?').bind('global').first()]);return rows.some(r=>r&&r.reset_at>now&&r.attempts>=5&&(r===rows[0]||r.attempts>=30))}
export async function failed(db,key){const until=Date.now()+15*60000;for(const k of [key,'global'])await db.prepare('INSERT INTO health_login_attempts (ip_hash,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(ip_hash) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<? THEN ? ELSE reset_at END').bind(k,until,Date.now(),Date.now(),until).run()}
export async function resetAttempts(db,key){await db.prepare('DELETE FROM health_login_attempts WHERE ip_hash=?').bind(key).run()}

const enc=new TextEncoder();
const cookieName='__Host-studyflow_session';
const headers={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
export const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{...headers,...extra}});
export const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00'))&&new Date(s+'T12:00:00').toISOString().slice(0,10)===s;
export const configured=env=>!!(env.DB&&env.STUDYFLOW_PIN&&env.STUDYFLOW_SESSION_SECRET&&/^\d{6}$/.test(env.STUDYFLOW_PIN)&&env.STUDYFLOW_SESSION_SECRET.length>=32);
export function sameOrigin(request){try{return new URL(request.headers.get('Origin')).origin===new URL(request.url).origin}catch{return false}}
async function mac(secret,value){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('')}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=enc.encode(a),y=enc.encode(b);let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);return diff===0}
export const checkPassword=(a,b)=>equal(a,b);
export async function signedCookie(env){const exp=Date.now()+7*86400000;const payload=String(exp);return `${cookieName}=${payload}.${await mac(env.STUDYFLOW_SESSION_SECRET,payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`}
export const clearCookie=()=>`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export async function authenticated(request,env){if(!configured(env))return false;const m=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-studyflow_session=([^;]+)/);if(!m)return false;const parts=m[1].split('.');if(parts.length!==2||!/^\d{13}$/.test(parts[0])||Number(parts[0])<Date.now())return false;return equal(parts[1],await mac(env.STUDYFLOW_SESSION_SECRET,parts[0]))}
export async function ensure(db){await db.prepare('CREATE TABLE IF NOT EXISTS health_days (day TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();await db.prepare('CREATE TABLE IF NOT EXISTS health_login_attempts (ip_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL)').run()}
export async function rateKey(env,request){const ip=request.headers.get('CF-Connecting-IP')||'unknown';return await mac(env.STUDYFLOW_SESSION_SECRET,ip)}
export async function blocked(db,key){const row=await db.prepare('SELECT attempts,reset_at FROM health_login_attempts WHERE ip_hash=?').bind(key).first();return !!(row&&row.reset_at>Date.now()&&row.attempts>=5)}
export async function failed(db,key){const until=Date.now()+15*60000;await db.prepare('INSERT INTO health_login_attempts (ip_hash,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(ip_hash) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<? THEN ? ELSE reset_at END').bind(key,until,Date.now(),Date.now(),until).run()}
export async function resetAttempts(db,key){await db.prepare('DELETE FROM health_login_attempts WHERE ip_hash=?').bind(key).run()}

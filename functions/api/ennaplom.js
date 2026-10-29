import {authenticated} from './_health.js';
const H={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:H});
export async function onRequest({request,env}){
 if(!env.DB)return reply({error:'Hiányzik a Cloudflare DB adatbázis-kapcsolat.'},503);
 if(!(await authenticated(request,env)))return reply({error:'A StudyFlow-belépés szükséges. Jelentkezz be a főoldalon.'},401);
 const method=request.method;
 if(method!=='GET'&&method!=='PUT')return reply({error:'Nem támogatott kérés.'},405);
 if(method==='PUT'&&request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Érvénytelen eredet.'},403);
 try{
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS ennaplom_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  if(method==='GET'){
   const row=await env.DB.prepare('SELECT payload FROM ennaplom_state WHERE id=1').first();
   return reply({state:row?JSON.parse(row.payload):null});
  }
  const length=Number(request.headers.get('Content-Length')||0);
  if(length>500000)return reply({error:'Túl nagy adatcsomag.'},413);
  const raw=await request.text();
  if(raw.length>500000)return reply({error:'Túl nagy adatcsomag.'},413);
  let data;try{data=JSON.parse(raw)}catch{return reply({error:'Hibás JSON.'},400)}
  if(!data||typeof data!=='object'||Array.isArray(data)||!data.days||typeof data.days!=='object'||Array.isArray(data.days)||!Array.isArray(data.habits)||!data.weights||typeof data.weights!=='object'||Array.isArray(data.weights))return reply({error:'Hibás naplóadatok.'},400);
  if(data.habits.length>200||Object.keys(data.days).length>15000||Object.keys(data.weights).length>15000)return reply({error:'Túl sok bejegyzés.'},400);
  await env.DB.prepare('INSERT INTO ennaplom_state(id,payload,updated_at) VALUES (1,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=CURRENT_TIMESTAMP').bind(raw).run();
  return reply({ok:true});
 }catch(e){console.error('ennaplom API',e);return reply({error:'Adatbázis-hiba. Próbáld újra.'},500)}
}

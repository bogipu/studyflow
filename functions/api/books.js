import {authenticated} from './_health.js';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers});
export async function onRequest({request,env}){
 if(!env.DB)return json({error:'Hiányzik a D1 DB kapcsolat.'},503);
 if(!(await authenticated(request,env)))return json({error:'Előbb jelentkezz be a StudyFlow-ba.'},401);
 if(!['GET','PUT'].includes(request.method))return json({error:'Nem támogatott művelet.'},405);
 if(request.method==='PUT'&&request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Érvénytelen eredet.'},403);
 try{
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS reading_journal (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  if(request.method==='GET'){
   const row=await env.DB.prepare('SELECT payload FROM reading_journal WHERE id=1').first();
   return json({state:row?JSON.parse(row.payload):null});
  }
  const raw=await request.text();
  if(raw.length>600000)return json({error:'Túl nagy adatmennyiség.'},413);
  let data;try{data=JSON.parse(raw)}catch{return json({error:'Hibás JSON.'},400)}
  if(!data||!Array.isArray(data.books)||data.books.length>3000||!data.settings||typeof data.settings!=='object')return json({error:'Hibás könyvnapló.'},400);
  for(const b of data.books){if(!b||typeof b.id!=='string'||typeof b.title!=='string'||b.title.length>300||String(b.cover||'').length>1500||String(b.notes||'').length>4000)return json({error:'Érvénytelen könyvadat.'},400)}
  await env.DB.prepare('INSERT INTO reading_journal(id,payload,updated_at) VALUES(1,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=CURRENT_TIMESTAMP').bind(raw).run();
  return json({ok:true});
 }catch(e){console.error('books api',e);return json({error:'Adatbázis-hiba.'},500)}
}

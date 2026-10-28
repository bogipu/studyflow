const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers});
export async function onRequest({request,env}){
 if(!env.DB||!env.STUDYFLOW_PIN)return reply({error:'Hiányzik a DB vagy STUDYFLOW_PIN beállítás.'},503);
 const supplied=request.headers.get('X-StudyFlow-PIN')||'',expected=String(env.STUDYFLOW_PIN);let mismatch=supplied.length^expected.length;for(let i=0;i<Math.max(supplied.length,expected.length);i++)mismatch|=(supplied.charCodeAt(i)||0)^(expected.charCodeAt(i)||0);if(mismatch)return reply({error:'Hibás PIN.'},401);
 if(!['GET','PUT'].includes(request.method))return reply({error:'Nem támogatott metódus.'},405);
 if(request.method==='PUT'&&request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Érvénytelen eredet.'},403);
 try{
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS focus_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  if(request.method==='GET'){const row=await env.DB.prepare('SELECT payload FROM focus_state WHERE id=1').first();return reply({state:row?JSON.parse(row.payload):null})}
  const raw=await request.text();if(raw.length>450000)return reply({error:'Túl nagy adatcsomag.'},413);
  let data;try{data=JSON.parse(raw)}catch{return reply({error:'Hibás JSON.'},400)}
  if(!data||!Array.isArray(data.projects)||!Array.isArray(data.sessions)||typeof data.settings!=='object'||data.projects.length>500||data.sessions.length>5000)return reply({error:'Érvénytelen adatok.'},400);
  if(data.projects.some(p=>typeof p.id!=='string'||typeof p.name!=='string'||p.name.length>100)||data.sessions.some(s=>!['egyetem','bblooms','olvasas','tanulas'].includes(s.category)||!Number.isFinite(s.minutes)||s.minutes<1||s.minutes>180||(s.note!==undefined&&(typeof s.note!=='string'||s.note.length>500))))return reply({error:'Érvénytelen bejegyzés.'},400);
  await env.DB.prepare('INSERT INTO focus_state (id,payload) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=CURRENT_TIMESTAMP').bind(raw).run();return reply({ok:true});
 }catch(e){console.error('focus api',e);return reply({error:'Adatbázishiba.'},500)}
}

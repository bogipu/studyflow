const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function onRequest({request,env}){
 if(!env.DB)return json({error:'Hiányzik a DB adatbázis-kapcsolat.'},503);
 const method=request.method,url=new URL(request.url);
 if(!['GET','POST','DELETE'].includes(method))return json({error:'Nem támogatott művelet.'},405);
 if(method!=='GET'&&request.headers.get('Origin')!==url.origin)return json({error:'Érvénytelen eredet.'},403);
 try{
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS studyflow_countdowns (id TEXT PRIMARY KEY,title TEXT NOT NULL,target_date TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  if(method==='GET'){const r=await env.DB.prepare('SELECT id,title,target_date AS date FROM studyflow_countdowns ORDER BY target_date,id').all();return json({items:r.results||[]});}
  if(method==='DELETE'){const id=url.searchParams.get('id');if(!id||id.length>100)return json({error:'Hibás azonosító.'},400);await env.DB.prepare('DELETE FROM studyflow_countdowns WHERE id=?').bind(id).run();return json({ok:true});}
  const data=await request.json();const id=String(data?.id||''),title=String(data?.title||'').trim(),date=String(data?.date||'');
  if(!id||id.length>100||!title||title.length>160||!/^(20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(date)||new Date(date+'T12:00:00').toISOString().slice(0,10)!==date)return json({error:'Hibás név vagy dátum.'},400);
  await env.DB.prepare('INSERT INTO studyflow_countdowns (id,title,target_date) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,target_date=excluded.target_date').bind(id,title,date).run();return json({ok:true});
 }catch{return json({error:'Adatbázis-művelet sikertelen.'},500)}
}

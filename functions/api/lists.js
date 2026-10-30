const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
export async function onRequest({request,env}){
 if(!env.DB)return reply({error:'Hiányzik a DB D1 adatbázis-kapcsolat.'},503);
 const method=request.method,url=new URL(request.url);
 if(!['GET','POST','DELETE'].includes(method))return reply({error:'Nem támogatott művelet.'},405);
 if(method!=='GET'&&request.headers.get('Origin')!==url.origin)return reply({error:'Érvénytelen eredet.'},403);
 try{
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS studyflow_list_items (id TEXT PRIMARY KEY, list_type TEXT NOT NULL CHECK(list_type IN ('packing','shopping')), name TEXT NOT NULL, quantity TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  if(method==='GET'){
   const result=await env.DB.prepare('SELECT id,list_type AS list,name,quantity,done FROM studyflow_list_items ORDER BY created_at ASC,id ASC').all();
   return reply({items:(result.results||[]).map(item=>({...item,done:!!item.done}))});
  }
  if(method==='DELETE'){
   const id=url.searchParams.get('id');if(!id||id.length>100)return reply({error:'Hibás azonosító.'},400);
   await env.DB.prepare('DELETE FROM studyflow_list_items WHERE id=?').bind(id).run();return reply({ok:true});
  }
  const data=await request.json();
  if(!data||typeof data!=='object')return reply({error:'Hibás adat.'},400);
  const id=String(data.id||''),list=data.list,name=String(data.name||'').trim(),quantity=String(data.quantity||'').trim();
  if(!id||id.length>100||!['packing','shopping'].includes(list)||!name||name.length>160||quantity.length>60||typeof data.done!=='boolean')return reply({error:'Érvénytelen vagy túl hosszú adat.'},400);
  await env.DB.prepare(`INSERT INTO studyflow_list_items (id,list_type,name,quantity,done) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET list_type=excluded.list_type,name=excluded.name,quantity=excluded.quantity,done=excluded.done`).bind(id,list,name,quantity,data.done?1:0).run();
  return reply({ok:true});
 }catch(error){return reply({error:'Adatbázis-művelet sikertelen.'},500)}
}

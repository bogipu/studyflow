const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const validUrl=s=>!s||(/^https?:\/\//i.test(s)&&s.length<=2048);
export async function onRequest({request,env}){
 if(!env.DB)return reply({error:'Hiányzik a DB D1 adatbázis-kapcsolat.'},503);
 const url=new URL(request.url);
 if(!['GET','POST','DELETE'].includes(request.method))return reply({error:'Nem támogatott metódus.'},405);
 if(request.method!=='GET'&&request.headers.get('Origin')!==url.origin)return reply({error:'Érvénytelen eredet.'},403);
 try{
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS wishlist_items (id TEXT PRIMARY KEY, owner TEXT NOT NULL CHECK(owner IN ('bogi','balazs')), name TEXT NOT NULL, price REAL, emoji TEXT NOT NULL DEFAULT '🎁', image TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  if(request.method==='GET'){
   const r=await env.DB.prepare('SELECT id,owner,name,price,emoji,image,url,note,done FROM wishlist_items ORDER BY created_at DESC,id DESC').all();
   return reply({items:(r.results||[]).map(x=>({...x,done:!!x.done,price:x.price??''}))});
  }
  if(request.method==='DELETE'){
   const id=url.searchParams.get('id');if(!id||id.length>100)return reply({error:'Hibás azonosító.'},400);
   await env.DB.prepare('DELETE FROM wishlist_items WHERE id=?').bind(id).run();return reply({ok:true});
  }
  const body=await request.json();
  if(!body||typeof body!=='object')return reply({error:'Hibás adat.'},400);
  const id=String(body.id||'');
  const name=String(body.name||'').trim(),owner=body.owner;
  const emoji=String(body.emoji||'🎁').slice(0,24),image=String(body.image||''),link=String(body.url||''),note=String(body.note||'');
  const price=body.price===''||body.price==null?null:Number(body.price);
  if(!id||id.length>100||!['bogi','balazs'].includes(owner)||!name||name.length>120||note.length>500||!validUrl(image)||!validUrl(link)||price!==null&&(!Number.isFinite(price)||price<0||price>1e12))return reply({error:'Hibás vagy túl hosszú mező.'},400);
  await env.DB.prepare(`INSERT INTO wishlist_items (id,owner,name,price,emoji,image,url,note,done) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,name=excluded.name,price=excluded.price,emoji=excluded.emoji,image=excluded.image,url=excluded.url,note=excluded.note,done=excluded.done`).bind(id,owner,name,price,emoji,image,link,note,body.done?1:0).run();
  return reply({ok:true});
 }catch(e){console.error('wishlist API',e);return reply({error:'Adatbázis-hiba. Próbáld újra.'},500)}
}

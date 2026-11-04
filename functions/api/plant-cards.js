// Cloudflare Pages Function – képes növénykártyák online tárolása D1-ben.
const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers});
async function table(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS plant_flashcards (id TEXT PRIMARY KEY, latin TEXT NOT NULL, image TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
}
export async function onRequestGet({env}) {
  if (!env.DB) return json({error:'Hiányzik a DB kötés'},503);
  try { await table(env.DB); const result = await env.DB.prepare('SELECT id, latin, image FROM plant_flashcards ORDER BY created_at, id').all(); return json({cards:result.results||[]}); }
  catch(e) { return json({error:'Adatbázishiba'},500); }
}
export async function onRequestPost({request,env}) {
  if (!env.DB) return json({error:'Hiányzik a DB kötés'},503);
  try {
    if (Number(request.headers.get('content-length')||0)>450000) return json({error:'Túl nagy kép'},413);
    const {latin,image} = await request.json();
    if (typeof latin!=='string'||!latin.trim()||latin.length>180||typeof image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>380000) return json({error:'Hibás név vagy kép'},400);
    await table(env.DB);
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO plant_flashcards (id,latin,image) VALUES (?,?,?)').bind(id,latin.trim(),image).run();
    return json({ok:true,id},201);
  } catch(e) { return json({error:'Nem sikerült menteni'},500); }
}
export async function onRequestDelete({request,env}) {
  if (!env.DB) return json({error:'Hiányzik a DB kötés'},503);
  const id=new URL(request.url).searchParams.get('id');
  if (!id||!/^[0-9a-f-]{36}$/i.test(id)) return json({error:'Hibás azonosító'},400);
  try { await table(env.DB); await env.DB.prepare('DELETE FROM plant_flashcards WHERE id=?').bind(id).run(); return json({ok:true}); }
  catch(e) { return json({error:'Nem sikerült törölni'},500); }
}

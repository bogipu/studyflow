// Cloudflare Pages Function: közös haladás kategóriánként, D1-ben.
// Figyelem: nyilvános közös profil, nincs hitelesítés.
async function ensureTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS study_progress (
    user_id TEXT NOT NULL,
    sheet_name TEXT NOT NULL,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, sheet_name)
  )`).run();
}
export async function onRequestGet({env, request}) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user');
    const sheetName = url.searchParams.get('sheet');
    if (!userId || !sheetName) return Response.json({error:'Hiányzó azonosító vagy kategória'}, {status:400});
    await ensureTable(env.DB);
    const row = await env.DB.prepare('SELECT state_json FROM study_progress WHERE user_id=? AND sheet_name=?').bind(userId,sheetName).first();
    return Response.json({state: row ? JSON.parse(row.state_json) : null}, {headers:{'Cache-Control':'no-store'}});
  } catch(e) { return Response.json({error:'Adatbázishiba'}, {status:500}); }
}
export async function onRequestPut({env, request}) {
  try {
    const {userId,sheetName,state} = await request.json();
    if (typeof userId !== 'string' || !userId || typeof sheetName !== 'string' || !sheetName || !state || typeof state !== 'object' || Array.isArray(state))
      return Response.json({error:'Hibás adatok'}, {status:400});
    const ids = ['learned','pending','roundCards','roundKnown','roundMissed'];
    if (!ids.every(k => Array.isArray(state[k]) && state[k].length <= 2000 && state[k].every(v => typeof v === 'string' && v.length <= 120)) ||
        (state.current !== null && typeof state.current !== 'string'))
      return Response.json({error:'Hibás haladási adatok'}, {status:400});
    const json = JSON.stringify(state);
    if (json.length > 120000) return Response.json({error:'Túl nagy adat'}, {status:413});
    await ensureTable(env.DB);
    await env.DB.prepare(`INSERT INTO study_progress(user_id,sheet_name,state_json,updated_at)
      VALUES(?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(user_id,sheet_name) DO UPDATE SET state_json=excluded.state_json,updated_at=CURRENT_TIMESTAMP`)
      .bind(userId,sheetName,json).run();
    return Response.json({success:true});
  } catch(e) { return Response.json({error:'Nem sikerült menteni'}, {status:500}); }
}

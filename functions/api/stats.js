
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user");

  if (!userId) {
    return Response.json({ error: "Hiányzó azonosító" }, { status: 400 });
  }

  const { results } = await env.DB.prepare(
    `SELECT
       DATE(created_at) AS day,
       sheet_name,
       result,
       COUNT(*) AS count
     FROM study_events
     WHERE user_id = ?
     GROUP BY DATE(created_at), sheet_name, result`
  ).bind(userId).all();

  return Response.json({ results });
}

export async function onRequestPost({ env, request }) {
  const { userId, sheetName, result } = await request.json();

  if (!userId || !sheetName || !["known", "missed"].includes(result)) {
    return Response.json({ error: "Hibás adatok" }, { status: 400 });
  }

  await env.DB.prepare(
    `INSERT INTO study_events (user_id, sheet_name, result)
     VALUES (?, ?, ?)`
  ).bind(userId, sheetName, result).run();

  return Response.json({ success: true });
}

import {json,configured,authenticated,sameOrigin,validDate,ensure} from './_health.js';
export async function onRequestGet({request,env}){
 if(!configured(env))return json({error:'A privát napló még nincs beállítva.'},503);
 if(!await authenticated(request,env))return json({error:'Bejelentkezés szükséges.'},401);
 try{await ensure(env.DB);const result=await env.DB.prepare('SELECT day FROM health_days ORDER BY day').all();return json({days:result.results.map(x=>x.day)})}catch{return json({error:'Az adatok nem tölthetők be.'},503)}
}
export async function onRequestPost({request,env}){
 if(!configured(env))return json({error:'A privát napló még nincs beállítva.'},503);
 if(!sameOrigin(request))return json({error:'Érvénytelen kérés.'},403);
 if(!await authenticated(request,env))return json({error:'Bejelentkezés szükséges.'},401);
 try{const body=await request.json();if(!validDate(body.day)||typeof body.selected!=='boolean')return json({error:'Érvénytelen nap.'},400);
 await ensure(env.DB);if(body.selected)await env.DB.prepare('INSERT OR IGNORE INTO health_days (day) VALUES (?)').bind(body.day).run();else await env.DB.prepare('DELETE FROM health_days WHERE day=?').bind(body.day).run();return json({ok:true})
 }catch{return json({error:'Nem sikerült menteni.'},503)}
}
export async function onRequestPut({request,env}){
 if(!configured(env))return json({error:'A privát napló még nincs beállítva.'},503);
 if(!sameOrigin(request))return json({error:'Érvénytelen kérés.'},403);
 if(!await authenticated(request,env))return json({error:'Bejelentkezés szükséges.'},401);
 try{const body=await request.json();if(!Array.isArray(body.days)||body.days.length>20000||body.days.some(x=>!validDate(x)))return json({error:'Érvénytelen importálás.'},400);
 await ensure(env.DB);const unique=[...new Set(body.days)];for(let i=0;i<unique.length;i+=80){await env.DB.batch(unique.slice(i,i+80).map(d=>env.DB.prepare('INSERT OR IGNORE INTO health_days (day) VALUES (?)').bind(d)))}
 return json({ok:true,imported:unique.length})}catch{return json({error:'Az importálás nem sikerült.'},503)}
}

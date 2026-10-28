import {json,configured,sameOrigin,checkPassword,signedCookie,ensure,rateKey,blocked,failed,resetAttempts} from './_health.js';
export async function onRequestPost({request,env}){
 if(!configured(env))return json({error:'A privát napló még nincs beállítva a szerveren.'},503);
 if(!sameOrigin(request))return json({error:'Érvénytelen kérés.'},403);
 try{await ensure(env.HEALTH_DB);const key=await rateKey(env,request);
 if(await blocked(env.HEALTH_DB,key)||await blocked(env.HEALTH_DB,'global-pin-attempts'))return json({error:'Túl sok próbálkozás. Kérlek, próbáld újra 15 perc múlva.'},429);
 const body=await request.json();if(typeof body.password!=='string'||!/^\d{6}$/.test(body.password))return json({error:'Érvénytelen jelszó.'},400);
 if(!checkPassword(body.password,env.HEALTH_PASSWORD)){await failed(env.HEALTH_DB,key);await failed(env.HEALTH_DB,'global-pin-attempts');return json({error:'Nem megfelelő jelszó.'},401)}
 await resetAttempts(env.HEALTH_DB,key);await resetAttempts(env.HEALTH_DB,'global-pin-attempts');return json({ok:true},200,{'Set-Cookie':await signedCookie(env)});
 }catch{return json({error:'A belépés átmenetileg nem érhető el.'},503)}
}

import {json,configured,configProblems,sameOrigin,checkPassword,signedCookie,ensure,rateKey,blocked,failed,resetAttempts} from './_health.js';
export async function onRequestPost({request,env}){
 if(!configured(env))return json({error:'Beállítási hiba: '+configProblems(env).join('; ')},503);
 if(!sameOrigin(request))return json({error:'Érvénytelen kérés.'},403);
 try{await ensure(env.DB);const key=await rateKey(env,request);
 if(await blocked(env.DB,key))return json({error:'Túl sok próbálkozás. Kérlek, próbáld újra 15 perc múlva.'},429);
 const body=await request.json();if(typeof body.password!=='string'||!/^\d{6}$/.test(body.password)){await failed(env.DB,key);return json({error:'Érvénytelen PIN.'},400)}
 if(!checkPassword(body.password,env.STUDYFLOW_PIN)){await failed(env.DB,key);return json({error:'Nem megfelelő jelszó.'},401)}
 await resetAttempts(env.DB,key);return json({ok:true},200,{'Set-Cookie':await signedCookie(env)});
 }catch{return json({error:'A belépés átmenetileg nem érhető el.'},503)}
}

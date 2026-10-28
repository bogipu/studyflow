import {json,clearCookie,sameOrigin,revoke} from './_health.js';
export async function onRequestPost({request,env}){if(!sameOrigin(request))return json({error:'Érvénytelen kérés.'},403);try{await revoke(request,env)}catch{return json({error:'Nem sikerült kijelentkezni.'},503)}return json({ok:true},200,{'Set-Cookie':clearCookie()})}

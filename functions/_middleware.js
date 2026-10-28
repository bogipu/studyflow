import {configured,authenticated,configProblems} from './api/_health.js';
export async function onRequest({request,env,next}) {
 const url=new URL(request.url), p=url.pathname;
 if((p==='/belepes.html'||p==='/belepes')||p==='/api/health-login'||p==='/api/health-logout'||p==='/favicon.ico') return next();
 if(!configured(env)) return new Response('A StudyFlow beállítási hibája: '+configProblems(env).join('; ')+'. Ellenőrizd a studyflow-pages Production beállításait, majd indíts új telepítést.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 if(await authenticated(request,env)) {const response=await next();const h=new Headers(response.headers);h.set('Cache-Control','private, no-store');h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','no-referrer');return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h})}
 if(p.startsWith('/api/'))return new Response(JSON.stringify({error:'Belépés szükséges.'}),{status:401,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 return Response.redirect(new URL('/belepes',request.url),302);
}

import {json,clearCookie,sameOrigin} from './_health.js';
export async function onRequestPost({request}){if(!sameOrigin(request))return json({error:'Érvénytelen kérés.'},403);return json({ok:true},200,{'Set-Cookie':clearCookie()})}

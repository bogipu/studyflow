/* StudyFlow health diary — local-only; intentionally no network requests */
(()=>{
'use strict';
const KEY='studyflow-health-days-v1';
const $=id=>document.getElementById(id);
const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T12:00:00').getTime())&&new Date(s+'T12:00:00').toISOString().slice(0,10)===s;
let selected=new Set();
try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(value))selected=new Set(value.filter(valid))}catch{}
const now=new Date();
let year=now.getFullYear(),month=now.getMonth();
const pad=n=>String(n).padStart(2,'0');
const dateKey=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;
const dayNum=s=>Date.parse(s+'T12:00:00')/86400000;
function episodes(){
 const days=[...selected].sort();
 const out=[];
 for(const d of days){
  const last=out[out.length-1];
  // A 1–2 napos szünet nem indít automatikusan új menstruációt.
  if(last&&dayNum(d)-dayNum(last.at(-1))<=3)last.push(d);
  else out.push([d]);
 }
 return out;
}
function averages(){
 const groups=episodes();
 // A folyamatban lévő vagy mai napon végződő vérzést kihagyjuk az átlagos vérzéshosszból.
 const today=dateKey(now.getFullYear(),now.getMonth(),now.getDate());
 const finished=groups.filter(g=>dayNum(today)-dayNum(g.at(-1))>=3);
 const lengths=finished.map(g=>dayNum(g.at(-1))-dayNum(g[0])+1);
 const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toLocaleString('hu-HU',{maximumFractionDigits:1}):'–';
 // A legalább 10 nap különbségű kezdések között számolunk ciklust.
 const starts=groups.map(g=>g[0]);
 const cycles=[];
 for(let i=1;i<starts.length;i++){const delta=dayNum(starts[i])-dayNum(starts[i-1]);if(delta>=10&&delta<=90)cycles.push(delta)}
 return {bleeding:avg(lengths),cycle:avg(cycles)};
}
function render(){
 const a=averages();
 $('bleedingAvg').textContent=a.bleeding;
 $('cycleAvg').textContent=a.cycle;
 $('healthMonth').textContent=new Intl.DateTimeFormat('hu-HU',{year:'numeric',month:'long'}).format(new Date(year,month,1));
 const count=new Date(year,month+1,0).getDate();
 const offset=(new Date(year,month,1).getDay()+6)%7;
 const today=dateKey(now.getFullYear(),now.getMonth(),now.getDate());
 const frag=document.createDocumentFragment();
 for(let i=0;i<offset;i++){const space=document.createElement('span');space.className='health-blank';frag.append(space)}
 for(let day=1;day<=count;day++){
  const key=dateKey(year,month,day),checked=selected.has(key);
  const b=document.createElement('button');
  b.type='button';b.className='health-day'+(checked?' marked':'')+(key===today?' today':'');
  b.textContent=String(day);b.setAttribute('aria-pressed',String(checked));
  b.setAttribute('aria-label',`${key} ${checked?'vérzéses nap, kijelölve':'nincs kijelölve'}`);
  b.onclick=()=>{
   if(selected.has(key))selected.delete(key);else selected.add(key);
   try{localStorage.setItem(KEY,JSON.stringify([...selected].sort()))}
   catch{alert('A böngésző nem engedte a mentést. Ellenőrizd a tárhelybeállításokat.')}
   render();
  };
  frag.append(b);
 }
 $('healthDays').replaceChildren(frag);
}
$('healthPrev').onclick=()=>{month--;if(month<0){month=11;year--}render()};
$('healthNext').onclick=()=>{month++;if(month>11){month=0;year++}render()};
render();
})();
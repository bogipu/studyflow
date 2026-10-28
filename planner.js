'use strict';
const $=id=>document.getElementById(id),today=localDate(new Date());
let projectWeek=weekStart(today),entries=[],selected=today,view='month',cursor=new Date(today+'T12:00:00'),tab='today',online=false;
function localDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function shift(date,n){let d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d)}
function human(date){return new Intl.DateTimeFormat('hu-HU',{month:'long',day:'numeric',weekday:'long'}).format(new Date(date+'T12:00:00'))}
function weekStart(date){let d=new Date(date+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return localDate(d)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function label(t){return {task:'Teendő',study:'Tanulás',event:'Program',exam:'ZH',deadline:'Határidő',bblooms:'Bblooms 🌸',university:'Egyetem 🎓'}[t]||'Esemény'}
function isTodo(e){return !e.isProjectMeta&&(e.isTask===true||e.type==='task'||e.type==='study')}
function sorted(a){return [...a].sort((x,y)=>x.date.localeCompare(y.date)||(x.time||'').localeCompare(y.time||''))}
async function load(){try{let r=await fetch('/api/planner',{cache:'no-store'});if(!r.ok)throw Error('API');let data=await r.json();entries=Array.isArray(data.items)?data.items:[];online=true;status('Online szinkronizálás aktív ♡')}catch{try{entries=JSON.parse(localStorage.getItem('studyflow-planner-v1')||'[]')}catch{entries=[]}status('Helyi mentés aktív. A készülékek közötti szinkronhoz Cloudflare Pages + D1 szükséges.')}render()}
function status(s){if($('syncStatus'))$('syncStatus').textContent=s}
async function save(){localStorage.setItem('studyflow-planner-v1',JSON.stringify(entries));render();if(online){try{let r=await fetch('/api/planner',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:entries})});if(!r.ok)throw Error('save');status('Mentve és szinkronizálva ♡')}catch{online=false;status('Az online mentés nem sikerült; a módosítás ezen a készüléken megmaradt.')}}}
function uid(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`}
function add(title,date,type,time='',minutes=0){entries.push({id:uid(),title:title.trim(),date,type,time,minutes:Number(minutes)||0,done:false})}
function addRepeating(title,date,type,time,minutes,repeat,until){
 if(repeat==='none'){add(title,date,type,time,minutes);return 1}
 if(!['daily','weekly','monthly'].includes(repeat)||!/^\d{4}-\d{2}-\d{2}$/.test(until)||until<date)throw Error('Adj meg egy érvényes ismétlődési végdátumot.');
 const start=new Date(date+'T12:00:00'),end=new Date(until+'T12:00:00');
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))throw Error('Érvénytelen dátum.');
 const dates=[];
 for(let i=0;i<367;i++){
  let next;
  if(repeat==='daily')next=shift(date,i);
  else if(repeat==='weekly')next=shift(date,i*7);
  else{
   const target=new Date(start.getFullYear(),start.getMonth()+i,1,12);
   const last=new Date(target.getFullYear(),target.getMonth()+1,0,12).getDate();
   target.setDate(Math.min(start.getDate(),last));next=localDate(target);
  }
  if(next>until)break;
  if(dates.length===366)throw Error('Legfeljebb 366 ismétlődő alkalom hozható létre.');
  dates.push(next);
 }
 const group=uid();
 dates.forEach(day=>{add(title,day,type,time,minutes);Object.assign(entries[entries.length-1],{repeatGroup:group,repeat,repeatUntil:until})});
 return dates.length
}
function exam(title,date,time,minutes,studytime){const group=uid();entries.push({id:uid(),group,title,date,type:'exam',time,minutes:0,done:false});for(let i=7;i>=1;i--)entries.push({id:uid(),group,title:`${title} – felkészülés`,date:shift(date,-i),type:'study',time:studytime,minutes:Number(minutes)||25,done:false})}
function itemHtml(e){const missed=isTodo(e)&&e.date<today&&!e.done&&!e.makeupFor;return `<div class="task ${e.done?'done':''}">${(isTodo(e)||!!$('tasks'))?`<input type="checkbox" data-toggle="${esc(e.id)}" ${e.done?'checked':''} aria-label="Teljesítve: ${esc(e.title)}">`:'<span class="emoji" style="font-size:1.2rem">📌</span>'}<div class="info"><strong>${esc(e.title)}</strong><small>${esc(label(e.type))} · ${esc(e.date)}${e.time?' · '+esc(e.time):''}${e.minutes?' · '+e.minutes+' perc':''}${e.makeupFor?' · Pótlás':''}${missed?' · Elmaradt':''}${e.tentative?' · Ellenőrizendő':''}</small>${e.notes?`<small>${esc(e.notes)}</small>`:''}</div><div class="actions">${missed?`<button data-makeup="${esc(e.id)}">Pótlás</button>`:''}<button data-edit="${esc(e.id)}" aria-label="Szerkesztés">✎</button><button class="danger" data-delete="${esc(e.id)}" aria-label="Törlés">✕</button></div></div>`}
function renderHome(){if(!$('events'))return;$('today').textContent=human(today);let todayEvents=sorted(entries.filter(e=>!e.isProjectMeta&&e.date===today&&!isTodo(e)));$('events').innerHTML=todayEvents.length?todayEvents.map(e=>`<div class="event"><time>${esc(e.time||'Egész nap')}</time><span class="bar ${e.type==='exam'?'exam':e.type==='deadline'?'deadline':''}"></span><div><strong>${esc(e.title)}</strong><div class="muted small">${label(e.type)}</div></div></div>`).join(''):'<p class="empty">Mára nincs bejegyzett program, ZH vagy határidő. ♡</p>'}
function renderWeeklyTasks(){
 if(!$('weeklyTasks'))return;
 const ws=weekStart(today),end=shift(ws,6);
 const items=sorted(entries.filter(e=>!e.isProjectMeta&&isTodo(e)&&e.date>=ws&&e.date<=end));
 $('weeklyTasks').innerHTML=items.length?items.map(itemHtml).join(''):'<p class="empty">Erre a hétre nincs feladat. ♡</p>';
}
function renderTasks(){if(!$('tasks'))return;let ws=weekStart(today),end=shift(ws,6);let category=$('taskCategory')?.value||'all';let visible=sorted(entries.filter(e=>!e.isProjectMeta&&(category==='all'||category===e.type)&&(tab==='today'?e.date===today:tab==='week'?e.date>=ws&&e.date<=end:tab==='missed'?isTodo(e)&&e.date<today&&!e.done&&!e.makeupFor:true)));$('tasks').innerHTML=(tab==='missed'?'<div class="notice">Az elmaradt feladat az eredeti dátumán marad. A pótlás külön feladatként jelenik meg. ♡</div>':'')+(visible.length?visible.map(itemHtml).join(''):'<p class="empty">Itt most nincs feladat. ♡</p>');document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab))}
let calendarCategory='all';
function calendarMatches(e){if(e.isProjectMeta)return false;const query=($('calendarSearch')?.value||'').toLocaleLowerCase('hu-HU').trim();return (calendarCategory==='all'||calendarCategory===e.type)&&(!query||`${e.title} ${e.notes||''}`.toLocaleLowerCase('hu-HU').includes(query))}
function shortCalendarLabel(e){
 if(e.type==='bblooms')return 'Bblooms';
 if(e.type==='university')return 'Egyetem';
 if(e.type==='exam')return 'ZH';
 if(e.type==='deadline')return 'Leadás';
 if(e.type==='study')return 'Tanulás';
 if(e.type==='task')return 'Teendő';
 const t=(e.title||'').toLocaleLowerCase('hu-HU');
 if(t.includes('prezentáció'))return 'Prez.';
 if(t.includes('konzultáció'))return 'Konz.';
 if(t.includes('születésnap'))return 'Szülinap';
 return 'Program';
}
function renderCalendar(){
 if(!$('calendar'))return;
 const d=new Date(cursor),year=d.getFullYear(),month=d.getMonth(),dates=[];
 if(view==='month'){
  const first=new Date(year,month,1,12),offset=(first.getDay()+6)%7,last=new Date(year,month+1,0,12).getDate();
  for(let i=0;i<offset;i++)dates.push(null);
  for(let i=1;i<=last;i++)dates.push(localDate(new Date(year,month,i,12)));
 }else if(view==='week'){
  const start=weekStart(localDate(d));for(let i=0;i<7;i++)dates.push(shift(start,i));
 }else dates.push(localDate(d));
 $('monthTitle').textContent=view==='month'?`♡ ${new Intl.DateTimeFormat('hu-HU',{month:'long'}).format(d)} ${year} ♡`:`♡ ${new Intl.DateTimeFormat('hu-HU',{month:'long'}).format(d)} ${year} · ${dates[0].slice(8)}–${dates[6].slice(8)}. ♡`;
 const filtered=entries.filter(calendarMatches),byDate=new Map();
 for(const e of filtered){if(!byDate.has(e.date))byDate.set(e.date,[]);byDate.get(e.date).push(e)}
 $('calendar').innerHTML=`<div class="calendar ${view==='day'?'calendar-single':''}">${view!=='day'?['H','K','Sze','Cs','P','Szo','V'].map(x=>`<div class="weekdays">${x}</div>`).join(''):''}${dates.map(date=>{
  if(!date)return '<div class="day blank"></div>';
  const items=sorted(byDate.get(date)||[]),primary=items[0]?.type||'empty';
  return `<button type="button" class="day day-${esc(primary)} ${date===selected?'selected':''} ${date===today?'today':''}" data-day="${date}" aria-label="${esc(human(date))}, ${items.length} esemény"><strong>${Number(date.slice(8))}</strong><span class="day-events">${items.map(e=>`<span class="event-chip chip-${esc(e.type)}" title="${esc(e.title)}">${esc(shortCalendarLabel(e))}</span>`).join('')}</span></button>`;
 }).join('')}</div>`;
 $('selectedTitle').textContent=`${human(selected)} ♡`;
 const dayEntries=sorted(filtered.filter(e=>e.date===selected));
 $('dayItems').innerHTML=dayEntries.length?dayEntries.map(e=>`<div class="calendar-event-card card-${esc(e.type)}">${itemHtml(e)}</div>`).join(''):'<p class="empty">Nincs a szűrésnek megfelelő bejegyzés ezen a napon.</p>';
 document.querySelectorAll('#calendarFilters [data-category]').forEach(b=>{const active=b.dataset.category===calendarCategory;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
}


function projectRecords(){return entries.filter(e=>e.isProjectMeta)}
function projectMilestones(id){return sorted(entries.filter(e=>e.projectId===id&&!e.isProjectMeta))}
function dayDiff(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000)}
function renderTodayProjects(){
 if(!$('todayTasks'))return;
 const tasks=sorted(entries.filter(e=>!e.isProjectMeta&&e.date===today&&isTodo(e)));
 $('todayTasks').innerHTML=tasks.length?tasks.map(itemHtml).join(''):'<p class="empty">Mára nincs feladatod. ♡</p>';
 const overdue=sorted(entries.filter(e=>isTodo(e)&&e.date<today&&!e.done&&!e.makeupFor));
 if($('todayOverdue'))$('todayOverdue').innerHTML=overdue.length?overdue.map(itemHtml).join(''):'<p class="empty">Nincs elmaradásod, ügyes vagy! 🌷</p>';
 if($('todayDateLabel'))$('todayDateLabel').textContent=human(today);
 if($('projectWeekLabel'))$('projectWeekLabel').textContent=`${projectWeek} – ${shift(projectWeek,6)}`;
 const dates=Array.from({length:7},(_,i)=>shift(projectWeek,i));
 $('timelineDays').innerHTML=dates.map(d=>`<div class="timeline-day ${d===today?'is-today':''}"><small>${['V','H','K','Sze','Cs','P','Szo'][new Date(d+'T12:00:00').getDay()]}</small><strong>${Number(d.slice(-2))}.</strong></div>`).join('');
 const projects=projectRecords().filter(p=>projectMilestones(p.id).length>0);
 $('projectTimeline').innerHTML=projects.length?projects.map(p=>{
 const marks=projectMilestones(p.id),start=marks[0]?.date,end=marks.at(-1)?.date;
 const color=/^#[0-9a-f]{6}$/i.test(p.projectColor||'')?p.projectColor:'#d9b8ce';
 let segment='';
 if(start&&end){
 const x1=Math.max(0,dayDiff(projectWeek,start)+.5),x2=Math.min(7,dayDiff(projectWeek,end)+.5);
 if(x2>=0&&x1<=7&&x2>=x1)segment=`<div class="project-line" style="left:${x1/7*100}%;width:${(x2-x1)/7*100}%;background:${color}"></div>`;
 }
 const dots=marks.filter(m=>m.date>=projectWeek&&m.date<=shift(projectWeek,6)).map(m=>{
 const x=(dayDiff(projectWeek,m.date)+.5)/7*100;
 return `<button class="milestone-dot ${m.done?'complete':''}" data-project-edit-milestone="${esc(m.id)}" style="left:${x}%;--project-color:${color}" title="${esc(m.title)} – ${esc(m.date)}" aria-label="${esc(m.title)} (${esc(m.date)})"></button><span class="milestone-caption" style="left:${x}%">${esc(m.title)}</span>`;
 }).join('');
 return `<div class="project-track"><div class="project-track-head"><strong>${esc(p.title)}</strong><span>${esc(label(p.projectCategory||'task'))} · ${marks.length} állomás</span><button data-project-open="${esc(p.id)}">Szerkesztés</button></div><div class="project-track-bar">${segment}${dots}</div></div>`;
 }).join(''):'<p class="empty">Még nincs mérföldkővel rendelkező projekted. ♡</p>';
}
function projectEditor(id){
 const p=projectRecords().find(p=>p.id===id);if(!p)return;
 const f=$('projectForm');f.elements.projectId.value=p.id;f.elements.title.value=p.title;f.elements.category.value=p.projectCategory||'task';f.elements.color.value=p.projectColor||'#e5b4c9';
 $('projectFormTitle').textContent='Projekt szerkesztése ♡';
 $('projectDelete').hidden=false;
 $('milestonePanel').hidden=false;
 $('milestoneProjectId').value=p.id;
 renderMilestoneList(p.id);
 $('projectForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderMilestoneList(id){
 const items=projectMilestones(id);
 if($('milestoneCountInfo'))$('milestoneCountInfo').textContent=`${items.length} / 10 mérföldkő`;if($('milestoneDesiredCount'))$('milestoneDesiredCount').value=String(Math.max(2,Math.min(10,items.length||2)));
 $('milestoneList').innerHTML=items.length?items.map(m=>`<div class="milestone-item"><label><input type="checkbox" data-toggle="${esc(m.id)}" ${m.done?'checked':''}> ${esc(m.title)} · ${esc(m.date)}</label><div><button data-project-edit-milestone="${esc(m.id)}">✎</button><button data-project-delete-milestone="${esc(m.id)}">✕</button></div></div>`).join(''):'<p class="muted small">Adj hozzá 2–10 mérföldkövet.</p>';
}
function resetProjectEditor(){
 $('projectForm').reset();$('projectForm').elements.projectId.value='';$('projectFormTitle').textContent='Új projekt ♡';$('projectDelete').hidden=true;$('milestonePanel').hidden=true;
}
function render(){renderTodayProjects();if($('todayDate'))$('todayDate').textContent=`Ma: ${new Intl.DateTimeFormat('hu-HU',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date())}`;renderHome();renderTasks();renderCalendar()}
document.addEventListener('click',async e=>{let b=e.target.closest('button');if(!b)return;if(b.dataset.category&&b.closest('#calendarFilters')){calendarCategory=b.dataset.category;renderCalendar()}if(b.dataset.tab){tab=b.dataset.tab;renderTasks()}if(b.dataset.view){view=b.dataset.view;renderCalendar()}if(b.dataset.day){selected=b.dataset.day;renderCalendar()}if(b.dataset.edit){const x=entries.find(x=>x.id===b.dataset.edit);if(x&&$('editForm')){let f=$('editForm');for(let k of ['id','title','date','type','time','minutes','notes'])f.elements[k].value=x[k]??'';$('editPanel').hidden=false;$('editPanel').scrollIntoView({behavior:'smooth',block:'start'})}}if(b.dataset.delete){let x=entries.find(x=>x.id===b.dataset.delete);if(x&&confirm('Biztosan törlöd ezt a bejegyzést?')){entries=entries.filter(y=>y.id!==x.id);await save()}}if(b.dataset.makeup){let x=entries.find(x=>x.id===b.dataset.makeup);if(!x)return;let date=prompt('Melyik dátumra szeretnéd a pótlást? (ÉÉÉÉ-HH-NN)',today);if(!date)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<=x.date){alert('Adj meg az eredeti napnál későbbi, érvényes dátumot.');return}if(entries.some(y=>y.makeupFor===x.id&&!y.done)){alert('Ehhez már van tervezett pótlás.');return}let item={...x,id:uid(),date,done:false,makeupFor:x.id};entries.push(item);await save()}});
document.addEventListener('change',async e=>{if(e.target.matches('[data-toggle]')){let x=entries.find(x=>x.id===e.target.dataset.toggle);if(x){x.done=e.target.checked;if(x.makeupFor&&x.done){let original=entries.find(y=>y.id===x.makeupFor);if(original)original.done=true}await save();if(x.projectId&&$('milestonePanel')&&!$('milestonePanel').hidden)renderMilestoneList(x.projectId)}}});
if($('prev')){$('prev').onclick=()=>{if(view==='month')cursor.setMonth(cursor.getMonth()-1,1);else cursor.setDate(cursor.getDate()-(view==='week'?7:1));selected=localDate(cursor);renderCalendar()};$('next').onclick=()=>{if(view==='month')cursor.setMonth(cursor.getMonth()+1,1);else cursor.setDate(cursor.getDate()+(view==='week'?7:1));selected=localDate(cursor);renderCalendar()}}
if($('taskForm')){$('taskForm').elements.date.value=today;$('taskForm').onsubmit=async e=>{e.preventDefault();let f=e.target;let repeat=f.elements.repeat.value,until=f.elements.repeatUntil.value;
if(repeat!=='none'&&(!until||until<f.elements.date.value)){alert('Ismétlődésnél adj meg a kezdőnapnál nem korábbi végdátumot.');return}
try{
const count=addRepeating(f.elements.title.value,f.elements.date.value,f.elements.type.value,f.elements.time.value,f.elements.minutes.value,repeat,until);
entries.slice(-count).forEach(item=>item.isTask=true);
f.reset();f.elements.date.value=today;await save();
if(repeat!=='none')alert(`${count} ismétlődő bejegyzés létrehozva. 🌷`);
}catch(err){alert(err.message)}}}
if($('examForm')){$('examForm').elements.date.value=shift(today,8);$('examForm').onsubmit=async e=>{e.preventDefault();let f=e.target;exam(f.elements.title.value,f.elements.date.value,f.elements.time.value,f.elements.minutes.value,f.elements.studytime.value);f.reset();f.elements.date.value=shift(today,8);await save();alert('A ZH és a megelőző 7 nap tanulási alkalmai létrejöttek! 🎀')}}
if($('eventForm')){$('eventForm').elements.date.value=today;$('eventForm').onsubmit=async e=>{
 e.preventDefault();const f=e.target,type=f.elements.type.value,title=f.elements.title.value,date=f.elements.date.value;
 const repeat=f.elements.repeat.value,until=f.elements.repeatUntil.value;
 if(repeat!=='none'&&(!until||until<date)){alert('Az ismétlődéshez válassz megfelelő végdátumot.');return}
 try{
  if(type==='exam'&&repeat==='none'){
   exam(title,date,f.elements.time.value,f.elements.minutes.value,'18:00');
   entries[entries.length-8].notes=f.elements.notes.value.trim();
  }else{
   const count=addRepeating(title,date,type,f.elements.time.value,type==='study'?f.elements.minutes.value:0,repeat,until);
   entries.slice(-count).forEach(item=>item.notes=f.elements.notes.value.trim());
   if(type==='exam'&&repeat!=='none')alert('Az ismétlődő ZH-k létrejöttek. Az automatikus 7 napos felkészülés csak egyszeri ZH-nál készül.');
  }
  selected=date;cursor=new Date(date+'T12:00:00');f.reset();f.elements.date.value=today;await save();
 }catch(err){alert(err.message)}
}}
if($('importDates'))$('importDates').onclick=async()=>{const pack=window.STUDYFLOW_DATE_IMPORT;if(!pack){alert('Az importálási fájl hiányzik.');return}const incoming=pack.items;const existing=new Set(entries.map(x=>x.id));const added=incoming.filter(x=>!existing.has(x.id)&&!entries.some(e=>e.date===x.date&&e.title===x.title&&e.type===x.type));if(!added.length){$('importResult').textContent='Minden ismert dátum már szerepel a Plannerben. ♡';return}if(!confirm(`${added.length} új bejegyzés hozzáadása a naptárhoz? A meglévő adatok megmaradnak.`))return;entries.push(...added);await save();$('importResult').textContent=`${added.length} bejegyzés hozzáadva. ${pack.unknown.length} dátum nélküli tétel külön listában maradt.`;};

if($('projectPrev'))$('projectPrev').onclick=()=>{projectWeek=shift(projectWeek,-7);renderTodayProjects()};
if($('projectNext'))$('projectNext').onclick=()=>{projectWeek=shift(projectWeek,7);renderTodayProjects()};
if($('projectToday'))$('projectToday').onclick=()=>{projectWeek=weekStart(today);renderTodayProjects()};
if($('projectForm'))$('projectForm').onsubmit=async ev=>{
 ev.preventDefault();const f=ev.target,id=f.elements.projectId.value;
 let p=entries.find(e=>e.id===id&&e.isProjectMeta);
 if(!p){p={id:uid(),type:'task',date:today,isProjectMeta:true,done:false};entries.push(p)}
 p.title=f.elements.title.value.trim();p.projectCategory=f.elements.category.value;p.projectColor=f.elements.color.value;
 await save();projectEditor(p.id);
};
if($('projectNew'))$('projectNew').onclick=resetProjectEditor;
if($('projectDelete'))$('projectDelete').onclick=async()=>{
 const id=$('projectForm').elements.projectId.value;
 if(!id||!confirm('A projekt és minden mérföldköve törlődjön?'))return;
 entries=entries.filter(e=>e.id!==id&&e.projectId!==id);resetProjectEditor();await save();
};
if($('milestoneCreateSlots'))$('milestoneCreateSlots').onclick=async()=>{
 const pid=$('milestoneProjectId').value, p=entries.find(e=>e.id===pid&&e.isProjectMeta);
 if(!p){alert('Először mentsd el a projektet.');return}
 const n=Number($('milestoneDesiredCount').value), existing=projectMilestones(pid).length;
 if(!Number.isInteger(n)||n<2||n>10){alert('2 és 10 közötti számot adj meg.');return}
 if(n<existing){alert(`Már ${existing} mérföldkő van. A meglévőket nem töröljük automatikusan.`);return}
 for(let i=existing;i<n;i++)entries.push({id:uid(),projectId:pid,isTask:true,done:false,title:`${i+1}. mérföldkő`,date:today,type:p.projectCategory||'task',time:''});
 if(n>existing)await save();renderMilestoneList(pid);
};
if($('milestoneForm'))$('milestoneForm').onsubmit=async ev=>{
 ev.preventDefault();const f=ev.target,id=f.elements.milestoneId.value,pid=f.elements.projectId.value;
 const project=entries.find(e=>e.id===pid&&e.isProjectMeta);if(!project){alert('Először mentsd el a projektet.');return}
 let m=entries.find(e=>e.id===id&&e.projectId===pid);
 if(!m&&projectMilestones(pid).length>=10){alert('Egy projekthez legfeljebb 10 mérföldkövet adhatsz hozzá.');return}
 if(!m){m={id:uid(),projectId:pid,isTask:true,done:false};entries.push(m)}
 m.title=f.elements.title.value.trim();m.date=f.elements.date.value;m.type=project.projectCategory||'task';m.time='';
 f.reset();f.elements.projectId.value=pid;await save();renderMilestoneList(pid);
};
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('button');if(!b||!$('projectTimeline'))return;
 if(b.dataset.projectOpen)projectEditor(b.dataset.projectOpen);
 if(b.dataset.projectEditMilestone){
 const m=entries.find(e=>e.id===b.dataset.projectEditMilestone);if(!m)return;
 projectEditor(m.projectId);const f=$('milestoneForm');
 f.elements.milestoneId.value=m.id;f.elements.projectId.value=m.projectId;f.elements.title.value=m.title;f.elements.date.value=m.date;
 f.scrollIntoView({behavior:'smooth',block:'center'});
 }
 if(b.dataset.projectDeleteMilestone){
 const m=entries.find(e=>e.id===b.dataset.projectDeleteMilestone);
 if(!m||!confirm('Törlöd ezt a mérföldkövet?'))return;
 entries=entries.filter(e=>e.id!==m.id);await save();renderMilestoneList(m.projectId);
 }
});
load();

if($('goToday'))$('goToday').onclick=()=>{selected=today;cursor=new Date(today+'T12:00:00');renderCalendar()};
if($('calendarSearch'))$('calendarSearch').addEventListener('input',renderCalendar);

if($('addOnSelected'))$('addOnSelected').onclick=()=>{$('eventForm').elements.date.value=selected;$('eventForm').scrollIntoView({behavior:'smooth',block:'start'});$('eventForm').elements.title.focus()};
if($('cancelEdit'))$('cancelEdit').onclick=()=>{$('editPanel').hidden=true};
if($('editForm'))$('editForm').onsubmit=async e=>{e.preventDefault();const f=e.target,x=entries.find(x=>x.id===f.elements.id.value);if(!x)return;const oldDate=x.date,oldType=x.type;const newType=f.elements.type.value,newDate=f.elements.date.value;if(!newDate)return;const linked=x.group&&oldType==='exam'?entries.filter(y=>y.group===x.group&&y.type==='study'):[];if(oldType==='exam'&&newType!=='exam'&&linked.length&&!confirm('A kapcsolódó tanulási alkalmak megmaradjanak?'))return;for(let k of ['title','date','type','time','notes'])x[k]=f.elements[k].value.trim();x.minutes=Number(f.elements.minutes.value)||0;if(linked.length&&newType==='exam'&&oldDate!==newDate){const delta=Math.round((new Date(newDate+'T12:00:00')-new Date(oldDate+'T12:00:00'))/86400000);linked.forEach(y=>{y.date=shift(y.date,delta)})}selected=x.date;cursor=new Date(x.date+'T12:00:00');$('editPanel').hidden=true;await save()};

if($('taskCategory'))$('taskCategory').addEventListener('change',renderTasks);

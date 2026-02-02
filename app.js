// Workout Tracker (Strength / Fat Loss / Volume) - date-driven rotation
const STORE_KEY="gym_template_rir_v10_history_x_pin";
const INC_KG=2.5;

const DAY_ORDER=['strength','fatloss','volume'];

function uid(p="id"){return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;}
function localISO(d=new Date()){
  // timezone-safe local YYYY-MM-DD
  const off=d.getTimezoneOffset();
  return new Date(d.getTime()-off*60000).toISOString().slice(0,10);
}
function addDays(iso,n){
  const d=new Date(iso+'T00:00:00');
  d.setDate(d.getDate()+n);
  return localISO(d);
}

function load(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||'null');}catch(e){return null;}}
function save(s){localStorage.setItem(STORE_KEY, JSON.stringify(s));}

function defaultState(){
  const exercises=[
    {id:uid('ex'),name:'Squat',type:'reps',archived:false},
    {id:uid('ex'),name:'Bench Press (Free)',type:'reps',archived:false},
    {id:uid('ex'),name:'Bent Over Row',type:'reps',archived:false},
    {id:uid('ex'),name:'Skull Crusher',type:'reps',archived:false},
    {id:uid('ex'),name:'Deadlift',type:'reps',archived:false},
    {id:uid('ex'),name:'Lat Pull Down',type:'reps',archived:false},
    {id:uid('ex'),name:'Military / Arnold Press',type:'reps',archived:false},
    {id:uid('ex'),name:'Hammer Curl',type:'reps',archived:false},
    {id:uid('ex'),name:'Stiff-Leg Romanian Deadlift',type:'reps',archived:false},
    {id:uid('ex'),name:'Chest Fly',type:'reps',archived:false},
    {id:uid('ex'),name:'Seated Dumbbell Extension',type:'reps',archived:false},
    {id:uid('ex'),name:'Dumbbell Palm Curl',type:'reps',archived:false},
    {id:uid('ex'),name:"Farmer's Walk",type:'time',archived:false},
  ];
  const id=(n)=>exercises.find(e=>e.name===n)?.id||'';
  const mk=(name,sets,target)=>({id:uid('row'),exId:id(name),sets:String(sets),target:String(target),weight:'',pin:'',rir:''});
  const presets={
    strength:[mk('Squat',2,5),mk('Bench Press (Free)',2,5),mk('Bent Over Row',2,5),mk('Skull Crusher',2,10)],
    fatloss:[mk('Deadlift',2,12),mk('Lat Pull Down',2,15),mk('Military / Arnold Press',2,15),mk('Hammer Curl',2,15),mk("Farmer's Walk",2,35)],
    volume:[mk('Stiff-Leg Romanian Deadlift',2,10),mk('Chest Fly',2,12),mk('Seated Dumbbell Extension',2,12),mk('Dumbbell Palm Curl',2,12),mk("Farmer's Walk",2,35)],
  };
  return {exercises,presets,sessions:{},progression:{}};
}

let state=load()||defaultState();
// Only persist once here; after this we only save on explicit actions / persisted-day edits.
save(state);

// DOM
const dateInput=document.getElementById('dateInput');
const prevDay=document.getElementById('prevDay');
const nextDay=document.getElementById('nextDay');
const todayBtn=document.getElementById('todayBtn');
const tabs=[...document.querySelectorAll('.tab')];
const workoutCard=document.getElementById('workoutCard');
const manageCard=document.getElementById('manageCard');
const historyCard=document.getElementById('historyCard');
const dayTitle=document.getElementById('dayTitle');
const daySelect=document.getElementById('daySelect');
const daySelectHint=document.getElementById('daySelectHint');
const tbody=document.getElementById('tbody');
const note=document.getElementById('note');

const loadPresetBtn=document.getElementById('loadPresetBtn');
const copyPrevBtn=document.getElementById('copyPrevBtn');
const clearBtn=document.getElementById('clearBtn');
const addRowBtn=document.getElementById('addRowBtn');
const progBtn=document.getElementById('progBtn');
const saveBtn=document.getElementById('saveBtn');

const newName=document.getElementById('newName');
const newType=document.getElementById('newType');
const addExBtn=document.getElementById('addExBtn');
const exList=document.getElementById('exList');

const rangeSel=document.getElementById('rangeSel');
const search=document.getElementById('search');
const histList=document.getElementById('histList');
const exportBtn=document.getElementById('exportBtn');
const importFile=document.getElementById('importFile');
const exportBtn2=document.getElementById('exportBtn2');
const importFile2=document.getElementById('importFile2');

// State for currently open date
let currentDate=localISO();
let currentTab='strength';
let followToday=true;

// For browsing dates: if a date has no saved session yet, we keep a temporary (unsaved) session in memory.
// This is what makes the program change as you go forward/backward WITHOUT saving anything.
let tempSession=null; // {date, dayType, rows}

// ---------- helpers ----------
function exById(id){return state.exercises.find(e=>e.id===id)||null;}
function activeExercises(){return state.exercises.filter(e=>!e.archived);}

function isPersistedDate(iso=currentDate){
  return !!state.sessions?.[iso];
}
function saveIfPersisted(){
  if(isPersistedDate()) save(state);
}

function getActiveSession(){
  // prefer saved session; otherwise temp for that date
  const saved=state.sessions?.[currentDate]||null;
  if(saved) return saved;
  if(tempSession && tempSession.date===currentDate) return tempSession;
  return null;
}
function setActiveSession(sess){
  // For currentDate only. If persisted date, set it on state.sessions. Otherwise update tempSession.
  if(isPersistedDate()){
    state.sessions[currentDate]=sess;
    save(state);
  }else{
    tempSession=sess;
  }
}

function isCompletedSession(sess){
  // completed = at least one exercise selected + saved
  return !!(sess?.rows && sess.rows.some(r=>r.exId));
}

function getLastCompletedBefore(iso){
  const dates=Object.keys(state.sessions||{}).filter(d=>d<iso).sort();
  for(let i=dates.length-1;i>=0;i--){
    const d=dates[i];
    const s=state.sessions[d];
    if(s?.dayType && isCompletedSession(s)) return {date:d, sess:s};
  }
  return null;
}

function computePlannedDayType(iso){
  // If there is a saved session on that date, use it.
  const saved=state.sessions?.[iso];
  if(saved?.dayType) return saved.dayType;

  // Otherwise based on last completed (saved) session before this date.
  const last=getLastCompletedBefore(iso);
  if(!last?.sess?.dayType) return 'strength';

  const idx=DAY_ORDER.indexOf(last.sess.dayType);
  if(idx===-1) return 'strength';
  return DAY_ORDER[(idx+1)%DAY_ORDER.length];
}

function hasRealInputs(sess){
  // Do not overwrite a session if user has started entering real data
  return !!(sess?.rows && sess.rows.some(r=>{
    return (r.weight && String(r.weight).trim()!=='') || (r.pin && String(r.pin).trim()!=='') || (r.rir && String(r.rir).trim()!=='');
  }));
}

// ---------- UI / rendering ----------
function setTitle(){
  dayTitle.textContent=currentTab==='strength'?'Strength Day':currentTab==='fatloss'?'Fat Loss Day':currentTab==='volume'?'Volume Day':'Workout';
  if(daySelect){
    if(currentTab==='manage'||currentTab==='history'){
      daySelect.disabled=true;
      if(daySelectHint) daySelectHint.textContent='Day type selection is disabled in Manage/History.';
    }else{
      daySelect.disabled=false;
      if(daySelectHint) daySelectHint.textContent='Pick a day type (optional). Program auto-follows your saved workouts.';
    }
  }
}

function render(){
  tabs.forEach(b=>b.classList.toggle('active', b.dataset.tab===currentTab));
  workoutCard.classList.toggle('hidden', currentTab==='manage'||currentTab==='history');
  manageCard.classList.toggle('hidden', currentTab!=='manage');
  historyCard.classList.toggle('hidden', currentTab!=='history');
  if(currentTab==='manage') renderManage();
  if(currentTab==='history') renderHistory();
  if(currentTab==='strength'||currentTab==='fatloss'||currentTab==='volume') renderWorkout();
}

function renderWorkout(){
  setTitle();
  const sess=getActiveSession();
  tbody.innerHTML='';
  if(!sess){ return; }
  (sess.rows||[]).forEach(r=>tbody.appendChild(renderRow(r, sess)));
  note.textContent = isPersistedDate()
    ? 'Saved day. Edit anytime.'
    : 'Browsing day (not saved). Press 💾 Save to store this day.';
}

function renderRow(r, sess){
  const tr=document.createElement('tr');

  const td1=document.createElement('td');
  const sel=document.createElement('select'); sel.className='input';
  const o0=document.createElement('option'); o0.value=''; o0.textContent='Select…'; sel.appendChild(o0);

  const opts=[...activeExercises()];
  const rowEx=exById(r.exId);
  if(rowEx && rowEx.archived && !opts.find(x=>x.id===rowEx.id)) opts.unshift(rowEx);

  opts.forEach(ex=>{
    const o=document.createElement('option');
    o.value=ex.id;
    o.textContent=ex.archived?`${ex.name} (archived)`:ex.name;
    sel.appendChild(o);
  });
  sel.value=r.exId||'';
  sel.onchange=()=>{
    r.exId=sel.value;
    const ex=exById(r.exId);
    if(ex?.type==='reps'){
      const nw=state.progression[ex.id];
      if(nw && !r.weight) r.weight=String(nw);
    } else {
      r.weight='';
    }
    saveIfPersisted();
    renderWorkout();
  };
  td1.appendChild(sel);

  const td2=document.createElement('td');
  const sets=document.createElement('input'); sets.className='input'; sets.inputMode='numeric'; sets.value=r.sets??'';
  sets.oninput=()=>{r.sets=sets.value; saveIfPersisted();};
  td2.appendChild(sets);

  const td3=document.createElement('td');
  const tgt=document.createElement('input'); tgt.className='input'; tgt.inputMode='numeric'; tgt.value=r.target??'';
  tgt.oninput=()=>{r.target=tgt.value; saveIfPersisted();};
  td3.appendChild(tgt);

  const td4=document.createElement('td');
  const w=document.createElement('input'); w.className='input'; w.inputMode='decimal';
  const ex=exById(r.exId);
  w.placeholder=ex?.type==='time'?'—':'kg';
  w.value=r.weight??'';
  w.disabled=(ex?.type==='time');
  w.oninput=()=>{r.weight=w.value; saveIfPersisted();};
  td4.appendChild(w);

  const tdPin=document.createElement('td');
  const pinSel=document.createElement('select'); pinSel.className='input';
  pinSel.innerHTML = `<option value="">Pin</option>` + Array.from({length:15},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
  pinSel.value = r.pin ?? '';
  pinSel.onchange=()=>{r.pin=pinSel.value; saveIfPersisted();};
  tdPin.appendChild(pinSel);

  const td5=document.createElement('td');
  const done=document.createElement('select'); done.className='rirSelect';
  done.innerHTML = `
    <option value="">RIR</option>
    <option value="1">1</option>
    <option value="2">2</option>
    <option value="3">3+</option>
    <option value="custom">Custom…</option>
  `;
  const curVal=(r.rir??'').toString().trim().replace('+','');
  if(curVal==='1'||curVal==='2'||curVal==='3') done.value=curVal;
  else if(curVal) done.value='custom';
  else done.value='';

  done.onchange=()=>{
    if(done.value==='custom'){
      const v=prompt('Enter RIR (number, e.g. 2 or 3.5)', r.rir??'');
      if(v===null){
        const vv=(r.rir??'').toString().trim().replace('+','');
        done.value=(vv==='1'||vv==='2'||vv==='3')?vv:(vv?'custom':'');
        return;
      }
      r.rir=v.toString().replace('+','').trim();
      saveIfPersisted();
      render();
      return;
    }
    r.rir=done.value;
    saveIfPersisted();
  };
  td5.appendChild(done);

  tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4); tr.appendChild(tdPin); tr.appendChild(td5);
  return tr;
}

// ---------- preset loading ----------
function loadPresetInto(sess, force=false){
  const preset=state.presets[currentTab]||[];
  sess.dayType=currentTab;

  if(!force && hasRealInputs(sess)) return;

  sess.rows=preset.map(p=>({...p,id:uid('row'),weight:'',pin:'',rir:''}));
}

function loadPreset(force=false){
  const sess=getActiveSession();
  if(!sess){
    // create temp if nothing
    tempSession={date:currentDate, dayType:currentTab, rows:[]};
  }
  const s=getActiveSession();
  loadPresetInto(s, force);
  setActiveSession(s);
  renderWorkout();
}

function copyPrev(){
  const prevIso=addDays(currentDate,-1);
  const prev=state.sessions[prevIso] || (tempSession && tempSession.date===prevIso ? tempSession : null);
  if(!prev?.rows?.length){alert('No previous day to copy.');return;}
  const sess=getActiveSession() || {date:currentDate, dayType:currentTab, rows:[]};
  sess.dayType=currentTab;
  sess.rows=prev.rows.map(r=>({...r,id:uid('row'),rir:''}));
  setActiveSession(sess);
  renderWorkout();
}

function clearDay(){
  if(!confirm('Clear this day?')) return;
  const sess=getActiveSession();
  if(!sess) return;
  sess.rows=[];
  setActiveSession(sess);
  saveIfPersisted();
  renderWorkout();
}

function addRow(){
  const sess=getActiveSession() || {date:currentDate, dayType:currentTab, rows:[]};
  sess.rows=sess.rows||[];
  sess.rows.push({id:uid('row'),exId:'',sets:'2',target:'',weight:'',pin:'',rir:''});
  setActiveSession(sess);
  renderWorkout();
}

function saveSession(){
  const sess=getActiveSession();
  if(!sess){return;}
  const rows=(sess.rows||[]).filter(r=>r.exId);
  if(!rows.length){
    alert('Nothing to save (pick at least 1 exercise).');
    return;
  }
  state.sessions[currentDate]={dayType:currentTab, rows};
  tempSession=null;
  save(state);
  note.textContent='Saved.';
  renderWorkout();
}

// ---------- DATE IS THE BOSS ----------
function openDate(iso){
  followToday=false;
  currentDate=iso;
  dateInput.value=currentDate;

  // if saved session exists, use it
  const saved=state.sessions?.[iso];
  if(saved?.dayType){
    currentTab=saved.dayType;
    if(daySelect) daySelect.value=currentTab;
    tempSession=null;
    render();
    return;
  }

  // otherwise compute planned type and load preset into temp session (DO NOT SAVE)
  const planned=computePlannedDayType(iso);
  currentTab=planned;
  if(daySelect) daySelect.value=planned;

  tempSession={date:iso, dayType:planned, rows:[]};
  loadPresetInto(tempSession, true); // force load preset for display
  render();
}

// ---------- TABS / DAY SELECT ----------
tabs.forEach(b=>b.onclick=()=>{
  const next=b.dataset.tab;
  if(next===currentTab) return;
  currentTab=next;

  if(next==='manage' || next==='history'){
    render();
    return;
  }

  // workout day selected: reflect in dropdown and load preset (without forcing overwrite if user started inputs)
  if(daySelect) daySelect.value=currentTab;
  const sess=getActiveSession() || {date:currentDate, dayType:currentTab, rows:[]};
  sess.dayType=currentTab;
  setActiveSession(sess);
  loadPreset(false);
  render();
});

if(daySelect){
  daySelect.onchange=()=>{
    const v=daySelect.value;
    if(!v) return;
    currentTab=v;

    const sess=getActiveSession() || {date:currentDate, dayType:v, rows:[]};
    sess.dayType=v;
    setActiveSession(sess);
    loadPreset(false);
    render();
  };
}

// Date controls
prevDay.onclick=()=>openDate(addDays(currentDate,-1));
nextDay.onclick=()=>openDate(addDays(currentDate,1));
todayBtn.onclick=()=>{followToday=true; openDate(localISO());};
dateInput.onchange=()=>openDate(dateInput.value||localISO());

// follow-today sync
function syncToTodayIfNeeded(){
  if(!followToday) return;
  const today=localISO();
  if(today!==currentDate){
    openDate(today);
  }
}
window.addEventListener('focus', syncToTodayIfNeeded);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) syncToTodayIfNeeded(); });

// Buttons
loadPresetBtn.onclick=()=>loadPreset(true); // force button
copyPrevBtn.onclick=copyPrev;
clearBtn.onclick=clearDay;
addRowBtn.onclick=addRow;
saveBtn.onclick=saveSession;

// Progression left as-is (not date-based in this version)
progBtn.onclick=()=>{
  note.textContent='Progression coming next (date-based). For now, log your weights + RIR and hit Save.';
};

// ---------- Manage ----------
function renderManage(){
  exList.innerHTML='';
  const sorted=state.exercises.slice().sort((a,b)=> (a.archived===b.archived)?a.name.localeCompare(b.name):(a.archived?1:-1));
  sorted.forEach(ex=>{
    const div=document.createElement('div'); div.className='item';
    const name=document.createElement('div'); name.style.fontWeight='800'; name.textContent=ex.name;
    const t=document.createElement('div'); t.className='pill'; t.textContent=ex.type==='time'?'Time (sec)':'Reps+Weight';
    const st=document.createElement('div'); st.className='pill'; st.textContent=ex.archived?'Archived':'Active';

    const rename=document.createElement('button'); rename.className='btn'; rename.textContent='Rename';
    rename.onclick=()=>{const n=prompt('Rename exercise', ex.name); if(!n) return; ex.name=n.trim(); save(state); renderManage();};

    const toggle=document.createElement('button'); toggle.className='btn'; toggle.textContent=ex.type==='time'?'Set to Reps':'Set to Time';
    toggle.onclick=()=>{ex.type=ex.type==='time'?'reps':'time'; save(state); renderManage();};

    const arch=document.createElement('button'); arch.className='btn danger'; arch.textContent=ex.archived?'Restore':'Archive';
    arch.onclick=()=>{ex.archived=!ex.archived; save(state); renderManage();};

    div.appendChild(name);div.appendChild(t);div.appendChild(st);div.appendChild(rename);div.appendChild(toggle);div.appendChild(arch);
    exList.appendChild(div);
  });
}
addExBtn.onclick=()=>{
  const n=(newName.value||'').trim();
  if(!n) return;
  state.exercises.push({id:uid('ex'),name:n,type:newType.value,archived:false});
  newName.value='';
  save(state);
  renderManage();
};

// ---------- History ----------
function renderHistory(){
  const days=parseInt(rangeSel.value,10);
  const cutoff=addDays(localISO(),-days);
  const q=(search.value||'').trim().toLowerCase();

  const entries=Object.entries(state.sessions)
    .filter(([iso,s])=> iso>=cutoff && s?.rows?.length)
    .sort((a,b)=>a[0]<b[0]?1:-1);

  histList.innerHTML='';
  entries.forEach(([iso,sess])=>{
    const rows=sess.rows.filter(r=>{
      const ex=exById(r.exId);
      if(!ex) return false;
      if(!q) return true;
      return ex.name.toLowerCase().includes(q);
    });
    if(!rows.length) return;

    const card=document.createElement('div'); card.className='hcard';
    card.innerHTML=`<div class="hhead" style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><strong>${iso}</strong> <span class="pill">${sess.dayType||'day'}</span></div></div>`;
    card.onclick=()=>{
      openDate(iso);
      // go back to workout
      currentTab=sess.dayType||currentTab;
      render();
    };

    const list=document.createElement('div'); list.style.marginTop='8px'; list.style.display='grid'; list.style.gap='6px';
    rows.forEach(r=>{
      const ex=exById(r.exId);
      const line=document.createElement('div'); line.className='muted small';
      if(ex?.type==='time') line.textContent=`${ex.name}: ${r.sets} sets • ${r.target||''}s • RIR ${r.rir||''}`;
      else line.textContent=`${ex.name}: ${r.sets}×${r.target||''} @ ${r.weight||''}kg • RIR ${r.rir||''}`;
      list.appendChild(line);
    });
    card.appendChild(list);
    histList.appendChild(card);
  });
}
rangeSel.onchange=renderHistory; search.oninput=renderHistory;

// Backup / restore
function setupBackup(btnEl,fileEl){
  if(!btnEl || !fileEl) return;
  btnEl.onclick=()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`workout_backup_${localISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  fileEl.onchange=async()=>{
    const f=fileEl.files?.[0];
    if(!f) return;
    try{
      const text=await f.text();
      const incoming=JSON.parse(text);
      if(!incoming?.exercises || !incoming?.sessions || !incoming?.presets){
        alert('Backup not recognized.');
        return;
      }
      if(!confirm('Import backup? This replaces your data on this device.')) return;
      state=incoming;
      tempSession=null;
      save(state);
      alert('Imported.');
      openDate(localISO());
      render();
    }catch(e){
      alert('Import failed.');
    }finally{
      fileEl.value='';
    }
  };
}
setupBackup(exportBtn, importFile);
setupBackup(exportBtn2, importFile2);

// Service worker
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
}

// Initial load
openDate(currentDate);
render();

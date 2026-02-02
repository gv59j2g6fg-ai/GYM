// GYM Tracker v22 — date-driven rotation + per-day edits
const STORE_KEY = "gym_tracker_v22_store";
const INC_KG = 2.5;

function uid(p="id"){ return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`; }

// Local YYYY-MM-DD (timezone safe)
function localISO(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function isoToLocalDate(iso){
  const [y,m,d]=iso.split('-').map(Number);
  return new Date(y, m-1, d);
}
function addDays(iso, n){
  const d = isoToLocalDate(iso);
  d.setDate(d.getDate()+n);
  return localISO(d);
}

function load(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)||'null'); }catch(e){ return null; } }
function save(s){ localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

const DAY_ORDER = ["strength","fatloss","volume"];
function nextType(t){
  const i = DAY_ORDER.indexOf(t);
  return DAY_ORDER[(i+1+DAY_ORDER.length)%DAY_ORDER.length] || "strength";
}

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

let state = load() || defaultState();
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

const back1=document.getElementById('backToWorkout1');
const back2=document.getElementById('backToWorkout2');

let currentDate = localISO();
let currentTab = 'strength';
let followToday = true;

// Draft session for dates with no saved session yet
let draft = null; // {date, dayType, rows}
function getSavedSession(date){ return state.sessions?.[date] || null; }
function setSavedSession(date, sess){ state.sessions[date]=sess; }

function exById(id){ return state.exercises.find(e=>e.id===id)||null; }
function activeExercises(){ return state.exercises.filter(e=>!e.archived); }

// A day is "completed" if any row has an exercise chosen (exId)
function isCompleted(sess){ return !!(sess?.rows && sess.rows.some(r=>r.exId)); }

// Find the last saved session BEFORE date that has a dayType
function findLastSessionBefore(date){
  const keys = Object.keys(state.sessions||{}).filter(d=>d<date).sort();
  for(let i=keys.length-1;i>=0;i--){
    const s=state.sessions[keys[i]];
    if(s?.dayType) return {date:keys[i], sess:s};
  }
  return null;
}

// Decide what dayType a given date SHOULD be (without creating a saved session)
function plannedDayTypeFor(date){
  const saved = getSavedSession(date);
  if(saved?.dayType) return saved.dayType;

  const last = findLastSessionBefore(date);
  if(!last?.sess?.dayType) return "strength";

  // If the last session wasn't completed, repeat it (missed session)
  if(!isCompleted(last.sess)) return last.sess.dayType;

  // Otherwise advance
  return nextType(last.sess.dayType);
}

function titleFor(t){
  return t==='strength'?'Strength Day':t==='fatloss'?'Fat Loss Day':t==='volume'?'Volume Day':'Workout';
}

// Load preset rows into a session object (in-memory), optionally overwrite
function presetRowsFor(dayType){
  const preset = state.presets[dayType] || [];
  return preset.map(p=>({ ...p, id:uid('row'), weight:'', pin:'', rir:'' }));
}

function sessionHasRealData(sess){
  return !!sess?.rows?.some(r =>
    (r.weight && r.weight!=='') ||
    (r.pin && r.pin!=='') ||
    (r.rir && r.rir!=='')
  );
}

// Switch date (THIS is the boss)
function openDate(date){
  currentDate = date;
  dateInput.value = currentDate;

  // If there is a saved session, use it
  const saved = getSavedSession(currentDate);
  if(saved){
    draft = null;
    currentTab = saved.dayType || plannedDayTypeFor(currentDate);
    if(daySelect) daySelect.value = currentTab;
    render();
    // If session exists but has no rows yet, show preset (without overwriting real data)
    if((saved.rows||[]).length===0){
      // load preset into saved rows ONLY if no real data (it has none)
      saved.dayType = currentTab;
      saved.rows = presetRowsFor(currentTab);
      save(state);
      render();
    }
    return;
  }

  // No saved session: create a draft view (NOT saved until user edits/saves)
  const t = plannedDayTypeFor(currentDate);
  currentTab = t;
  if(daySelect) daySelect.value = t;
  draft = { date: currentDate, dayType: t, rows: presetRowsFor(t) };
  render();
}

function getActiveSession(){
  const saved = getSavedSession(currentDate);
  if(saved) return {sess:saved, saved:true};
  if(draft && draft.date===currentDate) return {sess:draft, saved:false};
  // fallback
  draft = { date: currentDate, dayType: plannedDayTypeFor(currentDate), rows: presetRowsFor(plannedDayTypeFor(currentDate)) };
  return {sess:draft, saved:false};
}

// Convert draft into a saved session (first edit)
function touch(){
  const active = getActiveSession();
  if(active.saved) return active.sess;
  const s = { dayType: active.sess.dayType, rows: active.sess.rows || [] };
  setSavedSession(currentDate, s);
  draft = null;
  save(state);
  return s;
}

function setTitle(){
  dayTitle.textContent = titleFor(currentTab);
  if(daySelect){
    if(currentTab==='manage'||currentTab==='history'){
      daySelect.disabled=true;
      if(daySelectHint) daySelectHint.textContent='Day type selection is disabled in Manage/History.';
    }else{
      daySelect.disabled=false;
      if(daySelectHint) daySelectHint.textContent='Pick a day type to load the preset for this date.';
    }
  }
  note.textContent="Log Sets, Target, Weight (kg), Pin (multi ok: 5,7), and RIR. ✕ removes a row for this day only.";
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
  const {sess} = getActiveSession();
  tbody.innerHTML='';
  (sess.rows||[]).forEach(r=>tbody.appendChild(renderRow(r)));
}

// Remove a row for this day only
function removeRow(rowId){
  const active = getActiveSession();
  const sess = active.saved ? active.sess : touch();
  sess.rows = (sess.rows||[]).filter(r=>r.id!==rowId);
  save(state);
  renderWorkout();
}

function renderRow(r){
  const tr=document.createElement('tr');

  // Exercise select
  const td1=document.createElement('td');
  const sel=document.createElement('select'); sel.className='input';
  sel.appendChild(new Option('Select…',''));
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
    const sess = touch();
    r.exId=sel.value;
    // weight carry-forward: if we have progression weight saved
    const ex=exById(r.exId);
    if(ex?.type==='reps'){
      const nw=state.progression?.[ex.id];
      if(nw && !r.weight) r.weight=String(nw);
    }
    save(state); renderWorkout();
  };
  td1.appendChild(sel);

  // Sets
  const td2=document.createElement('td');
  const sets=document.createElement('input'); sets.className='input'; sets.inputMode='numeric'; sets.value=r.sets??'';
  sets.oninput=()=>{ touch(); r.sets=sets.value; save(state); };
  td2.appendChild(sets);

  // Target
  const td3=document.createElement('td');
  const tgt=document.createElement('input'); tgt.className='input'; tgt.inputMode='numeric'; tgt.value=r.target??'';
  tgt.oninput=()=>{ touch(); r.target=tgt.value; save(state); };
  td3.appendChild(tgt);

  // Weight (allow even for Farmer's Walk)
  const td4=document.createElement('td');
  const w=document.createElement('input'); w.className='input'; w.inputMode='decimal';
  const ex=exById(r.exId);
  w.placeholder='kg';
  w.value=r.weight??'';
  w.oninput=()=>{ touch(); r.weight=w.value; save(state); };
  td4.appendChild(w);

  // Pin (multi numbers allowed)
  const tdPin=document.createElement('td');
  const pin=document.createElement('input'); pin.className='input'; pin.placeholder='e.g. 5,7'; pin.value = (r.pin??'');
  pin.oninput=()=>{ touch(); r.pin=pin.value; save(state); };
  tdPin.appendChild(pin);

  // RIR picker
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
    const sess = touch();
    if(done.value==='custom'){
      const v = prompt('Enter RIR (number, e.g. 2 or 3.5)', r.rir??'');
      if(v===null){
        const vv=(r.rir??'').toString().trim().replace('+','');
        done.value=(vv==='1'||vv==='2'||vv==='3')?vv:(vv?'custom':'');
        return;
      }
      r.rir = v.toString().replace('+','').trim();
      save(state); render();
      return;
    }
    r.rir = done.value;
    save(state);
  };
  td5.appendChild(done);

  // Remove button
  const tdX=document.createElement('td');
  const x=document.createElement('button'); x.className='rmbtn'; x.type='button'; x.textContent='✕';
  x.onclick=()=>removeRow(r.id);
  tdX.appendChild(x);

  tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4); tr.appendChild(tdPin); tr.appendChild(td5); tr.appendChild(tdX);
  return tr;
}

function loadPreset(force=false){
  const active = getActiveSession();
  const sess = active.saved ? active.sess : draft;

  // if saved + has real data and not forcing, don't overwrite
  if(active.saved && sessionHasRealData(sess) && !force) return;

  const rows = presetRowsFor(currentTab);
  if(active.saved){
    sess.dayType=currentTab;
    sess.rows = rows;
    save(state);
  }else{
    draft = { date: currentDate, dayType: currentTab, rows };
  }
  renderWorkout();
}

function copyPrev(){
  const prev = getSavedSession(addDays(currentDate,-1));
  if(!prev?.rows?.length){ alert('No previous day to copy.'); return; }
  const sess = touch();
  sess.dayType = currentTab;
  sess.rows = prev.rows.map(r=>({ ...r, id:uid('row'), rir:'' }));
  save(state); renderWorkout();
}

function clearDay(){
  if(!confirm('Clear this day?')) return;
  const sess = touch();
  sess.rows = [];
  save(state); renderWorkout();
}

function addRow(){
  const sess = touch();
  sess.rows = sess.rows || [];
  sess.rows.push({id:uid('row'),exId:'',sets:'2',target:'',weight:'',pin:'',rir:''});
  save(state); renderWorkout();
}

function applyProgression(){
  if(!(currentTab==='strength'||currentTab==='fatloss'||currentTab==='volume')){ note.textContent='Go to a day tab first.'; return; }
  const active = getActiveSession();
  const sess = active.saved ? active.sess : null;
  if(!sess?.rows?.length){ note.textContent='Nothing to progress.'; return; }

  const bump = (w)=>{
    const x=parseFloat(w);
    if(!isFinite(x)) return w;
    return (Math.round((x+INC_KG)*10)/10).toString();
  };

  let changed=0;
  sess.rows.forEach(r=>{
    const rir=parseFloat(r.rir);
    if(!isFinite(rir)) return;
    if(r.weight!==undefined){
      if(rir<=1 || rir>=3){ r.weight=bump(r.weight); changed++; }
    }
  });

  save(state);
  render();
  note.textContent = changed ? `Progression applied (${changed} row${changed===1?'':'s'}).` : 'No rows had RIR entered.';
}

function saveSession(){
  const sess = touch();
  sess.dayType = currentTab;
  sess.rows = (sess.rows||[]).filter(r=>r.exId);
  save(state);
  note.textContent='Saved.';
  renderWorkout();
}

// Tabs
tabs.forEach(b=>b.onclick=()=>{
  const next=b.dataset.tab;
  if(next===currentTab) return;
  currentTab=next;
  if(currentTab==='manage' || currentTab==='history'){ render(); return; }

  // Workout day tabs are hidden in CSS, but keep it safe
  if(daySelect && (currentTab==='strength'||currentTab==='fatloss'||currentTab==='volume')) daySelect.value=currentTab;

  // Switching day type should change exercises immediately unless real data exists
  const active=getActiveSession();
  if(active.saved && sessionHasRealData(active.sess)){
    // don't overwrite, just change title
    active.sess.dayType=currentTab;
    save(state);
    render();
    return;
  }
  loadPreset(true);
});

// Day dropdown
if(daySelect){
  daySelect.onchange=()=>{
    const v=daySelect.value;
    if(!v) return;
    currentTab=v;
    // If day has real data, don't overwrite rows
    const active=getActiveSession();
    if(active.saved && sessionHasRealData(active.sess)){
      active.sess.dayType=v;
      save(state);
      render();
      return;
    }
    loadPreset(true);
  };
}

// Date controls — always use openDate()
prevDay.onclick=()=>{ followToday=false; openDate(addDays(currentDate,-1)); };
nextDay.onclick=()=>{ followToday=false; openDate(addDays(currentDate, 1)); };
todayBtn.onclick=()=>{ followToday=true; openDate(localISO()); };
dateInput.onchange=()=>{ followToday=false; openDate(dateInput.value||localISO()); };

function syncToTodayIfNeeded(){
  if(!followToday) return;
  const t=localISO();
  if(t!==currentDate) openDate(t);
}
window.addEventListener('focus', syncToTodayIfNeeded);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) syncToTodayIfNeeded(); });

// Buttons
loadPresetBtn.onclick=()=>loadPreset(true);
copyPrevBtn.onclick=copyPrev;
clearBtn.onclick=clearDay;
addRowBtn.onclick=addRow;
progBtn.onclick=applyProgression;
saveBtn.onclick=saveSession;

if(back1) back1.onclick=()=>{ currentTab = plannedDayTypeFor(currentDate); if(daySelect) daySelect.value=currentTab; render(); };
if(back2) back2.onclick=()=>{ currentTab = plannedDayTypeFor(currentDate); if(daySelect) daySelect.value=currentTab; render(); };

// Manage: rename + delete + archive
function purgeExercise(exId){
  // remove from presets
  Object.keys(state.presets||{}).forEach(k=>{
    state.presets[k] = (state.presets[k]||[]).filter(r=>r.exId!==exId);
  });
  // remove from sessions
  Object.keys(state.sessions||{}).forEach(d=>{
    const s=state.sessions[d];
    if(!s?.rows) return;
    s.rows = s.rows.filter(r=>r.exId!==exId);
  });
}

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

    const del=document.createElement('button'); del.className='btn danger'; del.textContent='Delete';
    del.onclick=()=>{
      if(!confirm(`Delete "${ex.name}" everywhere? This removes it from presets and days.`)) return;
      purgeExercise(ex.id);
      state.exercises = state.exercises.filter(e=>e.id!==ex.id);
      save(state);
      renderManage();
      // If current day contains it, refresh
      render();
    };

    div.appendChild(name);div.appendChild(t);div.appendChild(st);
    div.appendChild(rename);div.appendChild(toggle);div.appendChild(arch);div.appendChild(del);
    exList.appendChild(div);
  });
}
addExBtn.onclick=()=>{
  const n=(newName.value||'').trim(); if(!n) return;
  state.exercises.push({id:uid('ex'),name:n,type:newType.value,archived:false});
  newName.value='';
  save(state); renderManage();
};

// History
function renderHistory(){
  const days=parseInt(rangeSel.value,10);
  const cutoff=addDays(localISO(),-days);
  const q=(search.value||'').trim().toLowerCase();

  const entries=Object.entries(state.sessions).filter(([iso,s])=> iso>=cutoff && s?.rows?.length).sort((a,b)=>a[0]<b[0]?1:-1);
  histList.innerHTML='';
  entries.forEach(([iso,sess])=>{
    const rows=(sess.rows||[]).filter(r=>{
      const ex=exById(r.exId);
      if(!ex) return false;
      if(!q) return true;
      return ex.name.toLowerCase().includes(q);
    });
    if(!rows.length) return;

    const card=document.createElement('div'); card.className='hcard';
    card.innerHTML=`<div class="hhead" style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><strong>${iso}</strong> <span class="pill">${sess.dayType||'day'}</span></div><button class="xbtn" title="Delete this day" aria-label="Delete">✕</button></div>`;

    const delBtn=card.querySelector('.xbtn');
    delBtn.onclick=(ev)=>{
      ev.stopPropagation();
      if(!confirm(`Delete ${iso}?`)) return;
      delete state.sessions[iso];
      save(state);
      renderHistory();
    };
    card.onclick=()=>{
      followToday=false;
      openDate(iso);
      currentTab = (getSavedSession(iso)?.dayType) || plannedDayTypeFor(iso);
      render();
    };

    const list=document.createElement('div'); list.style.marginTop='8px'; list.style.display='grid'; list.style.gap='6px';
    rows.forEach(r=>{
      const ex=exById(r.exId);
      const line=document.createElement('div'); line.className='muted small';
      line.textContent = `${ex.name}: ${r.sets}×${r.target||''} @ ${r.weight||''}kg • Pin ${r.pin||''} • RIR ${r.rir||''}`;
      list.appendChild(line);
    });
    card.appendChild(list);
    histList.appendChild(card);
  });
}
rangeSel.onchange=renderHistory;
search.oninput=renderHistory;

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
      save(state);
      alert('Imported.');
      openDate(localISO());
      render();
    }catch(e){
      alert('Import failed.');
    }finally{ fileEl.value=''; }
  };
}
setupBackup(exportBtn, importFile);
setupBackup(exportBtn2, importFile2);

// Service worker
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
}

// Start
openDate(localISO());
render();

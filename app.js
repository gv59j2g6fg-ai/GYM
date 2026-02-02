// gym-full-stable-v3-import-fix (import works with older backups + paste)



const STORE_KEY="gym_full_stable_v1";
const DAY_ORDER=["strength","fatloss","volume"];

function uid(p="id"){return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;}
function localISO(d=new Date()){
  // local date YYYY-MM-DD without UTC shift
  const off=d.getTimezoneOffset();
  return new Date(d.getTime()-off*60000).toISOString().slice(0,10);
}
function addDays(iso,n){
  // safe local add days
  const [y,m,da]=iso.split("-").map(Number);
  const d=new Date(y, m-1, da);
  d.setDate(d.getDate()+n);
  return localISO(d);
}

function load(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||"null");}catch(e){return null;}}
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
  return {exercises,presets,sessions:{}};
}

let state=load()||defaultState();
save(state);

// Draft sessions are kept in-memory only (not saved) until you press Save
const drafts = {}; // { [iso]: {dayType, rows} }

function getSavedSession(iso){
  const s = state.sessions?.[iso];
  return s && s.saved ? s : null;
}
function getDraftSession(iso){
  return drafts[iso] || null;
}
function setDraftSession(iso, dayType, rows){
  drafts[iso] = {dayType, rows};
}
function sessionForDate(iso){
  // Prefer saved
  const saved = state.sessions?.[iso];
  if(saved && saved.saved){
    return {kind:'saved', sess:saved};
  }
  // Otherwise draft (in-memory)
  const d = getDraftSession(iso);
  if(d){
    return {kind:'draft', sess:{dayType:d.dayType, rows:d.rows, saved:false}};
  }
  // Create a fresh draft based on program decision + preset
  const program = decideProgramForDate(iso);
  const preset = (state.presets?.[program]||[]).map(p=>({ ...p, id:uid('row'), weight:'', pin:'', rir:'' }));
  const fresh = {dayType:program, rows:preset, saved:false};
  setDraftSession(iso, program, fresh.rows);
  return {kind:'draft', sess:fresh};
}

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
const planPill=document.getElementById('planPill');
const planHint=document.getElementById('planHint');

const tbody=document.getElementById('tbody');
const note=document.getElementById('note');

const copyPrevBtn=document.getElementById('copyPrevBtn');
const clearBtn=document.getElementById('clearBtn');
const addRowBtn=document.getElementById('addRowBtn');
const saveBtn=document.getElementById('saveBtn');

const backFromManage=document.getElementById('backFromManage');
const backFromHistory=document.getElementById('backFromHistory');

const newName=document.getElementById('newName');
const newType=document.getElementById('newType');
const addExBtn=document.getElementById('addExBtn');
const exList=document.getElementById('exList');

const exportBtn=document.getElementById('exportBtn');
const importFile=document.getElementById('importFile');
const pasteBtn=document.getElementById('pasteBtn');
const pasteWrap=document.getElementById('pasteWrap');
const pasteArea=document.getElementById('pasteArea');
const pasteImportBtn=document.getElementById('pasteImportBtn');
const pasteCancelBtn=document.getElementById('pasteCancelBtn');

const rangeSel=document.getElementById('rangeSel');
const search=document.getElementById('search');
const histList=document.getElementById('histList');

let currentDate=localISO();
let currentProgram="strength"; // strength|fatloss|volume
let currentView="workout"; // workout|manage|history

dateInput.value=currentDate;

function exById(id){return state.exercises.find(e=>e.id===id)||null;}
function activeExercises(){return state.exercises.filter(e=>!e.archived);}

function ensureSession(iso=currentDate){
  if(!state.sessions[iso]) state.sessions[iso]={dayType:currentProgram,rows:[] , saved:false};
  const s=state.sessions[iso];
  if(!Array.isArray(s.rows)) s.rows=[];
  return s;
}

function isCompletedSession(sess){
  // completed = user pressed Save for that date
  return !!sess?.saved;
}

function mostRecentSavedBefore(iso){
  const days=Object.keys(state.sessions||{}).filter(d=>d<iso).sort();
  for(let i=days.length-1;i>=0;i--){
    const s=state.sessions[days[i]];
    if(s?.dayType && s.saved) return {date:days[i], sess:s};
  }
  return null;
}

function getNextProgram(p){
  const i=DAY_ORDER.indexOf(p);
  if(i===-1) return "strength";
  return DAY_ORDER[(i+1)%DAY_ORDER.length];
}

function hasRealData(sess){
  return !!sess?.rows?.some(r =>
    (r.weight && r.weight!=='') ||
    (r.pin && r.pin!=='') ||
    (r.rir && r.rir!=='') ||
    (r.exId)
  );
}

function loadPresetForProgram(iso, program, force=false){
  const preset=state.presets[program]||[];
  const sess=ensureSession(iso);
  sess.dayType=program;

  // Only refuse overwrite if real data exists and not forcing
  if(hasRealData(sess) && !force) return;

  sess.rows = preset.map(p=>({ ...p, id:uid('row'), weight:'', pin:'', rir:'' }));
}

function decideProgramForDate(iso){
  // If already saved, keep its dayType
  const saved = state.sessions?.[iso];
  if(saved?.saved && (saved.dayType==='strength'||saved.dayType==='fatloss'||saved.dayType==='volume')){
    return saved.dayType;
  }
  // Use last saved day to rotate. If none, start strength.
  const prior = mostRecentSavedBefore(iso);
  if(!prior) return "strength";
  return getNextProgram(prior.sess.dayType || "strength");
}

function openDate(iso){
  currentDate = iso;
  dateInput.value = currentDate;

  const { sess } = sessionForDate(currentDate);
  currentProgram = sess.dayType;

  render();
}

function setHeader(){
  dayTitle.textContent = currentProgram==='strength'?'Strength Day':currentProgram==='fatloss'?'Fat Loss Day':'Volume Day';
  planPill.textContent = dayTitle.textContent;
  planHint.textContent = "Date decides the program. If you missed a session, it repeats. It only advances after you press Save.";
}

function render(){
  tabs.forEach(b=>b.classList.toggle('active', b.dataset.tab===currentView));
  workoutCard.classList.toggle('hidden', currentView!=='workout');
  manageCard.classList.toggle('hidden', currentView!=='manage');
  historyCard.classList.toggle('hidden', currentView!=='history');

  if(currentView==='workout') renderWorkout();
  if(currentView==='manage') renderManage();
  if(currentView==='history') renderHistory();
}

function renderWorkout(){
  setHeader();
  const {kind, sess} = sessionForDate(currentDate);

  tbody.innerHTML='';
  (sess.rows||[]).forEach(r=>tbody.appendChild(renderRow(kind, sess, r)));

  note.textContent = (kind==='saved' && sess.saved) ? "Saved ✔ (next day will advance)" : "Not saved yet (this date won't be stored until you press Save).";
}

function renderRow(kind, sess, r){
  const tr=document.createElement('tr');

  // Exercise select
  const td1=document.createElement('td');
  const sel=document.createElement('select'); sel.className='input';
  const o0=document.createElement('option'); o0.value=''; o0.textContent='Select…'; sel.appendChild(o0);
  const opts=[...activeExercises()];
  const rowEx=exById(r.exId);
  if(rowEx && rowEx.archived && !opts.find(x=>x.id===rowEx.id)) opts.unshift(rowEx);
  opts.forEach(ex=>{
    const o=document.createElement('option');
    o.value=ex.id; o.textContent=ex.archived?`${ex.name} (archived)`:ex.name;
    sel.appendChild(o);
  });
  sel.value=r.exId||'';
  sel.onchange=()=>{r.exId=sel.value; if(kind==='saved'){save(state);}else{setDraftSession(currentDate,sess.dayType,sess.rows);} renderWorkout();};
  td1.appendChild(sel);

  // Sets
  const td2=document.createElement('td');
  const sets=document.createElement('input'); sets.className='input'; sets.inputMode='numeric'; sets.value=r.sets??'';
  sets.oninput=()=>{r.sets=sets.value; save(state);};
  td2.appendChild(sets);

  // Target (reps or seconds)
  const td3=document.createElement('td');
  const tgt=document.createElement('input'); tgt.className='input'; tgt.inputMode='numeric'; tgt.value=r.target??'';
  tgt.oninput=()=>{r.target=tgt.value; save(state);};
  td3.appendChild(tgt);

  // Kg (ALWAYS enabled - Farmer's Walk can have weight too)
  const td4=document.createElement('td');
  const w=document.createElement('input'); w.className='input'; w.inputMode='decimal';
  const ex=exById(r.exId);
  w.placeholder = ex?.type==='time' ? 'kg (optional)' : 'kg';
  w.value=r.weight??'';
  w.disabled=false;
  w.oninput=()=>{r.weight=w.value; save(state);};
  td4.appendChild(w);

  // Pin (multi-value text)
  const tdPin=document.createElement('td');
  const pin=document.createElement('input'); pin.className='input';
  pin.placeholder='Pin (e.g. 5,7)';
  pin.value = r.pin ?? '';
  pin.oninput=()=>{r.pin=pin.value; save(state);};
  tdPin.appendChild(pin);

  // RIR picker
  const td5=document.createElement('td');
  const done=document.createElement('select');
  done.className='rirSelect';
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
      const v=prompt('Enter RIR (e.g. 2 or 3.5)', r.rir??'');
      if(v===null){ return; }
      r.rir=v.toString().trim();
      if(kind==='saved'){save(state);}else{setDraftSession(currentDate,sess.dayType,sess.rows);} renderWorkout();return;
    }
    r.rir=done.value; save(state);
  };
  td5.appendChild(done);

  // Remove row (today only)
  const tdRemove=document.createElement('td');
  const removeBtn=document.createElement('button');
  removeBtn.className='btn danger';
  removeBtn.type='button';
  removeBtn.textContent='✕';
  removeBtn.title='Remove this row (today only)';
  removeBtn.onclick=()=>{
    sess.rows = (sess.rows||[]).filter(x=>x.id!==r.id);
    if(kind==='saved'){save(state);}else{setDraftSession(currentDate,sess.dayType,sess.rows);} renderWorkout();};
  tdRemove.appendChild(removeBtn);

  tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4); tr.appendChild(tdPin); tr.appendChild(td5); tr.appendChild(tdRemove);
  return tr;
}

function addRow(){
  const {kind, sess} = sessionForDate(currentDate);
  sess.rows.push({id:uid('row'), exId:'', sets:'2', target:'', weight:'', pin:'', rir:''});
  if(kind==='saved'){ state.sessions[currentDate].rows = sess.rows; save(state); }
  else { setDraftSession(currentDate, sess.dayType, sess.rows); }
  renderWorkout();
}

// Tabs
tabs.forEach(b=>b.onclick=()=>{
  const next=b.dataset.tab;
  if(next===currentView) return;
  currentView=next;
  render();
});
backFromManage.onclick=()=>{currentView='workout'; render();};
backFromHistory.onclick=()=>{currentView='workout'; render();};

// Date controls
prevDay.onclick=()=>openDate(addDays(currentDate,-1));
nextDay.onclick=()=>openDate(addDays(currentDate,1));
todayBtn.onclick=()=>openDate(localISO());
dateInput.onchange=()=>openDate(dateInput.value||localISO());

// Buttons
addRowBtn.onclick=addRow;
copyPrevBtn.onclick=copyPrev;
clearBtn.onclick=clearDay;
saveBtn.onclick=saveDay;

// Manage
function renderManage(){
  exList.innerHTML='';
  const sorted=state.exercises.slice().sort((a,b)=> (a.archived===b.archived)?a.name.localeCompare(b.name):(a.archived?1:-1));
  sorted.forEach(ex=>{
    const div=document.createElement('div'); div.className='item';
    const name=document.createElement('div'); name.style.fontWeight='800'; name.textContent=ex.name;
    const t=document.createElement('div'); t.className='pill'; t.textContent=ex.type==='time'?'Time (sec)':'Reps+Weight';
    const st=document.createElement('div'); st.className='pill'; st.textContent=ex.archived?'Archived':'Active';

    const rename=document.createElement('button'); rename.className='btn'; rename.textContent='Rename';
    rename.onclick=()=>{
      const n=prompt('Rename exercise', ex.name);
      if(!n) return;
      ex.name=n.trim();
      save(state); renderManage();
    };

    const toggle=document.createElement('button'); toggle.className='btn'; toggle.textContent=ex.type==='time'?'Set to Reps':'Set to Time';
    toggle.onclick=()=>{
      ex.type=ex.type==='time'?'reps':'time';
      save(state); renderManage();
    };

    const del=document.createElement('button'); del.className='btn danger'; del.textContent='Delete';
    del.onclick=()=>{
      if(!confirm(`Delete "${ex.name}"? This removes it from presets and all days.`)) return;
      const exId=ex.id;
      state.exercises = state.exercises.filter(e=>e.id!==exId);
      Object.keys(state.presets||{}).forEach(k=>{
        state.presets[k] = (state.presets[k]||[]).filter(r=>r.exId!==exId);
      });
      Object.keys(state.sessions||{}).forEach(d=>{
        const s=state.sessions[d];
        if(!s?.rows) return;
        s.rows = s.rows.filter(r=>r.exId!==exId);
      });
      save(state); renderManage(); if(currentView==='workout') renderWorkout();
    };

    div.appendChild(name); div.appendChild(t); div.appendChild(st);
    div.appendChild(rename); div.appendChild(toggle); div.appendChild(del);
    exList.appendChild(div);
  });
}
addExBtn.onclick=()=>{
  const n=(newName.value||'').trim();
  if(!n) return;
  state.exercises.push({id:uid('ex'), name:n, type:newType.value, archived:false});
  newName.value='';
  save(state); renderManage();
};

// History
function renderHistory(){
  const days=parseInt(rangeSel.value,10);
  const cutoff=addDays(localISO(),-days);
  const q=(search.value||'').trim().toLowerCase();

  const entries=Object.entries(state.sessions)
    .filter(([iso,s])=> iso>=cutoff && s?.saved && s?.rows?.length)
    .sort((a,b)=>a[0]<b[0]?1:-1);

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
    const badge=sess.saved?'✔ saved':'not saved';
    card.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
      <div><strong>${iso}</strong> <span class="pill">${sess.dayType||'day'}</span> <span class="pill">${badge}</span></div>
      <div class="muted small">tap to open</div>
    </div>`;
    const list=document.createElement('div'); list.style.marginTop='8px'; list.style.display='grid'; list.style.gap='6px';
    rows.forEach(r=>{
      const ex=exById(r.exId);
      const line=document.createElement('div'); line.className='muted small';
      line.textContent = `${ex?.name||'Exercise'}: ${r.sets||''}×${r.target||''} @ ${r.weight||''}kg • Pin ${r.pin||''} • RIR ${r.rir||''}`;
      list.appendChild(line);
    });
    card.appendChild(list);

    card.onclick=()=>{
      currentView='workout';
      openDate(iso);
    };

    histList.appendChild(card);
  });
}
rangeSel.onchange=renderHistory;
search.oninput=renderHistory;

function normalizeImport(incoming){
  // Accept older schemas and convert to current: {exercises,presets,sessions}
  // sessions rows should be array of {exId,sets,target,weight,pin,rir,id}
  if(!incoming || typeof incoming!=='object') return null;

  // If it already matches current schema, just ensure fields exist.
  if(incoming.exercises && incoming.presets && incoming.sessions){
    // normalize session flags
    Object.keys(incoming.sessions||{}).forEach(d=>{
      const s=incoming.sessions[d];
      if(s && s.saved===undefined && s.done!==undefined) s.saved=!!s.done;
      if(s && s.dayType===undefined && s.type) s.dayType=s.type;
      if(s && !Array.isArray(s.rows)) s.rows=[];
    });
    return incoming;
  }

  // If it is from the minimal clean build: {sessions:{date:{type,rows,done}}}
  if(incoming.sessions && !incoming.exercises && !incoming.presets){
    const st = defaultState();
    Object.keys(incoming.sessions).forEach(d=>{
      const s=incoming.sessions[d];
      const dayType = s?.type || 'strength';
      const rows = (s?.rows||[]).map(r=>({
        id: uid('row'),
        exId: st.exercises.find(e=>e.name===r.name)?.id || '',
        sets: String(r.sets ?? ''),
        target: String(r.reps ?? r.target ?? ''),
        weight: String(r.kg ?? r.weight ?? ''),
        pin: String(r.pin ?? ''),
        rir: String(r.rir ?? '')
      })).filter(r=>r.exId);
      st.sessions[d] = {dayType, rows, saved: !!(s?.done)};
    });
    return st;
  }

  return null;
}

// Backup / Restore
exportBtn.onclick=()=>{
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
importFile.onchange=async()=>{
  const f=importFile.files?.[0];
  if(!f) return;
  try{
    const text=await f.text();
    const raw=JSON.parse(text);
    const incoming=normalizeImport(raw);
    if(!incoming){
      alert('Backup not recognized. Export a JSON from this app, or paste a compatible backup.');
      return;
    }
    if(!confirm('Import backup? This replaces your data on this device.')) return;
    state=incoming;
    save(state);
    // clear drafts if present
    if(typeof drafts==='object'){
      Object.keys(drafts).forEach(k=>delete drafts[k]);
    }
    alert('Imported.');
    openDate(localISO());
  }catch(e){
    alert('Import failed. Make sure the file is valid JSON.');
  }finally{
    importFile.value='';
  }
};

// Init
openDate(currentDate);


// Paste JSON import (works on iOS when file picker is blocked)
if(pasteBtn){
  pasteBtn.onclick=()=>{
    pasteWrap.classList.remove('hidden');
    pasteArea.focus();
  };
}
if(pasteCancelBtn){
  pasteCancelBtn.onclick=()=>{
    pasteArea.value='';
    pasteWrap.classList.add('hidden');
  };
}
if(pasteImportBtn){
  pasteImportBtn.onclick=()=>{
    try{
      const raw=JSON.parse(pasteArea.value||'');
      const incoming=normalizeImport(raw);
      if(!incoming){
        alert('Backup not recognized.');
        return;
      }
      if(!confirm('Import pasted backup? This replaces your data on this device.')) return;
      state=incoming;
      save(state);
      if(typeof drafts==='object'){
        Object.keys(drafts).forEach(k=>delete drafts[k]);
      }
      pasteArea.value='';
      pasteWrap.classList.add('hidden');
      alert('Imported.');
      openDate(localISO());
    }catch(e){
      alert('Invalid JSON.');
    }
  };
}
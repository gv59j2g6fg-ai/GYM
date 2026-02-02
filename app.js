// Full exact original Strength/Fat Loss/Volume build
const STORE_KEY="gym_template_v19_openDate_pinmulti_fwweight";

const INC_KG=2.5;


const DAY_ORDER=['strength','fatloss','volume'];
function uid(p="id"){return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;}
function localISO(d=new Date()){const off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,10);}
function addDays(iso,n){
  const d=new Date(iso+'T00:00:00');
  d.setDate(d.getDate()+n);
  return localISO(d);
}
function parseTop(t){t=(t||'').toString().trim();if(!t)return null;const m=t.match(/(\d+)\s*-\s*(\d+)/);if(m)return parseInt(m[2],10);const n=t.match(/(\d+)/);return n?parseInt(n[1],10):null;}

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
    {id:uid('ex'),name:"Farmer's Walk",type:'time',archived:false,allowWeight:true},
  ];
  const id=(n)=>exercises.find(e=>e.name===n)?.id||'';
  const mk=(name,sets,target)=>({id:uid('row'),exId:id(name),sets:String(sets),target:String(target),weight:'',rir:''});
  const presets={
    strength:[mk('Squat',2,5),mk('Bench Press (Free)',2,5),mk('Bent Over Row',2,5),mk('Skull Crusher',2,10)],
    fatloss:[mk('Deadlift',2,12),mk('Lat Pull Down',2,15),mk('Military / Arnold Press',2,15),mk('Hammer Curl',2,15),mk("Farmer's Walk",2,35)],
    volume:[mk('Stiff-Leg Romanian Deadlift',2,10),mk('Chest Fly',2,12),mk('Seated Dumbbell Extension',2,12),mk('Dumbbell Palm Curl',2,12),mk("Farmer's Walk",2,35)],
  };
  return {exercises,presets,sessions:{},progression:{}};
}

let state=load()||defaultState();save(state);

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

let currentDate=localISO();
let currentTab='strength';
let followToday=true; // if true, app auto-opens/returns to today

dateInput.value=currentDate;
// Day type dropdown sync
syncDaySelectForDate();


function exById(id){return state.exercises.find(e=>e.id===id)||null;}

function syncDaySelectForDate(){
  const sess=state.sessions[currentDate];
  const t=sess?.dayType||'';
  if(daySelect){
    daySelect.value=t||'';
  }
  if(t && (t==='strength'||t==='fatloss'||t==='volume')){
    currentTab=t;
  }
}
function canAutoLoadPreset(){
  // Only auto-load when a day type is explicitly selected for this date, or when the date already has a dayType saved.
  const sess=state.sessions[currentDate];
  const savedType=sess?.dayType;
  const selected=daySelect?daySelect.value:'';
  return Boolean(selected||savedType);
}
function activeExercises(){return state.exercises.filter(e=>!e.archived);}
function ensureSession(){
  if(!state.sessions[currentDate]) state.sessions[currentDate]={dayType:currentTab,rows:[]};
  const s=state.sessions[currentDate];
  if(!Array.isArray(s.rows)) s.rows=[];
  return s;
}
function setTitle(){
  dayTitle.textContent=currentTab==='strength'?'Strength Day':currentTab==='fatloss'?'Fat Loss Day':currentTab==='volume'?'Volume Day':'Workout';
  if(daySelect){
    if(currentTab==='manage'||currentTab==='history'){
      daySelect.disabled=true;
      if(daySelectHint) daySelectHint.textContent='Day type selection is disabled in Manage/History.';
    }else{
      daySelect.disabled=false;
      if(daySelectHint) daySelectHint.textContent='Pick a day type to load the preset for this date.';
    }
  }
  note.textContent="Pick Strength / Fat Loss / Volume to auto-load the preset. Log Weight, Pin + RIR.";
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
  const sess=ensureSession();
  tbody.innerHTML='';
  sess.rows.forEach(r=>tbody.appendChild(renderRow(r)));
}

function renderRow(r){
  const tr=document.createElement('tr');

  const td1=document.createElement('td');
  const sel=document.createElement('select'); sel.className='input';
  const o0=document.createElement('option'); o0.value=''; o0.textContent='Select…'; sel.appendChild(o0);

  const opts=[...activeExercises()];
  const rowEx=exById(r.exId);
  if(rowEx && rowEx.archived && !opts.find(x=>x.id===rowEx.id)) opts.unshift(rowEx);

  opts.forEach(ex=>{const o=document.createElement('option'); o.value=ex.id; o.textContent=ex.archived?`${ex.name} (archived)`:ex.name; sel.appendChild(o);});
  sel.value=r.exId||'';
  sel.onchange=()=>{
    r.exId=sel.value;
    const ex=exById(r.exId);
    if(ex?.type==='reps'){const nw=state.progression[ex.id]; if(nw && !r.weight) r.weight=String(nw);} else { if(!(ex?.type==='time' && ex?.allowWeight)) r.weight=''; }
    save(state); renderWorkout();
  };
  td1.appendChild(sel);

  const td2=document.createElement('td');
  const sets=document.createElement('input'); sets.className='input'; sets.inputMode='numeric'; sets.value=r.sets??'';
  sets.oninput=()=>{r.sets=sets.value; save(state);};
  td2.appendChild(sets);

  const td3=document.createElement('td');
  const tgt=document.createElement('input'); tgt.className='input'; tgt.inputMode='numeric'; tgt.value=r.target??'';
  tgt.oninput=()=>{r.target=tgt.value; save(state);};
  td3.appendChild(tgt);

  const td4=document.createElement('td');
  const w=document.createElement('input'); w.className='input'; w.inputMode='decimal';
  const ex=exById(r.exId);
  w.placeholder = (ex?.type==='time' && !ex?.allowWeight) ? '—' : 'kg';
  w.value=r.weight??''; w.disabled=(ex?.type==='time' && !ex?.allowWeight);
  w.oninput=()=>{r.weight=w.value; save(state);};
  td4.appendChild(w);


  const tdPin=document.createElement('td');
  const pinIn=document.createElement('input');
  pinIn.className='input';
  pinIn.inputMode='numeric';
  pinIn.placeholder='e.g. 5,7';
  pinIn.value = r.pin ?? '';
  pinIn.oninput=()=>{
    // allow digits, comma, space, slash, dash
    const cleaned = pinIn.value.replace(/[^0-9,\s\/-]/g,'');
    if(cleaned !== pinIn.value) pinIn.value = cleaned;
    r.pin = pinIn.value;
    save(state);
  };
  tdPin.appendChild(pinIn);
const td5=document.createElement('td');
  const done=document.createElement('select');
  done.className='rirSelect';
  // Safari-friendly picker: 1 / 2 / 3+
  done.innerHTML = `
    <option value="">RIR</option>
    <option value="1">1</option>
    <option value="2">2</option>
    <option value="3">3+</option>
    <option value="custom">Custom…</option>
  `;
  const curVal = (r.rir??'').toString().trim().replace('+','');
  if(curVal==='1'||curVal==='2'||curVal==='3') done.value=curVal;
  else if(curVal) done.value='custom';
  else done.value='';

  done.onchange=()=>{
    if(done.value==='custom'){
      const v = prompt('Enter RIR (number, e.g. 2 or 3.5)', r.rir??'');
      if(v===null){
        // revert selection
        const vv=(r.rir??'').toString().trim().replace('+','');
        done.value = (vv==='1'||vv==='2'||vv==='3') ? vv : (vv ? 'custom' : '');
        return;
      }
      r.rir = v.toString().replace('+','').trim();
      save(state);
      render();
      return;
    }
    r.rir = done.value; // "", "1", "2", "3"
    save(state);
  };
  td5.appendChild(done);

  tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4); tr.appendChild(tdPin); tr.appendChild(td5);
  return tr;
}

function loadPreset(force=false, persist=true){
  const preset=state.presets[currentTab]||[];
  const sess=ensureSession();
  sess.dayType=currentTab;

  // Block overwrite ONLY if real training inputs exist (kg / pin / RIR)
  const hasRealData = Array.isArray(sess.rows) && sess.rows.some(r=>{
    return (r.weight && String(r.weight).trim()!=='') ||
           (r.pin && String(r.pin).trim()!=='') ||
           (r.rir && String(r.rir).trim()!=='');
  });

  if(hasRealData && !force){
    if(persist) save(state);
    renderWorkout();
    return;
  }

  sess.rows=preset.map(p=>({...p,id:uid('row'),weight:'',pin:'',rir:''}));
  if(persist) save(state);
  renderWorkout();
}
function copyPrev(){
  const prev=state.sessions[addDays(currentDate,-1)];
  if(!prev?.rows?.length){alert('No previous day to copy.');return;}
  const sess=ensureSession();
  sess.rows=prev.rows.map(r=>({...r,id:uid('row'),rir:''}));
  save(state); renderWorkout();
}
function clearDay(){
  if(!confirm('Clear this day?')) return;
  const sess=ensureSession(); sess.rows=[]; save(state); renderWorkout();
}
function addRow(){
  const sess=ensureSession(); sess.rows.push({id:uid('row'),exId:'',sets:'2',target:'',weight:'',pin:'',rir:''});
  save(state); renderWorkout();
}
function applyProgression(){
  // RIR-based progression:
  // RIR 1 (hard / 0-1): increase weight next time (or reps for bodyweight)
  // RIR 2 (medium): keep weight
  // RIR 3 (easy / 3+): increase reps or weight if reps already at target
  const s = state;
  const tab = currentTab;
  if(!(tab==='strength'||tab==='fatloss'||tab==='volume')){ note.textContent='Go to a day tab first.'; return; }
  const cur = s.sessions?.[tab]?.rows || [];
  if(!cur.length){ note.textContent='Nothing to progress.'; return; }

  const bump = (w)=>{
    const x=parseFloat(w);
    if(!isFinite(x)) return w;
    // 2.5kg step default
    return (Math.round((x+2.5)*10)/10).toString();
  };

  let changed=0;
  cur.forEach(r=>{
    const rir = parseFloat(r.rir);
    // ignore if no weight or rir entered
    if(!isFinite(rir)) return;

    // If weight-based exercise:
    if(r.weight!==undefined){
      if(rir<=1){
        // push weight up
        r.weight = bump(r.weight);
        changed++;
      } else if(rir>=3){
        // if easy, also push weight up slightly (same step) for simplicity
        r.weight = bump(r.weight);
        changed++;
      } else {
        // rir ~2 : keep weight
      }
      return;
    }
  });

  save(s);
  render();
  note.textContent = changed ? `Progression applied (${changed} row${changed===1?'':'s'}).` : 'No rows had RIR entered.';
}
function saveSession(){
  const sess=ensureSession();
  sess.rows=sess.rows.filter(r=>r.exId);
  save(state);
  note.textContent='Saved.'; renderWorkout();
}

tabs.forEach(b=>b.onclick=()=>{
  const next=b.dataset.tab;
  if(next===currentTab) return;
  currentTab=next;
  // Update UI immediately
  render();
  // Auto-load the preset for workout day tabs (no prompt, no extra button)
  if(daySelect && (currentTab==='strength'||currentTab==='fatloss'||currentTab==='volume')) daySelect.value=currentTab;
  if(currentTab==='strength'||currentTab==='fatloss'||currentTab==='volume'){
    if(canAutoLoadPreset()) loadPreset(false,true);
  }
});
if(daySelect){
  daySelect.onchange=()=>{
    const v=daySelect.value;
    if(!v) return; // stay blank until user picks
    currentTab=v;
    render();
    loadPreset(false,true);
    // Persist the chosen day type for this date even if rows are still blank
    const sess=ensureSession();
    sess.dayType=v;
    save(state);
  };
}

function openDate(iso){
  followToday=false;
  currentDate=iso;
  dateInput.value=currentDate;

  // If this date already has a session with real data, just show it
  const existing=state.sessions[currentDate];
  if(existing?.dayType && isCompleted(existing)){
    currentTab=existing.dayType;
    if(daySelect) daySelect.value=existing.dayType;
    render();
    return;
  }

  // Decide what today should be based on the last completed (SAVED) workout
  const last=findLastCompletedBefore(currentDate);
  let nextType='strength';
  if(last){
    const idx=DAY_ORDER.indexOf(last.dayType);
    nextType = idx>=0 ? DAY_ORDER[(idx+1)%DAY_ORDER.length] : 'strength';
  }

  // Create an in-memory session for this date (won't persist unless you type or press Save)
  if(!state.sessions[currentDate]) state.sessions[currentDate]={dayType:nextType,rows:[]};
  state.sessions[currentDate].dayType=nextType;

  currentTab=nextType;
  if(daySelect) daySelect.value=nextType;

  // Auto-load preset rows for viewing/logging
  loadPreset(true, false);
  render();
}

function isCompleted(sess){
  return !!(sess?.rows && sess.rows.some(r=>r.exId && (String(r.exId).trim()!=='')));
}

function findLastCompletedBefore(iso){
  const dates=Object.keys(state.sessions||{}).filter(d=>d<iso).sort();
  for(let i=dates.length-1;i>=0;i--){
    const s=state.sessions[dates[i]];
    if(s?.dayType && isCompleted(s)) return s;
  }
  return null;
}

prevDay.onclick=()=>openDate(addDays(currentDate,-1));
nextDay.onclick=()=>openDate(addDays(currentDate,1));
todayBtn.onclick=()=>{followToday=true; openDate(localISO());};
dateInput.onchange=()=>openDate(dateInput.value||localISO());



// If you open the app tomorrow, it should open on tomorrow (today's date).
// When followToday is true, we auto-jump to today's date on focus/return.
function syncToTodayIfNeeded(){
  if(!followToday) return;
  const today=localISO();
  if(today!==currentDate){
    openDate(today);
  }
}
window.addEventListener('focus', syncToTodayIfNeeded);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) syncToTodayIfNeeded(); });

loadPresetBtn.onclick=()=>loadPreset(false,true);
copyPrevBtn.onclick=copyPrev;
clearBtn.onclick=clearDay;
addRowBtn.onclick=addRow;
progBtn.onclick=applyProgression;
saveBtn.onclick=saveSession;

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
    rename.onclick=()=>{const n=prompt('Rename exercise', ex.name); if(!n) return; ex.name=n.trim(); save(state); renderManage(); if(currentTab!=='manage') renderWorkout();};

    const toggle=document.createElement('button'); toggle.className='btn'; toggle.textContent=ex.type==='time'?'Set to Reps':'Set to Time';
    toggle.onclick=()=>{ex.type=ex.type==='time'?'reps':'time'; save(state); renderManage(); if(currentTab!=='manage') renderWorkout();};

    const arch=document.createElement('button'); arch.className='btn danger'; arch.textContent=ex.archived?'Restore':'Archive';
    arch.onclick=()=>{ex.archived=!ex.archived; save(state); renderManage(); if(currentTab!=='manage') renderWorkout();};

    
    const del=document.createElement('button'); del.className='btn danger'; del.textContent='Delete';
    del.onclick=()=>{
      if(!confirm(`Delete "${ex.name}" permanently? This will remove it from presets and future logs (history rows will keep the name only if archived).`)) return;
      // Remove from exercises
      state.exercises = state.exercises.filter(e=>e.id!==ex.id);
      // Remove from presets
      Object.keys(state.presets||{}).forEach(k=>{
        state.presets[k]= (state.presets[k]||[]).filter(r=>r.exId!==ex.id);
      });
      // Remove from all sessions (set exId blank so it doesn't show)
      Object.keys(state.sessions||{}).forEach(d=>{
        const s=state.sessions[d];
        if(!s?.rows) return;
        s.rows.forEach(r=>{ if(r.exId===ex.id) r.exId=''; });
        s.rows = s.rows.filter(r=>r.exId);
      });
      save(state);
      renderManage();
      render();
    };

    div.appendChild(name);div.appendChild(t);div.appendChild(st);div.appendChild(rename);div.appendChild(toggle);div.appendChild(arch);div.appendChild(del);
    exList.appendChild(div);
  });
}
addExBtn.onclick=()=>{const n=(newName.value||'').trim(); if(!n) return; state.exercises.push({id:uid('ex'),name:n,type:newType.value,archived:false}); newName.value=''; save(state); renderManage();};

// History
function renderHistory(){
  const days=parseInt(rangeSel.value,10);
  const cutoff=addDays(localISO(),-days);
  const q=(search.value||'').trim().toLowerCase();

  const entries=Object.entries(state.sessions).filter(([iso,s])=> iso>=cutoff && s?.rows?.length).sort((a,b)=>a[0]<b[0]?1:-1);
  histList.innerHTML='';
  entries.forEach(([iso,sess])=>{
    const rows=sess.rows.filter(r=>{const ex=exById(r.exId); if(!ex) return false; if(!q) return true; return ex.name.toLowerCase().includes(q);});
    if(!rows.length) return;
    const card=document.createElement('div'); card.className='hcard';
    card.innerHTML=`<div class="hhead" style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><strong>${iso}</strong> <span class="pill">${sess.dayType||'day'}</span></div><button class="xbtn" title="Delete this day" aria-label="Delete">✕</button></div>`;

    const delBtn=card.querySelector('.xbtn');
    delBtn.onclick=(ev)=>{
      ev.stopPropagation();
      if(!confirm(`Delete ${iso}?`)) return;
      delete state.sessions[iso];
      save(state);
      // If we deleted the currently open day, refresh it
      renderHistory();
    };
    card.onclick=()=>{
      followToday=false;
      currentDate=iso;
      dateInput.value=currentDate;
      // switch to that day's type if known
      if(sess.dayType && (sess.dayType==='strength'||sess.dayType==='fatloss'||sess.dayType==='volume')){
        currentTab=sess.dayType;
      }
      syncDaySelectForDate();
      render();
    };
    const list=document.createElement('div'); list.style.marginTop='8px'; list.style.display='grid'; list.style.gap='6px';
    rows.forEach(r=>{const ex=exById(r.exId); const line=document.createElement('div'); line.className='muted small';
      if(ex?.type==='time') line.textContent=`${ex.name}: ${r.sets} sets • ${r.target||''}s${(r.weight&&String(r.weight).trim()!=='')?` @ ${r.weight}kg`:''} • Pin ${r.pin||''} • RIR ${r.rir||''}`;
      else line.textContent=`${ex.name}: ${r.sets}×${r.target||''} @ ${r.weight||''}kg • Pin ${r.pin||''} • RIR ${r.rir||''}`;
      list.appendChild(line);
    });
    card.appendChild(list); histList.appendChild(card);
  });
}
rangeSel.onchange=renderHistory; search.oninput=renderHistory;


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
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));}

render();
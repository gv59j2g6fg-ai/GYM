// Full exact original Strength/Fat Loss/Volume build
const STORE_KEY="gym_template_rir_v9_layout_history_delete";

const INC_KG=2.5;

function uid(p="id"){return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;}
function localISO(d=new Date()){const off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,10);}
function addDays(iso,n){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}
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
    {id:uid('ex'),name:"Farmer's Walk",type:'time',archived:false},
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
const tbody=document.getElementById('tbody');
const note=document.getElementById('note');
const dayTypeSel=document.getElementById('dayTypeSel');

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
const clearHistoryBtn=document.getElementById('clearHistoryBtn');
const histList=document.getElementById('histList');
const exportBtn=document.getElementById('exportBtn');
const importFile=document.getElementById('importFile');
const exportBtn2=document.getElementById('exportBtn2');
const importFile2=document.getElementById('importFile2');

let currentDate=localISO();
let currentTab='';
let followToday=true; // if true, app auto-opens/returns to today

dateInput.value=currentDate;

function exById(id){return state.exercises.find(e=>e.id===id)||null;}
function activeExercises(){return state.exercises.filter(e=>!e.archived);}
function ensureSession(){
  if(!state.sessions[currentDate]) state.sessions[currentDate]={dayType:currentTab,rows:[]};
  const s=state.sessions[currentDate];
  if(!Array.isArray(s.rows)) s.rows=[];
  return s;
}
function setTitle(){
  dayTitle.textContent=currentTab==='strength'?'Strength Day':currentTab==='fatloss'?'Fat Loss Day':currentTab==='volume'?'Volume Day':(currentTab==='manage'?'Manage':currentTab==='history'?'History':'Select day');
  note.textContent="Switching Strength / Fat Loss / Volume auto-loads the preset. Log Weight + RIR.";
}

function render(){
  tabs.forEach(b=>b.classList.toggle('active', b.dataset.tab===currentTab));

  if(dayTypeSel){ dayTypeSel.value=(currentTab==='strength'||currentTab==='fatloss'||currentTab==='volume')?currentTab:''; }
  workoutCard.classList.toggle('hidden', !(currentTab==='strength'||currentTab==='fatloss'||currentTab==='volume'));
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

  const td1=document.createElement('td'); td1.className='col-ex';
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
    if(ex?.type==='reps'){const nw=state.progression[ex.id]; if(nw && !r.weight) r.weight=String(nw);}
    else {r.weight='';}
    save(state); renderWorkout();
  };
  td1.appendChild(sel);

  const td2=document.createElement('td'); td2.className='col-sets';
  const sets=document.createElement('input'); sets.className='input'; sets.inputMode='numeric'; sets.value=r.sets??'';
  sets.oninput=()=>{r.sets=sets.value; save(state);};
  td2.appendChild(sets);

  const td3=document.createElement('td'); td3.className='col-target';
  const tgt=document.createElement('input'); tgt.className='input'; tgt.inputMode='numeric'; tgt.value=r.target??'';
  tgt.oninput=()=>{r.target=tgt.value; save(state);};
  td3.appendChild(tgt);

  const td4=document.createElement('td'); td4.className='col-weight';
  const w=document.createElement('input'); w.className='input'; w.inputMode='decimal';
  const ex=exById(r.exId);
  w.placeholder=ex?.type==='time'?'—':'kg';
  w.value=r.weight??''; w.disabled=(ex?.type==='time');
  w.oninput=()=>{r.weight=w.value; save(state);};
  td4.appendChild(w);


  const tdPin=document.createElement('td'); tdPin.className='col-pin';
  const pinSel=document.createElement('select'); pinSel.className='rirSelect';
  let pinOpts='<option value="">Pin</option>';
  for(let i=1;i<=15;i++){pinOpts+=`<option value="${i}">${i}</option>`;}
  pinSel.innerHTML=pinOpts;
  pinSel.value = (r.pin??'').toString();
  pinSel.onchange=()=>{ r.pin=pinSel.value; save(state); };
  tdPin.appendChild(pinSel);

  const td5=document.createElement('td'); td5.className='col-rir';
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

function loadPreset(force=false){
  const preset=state.presets[currentTab]||[];
  const sess=ensureSession();
  // Don't overwrite existing entries unless forced
  if(!force && Array.isArray(sess.rows) && sess.rows.length) { sess.dayType=currentTab; save(state); return; }
  sess.dayType=currentTab;
  sess.rows=preset.map(p=>({...p,id:uid('row'),weight:'',rir:''}));
  save(state); renderWorkout();
}
function copyPrev(){
  const prev=state.sessions[addDays(currentDate,-1)];
  if(!prev?.rows?.length){alert('No previous day to copy.');return;}
  const sess=ensureSession();
  sess.rows=prev.rows.map(r=>({...r,id:uid('row'),pin:'',rir:''}));
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
  if(currentTab==='strength'||currentTab==='fatloss'||currentTab==='volume'){
    loadPreset(false);
    render();
  }
});

if(dayTypeSel){
  dayTypeSel.onchange=()=>{
    const v=dayTypeSel.value;
    if(!v){ currentTab=''; render(); return; }
    currentTab=v;
    render();
    loadPreset(false);
    render();
  };
}

prevDay.onclick=()=>{followToday=false; currentDate=addDays(currentDate,-1); dateInput.value=currentDate; render();};
nextDay.onclick=()=>{followToday=false; currentDate=addDays(currentDate,1); dateInput.value=currentDate; render();};
todayBtn.onclick=()=>{followToday=true; currentDate=localISO(); dateInput.value=currentDate; render();};
dateInput.onchange=()=>{
  followToday=false;
  currentDate=dateInput.value||localISO();
  const s=state.sessions?.[currentDate];
  currentTab=(s?.dayType)||'';
  render();
};



// If you open the app tomorrow, it should open on tomorrow (today's date).
// When followToday is true, we auto-jump to today's date on focus/return.
function syncToTodayIfNeeded(){
  if(!followToday) return;
  const today=localISO();
  if(today!==currentDate){
    currentDate=today;
    dateInput.value=currentDate;
    render();
  }
}
window.addEventListener('focus', syncToTodayIfNeeded);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) syncToTodayIfNeeded(); });

loadPresetBtn.onclick=loadPreset;
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

    div.appendChild(name);div.appendChild(t);div.appendChild(st);div.appendChild(rename);div.appendChild(toggle);div.appendChild(arch);
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
    card.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><strong>${iso}</strong> <span class="pill">${sess.dayType||'day'}</span></div></div>`;
    const list=document.createElement('div'); list.style.marginTop='8px'; list.style.display='grid'; list.style.gap='6px';
    rows.forEach(r=>{const ex=exById(r.exId); const line=document.createElement('div'); line.className='muted small';
      if(ex?.type==='time') line.textContent=`${ex.name}: ${r.sets} sets • ${r.target||''}s • RIR ${r.rir||''}`;
      else line.textContent=`${ex.name}: ${r.sets}×${r.target||''} @ ${r.weight||''}kg • RIR ${r.rir||''}`;
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

// Delete ALL history (sessions) on this device
if(clearHistoryBtn){
  clearHistoryBtn.onclick=()=>{
    const count=Object.keys(state.sessions||{}).length;
    if(count===0){alert('No history to delete.'); return;}
    if(!confirm(`Delete ALL history (${count} days)? This cannot be undone.`)) return;
    state.sessions={};
    save(state);
    alert('History deleted.');
    render();
  };
}

// Service worker
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));}

render();
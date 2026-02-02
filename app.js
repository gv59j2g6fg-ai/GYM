const DAY_ORDER=['strength','fatloss','volume'];

const PRESETS={
  strength:[
    {name:'Squat',sets:2,reps:5},
    {name:'Bench Press',sets:2,reps:5}
  ],
  fatloss:[
    {name:'Deadlift',sets:2,reps:12},
    {name:"Farmer's Walk",sets:2,reps:30}
  ],
  volume:[
    {name:'Chest Fly',sets:2,reps:12},
    {name:"Farmer's Walk",sets:2,reps:30}
  ]
};

let state = JSON.parse(localStorage.getItem('gym_clean')) || {sessions:{}};

const dateInput=document.getElementById('date');
const rows=document.getElementById('rows');
const title=document.getElementById('title');

function todayISO(){
  return new Date().toISOString().slice(0,10);
}

function getNext(type){
  return DAY_ORDER[(DAY_ORDER.indexOf(type)+1)%DAY_ORDER.length];
}

function openDate(d){
  dateInput.value=d;
  let s=state.sessions[d];

  if(!s){
    // find last completed
    let last=null;
    Object.keys(state.sessions).sort().forEach(k=>{
      if(state.sessions[k].done) last=state.sessions[k];
    });
    let type=last?getNext(last.type):'strength';
    s={type,rows:JSON.parse(JSON.stringify(PRESETS[type])),done:false};
    state.sessions[d]=s;
  }

  title.textContent=s.type.toUpperCase();
  renderRows(s);
}

function renderRows(s){
  rows.innerHTML='';
  s.rows.forEach((r,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${r.name}</td>
      <td><input value="${r.sets}"></td>
      <td><input value="${r.reps}"></td>
      <td><input value="${r.kg||''}"></td>
      <td><input value="${r.pin||''}" placeholder="5,7"></td>
      <td><input value="${r.rir||''}"></td>
      <td><button>✕</button></td>
    `;
    tr.querySelector('button').onclick=()=>{
      s.rows.splice(i,1);
      renderRows(s);
    };
    rows.appendChild(tr);
  });
}

document.getElementById('save').onclick=()=>{
  state.sessions[dateInput.value].done=true;
  localStorage.setItem('gym_clean',JSON.stringify(state));
  alert('Saved');
};

document.getElementById('prev').onclick=()=>{
  const d=new Date(dateInput.value);
  d.setDate(d.getDate()-1);
  openDate(d.toISOString().slice(0,10));
};

document.getElementById('next').onclick=()=>{
  const d=new Date(dateInput.value);
  d.setDate(d.getDate()+1);
  openDate(d.toISOString().slice(0,10));
};

openDate(todayISO());

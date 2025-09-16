const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
let myId = null;
const players = new Map();
const bullets = [];

const state = { x: canvas.width/2, y: canvas.height/2, dir:0, speed:220, dashCooldown:0, hp:100 };
let keys = {};
let mouse = { x:0, y:0, down:false };

let zone = { x: canvas.width/2, y: canvas.height/2, r:500 };
let zoneShrinkTimer = 0;

socket.onopen = ()=>{ statusEl.textContent='Conectado ao servidor'; };
socket.onmessage = (ev)=>{
  const { type, data } = JSON.parse(ev.data);
  if(type==='init'){
    myId = data.id;
    for(const p of data.players) players.set(p.id,p);
    if(players.has(myId)){
      const me = players.get(myId);
      state.x = me.x; state.y = me.y; state.hp = me.hp;
    }
  } else if(type==='players_update'){
    players.clear();
    for(const p of data) players.set(p.id,p);
  } else if(type==='shoot'){
    bullets.push({ x:data.x, y:data.y, vx:data.vx, vy:data.vy, owner:data.id, life:2 });
  }
};

function send(type,data){ if(socket.readyState===WebSocket.OPEN) socket.send(JSON.stringify({type,data})); }

window.addEventListener('keydown', e=>{ keys[e.key.toLowerCase()]=true; });
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });
canvas.addEventListener('mousemove', e=>{ const r=canvas.getBoundingClientRect(); mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; });
canvas.addEventListener('mousedown', ()=>mouse.down=true );
canvas.addEventListener('mouseup', ()=>mouse.down=false );

function spawnBullet(x,y,dir){
  const speed=600, vx=Math.cos(dir)*speed, vy=Math.sin(dir)*speed;
  bullets.push({x,y,vx,vy,owner:myId,life:2});
  send('shoot',{x,y,vx,vy});
}

let last = performance.now();
function loop(now){
  const dt=(now-last)/1000; last=now;
  update(dt); render();
  requestAnimationFrame(loop);
}

function update(dt){
  let dx=0,dy=0;
  if(keys['w']) dy-=1; if(keys['s']) dy+=1;
  if(keys['a']) dx-=1; if(keys['d']) dx+=1;
  const len=Math.hypot(dx,dy); if(len>0){dx/=len; dy/=len;}
  let sp=state.speed;
  if(keys[' '] && state.dashCooldown<=0){ state.dashCooldown=1.2; sp*=2.5; }
  state.dashCooldown=Math.max(0,state.dashCooldown-dt);

  state.x+=dx*sp*dt; state.y+=dy*sp*dt;
  state.x=Math.max(20,Math.min(canvas.width-20,state.x));
  state.y=Math.max(20,Math.min(canvas.height-20,state.y));
  state.dir=Math.atan2(mouse.y-state.y,mouse.x-state.x);

  if(mouse.down){ if(!state._shootCooldown) state._shootCooldown=0; state._shootCooldown-=dt;
    if(state._shootCooldown<=0){ state._shootCooldown=0.22; spawnBullet(state.x+Math.cos(state.dir)*18,state.y+Math.sin(state.dir)*18,state.dir);}
  }

  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i]; b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    for(const [pid,p] of players){ if(pid===b.owner) continue; const dxp=p.x-b.x,dyp=p.y-b.y; if(Math.hypot(dxp,dyp)<16){ if(pid===myId) state.hp-=18; bullets.splice(i,1); break;}}
    if(i<bullets.length && bullets[i] && bullets[i].life<=0) bullets.splice(i,1);
  }

  zoneShrinkTimer+=dt; if(zoneShrinkTimer>5) zone.r=Math.max(60,zone.r-6*dt);
  send('input',{x:state.x,y:state.y,dir:state.dir,hp:state.hp});
}

function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#6bb4e6'; ctx.fillRect(0,0,canvas.width,canvas.height);

  for(const [id,p] of players){
    ctx.save(); ctx.translate(p.x,p.y);
    ctx.fillStyle=(id===myId)?'#2ecc71':'#e74c3c';
    ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill();
    ctx.rotate(p.dir||0); ctx.fillStyle='#222'; ctx.fillRect(10,-4,10,8);
    ctx.fillStyle='#111'; ctx.fillRect(-18,18,36,6);
    ctx.fillStyle='#2ecc71'; ctx.fillRect(-18,18,(p.hp||100)/100*36,6);
    ctx.restore();
  }

  for(const b of bullets){ ctx.beginPath(); ctx.arc(b.x,b.y,4,0,Math.PI*2); ctx.fillStyle='#222'; ctx.fill(); }
  ctx.fillStyle='#fff'; ctx.font='16px Arial';
  ctx.fillText(`HP: ${Math.max(0,Math.round(state.hp))}`,12,20);
  ctx.fillText(`Players: ${players.size}`,12,40);
}

requestAnimationFrame(loop);

/* Monkey Family — Monkey Rush (le singe aventurier qui fuit le temple, façon Temple Run)
   Vue de dos en fausse 3D : 3 couloirs, glisser ← → pour changer de couloir ou tourner aux virages, ↑ sauter, ↓ glisser.
   Une manche va de 18 h à 18 h. 5 courses par manche : la 1re gratuite, puis 1 🍌. On garde la meilleure course.
   Score = mètres parcourus + 5 points par banane. À 18 h, le serveur classe la manche et donne les récompenses
   (1er 1 booster + 20 🍌, 2e 15, 3e 10, 4e 5, 5e 3, 6e 1). Serveur : mf_rush_* (supabase-rush.sql).
   Visible par l'admin seulement tant que le jeu n'est pas ouvert (réglages admin → « Ouvrir à tous »).
   Visuels provisoires dessinés dans le code ; les images de Kévin (packs/rush-*.webp) prennent le relais dès qu'elles existent :
   rush-singe (4 images de course vues de dos), rush-saut (saut, vu de dos), rush-glisse (glissade, vu de dos), rush-chute (singe sonné). */
(function(){
"use strict";

const NAME="Monkey Rush";
const P="packs/rush-";
const IMG={logo:P+"titre.webp",monkey:P+"singe.webp",fall:P+"chute.webp",jump:P+"saut.webp",slide:P+"glisse.webp",banana:"packs/fly-banana.webp"};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR={no_bananas:"Pas assez de bananes.",rush_limit:"Plus de courses dans cette manche : reviens après 18 h !",rush_closed:NAME+" n'est pas ouvert en ce moment.",
 rush_token:"Cette course n'est plus valable.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const MED=["🥇","🥈","🥉"];
const rew=x=>{const b=+(x&&x.boost)||0,n=+(x&&x.ban)||0;return [b?`${b} booster${b>1?"s":""}`:"",n?`${n} 🍌`:""].filter(Boolean).join(" + ");};
const dur=ms=>{ms=Math.max(0,ms);const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);return h?`${h} h ${String(m).padStart(2,"0")}`:`${Math.max(1,m)} min`;};
const rk1=n=>n===1?"1er":n+"e";

/* ---------- style ---------- */
const CSS=`
#mfRUSH{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;touch-action:manipulation;color:#f6f0d8;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:#1d2a14;background-image:radial-gradient(ellipse at 50% 0,#5a6a2a,#22331a 55%,#121c0c)}
#mfRUSH[hidden]{display:none}
#mfRUSH *{box-sizing:border-box;min-width:0}
#mfRUSH [hidden]{display:none!important}
#mfRUSH,#mfRUSH *{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
#mfRUSH button:focus-visible{outline:3px solid #8fd3ff;outline-offset:2px}
.ru-top{flex:none;position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:4px;padding:max(8px,env(safe-area-inset-top)) 58px 4px}
.ru-logo{display:block;height:clamp(48px,9svh,96px);width:auto;max-width:100%;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
.ru-logoT{margin:0;font:400 clamp(26px,7vw,36px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 #6b3f1d}
.ru-btn{position:absolute;top:max(8px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(20,26,10,.8);color:#ffd23f;font:700 19px Quicksand,sans-serif;cursor:pointer;display:grid;place-items:center}
.ru-btn.l{left:10px}.ru-btn.r{right:10px}
.ru-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px}
.ru-chip{background:#2a1a0c;border:1px solid #6b4520;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13.5px;white-space:nowrap}
.ru-chip b{color:#ffd23f}
.ru-main{flex:1;min-height:0;width:100%;display:flex;align-items:flex-start;justify-content:center;padding:4px 8px max(10px,env(safe-area-inset-bottom))}
.ru-cab{position:relative;flex:none;border-radius:18px;padding:8px;background:linear-gradient(180deg,#9a8a62,#5e5236);box-shadow:0 14px 30px rgba(0,0,0,.55),inset 0 2px 0 rgba(255,255,255,.2)}
.ru-scr{position:relative;width:100%;height:100%;border-radius:11px;overflow:hidden;box-shadow:inset 0 0 0 2px rgba(0,0,0,.5);touch-action:none;cursor:pointer}
.ru-scr canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ru-ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 12px;background:rgba(20,24,10,.62);overflow-y:auto;overscroll-behavior:contain;cursor:default;text-align:center}
.ru-ov h3{margin:2px 0 0;font:400 clamp(22px,4.2svh,30px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 rgba(0,0,0,.5)}
.ru-ov p{margin:0}
.ru-big{min-height:54px;padding:8px 24px;border-radius:16px;border:0;background:#ffd23f;color:#3b2410;font:400 19px "Titan One",sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8901a}
.ru-big:active{transform:translateY(2px);box-shadow:0 2px 0 #b8901a}
.ru-big:disabled{background:#4a4030;color:#a09880;box-shadow:none;cursor:default}
.ru-sub{font-size:13.5px;font-weight:700;color:#eef0d9;text-shadow:0 1px 3px #000}
.ru-help{font-size:13px;font-weight:700;color:#fff3cf;background:rgba(0,0,0,.35);border-radius:12px;padding:6px 10px;max-width:340px}
.ru-score{font:400 clamp(44px,9svh,64px)/1 "Titan One",sans-serif;color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.45)}
.ru-det{font-size:14px;font-weight:700;color:#e8edd6}
.ru-res{font:700 15px Quicksand,sans-serif;color:#ffe7a8}
.ru-res.win{color:#8fe3a8}
.ru-board{width:100%;max-width:340px;margin-top:2px;text-align:left}
.ru-board h4{margin:6px 0 4px;font:400 15px "Titan One",sans-serif;color:#ffd23f;display:flex;justify-content:space-between;gap:8px}
.ru-board h4 small{font:700 12px Quicksand,sans-serif;color:#dfe3c8;white-space:nowrap}
.ru-board ol{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.ru-board li{display:grid;grid-template-columns:2em minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:rgba(0,0,0,.38);font-size:14px}
.ru-board li.me{background:rgba(255,210,63,.18);box-shadow:inset 0 0 0 2px #ffd23f}
.ru-board .rk{font:400 15px "Titan One",sans-serif;text-align:center}
.ru-board .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.ru-board .sc{font:400 16px "Titan One",sans-serif;color:#fff;white-space:nowrap;text-align:right}
.ru-board .rw{font-size:12px;font-weight:700;color:#ffe7a8;white-space:nowrap;text-align:right}
.ru-board .empty{color:#dfe3c8;font-size:14px;padding:6px 2px}
.ru-panel{position:absolute;top:0;left:0;bottom:0;z-index:30;width:min(400px,100%);overflow-y:auto;overscroll-behavior:contain;background:#262a16;border-right:1px solid #4d5530;
 padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s;visibility:hidden}
.ru-panel.open{transform:none;visibility:visible}
.ru-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.ru-panel h3{font:400 19px "Titan One",sans-serif;color:#ffd23f;margin:14px 0 6px}
.ru-ph h3{margin:0}
.ru-panel p,.ru-panel li{color:#e0e4cc;font-size:14px}
.ru-panel ul.r{margin:4px 0;padding-left:18px}
.ru-rw{width:100%;border-collapse:collapse;font-size:14px}
.ru-rw td{padding:3px 4px;border-bottom:1px solid #3e4426;color:#e0e4cc}
.ru-rw td:last-child{text-align:right;font-weight:700;color:#ffd23f}
.ru-hist{list-style:none;margin:0;padding:0;font-size:14px}
.ru-hist li{padding:5px 0;border-bottom:1px solid #3e4426}
.ru-hist:empty::after{content:"Aucune course pour l'instant.";color:#a9ae90}
.ru-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ru-btns button{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid #5a6236;background:#353b1e;color:#f6f0d8;font:700 14px Quicksand,sans-serif;cursor:pointer}
.ru-btns button.on{background:#ffd23f;color:#3b2410;border-color:#ffd23f}
.ru-toast{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));z-index:40;transform:translate(-50%,12px);background:#353b1e;border:1px solid #ffd23f;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;max-width:92%;transition:transform .3s,opacity .3s;pointer-events:none;opacity:0}
.ru-toast.on{transform:translate(-50%,0);opacity:1}
@media(max-height:640px){.ru-logo{height:40px}.ru-big{min-height:46px}}
@media(prefers-reduced-motion:reduce){.ru-toast,.ru-panel{transition:none}.ru-big:active{transform:none}}
`;

/* ---------- état serveur ---------- */
let root=null,USER=null,ADMIN=false,S=null,skew=0,busy=false;
const $=s=>root.querySelector(s);
const nowS=()=>Date.now()+skew;
function take(info){if(!info)return;S=info;if(info.now)skew=+info.now-Date.now();try{if(info.state&&window.MF_APPLY)window.MF_APPLY(info.state);}catch(e){}}

/* ---------- sons ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==="suspended")AC.resume().catch(()=>{});return AC;}
function beep(f,t0,d,vol,type,f2){const a=AC;if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type||"square";o.frequency.setValueAtTime(f,a.currentTime+t0);
 if(f2)o.frequency.exponentialRampToValueAtTime(f2,a.currentTime+t0+d);g.gain.setValueAtTime(vol,a.currentTime+t0);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t0+d);
 o.connect(g).connect(a.destination);o.start(a.currentTime+t0);o.stop(a.currentTime+t0+d+.02);}catch(e){}}
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};

/* =====================================================================
   Le moteur : un monde à plat (x, z) + la hauteur y, une caméra derrière le singe qui tourne avec lui.
   Le chemin est une suite de lignes droites qui finissent par un virage (gauche, droite ou les deux).
   ===================================================================== */
const W=420,H=640;
const LW=1.3,HW=2.0,CURB=.4;           // largeur d'un couloir, demi-largeur du chemin, rebord
const F=510,HZ=190,CAMH=4,CAMB=6,NEAR=.35,FAR=78;
const DIRS=[[0,1],[1,0],[0,-1],[-1,0]];
const fw=d=>DIRS[d],rt=d=>DIRS[(d+1)%4];
const IM={};let cv=null,cx=null,dpr=1,raf=0,last=0;
const ok=n=>IM[n]&&IM[n].complete&&IM[n].naturalWidth>0;
const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

let mode="menu",t=0,segs=[],cur=null,s=0,lat=0,laneT=0,latV=0,y=0,vy=0,slideT=0,speed=10,dist=0,nb=0,queued=null,deadAt=0,deathKind="",token=null,shake=0;
let cam={x:0,z:0,th:0},off={x:0,z:0,th:0},th=0,parts=[],flash=0,turns=0,hintT=0;
const score=()=>Math.floor(dist)+5*nb;

function mkSeg(sx,sz,dir,first){
 const L=first?70:Math.round(rnd(40,78));
 const g={sx,sz,dir,L,obs:[],ban:[],deco:[],turn:first?pick(["L","R"]):(turns<2?pick(["L","R"]):pick(["L","R","L","R","T"]))};
 // obstacles
 const v=Math.max(speed,10);let p=first?26:Math.max(16,v*1.3);
 while(p<L-14){
  const r=Math.random(),k=r<.27?"low":r<.5?"high":"block";
  if(k==="low"){g.obs.push({k,s0:p,s1:p+.7});if(Math.random()<.6)arc(g,p+.35,pick([-1,0,1])*LW);}
  else if(k==="high"){g.obs.push({k,s0:p,s1:p+.6});if(Math.random()<.5)row(g,p-3.5,pick([-1,0,1])*LW,.45,4);}
  else{const n=Math.random()<.35?2:1,lanes=[-1,0,1].sort(()=>Math.random()-.5),free=lanes[n];
   for(let i=0;i<n;i++)g.obs.push({k,s0:p,s1:p+.9,lat:lanes[i]*LW,v:Math.floor(Math.random()*3)});
   if(Math.random()<.7)row(g,p-4,free*LW,.75,5);}
  // entre deux obstacles, parfois une ligne de bananes
  const gap=rnd(Math.max(12,v*1.15),Math.max(17,v*1.75));
  if(gap>16&&Math.random()<.45&&p+gap-6<L-14)row(g,p+5,pick([-1,0,1])*LW,.75,Math.min(6,Math.floor((gap-10)/2)));
  p+=gap;}
 if(first)row(g,10,0,.75,6);
 // décor : arbres, piliers, torches
 for(let q=first?-12:6;q<L+HW+22;q+=rnd(3.2,6)){for(const sd of[-1,1]){
  const nearTurn=q>L-HW-3&&(g.turn==="T"||(g.turn==="R"&&sd>0)||(g.turn==="L"&&sd<0));if(nearTurn)continue;
  if(q>L+HW&&Math.random()<.4)continue;
  const ro=Math.random();g.deco.push({s:q+rnd(-1,1),lat:sd*(HW+CURB+rnd(1.2,5.5)),k:ro<.62?"tree":ro<.85?"pillar":"bush",h:rnd(3.5,7),c:Math.floor(Math.random()*3)});}}
 for(let q=first?4:10;q<L-HW-4;q+=rnd(11,15))for(const sd of[-1,1])g.deco.push({s:q,lat:sd*(HW+CURB*.5),k:"torch",h:1.3});
 return g;}
function row(g,s0,l,h,n){for(let i=0;i<n;i++)g.ban.push({s:s0+i*1.9,lat:l,y:h});}
function arc(g,sc,l){[.8,1.4,1.75,1.4,.8].forEach((h,i)=>g.ban.push({s:sc+(i-2)*1.7,lat:l,y:h}));}
function endPt(g){const f=fw(g.dir);return [g.sx+f[0]*g.L,g.sz+f[1]*g.L];}
function wpt(g,ss,ll,yy){const f=fw(g.dir),r=rt(g.dir);return [g.sx+f[0]*ss+r[0]*ll,yy||0,g.sz+f[1]*ss+r[1]*ll];}

function reset(){segs=[];turns=0;speed=10;const g=mkSeg(0,0,0,true);segs.push(g);cur=g;s=4;lat=0;laneT=0;latV=0;y=0;vy=0;slideT=0;dist=0;nb=0;queued=null;
 th=0;off={x:0,z:0,th:0};parts=[];flash=0;shake=0;deathKind="";camUpdate(0,true);}

/* ---------- caméra ---------- */
function playerW(){return wpt(cur,s,lat,y);}
function camTarget(){const f=fw(cur.dir),r=rt(cur.dir),pw=wpt(cur,s,lat*.45);return {x:pw[0]-f[0]*CAMB,z:pw[2]-f[1]*CAMB,th};}
function camUpdate(dt,snap){const tg=camTarget();if(snap){off={x:0,z:0,th:0};}else{const k=Math.exp(-dt*9);off.x*=k;off.z*=k;off.th*=Math.exp(-dt*11);}
 cam.x=tg.x+off.x;cam.z=tg.z+off.z;cam.th=tg.th+off.th;}
let CS=0,SN=1;
function toCam(p){const dx=p[0]-cam.x,dz=p[2]-cam.z;return [dx*CS-dz*SN,p[1],dx*SN+dz*CS];}   // right = (cos, -sin), fwd = (sin, cos)
function prj(c){const k=F/c[2];return [W/2+c[0]*k,HZ-(c[1]-CAMH)*k];}
function clip(cs){const o=[];for(let i=0;i<cs.length;i++){const a=cs[i],b=cs[(i+1)%cs.length],ia=a[2]>=NEAR,ib=b[2]>=NEAR;
 if(ia)o.push(a);if(ia!==ib){const u=(NEAR-a[2])/(b[2]-a[2]);o.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,NEAR]);}}return o;}

/* ---------- le jeu ---------- */
function act(a){
 if(mode!=="play")return;
 if(a==="up"){if(y<=0.001){vy=6.4;slideT=0;beep(330,0,.12,.03,"triangle",660);}return;}
 if(a==="down"){if(y>0.05)vy=-14;slideT=.7;beep(260,0,.14,.025,"sawtooth",120);return;}
 const dirOk=cur.turn==="T"||cur.turn===a;
 if(dirOk&&s>=cur.L-15){if(s>=cur.L-.6)turn(a);else queued=a;return;}
 const nl=clamp(laneT+(a==="R"?1:-1),-1,1);if(nl!==laneT){laneT=nl;beep(520,0,.05,.015,"triangle");}}
function turn(a){
 queued=null;turns++;const old={x:cam.x,z:cam.z,th:cam.th};
 const E=endPt(cur),nd=(cur.dir+(a==="R"?1:3))%4,pw=playerW();
 const g=mkSeg(E[0],E[1],nd,false),f=fw(nd),r=rt(nd);
 const dx=pw[0]-E[0],dz=pw[2]-E[1];s=dx*f[0]+dz*f[1];lat=dx*r[0]+dz*r[1];laneT=clamp(Math.round(lat/LW),-1,1);
 th+=a==="R"?Math.PI/2:-Math.PI/2;segs.push(g);if(segs.length>3)segs.shift();cur=g;
 const tg=camTarget();off={x:old.x-tg.x,z:old.z-tg.z,th:old.th-tg.th};camUpdate(0);
 beep(700,0,.12,.025,"triangle",420);}
function die(k){if(mode!=="play")return;mode="dead";deathKind=k;deadAt=t;shake=.45;flash=.5;vib([40,30,90]);beep(200,0,.45,.05,"sawtooth",60);
 for(let i=0;i<16;i++)parts.push({x:W/2,y:H-150,vx:(Math.random()-.5)*360,vy:-Math.random()*320,l:.8,c:i%2?"#f3e2b0":"#8a6a3a"});send(score());}
function update(dt){t+=dt;flash=Math.max(0,flash-dt*1.5);shake=Math.max(0,shake-dt);
 for(const p of parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=700*dt;p.l-=dt;}parts=parts.filter(p=>p.l>0);
 if(mode==="dead"){speed=Math.max(0,speed-dt*45);const d=speed*dt;s+=d*.3;camUpdate(dt);return;}
 if(mode!=="play"){camUpdate(dt);return;}
 hintT+=dt;speed=Math.min(20,10+dist/90);
 const d=speed*dt,s0=s;s+=d;dist+=d;
 const pl=lat;lat+=(laneT*LW-lat)*Math.min(1,dt*16);latV=(lat-pl)/Math.max(dt,1e-3);
 if(y>0||vy>0){vy-=20*dt;y+=vy*dt;if(y<=0){y=0;vy=0;for(let i=0;i<5;i++)parts.push({x:W/2+(Math.random()-.5)*40,y:H-118,vx:(Math.random()-.5)*120,vy:-Math.random()*60,l:.4,c:"#d8c79a"});}}
 slideT=Math.max(0,slideT-dt);
 if(queued&&s>=cur.L-.6)turn(queued);
 if(s>=cur.L+HW-.55){s=cur.L+HW-.55;die("wall");return;}
 const lo=Math.min(s0,s)-.3,hi=s+.3;
 for(const o of cur.obs){if(hi<o.s0||lo>o.s1)continue;
  if(o.k==="low"&&y<.5){die("low");return;}
  if(o.k==="high"&&slideT<=0){die("high");return;}
  if(o.k==="block"&&y<1.5&&Math.abs(lat-o.lat)<.95){die("block");return;}}
 const py=y+(slideT>0?.3:.6);
 for(const b of cur.ban){if(b.got||b.s<lo-.5||b.s>hi+.5)continue;
  if(Math.abs(lat-b.lat)<.75&&Math.abs(py-b.y)<1){b.got=true;nb++;[988,1319].forEach((f,i)=>beep(f,i*.05,.07,.025,"triangle"));
   for(let i=0;i<8;i++)parts.push({x:W/2+(b.lat-lat)*80,y:H-170,vx:(Math.random()-.5)*220,vy:-Math.random()*240,l:.5,c:"#ffd23f"});}}
 camUpdate(dt);}

/* ---------- dessin ---------- */
const FOG=[178,196,150];
const mix=(c,k)=>`rgb(${Math.round(c[0]+(FOG[0]-c[0])*k)},${Math.round(c[1]+(FOG[1]-c[1])*k)},${Math.round(c[2]+(FOG[2]-c[2])*k)})`;
const fogK=z=>clamp((z-22)/(FAR-22),0,1)**1.2;
let Q=[];          // polygones à peindre : {z, pts (écran), col}
function poly(ws,col,layer,zb){const cs=clip(ws.map(toCam));if(cs.length<3)return;let zs=0,zm=1e9;for(const c of cs){zs+=c[2];if(c[2]<zm)zm=c[2];}
 const z=zs/cs.length;if(zm>FAR)return;Q.push({z:z+(zb||0),layer,pts:cs.map(prj),col:typeof col==="function"?col(fogK(z)):mix(col,fogK(z))});}
const STONE=[[186,164,122],[171,149,108]],MOSS=[[160,160,104],[150,148,98]],CURBC=[112,92,62],GRASS=[[62,112,52],[55,101,46]];
function floorSeg(g,stub){
 const a=stub?HW:(g===segs[0]?-14:HW),b=stub?HW+48:g.L+HW;
 for(let q=a;q<b;q+=2){const q1=Math.min(b,q+2),i=Math.floor(q/2)&1,m=((q*7)%11)<2;
  poly([wpt(g,q,-HW),wpt(g,q1,-HW),wpt(g,q1,HW),wpt(g,q,HW)],(m?MOSS:STONE)[i],1);
  const open=!stub&&q1>g.L-HW;
  if(!(open&&(g.turn==="L"||g.turn==="T")))poly([wpt(g,q,-HW-CURB,.18),wpt(g,q1,-HW-CURB,.18),wpt(g,q1,-HW,.18),wpt(g,q,-HW,.18)],CURBC,1,-.01);
  if(!(open&&(g.turn==="R"||g.turn==="T")))poly([wpt(g,q,HW,.18),wpt(g,q1,HW,.18),wpt(g,q1,HW+CURB,.18),wpt(g,q,HW+CURB,.18)],CURBC,1,-.01);}
 const ga=stub?HW:a,gb=stub?b:b+22;
 for(let q=ga;q<gb;q+=4){const q1=Math.min(gb,q+4),i=Math.floor(q/4)&1;
  poly([wpt(g,q,-HW-14),wpt(g,q1,-HW-14),wpt(g,q1,-HW-CURB),wpt(g,q,-HW-CURB)],GRASS[i],0);
  poly([wpt(g,q,HW+CURB),wpt(g,q1,HW+CURB),wpt(g,q1,HW+14),wpt(g,q,HW+14)],GRASS[i],0);}
 if(!stub){const e=g.L+HW;   // le mur du bout : il faut tourner !
  poly([wpt(g,e,-HW-CURB,0),wpt(g,e,HW+CURB,0),wpt(g,e,HW+CURB,2.8),wpt(g,e,-HW-CURB,2.8)],[120,104,76],2);
  poly([wpt(g,e,-HW-CURB,2.8),wpt(g,e,HW+CURB,2.8),wpt(g,e+.8,HW+CURB,2.8),wpt(g,e+.8,-HW-CURB,2.8)],[150,132,96],2,-.02);
  Q.push({z:Q[Q.length-1]?Q[Q.length-1].z-.03:0,layer:2,wall:g});}}
function sideStubs(g){if(g!==cur)return;const E=endPt(g);for(const a of g.turn==="T"?["L","R"]:[g.turn]){const nd=(g.dir+(a==="R"?1:3))%4;floorSeg({sx:E[0],sz:E[1],dir:nd,L:0,turn:"S"},true);}}
function box(g,s0,s1,l0,l1,y0,y1,cF,cT,cS){
 const cc=toSeg(g);
 if(cc.l<l0)poly([wpt(g,s0,l0,y0),wpt(g,s1,l0,y0),wpt(g,s1,l0,y1),wpt(g,s0,l0,y1)],cS,2);
 if(cc.l>l1)poly([wpt(g,s1,l1,y0),wpt(g,s0,l1,y0),wpt(g,s0,l1,y1),wpt(g,s1,l1,y1)],cS,2);
 if(CAMH>y1)poly([wpt(g,s0,l0,y1),wpt(g,s0,l1,y1),wpt(g,s1,l1,y1),wpt(g,s1,l0,y1)],cT,2);
 if(cc.s<s0)poly([wpt(g,s0,l0,y0),wpt(g,s0,l1,y0),wpt(g,s0,l1,y1),wpt(g,s0,l0,y1)],cF,2,-.05);}
function toSeg(g){const f=fw(g.dir),r=rt(g.dir),dx=cam.x-g.sx,dz=cam.z-g.sz;return {s:dx*f[0]+dz*f[1],l:dx*r[0]+dz*r[1]};}
const BLK=[[[138,128,104],[160,150,124],[112,104,84]],[[126,120,96],[150,144,118],[100,96,78]],[[146,124,96],[168,146,116],[118,100,78]]];
function obstacles(g){for(const o of g.obs){
 if(o.k==="low"){box(g,o.s0,o.s1,-HW-.15,HW+.15,0,.55,[104,66,34],[134,90,48],[84,52,26]);Q.push({z:depth(g,o.s0,0),layer:3,root:[g,o]});}
 else if(o.k==="high"){for(const sd of[-1,1])box(g,o.s0,o.s1,sd*(HW+.05)-.22,sd*(HW+.05)+.22,0,1.8,[120,108,84],[150,138,110],[98,88,68]);
  box(g,o.s0,o.s1,-HW-.3,HW+.3,1.12,1.8,[132,118,90],[160,146,114],[104,94,72]);Q.push({z:depth(g,o.s0,0)-.06,layer:3,vine:[g,o]});}
 else{const c=BLK[o.v||0];box(g,o.s0,o.s1,o.lat-.58,o.lat+.58,0,1.5,c[0],c[1],c[2]);Q.push({z:depth(g,o.s0,o.lat)-.06,layer:3,face:[g,o]});}}}
function depth(g,ss,ll){return toCam(wpt(g,ss,ll))[2];}
function sprites(g){
 for(const b of g.ban){if(b.got)continue;const c=toCam(wpt(g,b.s,b.lat,b.y));if(c[2]<NEAR||c[2]>FAR*.85)continue;Q.push({z:c[2],layer:3,ban:c});}
 for(const d of g.deco){const c=toCam(wpt(g,d.s,d.lat,0));if(c[2]<NEAR+.5||c[2]>FAR)continue;Q.push({z:c[2],layer:3,deco:[d,c]});}}
function sky(){const yaw=cam.th;
 const gr=cx.createLinearGradient(0,0,0,HZ);gr.addColorStop(0,"#2f7f9a");gr.addColorStop(.6,"#9cc7b0");gr.addColorStop(1,"#f2d7a0");cx.fillStyle=gr;cx.fillRect(0,0,W,HZ+2);
 const sx=((-yaw*F*.9)%1600+1600)%1600;
 cx.fillStyle="rgba(255,236,170,.75)";cx.beginPath();cx.arc(((sx+300)%1600)-200,HZ-70,26,0,7);cx.fill();
 const ridge=(off,amp,base,col,per,seed)=>{cx.fillStyle=col;cx.beginPath();cx.moveTo(0,HZ+2);
  for(let x=0;x<=W;x+=10){const u=(x+off)/per;cx.lineTo(x,base-amp*(.55+.45*Math.sin(u*6.283+seed)*Math.sin(u*2.1+seed*2)));}cx.lineTo(W,HZ+2);cx.fill();};
 ridge(sx*.6,46,HZ-8,"#7fa79a",700,1);
 // pyramides du temple au loin
 cx.fillStyle="#6a8a78";for(let k=0;k<3;k++){const px=((k*560-sx*.8)%1680+1680)%1680-200;if(px<-120||px>W+120)continue;
  for(let st=0;st<5;st++){const w=110-st*20,h=11;cx.fillRect(px-w/2,HZ-14-st*h-h,w,h);}cx.fillRect(px-8,HZ-14-66,16,12);}
 ridge(sx,26,HZ+1,"#4f7a52",420,4);
 const g2=cx.createLinearGradient(0,HZ,0,H);g2.addColorStop(0,mix([62,112,52],.9));g2.addColorStop(.25,"#4a7a40");g2.addColorStop(1,"#2e5326");cx.fillStyle=g2;cx.fillRect(0,HZ,W,H-HZ);}
function drawQ(q){
 if(q.pts){cx.fillStyle=q.col;cx.beginPath();cx.moveTo(q.pts[0][0],q.pts[0][1]);for(let i=1;i<q.pts.length;i++)cx.lineTo(q.pts[i][0],q.pts[i][1]);cx.closePath();cx.fill();return;}
 if(q.ban){const c=q.ban,p=prj(c),k=F/c[2],sz=.62*k,fa=1-fogK(c[2])*.8,bob=Math.sin(t*5+c[2])*.06*k;cx.globalAlpha=fa;
  if(ok("banana"))cx.drawImage(IM.banana,p[0]-sz/2,p[1]-sz/2+bob,sz,sz*41/42);else{cx.fillStyle="#ffd23f";cx.beginPath();cx.arc(p[0],p[1]+bob,sz*.3,0,7);cx.fill();}
  cx.globalAlpha=1;return;}
 if(q.deco){deco(q.deco[0],q.deco[1]);return;}
 if(q.player){monkey();return;}
 if(q.wall){wallArrows(q.wall);return;}
 if(q.root){const [g,o]=q.root;for(let i=-1;i<=1;i++){const c=toCam(wpt(g,o.s0,i*1.5,.28));if(c[2]<1.2)continue;const p=prj(c),k=F/c[2];cx.strokeStyle=mix([70,42,20],fogK(c[2]));cx.lineWidth=Math.max(1,.05*k);
  cx.beginPath();cx.arc(p[0],p[1],.16*k,0,7);cx.stroke();}return;}
 if(q.vine){const [g,o]=q.vine;for(let i=-3;i<=3;i++){const a=toCam(wpt(g,o.s0-.02,i*.62,1.12));if(a[2]<1.2)continue;const p=prj(a),k=F/a[2],len=(.25+((i*7+9)%5)*.08)*k;
  cx.strokeStyle=mix([52,120,48],fogK(a[2]));cx.lineWidth=Math.max(1,.06*k);cx.beginPath();cx.moveTo(p[0],p[1]);cx.quadraticCurveTo(p[0]+Math.sin(t*2+i)*.06*k,p[1]+len*.6,p[0],p[1]+len);cx.stroke();
  cx.fillStyle=cx.strokeStyle;cx.beginPath();cx.ellipse(p[0],p[1]+len,.07*k,.045*k,0,0,7);cx.fill();}return;}
 if(q.face){const [g,o]=q.face,c=toCam(wpt(g,o.s0,o.lat,.95));if(c[2]<1.2||toSeg(g).s>o.s0)return;const p=prj(c),k=F/c[2];   // tête de singe sculptée
  cx.strokeStyle=mix([70,62,48],fogK(c[2]));cx.lineWidth=Math.max(1,.06*k);cx.beginPath();cx.arc(p[0],p[1],.36*k,0,7);cx.stroke();
  cx.fillStyle=cx.strokeStyle;for(const sd of[-1,1]){cx.beginPath();cx.arc(p[0]+sd*.14*k,p[1]-.06*k,.06*k,0,7);cx.fill();cx.beginPath();cx.arc(p[0]+sd*.42*k,p[1]-.05*k,.1*k,0,7);cx.stroke();}
  cx.beginPath();cx.arc(p[0],p[1]+.12*k,.14*k,.15*Math.PI,.85*Math.PI);cx.stroke();return;}}
function wallArrows(g){const e=g.L+HW-.02,dirs=g.turn==="T"?["L","R"]:[g.turn];
 for(const a of dirs){const sd=a==="R"?1:-1,c=toCam(wpt(g,e,sd*1.1,1.4));if(c[2]<1.2||toSeg(g).s>e)continue;const p=prj(c),k=F/c[2];
  cx.save();cx.translate(p[0],p[1]);cx.scale(sd,1);cx.fillStyle=mix([255,210,63],fogK(c[2])*.7);cx.strokeStyle=mix([90,60,20],fogK(c[2]));cx.lineWidth=Math.max(1,.05*k);
  cx.beginPath();cx.moveTo(-.5*k,-.18*k);cx.lineTo(.05*k,-.18*k);cx.lineTo(.05*k,-.42*k);cx.lineTo(.55*k,0);cx.lineTo(.05*k,.42*k);cx.lineTo(.05*k,.18*k);cx.lineTo(-.5*k,.18*k);cx.closePath();cx.fill();cx.stroke();cx.restore();}}
const LEAF=["#2f7a3a","#3c8a3f","#2a6a36"];
function deco(d,c){const p=prj(c),k=F/c[2],fk=fogK(c[2]);
 if(d.k==="torch"){const top=prj([c[0],1.25,c[2]]);cx.strokeStyle=mix([80,56,30],fk);cx.lineWidth=Math.max(1,.12*k);cx.beginPath();cx.moveTo(p[0],p[1]);cx.lineTo(top[0],top[1]);cx.stroke();
  const fl=1+Math.sin(t*17+c[2])*.15;cx.fillStyle=`rgba(255,${150+Math.floor(Math.sin(t*11+c[0])*40)},40,${.9-fk*.6})`;cx.beginPath();cx.ellipse(top[0],top[1]-.14*k*fl,.11*k,.2*k*fl,0,0,7);cx.fill();
  cx.fillStyle=`rgba(255,240,160,${.9-fk*.6})`;cx.beginPath();cx.ellipse(top[0],top[1]-.1*k,.05*k,.09*k,0,0,7);cx.fill();return;}
 if(d.k==="pillar"){const h=d.h*.6,tp=prj([c[0],h,c[2]]),w=.45*k;cx.fillStyle=mix([140,126,98],fk);cx.fillRect(p[0]-w,tp[1],w*2,p[1]-tp[1]);
  cx.fillStyle=mix([110,98,76],fk);cx.fillRect(p[0]-w,tp[1],w*.5,p[1]-tp[1]);cx.fillStyle=mix([160,146,114],fk);cx.fillRect(p[0]-w*1.3,tp[1]-.25*k,w*2.6,.3*k);
  cx.fillStyle=mix([60,120,50],fk);cx.beginPath();cx.ellipse(p[0]+w*.4,tp[1]+.6*k,.2*k,.5*k,.3,0,7);cx.fill();return;}
 if(d.k==="bush"){cx.fillStyle=mix([46,104,46],fk);for(let i=-1;i<=1;i++){cx.beginPath();cx.arc(p[0]+i*.5*k,p[1]-.45*k-(i?0:.2*k),.6*k,0,7);cx.fill();}return;}
 const tp=prj([c[0],d.h,c[2]]);cx.strokeStyle=mix([92,64,40],fk);cx.lineWidth=Math.max(1,.32*k);cx.beginPath();cx.moveTo(p[0],p[1]);cx.lineTo(tp[0],tp[1]);cx.stroke();
 const lc=LEAF[d.c].match(/\w\w/g).map(h=>parseInt(h,16));cx.fillStyle=mix(lc,fk);
 for(let i=0;i<5;i++){const a=i/5*6.283+d.h;cx.beginPath();cx.ellipse(tp[0]+Math.cos(a)*.9*k,tp[1]+Math.sin(a)*.45*k,1.15*k,.55*k,a*.5,0,7);cx.fill();}
 cx.beginPath();cx.arc(tp[0],tp[1]-.2*k,1*k,0,7);cx.fill();}
/* le singe vu de dos (dessiné ; packs/rush-singe.webp = 4 images de course côte à côte le remplace s'il existe) */
function monkey(){const pw=playerW(),c=toCam(pw),g=toCam([pw[0],0,pw[2]]);if(c[2]<NEAR)return;
 const p=prj(c),pg=prj(g),k=F/c[2],u=k*.1;
 cx.fillStyle="rgba(0,0,0,.28)";cx.beginPath();cx.ellipse(pg[0],pg[1],(3.6-Math.min(1.5,y))*u,1.1*u,0,0,7);cx.fill();
 const run=mode==="play",ph=dist*1.7,a=run?Math.sin(ph):0,bob=run&&y<=0?Math.abs(Math.cos(ph))*.7*u:Math.sin(t*3)*.3*u,sl=slideT>0;
 cx.save();cx.translate(p[0],p[1]-bob);
 if(mode==="dead"){const q=clamp((t-deadAt)*2.5,0,1);cx.rotate((deathKind==="wall"||deathKind==="block"?-1:1)*q*1.2);cx.translate(0,q*2*u);}
 else cx.rotate(clamp(latV*.025,-.3,.3));
 if(mode==="dead"&&ok("fall")){const im=IM.fall,h=22*u,w=h*im.naturalWidth/im.naturalHeight;cx.drawImage(im,-w/2,-h,w,h);cx.restore();stars(p,u);return;}
 const one=(im,hh)=>{const h=hh*u,w=h*im.naturalWidth/im.naturalHeight;cx.drawImage(im,-w/2,-h,w,h);cx.restore();};
 if(sl&&ok("slide"))return one(IM.slide,13);              // glissade : packs/rush-glisse.webp
 if(run&&y>0&&ok("jump"))return one(IM.jump,22);          // saut : packs/rush-saut.webp
 if(ok("monkey")&&!sl){const im=IM.monkey,fwid=im.naturalWidth/4,f=run?Math.floor(ph/1.57)&3:0,h=22*u,w=h*fwid/im.naturalHeight;cx.drawImage(im,f*fwid,0,fwid,im.naturalHeight,-w/2,-h,w,h);cx.restore();return;}
 if(sl)cx.scale(1.1,.6);
 const BR="#7a4a26",DK="#5a3418",LT="#d9a77a";
 cx.lineCap="round";
 cx.strokeStyle="#6a3f1f";cx.lineWidth=1.3*u;cx.beginPath();cx.moveTo(1*u,-6*u);cx.bezierCurveTo(5*u,-5*u,5.5*u+Math.sin(t*6)*u,-11*u,3.5*u,-13*u);cx.stroke();   // queue
 cx.strokeStyle=DK;cx.lineWidth=2.3*u;
 const fl=y>0?-1.5*u:-Math.max(0,a)*2.6*u,fr=y>0?-1.5*u:-Math.max(0,-a)*2.6*u;
 cx.beginPath();cx.moveTo(-1.6*u,-5*u);cx.lineTo(-1.9*u,fl-.6*u);cx.moveTo(1.6*u,-5*u);cx.lineTo(1.9*u,fr-.6*u);cx.stroke();
 cx.fillStyle="#3a2210";cx.beginPath();cx.ellipse(-1.9*u,fl-.3*u,1.3*u,.7*u,0,0,7);cx.ellipse(1.9*u,fr-.3*u,1.3*u,.7*u,0,0,7);cx.fill();
 cx.strokeStyle=BR;cx.lineWidth=1.9*u;const ar=run?a*2.2*u:0;
 cx.beginPath();cx.moveTo(-3.1*u,-11*u);cx.lineTo(-4.4*u,-7.2*u-ar);cx.moveTo(3.1*u,-11*u);cx.lineTo(4.4*u,-7.2*u+ar);cx.stroke();
 cx.fillStyle=BR;cx.beginPath();cx.ellipse(0,-8.6*u,3.6*u,4.6*u,0,0,7);cx.fill();
 cx.fillStyle="#9b8a55";rr(-2.7*u,-12*u,5.4*u,5.8*u,1.2*u);cx.fill();cx.fillStyle="#7d6e40";rr(-2.7*u,-12*u,5.4*u,2*u,1*u);cx.fill();
 cx.fillStyle="#c9b070";cx.fillRect(-.5*u,-10.4*u,1*u,.9*u);
 cx.strokeStyle="#5e5230";cx.lineWidth=.6*u;cx.beginPath();cx.moveTo(-2.2*u,-12*u);cx.lineTo(-2.6*u,-13.2*u);cx.moveTo(2.2*u,-12*u);cx.lineTo(2.6*u,-13.2*u);cx.stroke();
 cx.fillStyle=BR;for(const sd of[-1,1]){cx.beginPath();cx.arc(sd*3.4*u,-15.4*u,1.4*u,0,7);cx.fill();}
 cx.fillStyle=LT;for(const sd of[-1,1]){cx.beginPath();cx.arc(sd*3.6*u,-15.4*u,.75*u,0,7);cx.fill();}
 cx.fillStyle=BR;cx.beginPath();cx.arc(0,-15.6*u,3.3*u,0,7);cx.fill();
 cx.fillStyle="#c9a86a";cx.beginPath();cx.ellipse(0,-17.6*u,5.2*u,1.5*u,0,0,7);cx.fill();
 cx.fillStyle="#b8955a";cx.beginPath();cx.moveTo(-3*u,-17.6*u);cx.lineTo(-2.6*u,-20.6*u);cx.quadraticCurveTo(0,-21.6*u,2.6*u,-20.6*u);cx.lineTo(3*u,-17.6*u);cx.closePath();cx.fill();
 cx.fillStyle="#5a3b1c";cx.fillRect(-3*u,-18.6*u,6*u,1*u);
 cx.restore();if(mode==="dead")stars(p,u);}
function rr(x,yy,w,h,r){cx.beginPath();cx.moveTo(x+r,yy);cx.arcTo(x+w,yy,x+w,yy+h,r);cx.arcTo(x+w,yy+h,x,yy+h,r);cx.arcTo(x,yy+h,x,yy,r);cx.arcTo(x,yy,x+w,yy,r);cx.closePath();}
function stars(p,u){const q=t-deadAt;if(q<.25)return;cx.fillStyle="#ffe36e";for(let i=0;i<4;i++){const a=t*4+i*1.57;cx.font=`${Math.round(3*u)}px sans-serif`;cx.textAlign="center";cx.fillText("★",p[0]+Math.cos(a)*5*u,p[1]-20*u+Math.sin(a)*1.5*u);}}
function draw(){cx.setTransform(1,0,0,1,0,0);const kk=cv.width/W;cx.setTransform(kk,0,0,kk,0,0);
 CS=Math.cos(cam.th);SN=Math.sin(cam.th);
 cx.save();if(shake>0&&!reduce)cx.translate((Math.random()-.5)*shake*26,(Math.random()-.5)*shake*26);
 sky();Q=[];
 for(const g of segs){floorSeg(g);sideStubs(g);obstacles(g);sprites(g);}
 const pc=toCam(playerW());Q.push({z:pc[2],layer:3,player:1});
 // herbe d'abord, puis le chemin, puis les objets du plus loin au plus près
 const L0=Q.filter(q=>q.layer===0).sort((a,b)=>b.z-a.z),L1=Q.filter(q=>q.layer===1).sort((a,b)=>b.z-a.z),L2=Q.filter(q=>q.layer>=2).sort((a,b)=>b.z-a.z);
 for(const q of L0)drawQ(q);for(const q of L1)drawQ(q);for(const q of L2)drawQ(q);
 for(const p of parts){cx.globalAlpha=Math.max(0,p.l*1.8);cx.fillStyle=p.c;cx.beginPath();cx.arc(p.x,p.y,3,0,7);cx.fill();}cx.globalAlpha=1;
 if(flash>0){cx.fillStyle=`rgba(255,80,40,${flash*.5})`;cx.fillRect(0,0,W,H);}
 if(mode==="play"&&speed>15&&!reduce){cx.strokeStyle="rgba(255,255,255,.22)";cx.lineWidth=2;for(let i=0;i<6;i++){const a=(i*1.7+t*3)%1,x=i%2?W*.06+i*6:W*.94-i*6,yy=HZ+40+a*(H-HZ);cx.beginPath();cx.moveTo(x,yy);cx.lineTo(x+(i%2?-6:6),yy+30);cx.stroke();}}
 if(mode==="play"||(mode==="dead"&&view===null)){cx.textAlign="center";cx.lineJoin="round";cx.font='48px "Titan One",sans-serif';cx.lineWidth=6;cx.strokeStyle="#2a2410";cx.strokeText(score(),W/2,70);cx.fillStyle="#fff";cx.fillText(score(),W/2,70);
  cx.font='700 15px Quicksand,sans-serif';cx.lineWidth=4;const tx=`${Math.floor(dist)} m · ${nb} 🍌`;cx.strokeText(tx,W/2,94);cx.fillStyle="#ffe7a8";cx.fillText(tx,W/2,94);
  if(mode==="play"&&hintT<5&&turns===0){cx.globalAlpha=clamp(5-hintT,0,1);cx.font='700 14px Quicksand,sans-serif';const ln=["Glisse ← → : changer de couloir ou tourner","↑ sauter · ↓ glisser"];
   ln.forEach((l,i)=>{cx.strokeText(l,W/2,H-60+i*20);cx.fillStyle="#fff";cx.fillText(l,W/2,H-60+i*20);});cx.globalAlpha=1;}}
 cx.restore();}
function fit(){const m=$(".ru-main"),c=$(".ru-cab");if(!m||!c)return;const cs=getComputedStyle(m);
 const aw=m.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-16,ah=m.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)-16;
 let h=Math.max(120,ah),w=h*W/H;if(w>aw){w=Math.max(80,aw);h=w*H/W;}c.style.width=Math.floor(w+16)+"px";c.style.height=Math.floor(h+16)+"px";}
function size(){if(!cv)return;fit();const r=cv.getBoundingClientRect();if(!r.width)return;dpr=Math.min(2,window.devicePixelRatio||1);
 const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}draw();}
function loop(n){raf=0;if(!root||root.hidden)return;const dt=Math.min((n-last)/1000,1/30);last=n;update(dt);draw();raf=requestAnimationFrame(loop);}
function run(){if(!raf){last=performance.now();raf=requestAnimationFrame(loop);}}

/* ---------- une course ---------- */
async function go(){
 if(busy||mode==="play"||!S)return;ac();busy=true;render();
 try{const r=await rpc("mf_rush_start");token=r.token;take(r.info);
  reset();mode="play";hintT=0;busy=false;show(null);render();
  if(+r.cost>0)toast(`Course payée : ${r.cost} 🍌`);
 }catch(e){busy=false;toast(errText(e));render();rpc("mf_rush_status").then(x=>{take(x);render();},()=>{});}
}
const WHY={wall:"Dans le mur ! Il fallait tourner.",low:"Pris les pieds dans une racine !",high:"Bonk ! Il fallait glisser sous la poutre.",block:"Écrasé contre un bloc du temple !",gone:"Course interrompue."};
async function send(sc){
 const tk=token;token=null;busy=true;let r=null,err=null;
 for(let i=0;i<3&&!r;i++){try{r=await rpc("mf_rush_end",{p_token:tk,p_score:sc});}catch(e){err=e;if(String(e&&e.message||e).includes("rush_token"))break;await new Promise(z=>setTimeout(z,800*(i+1)));}}
 busy=false;
 const res=!r?{t:"Score non envoyé : "+errText(err),w:false}
  :r.why==="rush_bad"?{t:"Cette course n'a pas été comptée.",w:false}
  :r.why==="rush_late"?{t:"La manche était déjà terminée : cette course ne compte pas.",w:false}
  :r.newBest?{t:`Meilleure course de la manche ! Tu es ${rk1(r.rank)}.`,w:true}
  :{t:`Ta meilleure course reste ${S&&S.myBest!=null?S.myBest:"—"} points${r.rank?` · ${rk1(r.rank)}`:""}.`,w:false};
 if(r){take(r.info);render();}
 if(r&&r.newBest)[523,659,784,1047].forEach((f,i)=>beep(f,i*.08,.16,.05,"triangle"));
 const d={score:sc,m:Math.floor(dist),b:nb,why:WHY[deathKind]||"",res};
 setTimeout(()=>{if(mode==="dead")show("end",d);},Math.max(0,1000-(t-deadAt)*1000));
}

/* ---------- écrans par-dessus le jeu ---------- */
function boardHTML(list,title,note){const me=S&&S.me;
 const rows=(list||[]).slice(0,10).map(x=>`<li class="${x.uid===me?"me":""}"><span class="rk">${MED[x.rank-1]||esc(x.rank)}</span><span class="nm">${esc(x.name||"?")}${x.uid===me?" (toi)":""}</span><span class="sc">${esc(x.best)}</span><span class="rw">${esc(rew(x))}</span></li>`).join("");
 return `<div class="ru-board"><h4>${esc(title)}<small>${esc(note||"")}</small></h4>${rows?`<ol>${rows}</ol>`:`<div class="empty">Personne n'a encore couru dans cette manche. À toi d'ouvrir le bal !</div>`}</div>`;}
function goLabel(){if(!S)return["…",true];if(+S.left<=0)return["Plus de courses",true];const bn=S.state?+S.state.bananas:0;
 if(+S.freeLeft>0)return["Courir · course gratuite",false];if(bn<+S.price)return["Pas assez de bananes",true];return[`Courir · ${S.price} 🍌`,false];}
function menuHTML(){const [lab,dis]=goLabel(),end=S?+S.endsAt-nowS():0;
 const sub=!S?"":(+S.left<=0?`Nouvelles courses à 18 h (dans ${dur(end)})`:`Courses : ${S.left}/${S.max} · classement à 18 h (dans ${dur(end)})`);
 return `<button type="button" class="ru-big" id="ruGo"${dis||busy?" disabled":""}>${esc(busy?"…":lab)}</button><div class="ru-sub">${esc(sub)}</div>
  ${S&&S.myBest!=null?`<div class="ru-res">Ta meilleure course de la manche : <b>${esc(S.myBest)}</b></div>`:""}
  ${boardHTML(S&&S.board,"Classement de la manche",S?"jusqu'à 18 h":"")}`;}
let view="menu",vdata=null;
function show(v,d){view=v;vdata=d||null;const o=$(".ru-ov");if(!v){o.hidden=true;return;}o.hidden=false;
 if(v==="menu")o.innerHTML=`<h3>Fuis le temple !</h3><div class="ru-help">Glisse ← → pour changer de couloir et tourner aux virages · ↑ sauter · ↓ glisser<br>1 point par mètre, 5 par banane</div>${menuHTML()}`;
 else if(v==="end")o.innerHTML=`<h3>Fin de course !</h3><div class="ru-det">${esc(d.why)}</div><div class="ru-score">${esc(d.score)}</div><div class="ru-det">${esc(d.m)} m · ${esc(d.b)} 🍌</div><div class="ru-res${d.res.w?" win":""}">${esc(d.res.t)}</div>${menuHTML()}`;
 else if(v==="last"){const L=S.last,m=L.me||{},rk=+m.rank||0,got=rew(m);
  o.innerHTML=`<h3>Résultat de la manche</h3><div class="ru-score">${rk?(MED[rk-1]||rk+"e"):"—"}</div>
   <div class="ru-res${got?" win":""}">${rk?`Tu as fini ${rk1(rk)} avec ${esc(m.best)} point${+m.best>1?"s":""}`:""}${got?` : +${esc(got)} !`:"."}</div>
   <button type="button" class="ru-big" id="ruOk">Continuer</button>${boardHTML(L.board,"Classement final",fmtRound(L.round))}`;
  const b=o.querySelector("#ruOk");b.addEventListener("click",()=>{rpc("mf_rush_seen",{p_round:L.round}).then(x=>{take(x);},()=>{});S.last.seen=true;show("menu");});b.focus({preventScroll:true});return;}
 const g=o.querySelector("#ruGo");if(g)g.addEventListener("click",go);}
const fmtRound=d=>{try{const [Y,M,D]=String(d).split("-").map(Number);const p=new Date(Y,M-1,D-1);return `du ${p.getDate()}/${p.getMonth()+1} 18 h au ${D}/${M} 18 h`;}catch(e){return "";}};
function render(){if(!root)return;const st=S&&S.state;
 $("#ruBan").textContent=st?st.bananas:"…";$("#ruLeft").textContent=S?`${S.left}/${S.max}`:"…";
 if(view==="menu"||view==="end")show(view,vdata);
 if(S){$("#ruHist").innerHTML=(S.hist||[]).map(h=>`<li>${esc(h)}</li>`).join("");
  $("#ruRw").innerHTML=(S.rewards||[]).map((x,i)=>`<tr><td>${MED[i]||(i+1)+"e"}</td><td>${esc(rew(x))}</td></tr>`).join("")+`<tr><td>${(S.rewards||[]).length+1}e et après</td><td>rien</td></tr>`;
  $("#ruBestAll").textContent=S.bestAll||0;}
 if(ADMIN&&S){const o=$("#ruOpen");o.textContent=S.open?"Cacher aux joueurs":"Ouvrir à tous les joueurs";o.classList.toggle("on",!S.open);
  $("#ruState").textContent=S.open?NAME+" est ouvert aux joueurs.":NAME+" est visible par toi seulement.";}}
let tt=0;function toast(m){const e=$(".ru-toast");e.textContent=m;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500);}
function panel(o){$("#ruPanel").classList.toggle("open",o);$("#ruTog").setAttribute("aria-expanded",String(o));}
async function adm(a,m){try{take(await rpc("mf_rush_admin",{p_action:a}));render();if(m)toast(m);}catch(e){toast(errText(e));}}

/* ---------- construction ---------- */
function build(){
 const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
 root=document.createElement("div");root.id="mfRUSH";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label",NAME);
 root.innerHTML=`<div class="ru-top"><button type="button" class="ru-btn l" id="ruTog" aria-controls="ruPanel" aria-expanded="false" aria-label="Règles">?</button>
  <h2 style="margin:0"><img class="ru-logo" src="${IMG.logo}" alt="${NAME}"><span class="ru-logoT" hidden>${NAME}</span></h2>
  <div class="ru-chips"><span class="ru-chip">🍌 <b id="ruBan">…</b></span><span class="ru-chip">Courses <b id="ruLeft">…</b></span></div>
  <button type="button" class="ru-btn r" id="ruClose" aria-label="Fermer">✕</button></div>
 <div class="ru-main"><div class="ru-cab"><div class="ru-scr" id="ruScr" aria-label="Zone de jeu : glisse le doigt pour diriger le singe">
  <canvas></canvas><div class="ru-ov" aria-live="polite"></div></div></div></div>
 <aside class="ru-panel" id="ruPanel" aria-label="Règles et réglages">
  <div class="ru-ph"><h3>Règles</h3><button type="button" class="ru-btn" style="position:static" id="ruPanelX" aria-label="Fermer les règles">✕</button></div>
  <ul class="r">
   <li>Le singe court tout seul et accélère. <b>Glisse</b> ← → pour changer de couloir, ↑ pour <b>sauter</b> les racines, ↓ pour <b>glisser</b> sous les poutres. Au clavier : flèches ou Z Q S D, Espace pour sauter.</li>
   <li>Au bout de chaque allée, un mur : glisse du bon côté pour <b>tourner</b> (tu peux glisser un peu avant le virage).</li>
   <li><b>1 point par mètre</b> et <b>5 points par banane</b>. Un seul choc et la course est finie.</li>
   <li>Une <b>manche</b> va de 18 h à 18 h. <b>5 courses</b> par manche : la 1re est <b>gratuite</b>, les suivantes coûtent <b>1 🍌</b>.</li>
   <li>Seule ta <b>meilleure course</b> de la manche compte. Égalité : le premier à avoir fait ce score passe devant.</li>
   <li>Chaque soir à <b>18 h</b>, le classement est figé et les récompenses arrivent toutes seules sur ton compte.</li>
  </ul>
  <h3>Récompenses de 18 h</h3><table class="ru-rw"><tbody id="ruRw"></tbody></table>
  <p>Ton record de tous les temps : <b id="ruBestAll">0</b></p>
  <h3>Dernières courses</h3><ul class="ru-hist" id="ruHist"></ul>
  <div id="ruAdm" hidden><h3>Réglages admin</h3><p id="ruState"></p>
   <div class="ru-btns"><button type="button" id="ruOpen"></button></div>
   <div class="ru-btns"><button type="button" id="ruReset">Rendre mes courses de la manche</button><button type="button" id="ruAdd">+50 🍌</button></div></div>
 </aside>
 <div class="ru-toast" role="status"></div>`;
 document.body.appendChild(root);
 $("#ruAdm").hidden=!ADMIN;
 cv=$("canvas");cx=cv.getContext("2d");
 const lg=$(".ru-logo"),noLogo=()=>{lg.hidden=true;$(".ru-logoT").hidden=false;};lg.onerror=noLogo;if(lg.complete&&!lg.naturalWidth)noLogo();
 Object.entries(IMG).forEach(([k,u])=>{if(k==="logo")return;const i=new Image();i.src=u;IM[k]=i;});
 try{new ResizeObserver(size).observe($(".ru-main"));}catch(e){addEventListener("resize",size);}
 // glisser le doigt : une action par geste, dès que le doigt a bougé assez
 const scr=$("#ruScr");let sw=null;
 const dirOf=(dx,dy)=>Math.abs(dx)>Math.abs(dy)?(dx>0?"R":"L"):(dy>0?"down":"up");
 scr.addEventListener("pointerdown",e=>{if(mode!=="play")return;e.preventDefault();sw={x:e.clientX,y:e.clientY,id:e.pointerId,done:false};try{scr.setPointerCapture(e.pointerId);}catch(_){}});
 scr.addEventListener("pointermove",e=>{if(!sw||sw.done||e.pointerId!==sw.id)return;const dx=e.clientX-sw.x,dy=e.clientY-sw.y,th=Math.max(18,scr.clientWidth*.05);
  if(Math.hypot(dx,dy)>=th){sw.done=true;act(dirOf(dx,dy));}});
 const up=e=>{if(!sw||e.pointerId!==sw.id)return;sw=null;};
 scr.addEventListener("pointerup",up);scr.addEventListener("pointercancel",up);
 const KEYS={ArrowLeft:"L",KeyA:"L",KeyQ:"L",ArrowRight:"R",KeyD:"R",ArrowUp:"up",KeyW:"up",KeyZ:"up",Space:"up",ArrowDown:"down",KeyS:"down"};
 document.addEventListener("keydown",e=>{if(!root||root.hidden)return;
  if(e.key==="Escape"){if($("#ruPanel").classList.contains("open"))panel(false);else close();return;}
  if(mode==="play"&&KEYS[e.code]){e.preventDefault();if(!e.repeat)act(KEYS[e.code]);}});
 $("#ruClose").addEventListener("click",close);
 $("#ruTog").addEventListener("click",()=>panel(!$("#ruPanel").classList.contains("open")));
 $("#ruPanelX").addEventListener("click",()=>{panel(false);$("#ruTog").focus({preventScroll:true});});
 $("#ruOpen").addEventListener("click",()=>adm(S&&S.open?"close":"open",S&&S.open?NAME+" est de nouveau caché.":NAME+" est ouvert à tous."));
 $("#ruReset").addEventListener("click",()=>adm("reset","Tes courses de la manche sont rendues."));
 $("#ruAdd").addEventListener("click",()=>adm("bananas","+50 🍌 sur ton compte."));
 setInterval(()=>{if(root&&!root.hidden&&mode!=="play"&&(view==="menu"||view==="end"))render();},30000);
}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
 if(!root)build();if(!root.hidden)return;
 root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 mode="menu";reset();show("menu");render();size();run();$("#ruClose").focus({preventScroll:true});
 try{take(await rpc("mf_rush_status"));render();if(S.last&&!S.last.seen)show("last");}catch(e){toast(errText(e));}
}
function close(){
 if(mode==="play"){toast("Termine ta course d'abord !");return;}
 if(busy&&mode==="dead"){toast("Envoi du score…");return;}
 panel(false);root.hidden=true;mode="menu";document.body.style.overflow=prevOverflow;if(opener&&opener.focus)opener.focus();
}
// l'appli passe en arrière-plan pendant une course : on la termine (le score part quand même)
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&mode==="play")die("gone");});

/* ---------- démarrage : le jeu s'inscrit au Casino ---------- */
async function boot(){
 if(!window.claude||!window.claude.use)return;
 try{USER=await window.claude.use("user");}catch(e){}
 if(!USER||typeof window.MF_RPC!=="function")return;
 try{ADMIN=!!(await USER.isOwner());}catch(e){}
 let can=ADMIN;if(!can){try{can=!!(await rpc("mf_rush_open"));}catch(e){}}
 if(!can||!window.MF_CASINO)return;
 Object.values(IMG).forEach(u=>{const i=new Image();i.src=u;});
 window.MF_CASINO.add({id:"rush",name:NAME,order:14,root:"mfRUSH",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v4M6 12l3-4 4 1 3 4 3-1M11 15l1-5"/></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){const r=await rpc("mf_rush_status");take(r);}const I=S;if(!I)return null;
   const end=+I.endsAt-nowS(),unseen=!!(I.last&&!I.last.seen),me=(I.board||[]).find(x=>x.uid===I.me);
   const pos=me?` · tu es ${rk1(me.rank)}`:"";
   if(unseen)return {line:"Résultat de la manche à voir !",hot:true};
   if(+I.freeLeft>0)return {line:"Course gratuite disponible"+pos,pre:"Classement dans ",in:end,hot:true};
   if(+I.left>0)return {line:`Encore ${I.left} course${+I.left>1?"s":""} · ${I.price} 🍌 la course${pos}`,pre:"Classement dans ",in:end,hot:false};
   return {line:"Plus de courses dans cette manche"+pos,pre:"Classement dans ",in:end,hot:false};}});
}
window.MF_RUSH={open,_test:{act,get st(){return {mode,s,lat,y,dist,nb,speed,turns,cur,view};}}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

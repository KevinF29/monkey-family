/* Monkey Family — Monkey Jump (le singe qui grimpe dans l'arbre géant, façon Doodle Jump)
   Le singe rebondit tout seul de branche en branche ; le joueur le dirige à gauche / à droite
   (au choix : toucher les côtés de l'écran ou pencher le téléphone ; flèches au clavier).
   Une manche va de 18 h à 18 h. 5 parties par manche : la 1re gratuite, puis 1 🍌. On garde la meilleure.
   À 18 h, le serveur classe la manche et donne les récompenses (comme Flying Monkey et Monkey Rush).
   Chaque partie a un jeton du serveur (mf_jump_*, supabase-jump.sql) qui refuse les scores impossibles.
   Visible par l'admin seulement tant que le jeu n'est pas ouvert (réglages admin → « Ouvrir à tous »). */
(function(){
"use strict";

// Visuels de Kévin (packs/jump-*) + le singe aventurier de Monkey Rush et la banane de Flying Monkey.
const P="packs/jump-";
const IMG={jump:"packs/rush-saut.webp",fall:"packs/rush-chute.webp",banana:"packs/fly-banana.webp",
 br:P+"branche.webp",rot:P+"pourrie.webp",vine:P+"liane.webp",mush:P+"champignon.webp",heli:P+"helice.webp",bub:P+"bulle.webp",
 snake:P+"serpent.webp",tou:P+"toucan.webp",coco:P+"coco.webp",trunk:P+"tronc.webp",soil:P+"sol.webp",cloud:P+"nuage.webp"};
const LOGO=P+"titre.webp";
// dessus du bois dans chaque image de branche (mesuré sur les images, en fraction de la hauteur) et largeur dessinée / largeur de la branche
const BR={n:["br",38/88,1.25],p:["rot",34/86,1.25],m:["vine",70/117,1.25]};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR={no_bananas:"Pas assez de bananes.",jump_limit:"Plus de parties dans cette manche : reviens après 18 h !",jump_closed:"Monkey Jump n'est pas ouvert en ce moment.",
 jump_token:"Cette partie n'est plus valable.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse=matchMedia("(pointer: coarse)").matches;
const MED=["🥇","🥈","🥉"];
const rew=x=>{const b=+(x&&x.boost)||0,n=+(x&&x.ban)||0;return [b?`${b} booster${b>1?"s":""}`:"",n?`${n} 🍌`:""].filter(Boolean).join(" + ");};
const dur=ms=>{ms=Math.max(0,ms);const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);return h?`${h} h ${String(m).padStart(2,"0")}`:`${Math.max(1,m)} min`;};

/* ---------- style ---------- */
const CSS=`#mfJUMP{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;touch-action:manipulation;color:#f6f0d8;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:#0f3b2a;background-image:radial-gradient(ellipse at 50% 0,#2f7a4d,#0f3b2a 55%,#08231a)}
#mfJUMP[hidden]{display:none}
#mfJUMP *{box-sizing:border-box;min-width:0}
#mfJUMP [hidden]{display:none!important}
#mfJUMP,#mfJUMP *{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
#mfJUMP button:focus-visible{outline:3px solid #8fd3ff;outline-offset:2px}
.jp-top{flex:none;position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:4px;padding:max(8px,env(safe-area-inset-top)) 58px 4px}
.jp-logo{display:block;height:clamp(48px,9svh,96px);width:auto;max-width:100%;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
.jp-logoT{margin:0;font:400 clamp(26px,7vw,36px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 #6b3f1d}
.jp-btn{position:absolute;top:max(8px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(10,30,18,.8);color:#ffd23f;font:700 19px Quicksand,sans-serif;cursor:pointer;display:grid;place-items:center}
.jp-btn.l{left:10px}.jp-btn.r{right:10px}
.jp-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px}
.jp-chip{background:#2a1a0c;border:1px solid #6b4520;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13.5px;white-space:nowrap}
.jp-chip b{color:#ffd23f}
.jp-main{flex:1;min-height:0;width:100%;display:flex;align-items:flex-start;justify-content:center;padding:4px 8px max(10px,env(safe-area-inset-bottom))}
.jp-cab{position:relative;flex:none;border-radius:18px;padding:8px;background:linear-gradient(180deg,#8a5a2e,#5a3618);box-shadow:0 14px 30px rgba(0,0,0,.55),inset 0 2px 0 rgba(255,255,255,.2)}
.jp-scr{position:relative;width:100%;height:100%;border-radius:11px;overflow:hidden;box-shadow:inset 0 0 0 2px rgba(0,0,0,.5);touch-action:none;cursor:pointer}
.jp-scr canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.jp-ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 12px;background:rgba(6,32,20,.62);overflow-y:auto;overscroll-behavior:contain;cursor:default;text-align:center}
.jp-ov h3{margin:2px 0 0;font:400 clamp(22px,4.2svh,30px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 rgba(0,0,0,.5)}
.jp-ov p{margin:0}
.jp-big{min-height:54px;padding:8px 24px;border-radius:16px;border:0;background:#ffd23f;color:#3b2410;font:400 19px "Titan One",sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8901a}
.jp-big:active{transform:translateY(2px);box-shadow:0 2px 0 #b8901a}
.jp-big:disabled{background:#4a4030;color:#a09880;box-shadow:none;cursor:default}
.jp-sub{font-size:13.5px;font-weight:700;color:#e3efd9;text-shadow:0 1px 3px #000}
.jp-score{font:400 clamp(44px,9svh,64px)/1 "Titan One",sans-serif;color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.45)}
.jp-res{font:700 15px Quicksand,sans-serif;color:#ffe7a8}
.jp-res.win{color:#8fe3a8}
.jp-board{width:100%;max-width:340px;margin-top:2px;text-align:left}
.jp-board h4{margin:6px 0 4px;font:400 15px "Titan One",sans-serif;color:#ffd23f;display:flex;justify-content:space-between;gap:8px}
.jp-board h4 small{font:700 12px Quicksand,sans-serif;color:#cfe0c8;white-space:nowrap}
.jp-board ol{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.jp-board li{display:grid;grid-template-columns:2em minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:rgba(0,0,0,.35);font-size:14px}
.jp-board li.me{background:rgba(255,210,63,.18);box-shadow:inset 0 0 0 2px #ffd23f}
.jp-board .rk{font:400 15px "Titan One",sans-serif;text-align:center}
.jp-board .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.jp-board .sc{font:400 16px "Titan One",sans-serif;color:#fff;white-space:nowrap;text-align:right}
.jp-board .rw{font-size:12px;font-weight:700;color:#ffe7a8;white-space:nowrap;text-align:right}
.jp-board .empty{color:#cfe0c8;font-size:14px;padding:6px 2px}
.jp-panel{position:absolute;top:0;left:0;bottom:0;z-index:30;width:min(400px,100%);overflow-y:auto;overscroll-behavior:contain;background:#14301f;border-right:1px solid #2f5a3a;
 padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s;visibility:hidden}
.jp-panel.open{transform:none;visibility:visible}
.jp-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.jp-panel h3{font:400 19px "Titan One",sans-serif;color:#ffd23f;margin:14px 0 6px}
.jp-ph h3{margin:0}
.jp-panel p,.jp-panel li{color:#d6e4cc;font-size:14px}
.jp-panel ul.r{margin:4px 0;padding-left:18px}
.jp-rw{width:100%;border-collapse:collapse;font-size:14px}
.jp-rw td{padding:3px 4px;border-bottom:1px solid #2a4a32;color:#d6e4cc}
.jp-rw td:last-child{text-align:right;font-weight:700;color:#ffd23f}
.jp-hist{list-style:none;margin:0;padding:0;font-size:14px}
.jp-hist li{padding:5px 0;border-bottom:1px solid #2a4a32}
.jp-hist:empty::after{content:"Aucune partie pour l'instant.";color:#9fb59a}
.jp-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.jp-btns button{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid #3f6a4a;background:#1f4a30;color:#f6f0d8;font:700 14px Quicksand,sans-serif;cursor:pointer}
.jp-btns button.on{background:#ffd23f;color:#3b2410;border-color:#ffd23f}
.jp-toast{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));z-index:40;transform:translate(-50%,12px);background:#1f4a30;border:1px solid #ffd23f;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;max-width:92%;transition:transform .3s,opacity .3s;pointer-events:none;opacity:0}
.jp-toast.on{transform:translate(-50%,0);opacity:1}
@media(max-height:640px){.jp-logo{height:40px}.jp-big{min-height:46px}}
@media(prefers-reduced-motion:reduce){.jp-toast,.jp-panel{transition:none}.jp-big:active{transform:none}}
.jp-ctrl{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;font-size:13.5px;font-weight:700;color:#e3efd9;text-shadow:0 1px 3px #000}
.jp-ctrl button{min-height:40px;padding:4px 14px;border-radius:999px;border:1px solid #6b8a5a;background:rgba(10,30,18,.75);color:#f6f0d8;font:700 14px Quicksand,sans-serif;cursor:pointer}
.jp-ctrl button[aria-pressed="true"]{background:#ffd23f;color:#3b2410;border-color:#ffd23f}
`;

/* ---------- état serveur ---------- */
let root=null,USER=null,ADMIN=false,S=null,skew=0,busy=false;
const $=s=>root.querySelector(s);
const nowS=()=>Date.now()+skew;
function take(info){if(!info)return;S=info;if(info.now)skew=+info.now-Date.now();try{if(info.state&&window.MF_APPLY)window.MF_APPLY(info.state);}catch(e){}}

/* ---------- sons ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==="suspended")AC.resume().catch(()=>{});return AC;}
function beep(f,t0,d,vol,type,f2){const a=AC;if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type||"square";o.frequency.setValueAtTime(f,a.currentTime+t0);if(f2)o.frequency.exponentialRampToValueAtTime(f2,a.currentTime+t0+d);g.gain.setValueAtTime(vol,a.currentTime+t0);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t0+d);o.connect(g).connect(a.destination);o.start(a.currentTime+t0);o.stop(a.currentTime+t0+d+.02);}catch(e){}}
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};

/* ---------- commandes (au choix du joueur, gardé sur le téléphone) ---------- */
let ctrl=(()=>{try{return localStorage.getItem("mf_jump_ctrl")==="tilt"?"tilt":"touch";}catch(e){return "touch";}})();
let tilt=0,tiltSeen=0,orientOn=false,keyL=false,keyR=false,ptrs=new Map(),tiltWarned=false;
function onOrient(e){if(e.gamma==null)return;tiltSeen=performance.now();
 const a=(screen.orientation&&screen.orientation.angle)||+window.orientation||0;
 const v=a===90?e.beta:(a===-90||a===270)?-e.beta:a===180?-e.gamma:e.gamma;
 tilt=Math.max(-1,Math.min(1,(+v||0)/22));}
async function askTilt(){
 if(!("DeviceOrientationEvent" in window))return false;
 try{const D=window.DeviceOrientationEvent;if(typeof D.requestPermission==="function"){const r=await D.requestPermission();if(r!=="granted")return false;}}catch(e){return false;}
 if(!orientOn){addEventListener("deviceorientation",onOrient);orientOn=true;}return true;}
async function setCtrl(c){
 if(c==="tilt"&&!(await askTilt())){toast("Ton téléphone ne permet pas de jouer en le penchant : on reste en mode toucher.");c="touch";}
 ctrl=c;try{localStorage.setItem("mf_jump_ctrl",c);}catch(e){}
 if(c==="tilt")toast("Penche ton téléphone à gauche ou à droite pour diriger le singe.");
 render();}
function touchDir(){let d=0;for(const v of ptrs.values())d=v;return d;}
// mode Pencher : seul le téléphone dirige (toucher l'écran ne fait rien) ; mode Toucher : les côtés de l'écran ; le clavier marche toujours
function wantDir(){const k=(keyR?1:0)-(keyL?1:0);if(k)return k;return ctrl==="tilt"?tilt:touchDir();}

/* ---------- le jeu (coordonnées logiques 420 × 640, y vers le bas, monde qui monte) ---------- */
const W=420,H=640,PXM=20,G=1500,VJ=820,VS=1360,VH=760,HELI_T=3,MAXVX=340,MW=58,MH=64;
const IM={};let cv=null,cx=null,dpr=1,raf=0,last=0;
const ok=n=>IM[n]&&IM[n].complete&&IM[n].naturalWidth>0;
let mode="menu",t=0,mx=W/2,my=0,vx=0,vy=0,face=1,camY=0,startY=0,topY=0,hmax=0,nBan=0,score=0,
 plats=[],bans=[],tous=[],cocos=[],parts=[],heli=0,shield=false,squash=0,shake=0,flash=0,deadAt=0,why="fall",token=null,
 lastBanY=0,touT=0,cocoT=0,playT=0;
const hm=y=>(startY-y)/PXM;
const rnd=(a,b)=>a+Math.random()*(b-a);

function addPlat(x,y,k,extra){
 const p={x,y,w:k==="p"?64:72,k,vx:0,fall:0,fy:0,it:null,itx:0,snake:false,sq:0,ph:Math.random()*6};
 if(k==="m")p.vx=(Math.random()<.5?-1:1)*(50+Math.min(110,Math.max(0,hm(y))*.06));
 Object.assign(p,extra||{});plats.push(p);return p;}
const freeX=(x,d)=>{let x2=rnd(40,W-40),n=0;while(Math.abs(x2-x)<d&&n++<8)x2=rnd(40,W-40);return x2;};
function gen(){
 while(topY>camY-180){
  const h=Math.max(0,hm(topY)),gmax=Math.min(200,72+h*.1),gmin=Math.min(gmax*.55,110),gap=rnd(gmin,gmax);
  const prevY=topY;topY-=gap;const h2=hm(topY);
  const x=rnd(40,W-40);
  const p=addPlat(x,topY,Math.random()<Math.min(.4,Math.max(0,(h2-80)/1500))?"m":"n");
  const r=Math.random();
  if(h2>40&&r<.065)p.it="spring";else if(h2>150&&r<.077)p.it="heli";else if(h2>100&&r<.09)p.it="shield";
  if(p.it)p.itx=rnd(-18,18);
  if(lastBanY-(topY-46)>=100&&Math.random()<.3){bans.push({x:Math.max(24,Math.min(W-24,x+rnd(-30,30))),y:topY-46,ph:Math.random()*6});lastBanY=topY-46;}
  // branche pourrie (piège) entre deux branches
  if(h2>30&&gap>60&&Math.random()<Math.min(.45,.12+h2/2500))addPlat(freeX(x,100),prevY-gap*rnd(.35,.65),"p");
  // branche avec un serpent (évitable)
  if(h2>200&&gap>70&&Math.random()<Math.min(.16,(h2-200)/2500))addPlat(freeX(x,120),prevY-gap*rnd(.3,.7),"n",{snake:true});
 }}
function reset(){
 t=0;camY=0;startY=H-80;mx=W/2;my=startY;vx=0;vy=-VJ;face=1;hmax=0;nBan=0;score=0;heli=0;shield=false;squash=0;flash=0;
 plats=[];bans=[];tous=[];cocos=[];parts=[];topY=startY;lastBanY=startY;touT=rnd(4,8);cocoT=rnd(5,9);playT=0;tiltWarned=false;
 addPlat(W/2,startY,"n",{w:W+60,ground:true});gen();}
function burst(x,y,c,n,s){for(let i=0;i<n;i++){const a=Math.random()*6.28,v=rnd(.3,1)*(s||200);parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:rnd(.35,.7),c});}}
function hit(kind,e){
 if(heli>0){e.dead=true;burst(e.x,e.y,"#fff",10);return;}
 if(shield){shield=false;e.dead=true;flash=.4;burst(mx,my-MH/2,"#8fd3ff",18,260);beep(300,0,.2,.05,"triangle",900);vib(40);return;}
 die(kind);}
function update(dt){t+=dt;
 for(const p of parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=500*dt;p.l-=dt;}parts=parts.filter(p=>p.l>0);
 shake=Math.max(0,shake-dt);flash=Math.max(0,flash-dt);squash=Math.max(0,squash-dt);
 if(mode==="dead"){vy=Math.min(vy+G*dt,1300);my+=vy*dt;return;}
 if(mode!=="play"){ // le singe rebondit sur place derrière l'écran d'accueil
  const g=plats.find(p=>p.ground);vy+=G*dt;my+=vy*dt;mx=W/2+Math.sin(t*.9)*80;face=Math.cos(t*.9)>=0?1:-1;
  if(g&&my>=g.y){my=g.y;vy=-VJ*.72;squash=.12;}return;}
 playT+=dt;
 if(ctrl==="tilt"&&coarse&&!tiltWarned&&playT>1.6&&performance.now()-tiltSeen>1500){tiltWarned=true;toast("Ton téléphone n'envoie pas l'inclinaison : choisis « Toucher » sur l'écran d'accueil.");}
 // gauche / droite (le singe repasse de l'autre côté de l'écran)
 const tg=wantDir()*MAXVX;vx+=(tg-vx)*Math.min(1,dt*(ctrl==="tilt"&&!keyL&&!keyR?14:9));
 mx+=vx*dt;if(mx<-MW/2)mx+=W+MW;if(mx>W+MW/2)mx-=W+MW;if(Math.abs(vx)>25)face=vx>0?1:-1;
 // haut / bas
 const py=my;
 if(heli>0){heli-=dt;vy=-VH;if(Math.random()<.6)parts.push({x:mx+rnd(-8,8),y:my-MH-6,vx:rnd(-40,40),vy:rnd(-20,40),l:.3,c:"#bff5a8"});}
 else vy=Math.min(vy+G*dt,1100);
 my+=vy*dt;
 // branches qui bougent ou qui tombent
 for(const p of plats){if(p.fall){p.fall+=dt;p.fy+=(p.fall*G*.6)*dt;continue;}
  if(p.vx){p.x+=p.vx*dt;const m=p.w/2+4;if(p.x<m){p.x=m;p.vx=-p.vx;}if(p.x>W-m){p.x=W-m;p.vx=-p.vx;}}
  p.sq=Math.max(0,p.sq-dt);}
 // atterrissage (seulement en descendant, les pieds passent le haut de la branche)
 if(vy>0&&heli<=0){for(const p of plats){if(p.fall||py>p.y||my<p.y)continue;if(Math.abs(mx-p.x)>p.w/2+14&&!p.ground)continue;
   if(p.k==="p"){p.fall=.001;beep(140,0,.18,.05,"sawtooth",70);burst(p.x,p.y,"#9a8466",8,140);continue;}
   my=p.y;squash=.12;
   if(p.snake){p.snake=false;burst(p.x,p.y-14,"#4caf50",14,220);vy=-VJ*1.12;beep(660,0,.1,.04,"square",990);vib(20);break;}
   if(p.it==="spring"&&Math.abs(mx-(p.x+p.itx))<28){vy=-VS;p.sq=.25;[392,523,784].forEach((f,i)=>beep(f,i*.05,.09,.04,"triangle"));vib(15);}
   else{vy=-VJ;beep(330,0,.08,.025,"triangle",520);}
   break;}}
 // caméra : monte avec le singe, ne redescend jamais
 const lim=camY+H*.42;if(my<lim)camY=my-H*.42;
 hmax=Math.max(hmax,hm(my));score=Math.floor(hmax)+5*nBan;
 const cyM=my-MH/2;
 // objets à ramasser
 for(const p of plats){if(!p.it||p.it==="spring"||p.fall)continue;const ix=p.x+p.itx,iy=p.y-18;
  if(Math.hypot(ix-mx,iy-cyM)<34){if(p.it==="heli"){heli=HELI_T;beep(500,0,.5,.04,"sawtooth",1200);}else{shield=true;beep(700,0,.25,.04,"triangle",1400);}burst(ix,iy,p.it==="heli"?"#8fe36b":"#8fd3ff",14,200);vib(20);p.it=null;}}
 for(const b of bans){if(!b.got&&Math.hypot(b.x-mx,b.y-cyM)<32){b.got=true;nBan++;score=Math.floor(hmax)+5*nBan;[988,1319].forEach((f,i)=>beep(f,i*.06,.08,.03,"triangle"));burst(b.x,b.y,"#ffd23f",10,200);}}
 // serpents (on peut leur sauter dessus, mais pas les toucher par en dessous ou par le côté)
 for(const p of plats){if(!p.snake||p.fall)continue;const sx=p.x,sy=p.y-16;
  if(Math.abs(sx-mx)<26&&Math.abs(sy-cyM)<34){const e={x:sx,y:sy,dead:false};hit("snake",e);if(e.dead){p.snake=false;}if(mode!=="play")return;}}
 // toucans
 const h=hmax;
 if(h>300){touT-=dt;if(touT<=0){touT=rnd(6,12)-Math.min(4,h/600);const d=Math.random()<.5?1:-1;tous.push({x:d>0?-40:W+40,y:camY+rnd(60,H*.5),vx:d*(110+Math.min(130,h*.03)),dead:false,ph:Math.random()*6});}}
 for(const o of tous){o.x+=o.vx*dt;if(o.dead)continue;
  if(Math.abs(o.x-mx)<34&&Math.abs(o.y-cyM)<36){
   if(vy>0&&my<o.y+6){o.dead=true;vy=-VJ*1.12;burst(o.x,o.y,"#ff8a1f",14,220);beep(660,0,.1,.04,"square",990);}
   else{hit("toucan",o);if(mode!=="play")return;}}}
 tous=tous.filter(o=>!o.dead&&o.x>-80&&o.x<W+80&&o.y<camY+H+60);
 // noix de coco (un point rouge prévient avant la chute)
 if(h>500){cocoT-=dt;if(cocoT<=0){cocoT=rnd(4,8)-Math.min(2.5,h/1000);cocos.push({x:rnd(30,W-30),y:0,vy:0,warn:.9,dead:false});}}
 for(const o of cocos){if(o.warn>0){o.warn-=dt;o.y=camY-30;continue;}o.vy=Math.min(o.vy+700*dt,620);o.y+=(o.vy)*dt;
  if(!o.dead&&Math.hypot(o.x-mx,o.y-cyM)<30){hit("coco",o);if(mode!=="play")return;}}
 cocos=cocos.filter(o=>!o.dead&&o.y<camY+H+60);
 // ménage + nouvelles branches
 plats=plats.filter(p=>p.y+p.fy<camY+H+80);bans=bans.filter(b=>!b.got&&b.y<camY+H+60);gen();
 if(my>camY+H+40)die("fall");}

/* ---------- dessin ---------- */
const STAGES=[[0,[13,51,34],[31,90,53]],[250,[29,90,51],[63,143,74]],[600,[78,160,140],[150,215,185]],[1000,[126,200,240],[205,238,252]],[1700,[59,76,143],[150,130,200]],[2600,[11,16,48],[38,48,106]]];
function stage(h){let a=STAGES[0],b=STAGES[0];for(let i=0;i<STAGES.length;i++){if(h>=STAGES[i][0]){a=STAGES[i];b=STAGES[Math.min(i+1,STAGES.length-1)];}}
 const k=b===a?0:Math.min(1,(h-a[0])/(b[0]-a[0])),m=(u,v)=>u.map((x,i)=>Math.round(x+(v[i]-x)*k));return [m(a[1],b[1]),m(a[2],b[2])];}
const rgb=c=>`rgb(${c[0]},${c[1]},${c[2]})`;
const sm=(a,b,x)=>Math.max(0,Math.min(1,(x-a)/(b-a)));
function rr(x,y,w,h,r){cx.beginPath();cx.moveTo(x+r,y);cx.arcTo(x+w,y,x+w,y+h,r);cx.arcTo(x+w,y+h,x,y+h,r);cx.arcTo(x,y+h,x,y,r);cx.arcTo(x,y,x+w,y,r);cx.closePath();}
function bg(){const h=Math.max(0,hm(camY+H/2)),[top,bot]=stage(h);
 const g=cx.createLinearGradient(0,0,0,H);g.addColorStop(0,rgb(top));g.addColorStop(1,rgb(bot));cx.fillStyle=g;cx.fillRect(0,0,W,H);
 // étoiles tout en haut
 const st=sm(1800,2600,h);if(st>0){cx.fillStyle=`rgba(255,255,240,${.8*st})`;for(let i=0;i<40;i++){const x=(i*97.3)%W,y=((i*151.7-camY*.08)%H+H)%H;cx.fillRect(x,y,i%3?1.5:2.5,i%3?1.5:2.5);}}
 // nuages
 const cl=sm(650,900,h)*(1-sm(2200,2800,h));if(cl>0){cx.fillStyle=`rgba(255,255,255,${.75*cl})`;
  for(let i=0;i<6;i++){const y=((i*230-camY*.4)%(H+240)+H+240)%(H+240)-120,x=((i*173)%W)+Math.sin(t*.1+i)*20;
   if(ok("cloud")){const cw=110+(i%3)*30,ch=cw*191/400;cx.globalAlpha=.85*cl;cx.drawImage(IM.cloud,x-cw/2,y-ch/2,cw,ch);cx.globalAlpha=1;continue;}
   cx.beginPath();cx.ellipse(x,y,70,22,0,0,7);cx.ellipse(x-40,y+6,40,16,0,0,7);cx.ellipse(x+44,y+5,46,17,0,0,7);cx.fill();}}
 // le tronc géant et les feuillages (disparaissent au-dessus de la canopée)
 const tr=1-sm(700,1150,h);
 if(tr>0&&ok("trunk")){cx.save();cx.globalAlpha=tr;const th=W*1260/840,off=camY*.5;
  // images empilées (défilement à mi-vitesse), une sur deux retournée pour cacher les raccords
  for(let n=Math.floor(off/th);n*th-off<H;n++){const y=n*th-off;
   if(n&1){cx.save();cx.translate(0,y+th);cx.scale(1,-1);cx.drawImage(IM.trunk,0,0,W,th);cx.restore();}else cx.drawImage(IM.trunk,0,y,W,th);}
  cx.restore();}
 else if(tr>0){cx.save();cx.globalAlpha=tr;const tw=150,tx=W/2-tw/2;
  const tg=cx.createLinearGradient(tx,0,tx+tw,0);tg.addColorStop(0,"#3b2410");tg.addColorStop(.35,"#6b4520");tg.addColorStop(.7,"#5a3618");tg.addColorStop(1,"#2a1a0c");
  cx.fillStyle=tg;cx.fillRect(tx,0,tw,H);cx.strokeStyle="rgba(30,15,5,.45)";cx.lineWidth=3;
  for(let i=0;i<9;i++){const y=((i*90-camY*.5)%720+720)%720-40,x=tx+20+(i*37)%110;cx.beginPath();cx.moveTo(x,y);cx.bezierCurveTo(x+8,y+25,x-6,y+45,x+4,y+70);cx.stroke();}
  for(let s=0;s<2;s++){for(let i=0;i<5;i++){const y=((i*170-camY*.65+s*85)%850+850)%850-120,x=s?W-10:10;
   cx.fillStyle=i%2?"#1f6b3a":"#2e8a4a";cx.beginPath();cx.ellipse(x,y,60,34,s?-.4:.4,0,7);cx.ellipse(x+(s?-30:30),y+24,40,22,0,0,7);cx.fill();}}
  cx.restore();}}
function branch(p){const y=p.y-camY+p.fy;if(y<-40||y>H+40)return;const w=p.w,x0=p.x-w/2;
 if(p.ground&&ok("soil")){const sh=W*331/1000,top=sh*221/331;cx.fillStyle="#5a2e14";cx.fillRect(0,y+sh-top-4,W,H);cx.drawImage(IM.soil,0,y-top,W,sh);return;}
 if(p.ground){cx.fillStyle="#3b2410";cx.fillRect(0,y,W,H-y+40);cx.fillStyle="#2e8a4a";rr(-10,y-4,W+20,18,9);cx.fill();
  cx.fillStyle="#3fae5f";for(let i=0;i<12;i++){cx.beginPath();cx.ellipse(i*38+10,y-2,16,7,0,0,7);cx.fill();}return;}
 const B=BR[p.k],bi=B&&ok(B[0])?IM[B[0]]:null;
 if(bi){const dw=w*B[2],dh=dw*bi.naturalHeight/bi.naturalWidth,ty=dh*B[1];cx.save();
  if(p.fall){cx.globalAlpha=Math.max(0,1-p.fall*1.4);const sw=bi.naturalWidth/2;
   for(const s of [0,1]){cx.save();cx.translate(p.x+(s?dw/4:-dw/4),y);cx.rotate((s?1:-1)*Math.min(1,p.fall*3));cx.drawImage(bi,s*sw,0,sw,bi.naturalHeight,-dw/4,-ty,dw/2,dh);cx.restore();}
   cx.restore();return;}
  cx.drawImage(bi,p.x-dw/2,y-ty,dw,dh);cx.restore();}
 cx.save();
 if(!bi&&p.fall){cx.globalAlpha=Math.max(0,1-p.fall*1.4);
  for(const s of [-1,1]){cx.save();cx.translate(p.x+s*w/4,y+6);cx.rotate(s*Math.min(1,p.fall*3));cx.fillStyle="#7a6a55";rr(-w/4,-6,w/2,12,5);cx.fill();cx.restore();}
  cx.restore();return;}
 if(!bi){const col=p.k==="p"?["#8c7a62","#5c4d3a"]:p.k==="m"?["#7a6a2e","#4a3c12"]:["#8a5a2e","#4a2a10"];
 if(p.k==="m"){cx.strokeStyle="#3f8a2e";cx.lineWidth=3;for(const s of [-1,1]){cx.beginPath();cx.moveTo(p.x+s*(w/2-8),y);cx.quadraticCurveTo(p.x+s*(w/2-2),y-40,p.x+s*(w/2-10),y-90);cx.stroke();}}
 cx.fillStyle=col[1];rr(x0,y-1,w,15,7);cx.fill();cx.fillStyle=col[0];rr(x0,y-1,w,11,6);cx.fill();
 cx.fillStyle="rgba(255,255,255,.18)";rr(x0+6,y,w-12,3,2);cx.fill();
 if(p.k==="p"){cx.strokeStyle="#3a2e20";cx.lineWidth=2;cx.beginPath();cx.moveTo(p.x-4,y);cx.lineTo(p.x+3,y+5);cx.lineTo(p.x-2,y+9);cx.lineTo(p.x+4,y+14);cx.stroke();
  cx.fillStyle="#a8844a";cx.beginPath();cx.ellipse(x0+4,y+3,9,4,.5,0,7);cx.ellipse(x0+w-4,y+3,9,4,-.5,0,7);cx.fill();}
 else{cx.fillStyle=p.k==="m"?"#4caf50":"#2e9a4a";cx.beginPath();cx.ellipse(x0+2,y+2,13,6,.5,0,7);cx.ellipse(x0+w-2,y+2,13,6,-.5,0,7);cx.fill();
  if(p.k==="m"){cx.strokeStyle="#3f8a2e";cx.lineWidth=2;for(let i=8;i<w-4;i+=10){cx.beginPath();cx.moveTo(x0+i,y-1);cx.lineTo(x0+i+5,y+12);cx.stroke();}}}}
 // objets posés sur la branche
 if(p.it==="spring"&&ok("mush")){const sx=p.x+p.itx,k=p.sq>0?1+Math.sin(p.sq*25)*.18:1,mw=36*(2-k),mh=34*k;cx.drawImage(IM.mush,sx-mw/2,y+3-mh,mw,mh);}
 else if(p.it==="heli"&&ok("heli")){const sx=p.x+p.itx,sy=y-20+Math.sin(t*4+p.ph)*3;cx.drawImage(IM.heli,sx-18,sy-19,36,39);}
 else if(p.it==="shield"&&ok("bub")){const sx=p.x+p.itx,sy=y-20+Math.sin(t*4+p.ph)*3;cx.drawImage(IM.bub,sx-17,sy-16,34,32);}
 else if(p.it==="spring"){const sx=p.x+p.itx,k=p.sq>0?1+Math.sin(p.sq*25)*.18:1;
  cx.fillStyle="#f3ead8";rr(sx-6,y-14*k,12,14*k,3);cx.fill();
  cx.fillStyle="#d8342c";cx.beginPath();cx.ellipse(sx,y-14*k,17,11*k,0,Math.PI,0);cx.fill();
  cx.fillStyle="#fff";[[-8,-17],[2,-21],[9,-15]].forEach(([a,b])=>{cx.beginPath();cx.arc(sx+a,y+b*k,2.4,0,7);cx.fill();});}
 else if(p.it==="heli"){const sx=p.x+p.itx,sy=y-20+Math.sin(t*4+p.ph)*3;
  cx.fillStyle="#58c23a";cx.beginPath();cx.ellipse(sx,sy+4,13,8,0,0,7);cx.fill();cx.strokeStyle="#2e7a1f";cx.lineWidth=1.5;cx.beginPath();cx.moveTo(sx-11,sy+4);cx.lineTo(sx+11,sy+4);cx.stroke();
  cx.fillStyle="#6b4520";cx.fillRect(sx-1.5,sy-8,3,8);const a=Math.abs(Math.sin(t*20))*16+3;cx.fillStyle="#ffd23f";rr(sx-a,sy-10,a*2,4,2);cx.fill();}
 else if(p.it==="shield"){const sx=p.x+p.itx,sy=y-20+Math.sin(t*4+p.ph)*3;
  cx.fillStyle="rgba(143,211,255,.35)";cx.strokeStyle="#8fd3ff";cx.lineWidth=2.5;cx.beginPath();cx.arc(sx,sy,13,0,7);cx.fill();cx.stroke();
  cx.fillStyle="#fff";cx.beginPath();cx.arc(sx-4,sy-5,3,0,7);cx.fill();}
 if(p.snake&&ok("snake")){const sw=42,sh=sw*213/180,b=1+Math.sin(t*3+p.ph)*.04;cx.drawImage(IM.snake,p.x-sw/2,y+3-sh*b,sw,sh*b);}
 else if(p.snake){const sx=p.x,sy=y-2;cx.fillStyle="#3f9a3a";
  for(let i=0;i<3;i++){cx.beginPath();cx.ellipse(sx,sy-5-i*7,15-i*3,5.5,0,0,7);cx.fill();}
  cx.fillStyle="#2e7a2a";for(let i=0;i<3;i++){cx.beginPath();cx.arc(sx-8+i*8,sy-6-i*5,1.6,0,7);cx.fill();}
  const hx=sx+Math.sin(t*3+p.ph)*4,hy=sy-28;cx.fillStyle="#4caf50";cx.beginPath();cx.ellipse(hx,hy,9,7,0,0,7);cx.fill();
  cx.fillStyle="#fff";cx.beginPath();cx.arc(hx-3,hy-2,2.6,0,7);cx.arc(hx+3,hy-2,2.6,0,7);cx.fill();cx.fillStyle="#111";cx.beginPath();cx.arc(hx-3,hy-2,1.3,0,7);cx.arc(hx+3,hy-2,1.3,0,7);cx.fill();
  if(Math.sin(t*5+p.ph)>.3){cx.strokeStyle="#e53935";cx.lineWidth=1.6;cx.beginPath();cx.moveTo(hx,hy+5);cx.lineTo(hx,hy+11);cx.lineTo(hx-2,hy+13);cx.moveTo(hx,hy+11);cx.lineTo(hx+2,hy+13);cx.stroke();}}
 cx.restore();}
function toucan(o){const x=o.x,y=o.y-camY,d=o.vx>0?1:-1;cx.save();cx.translate(x,y);cx.scale(d,1);
 if(ok("tou")){const f=1+Math.sin(t*14+o.ph)*.08;cx.scale(1,f);cx.drawImage(IM.tou,-34,-17,68,35);cx.restore();return;}
 cx.fillStyle="#1b1b1f";cx.beginPath();cx.ellipse(0,0,18,12,0,0,7);cx.fill();
 cx.fillStyle="#fff3c4";cx.beginPath();cx.ellipse(8,2,7,8,0,0,7);cx.fill();
 const wf=Math.sin(t*16+o.ph)*9;cx.fillStyle="#2c2c34";cx.beginPath();cx.moveTo(-6,-2);cx.lineTo(-18,-4-wf);cx.lineTo(2,-4);cx.fill();
 cx.fillStyle="#ff8a1f";cx.beginPath();cx.moveTo(12,-6);cx.quadraticCurveTo(34,-6,36,2);cx.quadraticCurveTo(24,4,12,2);cx.fill();
 cx.fillStyle="#111";cx.fillRect(33,-2,3,4);cx.fillStyle="#fff";cx.beginPath();cx.arc(10,-5,3,0,7);cx.fill();cx.fillStyle="#111";cx.beginPath();cx.arc(10.8,-5,1.5,0,7);cx.fill();
 cx.fillStyle="#1b1b1f";cx.beginPath();cx.moveTo(-16,0);cx.lineTo(-28,6);cx.lineTo(-16,6);cx.fill();cx.restore();}
function coco(o){if(o.warn>0){const a=.5+.5*Math.sin(t*20);cx.fillStyle=`rgba(229,57,53,${.6+.4*a})`;cx.beginPath();cx.moveTo(o.x,8);cx.lineTo(o.x-11,28);cx.lineTo(o.x+11,28);cx.fill();
  cx.fillStyle="#fff";cx.font='700 14px Quicksand,sans-serif';cx.textAlign="center";cx.fillText("!",o.x,25);return;}
 const y=o.y-camY;if(ok("coco")){cx.drawImage(IM.coco,o.x-18,y-31,36,50);return;}
 cx.save();cx.translate(o.x,y);cx.rotate(t*5);cx.fillStyle="#6b4520";cx.beginPath();cx.arc(0,0,14,0,7);cx.fill();
 cx.strokeStyle="#3b2410";cx.lineWidth=2;cx.beginPath();cx.arc(0,0,14,0,7);cx.stroke();cx.fillStyle="#2a1a0c";[[-4,-4],[4,-4],[0,3]].forEach(([a,b])=>{cx.beginPath();cx.arc(a,b,2.2,0,7);cx.fill();});cx.restore();}
function monkey(){const y=my-camY;cx.save();cx.translate(mx,y);
 if(mode==="dead"){cx.rotate(Math.min(.6,(t-deadAt)*2));if(ok("fall"))cx.drawImage(IM.fall,-38,-76,76,76);else{cx.fillStyle="#8a5a2e";cx.beginPath();cx.arc(0,-30,24,0,7);cx.fill();}cx.restore();return;}
 const k=squash>0?1-squash*1.6:1,sx=(2-k)*face,sy=k;cx.scale(sx,sy);
 if(shield){cx.fillStyle="rgba(143,211,255,.22)";cx.strokeStyle=`rgba(143,211,255,${.6+.3*Math.sin(t*6)})`;cx.lineWidth=3;cx.beginPath();cx.arc(0,-MH/2,40,0,7);cx.fill();cx.stroke();}
 if(ok("jump"))cx.drawImage(IM.jump,-MW/2,-MH,MW,MH);else{cx.fillStyle="#8a5a2e";cx.beginPath();cx.arc(0,-30,24,0,7);cx.fill();}
 if(heli>0&&ok("heli")){cx.save();cx.translate(0,-MH+8);cx.rotate(Math.sin(t*18)*.08);cx.drawImage(IM.heli,-22,-40,44,47);cx.restore();}
 else if(heli>0){cx.fillStyle="#58c23a";cx.beginPath();cx.ellipse(0,-MH-4,16,6,0,0,7);cx.fill();cx.fillStyle="#6b4520";cx.fillRect(-1.5,-MH-14,3,10);
  const a=Math.abs(Math.sin(t*30))*26+4;cx.fillStyle="#ffd23f";rr(-a,-MH-17,a*2,5,2);cx.fill();}
 cx.restore();}
function draw(){const k=cv.width/W;cx.setTransform(k,0,0,k,0,0);
 cx.save();if(shake>0&&!reduce)cx.translate((Math.random()-.5)*shake*30,(Math.random()-.5)*shake*30);
 bg();for(const p of plats)branch(p);
 for(const b of bans){const y=b.y-camY+Math.sin(t*4+b.ph)*3;if(y<-30||y>H+30)continue;if(ok("banana"))cx.drawImage(IM.banana,b.x-19,y-19,38,37);else{cx.fillStyle="#ffd23f";cx.beginPath();cx.arc(b.x,y,11,0,7);cx.fill();}}
 for(const o of tous)toucan(o);for(const o of cocos)coco(o);
 monkey();
 for(const p of parts){cx.globalAlpha=Math.max(0,p.l*1.8);cx.fillStyle=p.c||"#fff";cx.beginPath();cx.arc(p.x,p.y-camY,3,0,7);cx.fill();}cx.globalAlpha=1;
 if(flash>0){cx.fillStyle=`rgba(143,211,255,${flash*.6})`;cx.fillRect(0,0,W,H);}
 if(mode==="play"||(mode==="dead"&&view===null)){
  cx.textAlign="center";cx.lineWidth=6;cx.strokeStyle="#1d3b23";cx.font='48px "Titan One",sans-serif';cx.strokeText(score,W/2,70);cx.fillStyle="#fff";cx.fillText(score,W/2,70);
  cx.font='700 14px Quicksand,sans-serif';cx.lineWidth=4;const sub=`${Math.floor(hmax)} m · 🍌 ${nBan}`;cx.strokeText(sub,W/2,92);cx.fillStyle="#ffe7a8";cx.fillText(sub,W/2,92);
  if(heli>0){cx.fillStyle="rgba(0,0,0,.35)";rr(W/2-50,102,100,8,4);cx.fill();cx.fillStyle="#8fe36b";rr(W/2-50,102,100*heli/HELI_T,8,4);cx.fill();}
  if(mode==="play"&&playT<3&&(ctrl==="touch"||!coarse)){cx.globalAlpha=Math.min(1,(3-playT))*.55;cx.fillStyle="#fff";cx.font='40px "Titan One",sans-serif';
   if(coarse){cx.fillText("◀",44,H-40);cx.fillText("▶",W-44,H-40);}else{cx.font='700 15px Quicksand,sans-serif';cx.fillText("← → pour diriger le singe",W/2,H-30);}cx.globalAlpha=1;}}
 cx.restore();}
function fit(){const m=$(".jp-main"),c=$(".jp-cab");if(!m||!c)return;const cs=getComputedStyle(m);
 const aw=m.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-16,ah=m.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)-16;
 let h=Math.max(120,ah),w=h*W/H;if(w>aw){w=Math.max(80,aw);h=w*H/W;}c.style.width=Math.floor(w+16)+"px";c.style.height=Math.floor(h+16)+"px";}
function size(){if(!cv)return;fit();const r=cv.getBoundingClientRect();if(!r.width)return;dpr=Math.min(2,window.devicePixelRatio||1);
 const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}draw();}
function loop(n){raf=0;if(!root||root.hidden)return;const dt=Math.min((n-last)/1000,1/30);last=n;
 // pas fixes de 1/120 s : les atterrissages restent fiables même si le téléphone rame
 let r=dt;while(r>1e-6){const s=Math.min(r,1/120);update(s);r-=s;}draw();raf=requestAnimationFrame(loop);}
function run(){if(!raf){last=performance.now();raf=requestAnimationFrame(loop);}}

/* ---------- une partie ---------- */
async function go(){
 if(busy||mode==="play"||!S)return;ac();if(ctrl==="tilt")askTilt();busy=true;render();
 try{const r=await rpc("mf_jump_start");token=r.token;take(r.info);
  reset();mode="play";busy=false;show(null);render();beep(330,0,.08,.025,"triangle",520);
  if(+r.cost>0)toast(`Partie payée : ${r.cost} 🍌`);
 }catch(e){busy=false;toast(errText(e));render();rpc("mf_jump_status").then(x=>{take(x);render();},()=>{});}
}
const WHY={fall:"Gros plongeon dans la jungle !",snake:"Mordu par un serpent !",toucan:"Percuté par un toucan !",coco:"Bonk ! Une noix de coco !"};
function die(k){if(mode!=="play")return;mode="dead";why=k||"fall";deadAt=t;shake=k==="fall"?0:.35;vy=k==="fall"?300:-300;ptrs.clear();
 vib(k==="fall"?[30,40,30]:[40,30,80]);beep(k==="fall"?600:200,0,.5,.05,"sawtooth",k==="fall"?90:60);send(score);}
async function send(sc){
 const tk=token;token=null;busy=true;let r=null,err=null;
 for(let i=0;i<3&&!r;i++){try{r=await rpc("mf_jump_end",{p_token:tk,p_score:sc});}catch(e){err=e;if(String(e&&e.message||e).includes("jump_token"))break;await new Promise(z=>setTimeout(z,800*(i+1)));}}
 busy=false;
 const res=!r?{t:"Score non envoyé : "+errText(err),w:false}
  :r.why==="jump_bad"?{t:"Cette partie n'a pas été comptée.",w:false}
  :r.why==="jump_late"?{t:"La manche était déjà terminée : cette partie ne compte pas.",w:false}
  :r.newBest?{t:`Meilleure partie de la manche !${r.rank?` Tu es ${r.rank===1?"1er":r.rank+"e"}.`:" (hors classement)"}`,w:true}
  :{t:`Ta meilleure partie reste ${S&&S.myBest!=null?S.myBest:"—"} points${r.rank?` · ${r.rank===1?"1er":r.rank+"e"}`:""}.`,w:false};
 if(r){take(r.info);render();}
 if(r&&r.newBest)[523,659,784,1047].forEach((f,i)=>beep(f,i*.08,.16,.05,"triangle"));
 const h=Math.floor(hmax),b=nBan;
 setTimeout(()=>{if(mode==="dead")show("end",{score:sc,h,b,res});},Math.max(0,700-(t-deadAt)*1000));
}

/* ---------- écrans par-dessus le jeu ---------- */
function boardHTML(list,title,note){const me=S&&S.me;
 const rows=(list||[]).slice(0,10).map(x=>`<li class="${x.uid===me?"me":""}"><span class="rk">${MED[x.rank-1]||esc(x.rank)}</span><span class="nm">${esc(x.name||"?")}${x.uid===me?" (toi)":""}</span><span class="sc">${esc(x.best)}</span><span class="rw">${esc(rew(x))}</span></li>`).join("");
 return `<div class="jp-board"><h4>${esc(title)}<small>${esc(note||"")}</small></h4>${rows?`<ol>${rows}</ol>`:`<div class="empty">Personne n'a encore grimpé dans cette manche. À toi d'ouvrir le bal !</div>`}</div>`;}
function goLabel(){if(!S)return["…",true];if(+S.left<=0)return["Plus de parties",true];const bn=S.state?+S.state.bananas:0;
 if(+S.freeLeft>0)return["Grimper · partie gratuite",false];if(bn<+S.price)return["Pas assez de bananes",true];return[`Grimper · ${S.price} 🍌`,false];}
function ctrlHTML(){if(!coarse)return `<div class="jp-ctrl">Clavier : ← → (ou Q / D) pour diriger le singe</div>`;
 return `<div class="jp-ctrl" role="group" aria-label="Commandes">Commandes :<button type="button" data-c="touch" aria-pressed="${ctrl==="touch"}">👆 Toucher</button><button type="button" data-c="tilt" aria-pressed="${ctrl==="tilt"}">📱 Pencher</button></div>`;}
function menuHTML(){const [lab,dis]=goLabel(),end=S?+S.endsAt-nowS():0;
 const sub=!S?"":(+S.left<=0?`Nouvelles parties à 18 h (dans ${dur(end)})`:`Parties : ${S.left}/${S.max} · classement à 18 h (dans ${dur(end)})`);
 return `<button type="button" class="jp-big" id="jpGo"${dis||busy?" disabled":""}>${esc(busy?"…":lab)}</button><div class="jp-sub">${esc(sub)}</div>${ctrlHTML()}
  ${S&&S.myBest!=null?`<div class="jp-res">Ta meilleure partie de la manche : <b>${esc(S.myBest)}</b></div>`:""}
  ${boardHTML(S&&S.board,"Classement de la manche",S?"jusqu'à 18 h":"")}`;}
let view="menu",vdata=null;
function show(v,d){view=v;vdata=d||null;const o=$(".jp-ov");if(!v){o.hidden=true;return;}o.hidden=false;
 if(v==="menu")o.innerHTML=`<h3>Jusqu'où iras-tu ?</h3>${menuHTML()}`;
 else if(v==="end")o.innerHTML=`<h3>${esc(WHY[why]||WHY.fall)}</h3><div class="jp-score">${esc(d.score)}</div><div class="jp-sub">${esc(d.h)} m grimpés · ${esc(d.b)} banane${d.b>1?"s":""}</div><div class="jp-res${d.res.w?" win":""}">${esc(d.res.t)}</div>${menuHTML()}`;
 else if(v==="last"){const L=S.last,m=L.me||{},rk=+m.rank||0,got=rew(m);
  o.innerHTML=`<h3>Résultat de la manche</h3><div class="jp-score">${rk?(MED[rk-1]||rk+"e"):"—"}</div>
   <div class="jp-res${got?" win":""}">${rk?`Tu as fini ${rk===1?"1er":rk+"e"} avec ${esc(m.best)} point${+m.best>1?"s":""}`:""}${got?` : +${esc(got)} !`:"."}</div>
   <button type="button" class="jp-big" id="jpOk">Continuer</button>${boardHTML(L.board,"Classement final",fmtRound(L.round))}`;
  const b=o.querySelector("#jpOk");b.addEventListener("click",()=>{rpc("mf_jump_seen",{p_round:L.round}).then(x=>{take(x);},()=>{});S.last.seen=true;show("menu");});b.focus({preventScroll:true});return;}
 const g=o.querySelector("#jpGo");if(g)g.addEventListener("click",go);
 o.querySelectorAll(".jp-ctrl button").forEach(b=>b.addEventListener("click",()=>setCtrl(b.dataset.c)));}
const fmtRound=d=>{try{const [Y,M,D]=String(d).split("-").map(Number);const p=new Date(Y,M-1,D-1);return `du ${p.getDate()}/${p.getMonth()+1} 18 h au ${D}/${M} 18 h`;}catch(e){return "";}};
function render(){if(!root)return;const st=S&&S.state;
 $("#jpBan").textContent=st?st.bananas:"…";$("#jpLeft").textContent=S?`${S.left}/${S.max}`:"…";
 if(view==="menu"||view==="end")show(view,vdata);
 if(S){$("#jpHist").innerHTML=(S.hist||[]).map(h=>`<li>${esc(h)}</li>`).join("");
  $("#jpRw").innerHTML=(S.rewards||[]).map((x,i)=>`<tr><td>${MED[i]||(i+1)+"e"}</td><td>${esc(rew(x))}</td></tr>`).join("")+`<tr><td>${(S.rewards||[]).length+1}e et après</td><td>rien</td></tr>`;
  $("#jpBestAll").textContent=S.bestAll||0;}
 if(ADMIN&&S){const o=$("#jpOpen");o.textContent=S.open?"Cacher aux joueurs":"Ouvrir à tous les joueurs";o.classList.toggle("on",!S.open);
  $("#jpState").textContent=S.open?"Monkey Jump est ouvert à tous les joueurs (dans l'Arène).":"Monkey Jump est visible par toi seulement.";}}
let tt=0;function toast(m){if(!root)return;const e=$(".jp-toast");e.textContent=m;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500);}
function panel(o){$("#jpPanel").classList.toggle("open",o);$("#jpTog").setAttribute("aria-expanded",String(o));}
async function adm(a,m){try{take(await rpc("mf_jump_admin",{p_action:a}));render();if(m)toast(m);}catch(e){toast(errText(e));}}

/* ---------- construction ---------- */
function build(){
 const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
 root=document.createElement("div");root.id="mfJUMP";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Monkey Jump");
 root.innerHTML=`<div class="jp-top"><button type="button" class="jp-btn l" id="jpTog" aria-controls="jpPanel" aria-expanded="false" aria-label="Règles">?</button>
  <h2 style="margin:0">${LOGO?`<img class="jp-logo" src="${LOGO}" alt="Monkey Jump">`:""}<span class="jp-logoT"${LOGO?" hidden":""}>Monkey Jump</span></h2>
  <div class="jp-chips"><span class="jp-chip">🍌 <b id="jpBan">…</b></span><span class="jp-chip">Parties <b id="jpLeft">…</b></span></div>
  <button type="button" class="jp-btn r" id="jpClose" aria-label="Fermer">✕</button></div>
 <div class="jp-main"><div class="jp-cab"><div class="jp-scr" id="jpScr" aria-label="Zone de jeu : touche la gauche ou la droite de l'écran pour diriger le singe">
  <canvas></canvas><div class="jp-ov" aria-live="polite"></div></div></div></div>
 <aside class="jp-panel" id="jpPanel" aria-label="Règles et réglages">
  <div class="jp-ph"><h3>Règles</h3><button type="button" class="jp-btn" style="position:static" id="jpPanelX" aria-label="Fermer les règles">✕</button></div>
  <ul class="r">
   <li>Le singe saute tout seul de branche en branche. Dirige-le à gauche ou à droite : <b>touche un côté de l'écran</b> ou <b>penche ton téléphone</b> (au choix, sur l'écran d'accueil). Au clavier : ← →. En sortant d'un côté de l'écran, il revient par l'autre.</li>
   <li>Les <b>branches grises fendues</b> cassent sous ses pieds, les <b>lianes</b> bougent, le <b>champignon rouge</b> envoie très haut.</li>
   <li>Bonus : la <b>feuille-hélice</b> fait monter quelques secondes sans rien craindre, la <b>bulle</b> protège d'un coup.</li>
   <li>Dangers : serpents, toucans (on peut leur sauter dessus) et noix de coco qui tombent (un ❗ rouge prévient).</li>
   <li><b>1 point par mètre</b> grimpé, <b>5 points</b> par banane. Si le singe tombe en bas de l'écran, la partie est finie.</li>
   <li>Une <b>manche</b> va de 18 h à 18 h. <b>5 parties</b> par manche : la 1re est <b>gratuite</b>, les suivantes coûtent <b>1 🍌</b>. Seule ta <b>meilleure partie</b> compte ; égalité : le premier à avoir fait ce score passe devant.</li>
   <li>Chaque soir à <b>18 h</b>, le classement est figé et les récompenses arrivent toutes seules sur ton compte.</li>
  </ul>
  <h3>Récompenses de 18 h</h3><table class="jp-rw"><tbody id="jpRw"></tbody></table>
  <p>Ton record de tous les temps : <b id="jpBestAll">0</b></p>
  <h3>Dernières parties</h3><ul class="jp-hist" id="jpHist"></ul>
  <div id="jpAdm" hidden><h3>Réglages admin</h3><p id="jpState"></p>
   <div class="jp-btns"><button type="button" id="jpOpen"></button></div>
   <div class="jp-btns"><button type="button" id="jpReset">Rendre mes parties de la manche</button><button type="button" id="jpAdd">+50 🍌</button></div></div>
 </aside>
 <div class="jp-toast" role="status"></div>`;
 document.body.appendChild(root);
 $("#jpAdm").hidden=!ADMIN;
 cv=$("canvas");cx=cv.getContext("2d");
 const lg=$(".jp-logo");if(lg){const noLogo=()=>{lg.hidden=true;$(".jp-logoT").hidden=false;};lg.onerror=noLogo;if(lg.complete&&!lg.naturalWidth)noLogo();}
 Object.entries(IMG).forEach(([k,u])=>{const i=new Image();i.src=u;IM[k]=i;});
 try{new ResizeObserver(size).observe($(".jp-main"));}catch(e){addEventListener("resize",size);}
 const scr=$("#jpScr"),side=e=>{const r=scr.getBoundingClientRect();return e.clientX<r.left+r.width/2?-1:1;};
 scr.addEventListener("pointerdown",e=>{if(mode!=="play")return;e.preventDefault();if(ctrl==="tilt")return;ptrs.set(e.pointerId,side(e));try{scr.setPointerCapture(e.pointerId);}catch(x){}});
 scr.addEventListener("pointermove",e=>{if(ptrs.has(e.pointerId)){ptrs.delete(e.pointerId);ptrs.set(e.pointerId,side(e));}});
 ["pointerup","pointercancel","lostpointercapture"].forEach(n=>scr.addEventListener(n,e=>ptrs.delete(e.pointerId)));
 scr.addEventListener("contextmenu",e=>{if(mode==="play")e.preventDefault();});
 const K=(e,v)=>{const c=e.code;if(c==="ArrowLeft"||c==="KeyA"||c==="KeyQ"){keyL=v;if(mode==="play")e.preventDefault();}else if(c==="ArrowRight"||c==="KeyD"){keyR=v;if(mode==="play")e.preventDefault();}};
 // au clavier, sur toute la page tant que le jeu est ouvert (le bouton « Grimper » disparaît en début de partie et emporte le focus)
 document.addEventListener("keydown",e=>{if(!root||root.hidden)return;
  if(e.key==="Escape"){if($("#jpPanel").classList.contains("open"))panel(false);else close();return;}K(e,true);});
 document.addEventListener("keyup",e=>{if(root&&!root.hidden)K(e,false);});
 addEventListener("blur",()=>{keyL=keyR=false;ptrs.clear();});
 $("#jpClose").addEventListener("click",close);
 $("#jpTog").addEventListener("click",()=>panel(!$("#jpPanel").classList.contains("open")));
 $("#jpPanelX").addEventListener("click",()=>{panel(false);$("#jpTog").focus({preventScroll:true});});
 $("#jpOpen").addEventListener("click",()=>adm(S&&S.open?"close":"open",S&&S.open?"Monkey Jump est de nouveau caché.":"Monkey Jump est ouvert à tous les joueurs."));
 $("#jpReset").addEventListener("click",()=>adm("reset","Tes parties de la manche sont rendues."));
 $("#jpAdd").addEventListener("click",()=>adm("bananas","+50 🍌 sur ton compte."));
 setInterval(()=>{if(root&&!root.hidden&&mode!=="play"&&(view==="menu"||view==="end"))render();},30000);
}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
 if(!root)build();if(!root.hidden)return;
 root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 mode="menu";reset();vy=0;show("menu");render();size();run();$("#jpClose").focus({preventScroll:true});
 if(ctrl==="tilt"&&!(window.DeviceOrientationEvent&&typeof window.DeviceOrientationEvent.requestPermission==="function"))askTilt();
 try{take(await rpc("mf_jump_status"));render();if(S.last&&!S.last.seen)show("last");}catch(e){toast(errText(e));}
}
function close(){
 if(mode==="play"){toast("Termine ta partie d'abord !");return;}
 if(busy&&mode==="dead"){toast("Envoi du score…");return;}
 panel(false);root.hidden=true;mode="menu";document.body.style.overflow=prevOverflow;if(opener&&opener.focus)opener.focus();
}
// l'appli passe en arrière-plan pendant une partie : on la termine (le score part quand même)
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&mode==="play")die("fall");});

/* ---------- démarrage : le jeu s'inscrit dans l'Arène ---------- */
async function boot(){
 if(!window.claude||!window.claude.use)return;
 try{USER=await window.claude.use("user");}catch(e){}
 if(!USER||typeof window.MF_RPC!=="function")return;
 try{ADMIN=!!(await USER.isOwner());}catch(e){}
 let can=ADMIN;if(!can){try{can=!!(await rpc("mf_jump_open"));}catch(e){}}
 if(!can||!window.MF_CASINO)return;
 Object.values(IMG).forEach(u=>{const i=new Image();i.src=u;});
 window.MF_CASINO.add({id:"jump",name:"Monkey Jump",order:15,root:"mfJUMP",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20V4M7 9l5-5 5 5"/><path d="M3 15h6M15 19h6M15 11h5"/></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){const r=await rpc("mf_jump_status");take(r);}const I=S;if(!I)return null;
   const end=+I.endsAt-nowS(),unseen=!!(I.last&&!I.last.seen),me=(I.board||[]).find(x=>x.uid===I.me);
   const pos=me?` · tu es ${me.rank===1?"1er":me.rank+"e"}`:"";
   if(unseen)return {line:"Résultat de la manche à voir !",hot:true};
   if(+I.freeLeft>0)return {line:"Partie gratuite disponible"+pos,pre:"Classement dans ",in:end,hot:true};
   if(+I.left>0)return {line:`Encore ${I.left} partie${+I.left>1?"s":""} · ${I.price} 🍌 la partie${pos}`,pre:"Classement dans ",in:end,hot:false};
   return {line:"Plus de parties dans cette manche"+pos,pre:"Classement dans ",in:end,hot:false};}});
}
window.MF_JUMP={open};
if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname))window.MF_JUMP._test={st:()=>({mode,mx,my,vy,camY,hmax,score,nBan,plats:plats.length,heli,shield,why}),lift:m=>{startY+=m*PXM;},spawn:()=>{const y=camY+H*.5;addPlat(90,y,"n",{it:"spring",itx:0});addPlat(330,y,"n",{it:"heli",itx:0});addPlat(90,y-140,"n",{it:"shield",itx:0});addPlat(330,y-140,"n",{snake:true});addPlat(210,y+120,"p");addPlat(210,y-260,"m");tous.push({x:120,y:camY+110,vx:150,dead:false,ph:0});cocos.push({x:300,y:camY+200,vy:0,warn:0,dead:false},{x:60,y:0,vy:0,warn:5,dead:false});},world:()=>({mx,my,vy,heli,plats:plats.filter(p=>!p.fall).map(p=>({x:p.x,y:p.y,k:p.k,w:p.w,s:p.snake,g:!!p.ground,it:p.it})),tous:tous.map(o=>({x:o.x,y:o.y})),cocos:cocos.map(o=>({x:o.x,y:o.y,w:o.warn}))})};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

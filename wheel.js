/* Monkey Family — The Monkey Wheel (roue de la fortune du Casino)
   1 tour doré gratuit par jour + 5 tours payants à 1 🍌 (la banane va dans la cagnotte commune).
   Le tirage, les gains, le quitte ou double et le Monkey Scam sont décidés par le serveur (mf_wheel_*, supabase-roue.sql) :
   la page fait tourner la roue jusqu'à la case renvoyée. L'ordre des cases ci-dessous doit rester celui du serveur.
   Visible par l'admin seulement tant que la roue n'est pas ouverte à tous (réglages admin → « Ouvrir à tous »). */
(function(){
"use strict";

/* ---------- cases (même ordre que _wheel_seg côté serveur) ---------- */
const PZ={
 P:{ic:"✕",lab:"Perdu",k:"lose",c:"#2d2544",f:"#a79fc0"},
 b1:{ic:"🍌",lab:"1 🍌",k:"ban",v:1,c:"#ffd23f",f:"#3a2300"},
 b2:{ic:"2🍌",lab:"2 🍌",k:"ban",v:2,c:"#ffa62b",f:"#3a1d00"},
 b5:{ic:"5🍌",lab:"5 🍌",k:"ban",v:5,c:"#e84a5f",f:"#fff"},
 b10:{ic:"10🍌",lab:"10 🍌",k:"ban",v:10,c:"#7b5cff",f:"#fff"},
 b25:{ic:"25🍌",lab:"25 🍌",k:"ban",v:25,c:"#19b5a5",f:"#fff"},
 R:{ic:"↻",lab:"Relance",k:"relance",c:"#3a8dff",f:"#fff"},
 T:{ic:"⏳",lab:"−2 h d'attente",k:"time",v:120,c:"#5bc0eb",f:"#0b2a3a"},
 BB:{ic:"🎴🎴",lab:"2 boosters",k:"boost",v:2,c:"#0b8a5f",f:"#fff"},
 J:{ic:"💰",lab:"Jackpot",k:"jackpot",c:"#fff2b3",f:"#5a3a00"},
 OR:{ic:"×2",lab:"Doublé",k:"or",c:"#ffd23f",f:"#3a2300"},
 NO:{ic:"✕",lab:"Perdu",k:"noir",c:"#15111f",f:"#ffd23f"}};
const WH={
 main:{name:"Roue normale",seg:"J P b1 P b5 P T P b2 P b1 R P b10 P b1 P BB P b2 P b5 P b1".split(" ")},
 gold:{name:"Roue dorée",seg:"J P b2 b5 b2 T b10 b2 P b5 BB b2 b25 b5 P b2 b10 b5 b2 P".split(" "),
  col:{P:["#5a4214","#f5deb3"],b2:["#f7d774","#3a2300"],b5:["#e9b949","#3a2300"],b10:["#c9971a","#fff"],b25:["#fff2b3","#5a3a00"]}},
 qod:{name:"Quitte ou double",seg:"OR NO OR NO OR NO OR NO OR NO".split(" ")}};
const IMG={fond:"packs/roue-fond.webp",cadre:"packs/roue-cadre.webp",ptr:"packs/roue-pointeur.webp",logo:"packs/roue-logo.webp",scam:"packs/monkey-scam.webp",scam2:"packs/monkey-scam-ferme.webp"};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR={no_bananas:"Pas assez de bananes.",wheel_limit:"Plus de tours aujourd'hui : reviens demain !",wheel_free_used:"Tu as déjà pris ton tour doré aujourd'hui.",
 wheel_closed:"La roue n'est pas encore ouverte.",wheel_pending:"Choisis d'abord : garder ton gain ou le doubler.",wheel_no_relance:"Tu n'as pas de relance.",
 wheel_nothing:"Rien à doubler.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const TAU=Math.PI*2,mod=(a,m)=>((a%m)+m)%m;

/* ---------- style ---------- */
const CSS=`
#mfWheel{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;color:#f1edf9;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:radial-gradient(120% 60% at 50% 0,#2c2148,#15111f 60%)}
#mfWheel[hidden]{display:none}
#mfWheel *{box-sizing:border-box;min-width:0}
.wh-top{flex:none;position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;padding:max(8px,env(safe-area-inset-top)) 58px 6px}
.wh-logo{display:block;height:clamp(58px,11svh,120px);width:auto;max-width:100%;filter:drop-shadow(0 8px 12px rgba(0,0,0,.5))}
.wh-btn{position:absolute;top:max(8px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(20,18,32,.75);color:#ffd23f;font:700 19px Quicksand,sans-serif;cursor:pointer;display:grid;place-items:center}
.wh-btn.l{left:10px}.wh-btn.r{right:10px}
.wh-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px}
.wh-chip{background:#211a33;border:1px solid #3a2f57;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13.5px;white-space:nowrap}
.wh-chip b{color:#ffd23f}
.wh-scene{flex:1;min-height:0;width:min(100%,640px);position:relative;display:flex;flex-direction:column;align-items:center;background:#2a1640 url(${IMG.fond}) center 40%/cover;padding:6px 10px max(10px,env(safe-area-inset-bottom))}
.wh-mode{flex:none;position:relative;z-index:4;background:rgba(21,17,31,.82);border:1px solid rgba(255,210,63,.5);border-radius:999px;padding:3px 14px;white-space:nowrap;font:400 17px "Titan One",sans-serif}
.wh-mode[data-m=gold]{color:#ffd23f}
.wh-area{flex:1;min-height:0;width:100%;display:grid;place-items:center}
.wh-box{position:relative;width:300px;height:300px}
.wh-box canvas{position:absolute;left:10.4%;top:12.4%;width:78.1%;height:78.1%;touch-action:none;border-radius:50%;cursor:grab}
.wh-box[data-m=gold] canvas{box-shadow:0 0 40px rgba(255,210,63,.45)}
.wh-frame{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}
.wh-frame.flash{animation:whFl .35s 4 alternate}@keyframes whFl{to{filter:brightness(1.5) drop-shadow(0 0 14px #ffd23f)}}
.wh-ptr{position:absolute;left:40%;top:-4.1%;width:20%;height:20%;z-index:2;transform-origin:50% 28%;transition:transform .06s;filter:drop-shadow(0 3px 3px rgba(0,0,0,.5));pointer-events:none}
.wh-ptr.flick{transform:rotate(-16deg)}
.wh-act{flex:none;position:relative;z-index:3;text-align:center;width:100%}
.wh-sub{color:#fff;text-shadow:0 1px 3px #000,0 0 8px #000;font-size:13px;margin-top:6px;font-weight:700}
.wh-big{min-height:52px;padding:10px 26px;border-radius:16px;border:0;background:#ffd23f;color:#2a1145;font:400 20px "Titan One",sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8901a}
.wh-big:active{transform:translateY(2px);box-shadow:0 2px 0 #b8901a}
.wh-big:disabled{background:#4a4060;color:#9d93b8;box-shadow:none;cursor:default}
.wh-ghost{min-height:52px;padding:10px 18px;border-radius:16px;border:2px solid #ffd23f;background:transparent;color:#ffd23f;font:700 16px Quicksand,sans-serif;cursor:pointer}
#mfWheel button:focus-visible,#mfWheel select:focus-visible,#mfWheel input:focus-visible{outline:3px solid #8fd3ff;outline-offset:2px}
.wh-res{position:absolute;left:6%;right:6%;top:42%;z-index:5;background:rgba(33,26,51,.96);box-shadow:0 10px 30px rgba(0,0,0,.5);border:1px solid #3a2f57;border-radius:18px;padding:14px 16px;text-align:center;cursor:pointer}
.wh-res[hidden]{display:none}
.wh-res .wh-rt{font:400 24px/1.15 "Titan One",sans-serif;color:#ffd23f}
.wh-res .wh-rt.lose{color:#b3a8cc}
.wh-res .wh-rs{color:#d9d1ec;font-size:14.5px;margin-top:4px}
.wh-res .wh-rrow{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:12px}
.wh-res .wh-rrow:empty{display:none}
.wh-side{position:absolute;top:0;left:0;bottom:0;z-index:30;width:min(400px,100%);overflow-y:auto;overscroll-behavior:contain;background:#1a1429;border-right:1px solid #3a2f57;
 padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s;visibility:hidden}
.wh-side.open{transform:none;visibility:visible}
.wh-sh{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.wh-side h3{font:400 19px "Titan One",sans-serif;color:#ffd23f;margin:14px 0 6px}
.wh-sh h3{margin:0}
.wh-side p{margin:4px 0;color:#c9c0de;font-size:14px}
.wh-side table{width:100%;border-collapse:collapse;font-size:14px;margin:4px 0 8px}
.wh-side td{padding:4px 0;border-bottom:1px solid #2e2546}.wh-side td:last-child{text-align:right;white-space:nowrap}
.wh-dot{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.wh-hist{list-style:none;margin:0;padding:0;font-size:14px}
.wh-hist li{padding:5px 0;border-bottom:1px solid #2e2546}
.wh-hist:empty::after{content:"Aucun tour pour l'instant.";color:#a79fc0}
.wh-adm[hidden]{display:none}
.wh-adm label{display:block;margin:10px 0 4px;font-weight:700;font-size:14px}
.wh-adm select{width:100%;min-height:44px;font:16px Quicksand,sans-serif;border-radius:10px;border:1px solid #4a3a78;background:#15111f;color:#f1edf9;padding:0 10px}
.wh-chk{display:flex!important;gap:8px;align-items:center;font-weight:700;font-size:14px}
.wh-chk input{width:22px;height:22px}
.wh-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.wh-btns button{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid #4a3a78;background:#2c2148;color:#f1edf9;font:700 14px Quicksand,sans-serif;cursor:pointer}
.wh-btns button.on{background:#ffd23f;color:#2a1145;border-color:#ffd23f}
.wh-toast{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));z-index:40;transform:translate(-50%,12px);background:#2c2148;border:1px solid #ffd23f;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;max-width:92%;transition:transform .3s,opacity .3s;pointer-events:none;opacity:0}
.wh-toast.on{transform:translate(-50%,0);opacity:1}
.wh-scam{position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:radial-gradient(circle at 50% 45%,rgba(255,61,154,.55),rgba(21,17,31,.92) 70%);animation:whIn .25s ease-out;overflow:hidden;cursor:pointer}
.wh-scam[hidden]{display:none}
.wh-monk{position:relative;width:min(72%,330px,46svh);filter:drop-shadow(0 10px 18px rgba(0,0,0,.55));animation:whPop .6s cubic-bezier(.2,1.6,.4,1) both,whTaunt .32s .6s infinite alternate ease-in-out;transform-origin:50% 90%}
.wh-monk img{display:block;width:100%;height:auto}
.wh-monk .m2{position:absolute;inset:0;opacity:0;animation:whBlep .44s steps(1) .6s infinite}
.wh-scamT{font:400 clamp(26px,8vw,40px)/1.05 "Titan One",sans-serif;text-align:center;color:#fff;transform:rotate(-4deg);text-shadow:0 3px 0 #a81f63,0 0 18px rgba(0,0,0,.6);animation:whPop .5s .35s cubic-bezier(.2,1.6,.4,1) both}
.wh-scamT b{font-weight:400;color:#ffd23f;font-size:1.25em}
.wh-scamS{font-weight:700;color:#f1edf9;text-shadow:0 1px 3px #000;opacity:0;animation:whIn .4s 2s forwards;padding:0 16px;text-align:center}
@keyframes whPop{from{transform:translateY(60%) scale(.4);opacity:0}to{opacity:1}}
@keyframes whTaunt{from{transform:rotate(-5deg)}to{transform:rotate(5deg) scale(1.04)}}
@keyframes whBlep{0%{opacity:0}50%{opacity:1}}
@keyframes whIn{from{opacity:0}to{opacity:1}}
@media(min-width:660px){.wh-scene{border-radius:22px 22px 0 0;box-shadow:0 -6px 30px rgba(0,0,0,.4)}}
@media(prefers-reduced-motion:reduce){.wh-monk,.wh-monk .m2,.wh-scamT,.wh-frame.flash{animation:none}.wh-scamS{animation:none;opacity:1}.wh-toast,.wh-ptr,.wh-side{transition:none}}
`;

/* ---------- état ---------- */
let root=null,USER=null,ADMIN=false,S=null,cur="main",theta=0,busy=false,hold=false,drag=null,lastIdx=-1,dpr=1,size=300,cv=null,ctx=null;
const $=s=>root.querySelector(s);
function take(info){if(!info)return;S=info;try{if(window.MF_APPLY&&info.state)window.MF_APPLY(info.state);}catch(e){}}

/* ---------- sons et vibrations ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==="suspended")AC.resume().catch(()=>{});return AC;}
function beep(f,t0,dur,vol,type){const a=AC;if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type||"square";o.frequency.value=f;g.gain.setValueAtTime(vol,a.currentTime+t0);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t0+dur);o.connect(g).connect(a.destination);o.start(a.currentTime+t0);o.stop(a.currentTime+t0+dur+.02);}catch(e){}}
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};
function tick(){beep(1700,0,.025,.04);vib(6);const p=$(".wh-ptr");p.classList.add("flick");setTimeout(()=>p.classList.remove("flick"),55);}
function jingle(big){const fr=$(".wh-frame");fr.classList.remove("flash");void fr.offsetWidth;fr.classList.add("flash");[523,659,784,1047].concat(big?[1319,1568]:[]).forEach((f,i)=>beep(f,i*.09,.18,.06,"triangle"));vib(big?[60,40,60,40,120]:40);}
function pfrt(){const a=AC;if(!a)return;try{const o=a.createOscillator(),l=a.createOscillator(),g=a.createGain(),lg=a.createGain(),t=a.currentTime;
 o.type="sawtooth";o.frequency.setValueAtTime(140,t);o.frequency.linearRampToValueAtTime(90,t+.9);l.type="square";l.frequency.value=26;lg.gain.value=.08;
 g.gain.setValueAtTime(.09,t);g.gain.linearRampToValueAtTime(.0001,t+1);l.connect(lg).connect(g.gain);o.connect(g).connect(a.destination);o.start(t);l.start(t);o.stop(t+1.05);l.stop(t+1.05);}catch(e){}}

/* ---------- dessin de la roue ---------- */
const segAt=()=>{const n=WH[cur].seg.length;return Math.floor(mod(-theta,TAU)/(TAU/n));};
function col(w,k){const o=WH[w].col&&WH[w].col[k];return o?o:[PZ[k].c,PZ[k].f];}
function draw(){
 if(!ctx)return;const w=WH[cur],n=w.seg.length,s=TAU/n,R=size/2;
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
 ctx.save();ctx.translate(R,R);ctx.rotate(theta);
 const fs=n>=20?Math.max(13,size/16):Math.max(18,size/11);
 for(let i=0;i<n;i++){const k=w.seg[i],[c,f]=col(cur,k),a0=-Math.PI/2+i*s;
  ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,R-1,a0,a0+s);ctx.closePath();ctx.fillStyle=c;ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,.28)";ctx.lineWidth=1;ctx.stroke();
  ctx.save();ctx.rotate(a0+s/2);ctx.fillStyle=f;const ic=PZ[k].ic,f2=ic.length>2?fs*.8:fs;ctx.font=`700 ${f2}px Quicksand,sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(ic,R*.68,1);ctx.restore();}
 ctx.restore();
 const g=ctx.createRadialGradient(R-R*.04,R-R*.04,2,R,R,R*.14);g.addColorStop(0,"#fff6c9");g.addColorStop(1,"#d9a514");
 ctx.beginPath();ctx.arc(R,R,R*.13,0,TAU);ctx.fillStyle=g;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle="#2a1145";ctx.stroke();
 ctx.font=`${R*.12}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("🍌",R,R+1);
 const ix=segAt();if(ix!==lastIdx){if((busy||drag)&&lastIdx!==-1)tick();lastIdx=ix;}}
function sizeCanvas(){const s2=cv.clientWidth||200;if(s2===size&&cv.width===Math.round(s2*dpr))return;size=s2;dpr=window.devicePixelRatio||1;cv.width=Math.round(size*dpr);cv.height=Math.round(size*dpr);draw();}
// écran fixe : la roue prend la plus grande taille qui tient entre le titre et le bouton
function fit(){if(!root||root.hidden)return;const a=$(".wh-area"),side=Math.max(150,Math.floor(Math.min(a.clientWidth*.97,a.clientHeight)));const b=$(".wh-box");b.style.width=b.style.height=side+"px";sizeCanvas();}

/* ---------- rotation : roue libre pendant que le serveur répond, puis freinage jusqu'à la case tirée ---------- */
let anim=null,vel=0;
function roll(v){vel=v;let t0=performance.now();const step=t=>{if(anim!=="roll")return;theta+=vel*(t-t0);t0=t;draw();requestAnimationFrame(step);};anim="roll";requestAnimationFrame(step);}
function land(idx){return new Promise(done=>{
 const n=WH[cur].seg.length,s=TAU/n,target=-(idx+.2+.6*Math.random())*s,v=vel,dir=v<0?-1:1,av=Math.abs(v);
 const delta=dir>0?mod(target-theta,TAU):-mod(theta-target,TAU);
 const N=Math.max(2,Math.round(av*5200/3/TAU)),D=dir*TAU*N+delta;
 const T=reduce?1400:Math.min(8000,Math.max(3500,3*Math.abs(D)/av)),th0=theta,t0=performance.now();anim="land";
 const step=t=>{const u=Math.min(1,(t-t0)/T);theta=th0+D*(1-(1-u)**3);draw();if(u<1)requestAnimationFrame(step);else{anim=null;done();}};
 requestAnimationFrame(step);});}

/* ---------- ce que fait le bouton ---------- */
function wanted(){if(!S)return"main";if(S.pending)return cur;return S.free?"gold":"main";}
function action(){if(!S||S.pending)return null;
 if(cur==="gold")return{kind:"gold"};
 if(+S.relance>0)return{kind:"relance"};
 if(+S.paidLeft>0&&+S.state.bananas>=+S.price)return{kind:"paid"};return null;}
const hhmm=ms=>{const m=Math.max(0,Math.round(ms/60000));return `${Math.floor(m/60)} h ${String(m%60).padStart(2,"0")}`;};
let skew=0;
function render(){if(!root||!S)return;
 $("#whBan").textContent=S.state?S.state.bananas:"…";$("#whBoo").textContent=S.state?S.state.stock:"…";
 if(!busy&&!hold){const w=wanted();if(w!==cur){cur=w;lastIdx=-1;draw();}}
 const m=$(".wh-mode");m.dataset.m=cur;$(".wh-box").dataset.m=cur;
 m.textContent=cur==="gold"?`Tour doré gratuit · cagnotte ${S.pot} 🍌`:cur==="qod"?"Quitte ou double":`💰 Cagnotte : ${S.pot} 🍌`;
 const b=$("#whGo"),choice=!!S.pending;b.hidden=choice;
 const a=action();b.disabled=busy||!a;
 b.textContent=cur==="gold"?"Tour doré gratuit":+S.relance>0?`Relance gratuite (${S.relance})`:a?`Tourner · ${S.price} 🍌`:+S.paidLeft===0?"Plus de tours aujourd'hui":"Pas assez de bananes";
 $("#whSub").textContent=`Tours payants : ${S.paidLeft}/${S.max}`+(S.free?"":` · Tour doré dans ${hhmm(+S.nextFree-(Date.now()+skew))}`);
 if(choice&&!busy)showChoice(lot(S.pending));
 $("#whHist").innerHTML=(S.hist||[]).map(h=>`<li>${esc(h)}</li>`).join("");
 if(ADMIN){const o=$("#whOpen");o.textContent=S.open?"Cacher aux joueurs":"Ouvrir à tous les joueurs";o.classList.toggle("on",!S.open);
  $("#whState").textContent=S.open?"La roue est ouverte à tous les joueurs.":"La roue est visible par toi seulement.";}}

/* ---------- résultats ---------- */
function show(t,s,lose,btns){$("#whResT").textContent=t;$("#whResT").className="wh-rt"+(lose?" lose":"");$("#whResS").textContent=s||"";const r=$("#whResB");r.innerHTML="";(btns||[]).forEach(x=>r.appendChild(x));$("#whRes").hidden=false;}
const mk=(txt,cls,fn)=>{const e=document.createElement("button");e.type="button";e.className=cls;e.textContent=txt;e.onclick=fn;return e;};
/* un lot en attente : {t,v} (ancien format {gain} = bananes) */
const lot=p=>({t:p&&p.t||"ban",v:+(p&&(p.v!=null?p.v:p.gain))||0});
function lab(t,v){return t==="ban"?`${v} 🍌`:t==="jackpot"?`${v} 🍌`:t==="boost"?`${v} booster${v>1?"s":""}`:
 t==="relance"?`${v} relance${v>1?"s":""}`:t==="time"?`−${v/60} h d'attente`:"";}
function showChoice(L){const{t,v}=L,a=lab(t,v),b=lab(t,2*v);
 const title=t==="jackpot"?`JACKPOT : ${a}`:`Gagné : ${a}`;
 show(title,"Tu le gardes, ou tu tentes de le doubler sur la roue or/noir (une chance sur deux) ?",false,
 [mk(`Garder ${a}`,"wh-ghost",()=>keep()),mk(`Quitte ou double → ${b}`,"wh-big",()=>dbl())]);}
function gotMsg(t,v,kept){return t==="ban"?["Ajoutées à ton compte."]:t==="jackpot"?[`La cagnotte repart à ${S.pot0} 🍌.`]:
 t==="boost"?["Ajoutés à ton stock."]:t==="relance"?[v>1?"Tes prochains tours sont offerts.":"Ton prochain tour est offert."]:
 t==="time"?[kept?"Gardées pour ta prochaine attente de booster.":`Ton prochain booster arrive ${v/60} heures plus tôt.`]:[""];}
let tt=0;function toast(t){const e=$(".wh-toast");e.textContent=t;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500);}
const err=e=>{busy=false;anim=null;show("Oups",errText(e),true);render();
 rpc("mf_wheel_status").then(r=>{take(r);render();},()=>{});};
const takeForce=id=>{if(!ADMIN)return null;const el=$(id),v=el.value;el.value="";return v||null;};
const takeScam=()=>{if(!ADMIN)return false;const el=$("#whFScam"),v=el.checked;el.checked=false;return v;};

async function go(v){if(busy)return;const a=action();if(!a){render();return;}
 ac();busy=true;$("#whRes").hidden=true;render();roll(v);
 let r;try{r=await rpc("mf_wheel_spin",{p_kind:a.kind,p_force:takeForce("#whFMain"),p_scam:takeScam()});}catch(e){return err(e);}
 if(r.wheel!==cur){cur=r.wheel;lastIdx=-1;}
 await land(r.idx);if(r.scam)await scam(PZ[r.key].k==="jackpot"?"le jackpot":PZ[r.key].lab);busy=false;take(r.info);outcome(r);render();}
function outcome(r){const p=PZ[r.key];
 if(r.scam){show("Monkey Scam !",`Le singe a volé ton lot (${p.k==="jackpot"?"le jackpot reste dans la cagnotte":p.lab}). Retente ta chance !`,true);return;}
 if(p.k==="lose"){show("Perdu…","Retente ta chance !",true);return;}
 jingle(p.k!=="ban"&&p.k!=="relance"||p.v>=25);}
function scam(what){$("#whScamS").textContent=`Il repart avec ton lot : ${what}`;return new Promise(done=>{const el=$(".wh-scam");el.hidden=false;ac();setTimeout(pfrt,300);vib([80,60,80,60,200]);
 const end=()=>{el.hidden=true;el.onclick=null;clearTimeout(tm);done();};const tm=setTimeout(end,3800);setTimeout(()=>{el.onclick=end;},1200);});}
async function keep(){if(busy)return;busy=true;try{const r=await rpc("mf_wheel_double",{p_double:false});take(r.info);busy=false;
 const t=r.t||"ban";const v=r.v||r.gain;show(`${t==="time"?"":"+"}${lab(t,v)}`,gotMsg(t,v,r.timeKept)[0]);render();}catch(e){err(e);}}
async function dbl(){if(busy)return;ac();busy=true;$("#whRes").hidden=true;cur="qod";lastIdx=-1;render();roll(.014+Math.random()*.004);
 let r;try{r=await rpc("mf_wheel_double",{p_double:true,p_force:takeForce("#whFQod"),p_scam:takeScam()});}catch(e){return err(e);}
 const t=r.t||"ban",won=lab(t,2*r.stake),lost=lab(t,r.stake);
 await land(r.idx);if(r.scam)await scam(won);busy=false;take(r.info);
 if(r.scam)show("Monkey Scam !",`Le singe est parti avec ton lot : ${won}.`,true);
 else if(r.gain){jingle(true);show(`Doublé ! ${t==="time"?"":"+"}${won}`,`Quel cran. ${gotMsg(t,2*r.stake,r.timeKept)[0]}`);}else show("Perdu…",`Ton lot (${lost}) est parti.`,true);
 hold=true;render();setTimeout(()=>{hold=false;render();},1600);}

/* ---------- admin ---------- */
async function adm(x,msg){try{take(await rpc("mf_wheel_admin",{p_action:x}));$("#whRes").hidden=true;render();if(msg)toast(msg);}catch(e){err(e);}}

/* ---------- construction ---------- */
function rulesHtml(){
 return `<p>Toutes les cases ont la même taille. 1 tour doré gratuit par jour, puis 5 tours payants à 1 🍌. La banane de chaque tour payant va dans la cagnotte commune à tous les joueurs ; elle repart à 20 🍌 après un jackpot. Sur les gains de 1, 2, 5 et 10 🍌, tu peux tenter un quitte ou double (une chance sur deux). Attention au Monkey Scam…</p>`+
 ["gold","main"].map(w=>{const s=WH[w].seg,c={};s.forEach(k=>c[k]=(c[k]||0)+1);
  return `<h3>${WH[w].name} · ${s.length} cases</h3><table>${Object.keys(c).map(k=>`<tr><td><span class="wh-dot" style="background:${col(w,k)[0]}"></span>${PZ[k].ic} ${esc(PZ[k].lab)}</td><td>${c[k]} · ${(c[k]/s.length*100).toLocaleString("fr-FR",{maximumFractionDigits:1})} %</td></tr>`).join("")}</table>`;}).join("");}
function build(){
 const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
 root=document.createElement("div");root.id="mfWheel";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","The Monkey Wheel");
 root.innerHTML=`<div class="wh-top"><button type="button" class="wh-btn l" id="whTog" aria-controls="whSide" aria-expanded="false" aria-label="Règles${""}">?</button>
  <h2 style="margin:0"><img class="wh-logo" src="${IMG.logo}" alt="The Monkey Wheel" width="1400" height="470"></h2>
  <div class="wh-chips"><span class="wh-chip">🍌 <b id="whBan">…</b></span><span class="wh-chip">Boosters <b id="whBoo">…</b></span></div>
  <button type="button" class="wh-btn r" id="whClose" aria-label="Fermer">✕</button></div>
 <div class="wh-scene">
  <div class="wh-mode"></div>
  <div class="wh-area"><div class="wh-box"><canvas aria-label="Roue, glisse-la du doigt pour la lancer"></canvas><img class="wh-frame" src="${IMG.cadre}" alt=""><img class="wh-ptr" src="${IMG.ptr}" alt=""></div></div>
  <div class="wh-act"><button type="button" class="wh-big" id="whGo"></button><div class="wh-sub" id="whSub"></div></div>
  <div class="wh-res" id="whRes" hidden role="status"><div class="wh-rt" id="whResT"></div><div class="wh-rs" id="whResS"></div><div class="wh-rrow" id="whResB"></div></div>
 </div>
 <aside class="wh-side" id="whSide" aria-label="Règles et réglages">
  <div class="wh-sh"><h3>Règles et chances</h3><button type="button" class="wh-btn" style="position:static" id="whSideX" aria-label="Fermer les règles">✕</button></div>
  <p>✕ Perdu · 🍌 bananes · ↻ Relance · ⏳ −2 h d'attente · 🎴🎴 2 boosters · 💰 Jackpot · ×2 Doublé</p>
  ${rulesHtml()}
  <h3>Derniers tours</h3><ul class="wh-hist" id="whHist"></ul>
  <div class="wh-adm" id="whAdm" hidden>
   <h3>Réglages admin</h3>
   <p id="whState"></p>
   <div class="wh-btns"><button type="button" id="whOpen"></button></div>
   <label for="whFMain">Prochain résultat (roue normale ou dorée)</label>
   <select id="whFMain"><option value="">Au hasard</option><option value="P">Perdu</option><option value="b1">1 🍌 (normale)</option><option value="b2">2 🍌</option><option value="b5">5 🍌</option><option value="b10">10 🍌</option><option value="b25">25 🍌 (dorée)</option><option value="R">Relance (normale)</option><option value="T">−2 h d'attente</option><option value="BB">2 boosters</option><option value="J">Jackpot</option></select>
   <label for="whFQod">Prochain quitte ou double</label>
   <select id="whFQod"><option value="">Au hasard</option><option value="OR">Doublé</option><option value="NO">Perdu</option></select>
   <label class="wh-chk"><input type="checkbox" id="whFScam"> Monkey Scam au prochain gain</label>
   <div class="wh-btns"><button type="button" id="whReset">Rendre mes tours du jour</button><button type="button" id="whAdd">+50 🍌</button><button type="button" id="whPotAdd">Cagnotte +50</button></div>
  </div>
 </aside>
 <div class="wh-scam" hidden aria-live="assertive"><div class="wh-monk" aria-hidden="true"><img src="${IMG.scam}" alt="" width="714" height="720"><img class="m2" src="${IMG.scam2}" alt="" width="714" height="720"></div>
  <div class="wh-scamT">Tu viens de te faire<br><b>Monkey Scam !</b></div><div class="wh-scamS" id="whScamS"></div></div>
 <div class="wh-toast" role="status"></div>`;
 document.body.appendChild(root);
 cv=$("canvas");ctx=cv.getContext("2d");
 $("#whAdm").hidden=!ADMIN;
 new ResizeObserver(fit).observe($(".wh-area"));new ResizeObserver(sizeCanvas).observe(cv);
 if(document.fonts)document.fonts.ready.then(draw);
 $("#whClose").addEventListener("click",close);
 $("#whGo").addEventListener("click",()=>go(.013+Math.random()*.005));
 $("#whRes").addEventListener("click",e=>{if(e.target.closest("button")||(S&&S.pending))return;$("#whRes").hidden=true;});
 $("#whTog").addEventListener("click",()=>side(!$("#whSide").classList.contains("open")));
 $("#whSideX").addEventListener("click",()=>{side(false);$("#whTog").focus({preventScroll:true});});
 $("#whOpen").addEventListener("click",()=>adm(S&&S.open?"close":"open",S&&S.open?"La roue est de nouveau cachée.":"The Monkey Wheel est ouverte à tous les joueurs !"));
 $("#whReset").addEventListener("click",()=>adm("reset","Tes tours du jour sont rendus."));
 $("#whAdd").addEventListener("click",()=>adm("bananas","+50 🍌 sur ton compte."));
 $("#whPotAdd").addEventListener("click",()=>adm("pot","Cagnotte +50 🍌."));
 // lancer au doigt
 const ang=e=>{const r=cv.getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2);};
 cv.addEventListener("pointerdown",e=>{if(busy||!action())return;ac();drag={a:ang(e),t:performance.now(),v:0};try{cv.setPointerCapture(e.pointerId);}catch(x){}});
 cv.addEventListener("pointermove",e=>{if(!drag)return;const a=ang(e),t=performance.now();let da=a-drag.a;if(da>Math.PI)da-=TAU;if(da<-Math.PI)da+=TAU;
  theta+=da;const dt=Math.max(1,t-drag.t);drag.v=.6*drag.v+.4*(da/dt);drag.a=a;drag.t=t;draw();});
 const up=()=>{if(!drag)return;const v=drag.v,old=performance.now()-drag.t>120;drag=null;
  if(!old&&Math.abs(v)>.004){const s=Math.sign(v)*Math.min(.03,Math.max(.01,Math.abs(v)));go(s);}};
 cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",()=>{drag=null;});
 root.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!$(".wh-scam").hidden)return;if($("#whSide").classList.contains("open"))side(false);else close();});
 setInterval(()=>{if(!root.hidden)render();},30000);
}
function side(o){$("#whSide").classList.toggle("open",o);$("#whTog").setAttribute("aria-expanded",String(o));}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
 if(!root)build();
 root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 fit();draw();$("#whClose").focus({preventScroll:true});render();
 try{const r=await rpc("mf_wheel_status");if(r.now)skew=+r.now-Date.now();take(r);if(!busy){cur=wanted();lastIdx=-1;draw();}render();}catch(e){show("Oups",errText(e),true);}
}
function close(){
 if(busy){toast("La roue tourne encore…");return;}
 side(false);root.hidden=true;document.body.style.overflow=prevOverflow;if(opener&&opener.focus)opener.focus();
}

/* ---------- démarrage : la roue s'inscrit au Casino ---------- */
async function boot(){
 if(!window.claude||!window.claude.use)return;
 try{USER=await window.claude.use("user");}catch(e){}
 if(!USER||typeof window.MF_RPC!=="function")return;
 try{ADMIN=!!(await USER.isOwner());}catch(e){}
 let ok=ADMIN;if(!ok){try{ok=!!(await rpc("mf_wheel_open"));}catch(e){}}
 if(!ok||!window.MF_CASINO)return;
 Object.values(IMG).forEach(u=>{const i=new Image();i.src=u;});
 window.MF_CASINO.add({id:"wheel",name:"The Monkey Wheel",order:5,root:"mfWheel",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><circle cx="12" cy="13" r="1.6"/><path d="M12 5v6.4M12 14.6V21M4 13h6.4M13.6 13H20M6.3 7.3l4.5 4.5M13.2 14.2l4.5 4.5M17.7 7.3l-4.5 4.5M10.8 14.2l-4.5 4.5"/><path d="M10.5 2.5h3L12 5z"/></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){const r=await rpc("mf_wheel_status");if(r.now)skew=+r.now-Date.now();take(r);}const I=S;if(!I)return null;
   if(I.pending){const L=lot(I.pending);return {line:`Un lot t'attend (${lab(L.t,L.v)}) : garde-le ou double-le !`,hot:true};}
   if(I.free)return {line:"Ton tour doré gratuit t'attend !",hot:true};
   if(+I.relance>0)return {line:"Une relance gratuite t'attend !",hot:true};
   if(+I.paidLeft>0)return {line:`Encore ${I.paidLeft} tour${+I.paidLeft>1?"s":""} aujourd'hui · cagnotte ${I.pot} 🍌`,pre:"Tour doré dans ",in:+I.nextFree-(Date.now()+skew),hot:false};
   return {line:`Plus de tours aujourd'hui · cagnotte ${I.pot} 🍌`,pre:"Tour doré dans ",in:+I.nextFree-(Date.now()+skew),hot:false};}});
}
window.MF_WHEEL={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

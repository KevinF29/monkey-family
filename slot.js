/* Monkey Family — Banana Machine (ouverte à tous ; réglages et résultats forcés réservés à l'admin)
   1 banane le tour, 10 tours par jour, table de gains ci-dessous.
   Le tirage, les gains, les limites et l'aide du singe sont décidés par le serveur (mf_slot_spin) :
   cette page ne fait qu'animer les rouleaux jusqu'au résultat reçu, puis affiche le nouvel état du jeu. */
(function(){
"use strict";

/* ---------- symboles, poids par rouleau et table de gains ---------- */
const SYM=[
  {e:"banane",n:"Banane",d:"Le symbole de base",w:9},
  {e:"rage",n:"Rage",d:"DarkKyx qui rage",w:6},
  {e:"remboursement",n:"Remboursement",d:"JamesRr se fait rembourser",w:5},
  {e:"camera",n:"Caméra",d:"Dridriix le youtubeur",w:4},
  {e:"maman",n:"Planquez vos mamans",d:"Mougouphouy arrive",w:3},
  {e:"sablier",n:"Sablier",d:"Réduit l'attente du prochain booster",w:3},
  {e:"booster",n:"Booster",d:"Gagne des boosters",w:3},
  {e:"singe",n:"Singe Monkey Family",d:"Le jackpot",w:2}];
const TOTAL=SYM.reduce((a,s)=>a+s.w,0);
const NAME=Object.fromEntries(SYM.map(s=>[s.e,s.n]));
const TRI={singe:{t:"boost",v:7},booster:{t:"boost",v:3},sablier:{t:"time",v:360},maman:{t:"ban",v:40},camera:{t:"ban",v:25},remboursement:{t:"ban",v:15},rage:{t:"ban",v:10},banane:{t:"ban",v:5}};
const PAIR=[["booster",{t:"boost",v:1}],["sablier",{t:"time",v:120}],["banane",{t:"ban",v:3}]];
const ORDER=["3:singe","3:booster","3:sablier","3:maman","3:camera","3:remboursement","3:rage","3:banane","2:booster","2:sablier","2:banane","1:banane"];
const COST=1,TURNS=10,PITY=10;

function pay(s){
  const [a,b,c]=s;
  if(a===b&&b===c)return {...TRI[a],k:"3:"+a};
  for(const [sym,r] of PAIR)if(s.filter(x=>x===sym).length===2)return {...r,k:"2:"+sym};
  if(a==="banane")return {t:"ban",v:1,k:"1:banane"};
  return null;
}
function draw(){let r=Math.random()*TOTAL;for(const s of SYM){if((r-=s.w)<0)return s.e;}return SYM[0].e;}
const src=e=>"packs/slot-"+e+".webp";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const label=r=>!r?"":r.t==="ban"?r.v+" banane"+(r.v>1?"s":""):r.t==="boost"?r.v+" booster"+(r.v>1?"s":""):"−"+(r.v/60)+" h d'attente";
const short=r=>r.t==="time"?"−"+(r.v/60)+" h ⏳":label(r);
const mod=(n,m)=>((n%m)+m)%m;
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- état (le serveur fait foi) ---------- */
let S={bal:0,left:TURNS,feed:[],spins:0,spent:0,won:0,boosters:0,mins:0};
let ME="Admin",ADMIN=false,force="",busy=false,sound=true,loaded=false;
const ERR={no_bananas:"Pas assez de bananes.",slot_limit:"Plus de tours aujourd'hui : reviens demain !",slot_closed:"La machine n'est pas encore ouverte.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
function applyState(st){if(!st)return;S.bal=+st.bananas||0;try{if(window.MF_APPLY)window.MF_APPLY(st);}catch(e){}}

/* ---------- style ---------- */
const CSS=`
#mfSlot{position:fixed;inset:0;z-index:9000;overflow:hidden;overscroll-behavior:none;touch-action:manipulation;display:flex;flex-direction:column;color:#f6f0d8;font:16px/1.5 Quicksand,system-ui,sans-serif;
 background:radial-gradient(ellipse 70% 60% at 50% 35%,rgba(255,176,64,.25),transparent 70%),linear-gradient(180deg,#0f3a1f,#082414)}
#mfSlot[hidden]{display:none}
#mfSlot *{box-sizing:border-box;min-width:0}
.sl-top{flex:none;display:flex;align-items:center;gap:10px;padding:max(10px,env(safe-area-inset-top)) max(4vw,14px) 6px;position:relative;z-index:6}
.sl-top{justify-content:flex-end}
.sl-top h2{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sl-col{display:flex;flex-direction:column;align-items:center}
.sl-col>.sl-m{align-self:stretch}
.sl-logo{display:block;width:80%;height:auto;margin:-40px auto 50px;filter:drop-shadow(0 10px 14px rgba(0,0,0,.45));pointer-events:none}
.sl-tag{font:700 12px Quicksand,sans-serif;background:#ffd23f;color:#3a200b;border-radius:99px;padding:3px 10px}
.sl-x{min-width:44px;min-height:44px;border-radius:12px;border:2px solid #5a3416;background:#3a200b;color:#ffd23f;font:400 20px "Titan One",sans-serif;cursor:pointer}
.sl-body{flex:1;position:relative;overflow:hidden}
.sl-stage{position:absolute;left:50%;top:50%;width:min(560px,calc(100vw - 20px));transform-origin:50% 50%}
.sl-stage{padding:58px 14px 22px}
.sl-m{position:relative;padding:20px 24px 24px;border-radius:20px;
 background:repeating-linear-gradient(90deg,rgba(0,0,0,.07) 0 2px,transparent 2px 11px),linear-gradient(180deg,#a36b35,#6e411d 70%,#5a3416);
 box-shadow:inset 0 0 0 5px #4a2a10,inset 0 0 0 9px rgba(255,214,150,.18),0 16px 0 #3a200b,0 30px 50px rgba(0,0,0,.5)}
.sl-m::before,.sl-m::after{content:"";position:absolute;top:-34px;bottom:-18px;width:24px;border-radius:12px;z-index:2;
 background:repeating-linear-gradient(180deg,transparent 0 52px,#5d7a1f 52px 55px,#c9d870 55px 57px,transparent 57px),linear-gradient(90deg,#6d8a26,#b8cf55 35%,#e2eb98 48%,#9cb840 70%,#5f7a20);box-shadow:0 6px 10px rgba(0,0,0,.4)}
.sl-m::before{left:-12px}.sl-m::after{right:-12px}
.sl-vine{position:absolute;top:-54px;width:min(36%,180px);height:auto;z-index:3;pointer-events:none;overflow:visible}
.sl-vine.l{left:-30px}.sl-vine.r{right:-30px;transform:scaleX(-1)}
.sl-sign{position:relative;z-index:4;margin:-56px auto 0;width:fit-content;max-width:100%;padding:10px 26px 12px;text-align:center;border-radius:12px;transform:rotate(-1.5deg);
 background:repeating-linear-gradient(0deg,rgba(0,0,0,.08) 0 2px,transparent 2px 9px),linear-gradient(180deg,#d39a58,#9a6130);box-shadow:inset 0 0 0 3px #5a3416,0 8px 0 #3a200b,0 12px 20px rgba(0,0,0,.4);
 font:400 clamp(24px,4.6vw,36px)/1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 4px 0 #4a2a10,3px 0 0 #4a2a10,-3px 0 0 #4a2a10,0 -3px 0 #4a2a10}
.sl-sign small{display:block;margin-top:6px;font:700 13px Quicksand,sans-serif;color:#fff3cf;text-shadow:0 1px 0 #4a2a10}
.sl-sign::before,.sl-sign::after{content:"";position:absolute;top:-40px;width:3px;height:42px;background:#c9a46a}
.sl-sign::before{left:22px}.sl-sign::after{right:22px}
.sl-tb{position:relative;z-index:1;margin:16px 4px 4px;padding:12px 12px 10px;border-radius:12px;background:radial-gradient(ellipse at 50% 0,#1f4a28,#0c2213 75%);box-shadow:0 0 0 4px #c9a046,0 0 0 7px #5a3416,inset 0 0 18px rgba(0,0,0,.6)}
.sl-tbt{display:block;width:100%;text-align:center;font:400 18px/1 "Titan One",sans-serif;color:#ffd23f;margin-bottom:8px}
.sl-tbg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px}
.sl-row{display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:8px;font-weight:700;font-size:13.5px;line-height:1.2}
.sl-row .ic{display:flex;flex:none;align-items:center}.sl-row .ic img{width:24px;height:24px}.sl-row .ic i{width:24px;text-align:center;color:#8fae6a;font-style:normal;font-size:13px}
.sl-row .dt{flex:1;border-bottom:2px dotted rgba(255,214,120,.35);height:0;margin:0 2px}
.sl-row .pz{white-space:nowrap;color:#ffe08a;display:flex;align-items:center;gap:3px}.sl-row .pz img{width:18px;height:18px}
.sl-row.jk{grid-column:1/-1;justify-content:center;background:rgba(255,210,63,.12);margin-bottom:4px}
.sl-row.jk .ic img{width:32px;height:32px}.sl-row.jk .pz{font:400 19px "Titan One",sans-serif;color:#ffd23f}
.sl-row.hit{background:#ffd23f;color:#3a200b}.sl-row.hit .pz{color:#3a200b}
.sl-rules{margin:8px 0 0;text-align:center;font-size:12px;color:#cfe0b0;line-height:1.4}
@media(max-width:520px){.sl-tb{padding:10px 8px 8px}.sl-tbg{column-gap:8px}.sl-row{font-size:12px;padding:2px 4px;gap:4px}.sl-row .ic img{width:19px;height:19px}.sl-row .ic i{width:19px;font-size:11px}.sl-row .pz img{width:15px;height:15px}.sl-row.jk .ic img{width:26px;height:26px}.sl-rules{font-size:11px}}
.sl-lights{display:flex;justify-content:space-between;margin:16px 2px 6px;padding:0 6px;background:linear-gradient(transparent 0 46%,#2b1a0a 46% 54%,transparent 54%)}
.sl-lights i{width:13px;height:16px;border-radius:50% 50% 45% 45%;background:#ffcf6a;box-shadow:0 0 10px #ffb340}
.sl-m.spin .sl-lights i{animation:slBlink .35s infinite alternate}.sl-lights i:nth-child(even){animation-delay:.17s!important}
@keyframes slBlink{to{background:#ff7a3a;box-shadow:0 0 14px #ff5a1f}}
.sl-win{position:relative;background:#1b120a;border-radius:14px;padding:10px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 4px 0;
 box-shadow:0 0 0 7px #a8c04a,0 0 0 10px #5d7a1f,0 0 0 12px #3a200b,inset 0 8px 16px rgba(0,0,0,.7)}
.sl-win::before,.sl-win::after{content:"";position:absolute;top:50%;margin-top:-11px;border:11px solid transparent;z-index:2}
.sl-win::before{left:-2px;border-left-color:#ffd23f}.sl-win::after{right:-2px;border-right-color:#ffd23f}
.sl-reel{background:linear-gradient(180deg,#cdb98a,#fff6dc 30%,#fff6dc 70%,#cdb98a);border-radius:9px;height:clamp(140px,34vw,210px);overflow:hidden;position:relative;--ch:80px}
.sl-reel::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(50,25,0,.6),transparent 30%,transparent 70%,rgba(50,25,0,.6))}
.sl-cells{position:absolute;inset:0}
.sl-cells img{position:absolute;left:0;right:0;top:0;margin:0 auto;height:calc(var(--ch)*.84);width:auto;max-width:92%;object-fit:contain;filter:drop-shadow(0 3px 2px rgba(0,0,0,.25));will-change:transform}
.sl-reel.win::before{content:"";position:absolute;left:4px;right:4px;top:calc(50% - var(--ch)/2);height:var(--ch);border-radius:8px;box-shadow:0 0 0 4px #ffd23f,0 0 26px rgba(255,190,40,.9);z-index:1}
.sl-reel.tense{animation:slTense .25s infinite alternate}@keyframes slTense{to{box-shadow:0 0 0 3px #ff7a3a,0 0 22px #ffb300}}
.sl-ctl{display:flex;gap:12px;align-items:center;margin-top:22px;flex-wrap:wrap}
.sl-go{flex:1 1 200px;min-height:62px;border:0;border-radius:16px;cursor:pointer;color:#4a2a10;font:400 25px "Titan One",sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;
 background:linear-gradient(180deg,#ffe066,#f5b700);box-shadow:0 6px 0 #a86c00,0 10px 16px rgba(0,0,0,.35)}
.sl-go img{width:32px;height:32px}.sl-go:active{transform:translateY(4px);box-shadow:0 2px 0 #a86c00}
.sl-go:disabled{background:#8d7a5a;color:#3a2a14;box-shadow:0 6px 0 #4e3d22;cursor:not-allowed}
#mfSlot button:focus-visible,#mfSlot input:focus-visible{outline:3px solid #ffd23f;outline-offset:3px}
.sl-pills{display:flex;gap:10px;flex-wrap:wrap}
.sl-pill{background:#3a200b;color:#ffd23f;border-radius:12px;padding:6px 12px;font-weight:700;white-space:nowrap;box-shadow:inset 0 0 0 2px #5a3416}
.sl-pill b{font:400 21px "Titan One",sans-serif;color:#fff;margin-left:4px}
.sl-res{margin-top:16px;min-height:56px;border-radius:12px;padding:10px 14px;font-weight:700;font-size:16px;display:flex;align-items:center;color:#3a200b;background:#f3e2b8;box-shadow:inset 0 0 0 2px #c9a46a}
.sl-res.good{background:#d7ecb0}.sl-res.jack{background:linear-gradient(90deg,#ffd23f,#ffb300);font:400 22px "Titan One",sans-serif}
.sl-m.shake{animation:slShake .5s 3}@keyframes slShake{25%{transform:translate(-6px,2px) rotate(-.6deg)}50%{transform:translate(5px,-2px) rotate(.5deg)}75%{transform:translate(-3px,1px)}}
.sl-side{position:absolute;top:0;right:0;bottom:0;z-index:7;width:min(380px,100%);overflow-y:auto;overscroll-behavior:contain;background:#0c2213;border-left:2px solid #2a5a33;padding:16px 16px max(16px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px;box-shadow:-20px 0 40px rgba(0,0,0,.5);transform:translateX(105%);transition:transform .25s ease;visibility:hidden}
.sl-side.open{transform:none;visibility:visible}
.sl-side>*{flex-shrink:0}
.sl-sidehead{display:flex;align-items:center;justify-content:space-between;gap:10px}
#mfSlot.fill .sl-side{padding-top:max(12px,env(safe-area-inset-top))}
/* grand écran (PC) : la table des gains passe à gauche de la machine, et tout peut grossir */
#mfSlot.wide .sl-stage{display:flex;align-items:center;gap:34px;width:auto}
#mfSlot.wide .sl-col{width:560px;flex:none}
#mfSlot.wide .sl-board{display:block;width:330px;flex:none;position:relative;padding:18px 14px 14px;border-radius:18px;
 background:repeating-linear-gradient(0deg,rgba(0,0,0,.07) 0 2px,transparent 2px 10px),linear-gradient(180deg,#a36b35,#6e411d);box-shadow:inset 0 0 0 5px #4a2a10,0 12px 0 #3a200b,0 22px 40px rgba(0,0,0,.45)}
#mfSlot.wide .sl-board::before,#mfSlot.wide .sl-board::after{content:"";position:absolute;top:-30px;width:3px;height:32px;background:#c9a46a}
#mfSlot.wide .sl-board::before{left:40px}#mfSlot.wide .sl-board::after{right:40px}
#mfSlot.wide .sl-board .sl-tb{margin:0}
#mfSlot.wide .sl-board .sl-tbg{grid-template-columns:minmax(0,1fr)}
#mfSlot.wide .sl-board .sl-tbt{font-size:22px;margin-bottom:10px}
#mfSlot.wide .sl-board .sl-row{font-size:15px;padding:4px 8px}
#mfSlot.wide .sl-board .sl-row .ic img{width:28px;height:28px}#mfSlot.wide .sl-board .sl-row .ic i{width:28px}
#mfSlot.wide .sl-board .sl-row .pz img{width:20px;height:20px}
#mfSlot.wide .sl-board .sl-row.jk .ic img{width:36px;height:36px}#mfSlot.wide .sl-board .sl-row.jk .pz{font-size:22px}
#mfSlot.wide .sl-board .sl-rules{font-size:13px}
#mfSlot.wide .sl-reel{height:210px}
.sl-board{display:none}
/* téléphone : la machine remplit tout l'écran (largeur et hauteur), les rouleaux prennent la place libre, la table des gains se déplie à la demande */
#mfSlot.fill .sl-top{position:absolute;top:0;right:0;left:0;padding:max(8px,env(safe-area-inset-top)) 10px 0;pointer-events:none}#mfSlot.fill .sl-top>*{pointer-events:auto}#mfSlot.fill .sl-x{margin-left:auto}
#mfSlot.fill .sl-tog{min-height:40px;width:40px;padding:0;font-size:0}#mfSlot.fill .sl-tog::before{content:"⚙";font-size:20px;line-height:1}
#mfSlot.fill .sl-pills{flex:1 1 100%;justify-content:space-between}#mfSlot.fill .sl-x{min-width:40px;min-height:40px}
#mfSlot.fill .sl-stage{position:absolute;inset:0;width:auto;transform:none!important;padding:max(8px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));display:flex;flex-direction:column}
#mfSlot.fill .sl-col{flex:1;min-height:0;display:flex;flex-direction:column}
#mfSlot.fill .sl-logo{width:auto;height:clamp(54px,10vh,96px);max-width:62%;margin:0 auto 12px;flex:none}
#mfSlot.fill .sl-sign{display:none}
#mfSlot.fill .sl-m{flex:1;min-height:0;display:flex;flex-direction:column;padding:10px 16px 14px}
#mfSlot.fill .sl-m>*{flex:none}
#mfSlot.fill .sl-win{flex:1 1 auto;min-height:0;grid-template-rows:minmax(0,1fr)}
#mfSlot.fill .sl-reel{height:auto;min-height:0}
#mfSlot.fill .sl-lights{margin:12px 2px 4px}
#mfSlot.fill .sl-ctl{margin-top:16px}#mfSlot.fill .sl-res{margin-top:10px;min-height:48px}
#mfSlot.fill .sl-tb{margin-top:6px}
#mfSlot.fill .sl-win{min-height:150px}
/* table dépliée sur un petit écran : elle défile dans son cadre au lieu de rapetisser la machine */
#mfSlot.fill .sl-tb.open{flex:0 1 auto;min-height:110px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
#mfSlot.fill .sl-tb.open .sl-tbt{position:sticky;top:-10px;z-index:1;background:#0f2a17;padding:4px 0;margin:-4px 0 4px;border-radius:8px}

#mfSlot:not(.admin) .sl-adm,body.preview #mfSlot .sl-adm{display:none!important}
.sl-side label.sl-chk{flex-wrap:wrap;height:auto}
@media(max-width:560px){.sl-tag{display:none}}
.sl-tog{min-height:44px;border-radius:12px;border:2px solid #5a3416;background:#3a200b;color:#ffd23f;font:700 14px Quicksand,sans-serif;padding:0 12px;cursor:pointer}
.sl-tog[aria-expanded=true]{background:#ffd23f;color:#3a200b}
.sl-side h3{margin:0;font:400 20px "Titan One",sans-serif;color:#ffd23f}
.sl-note{margin:0;font-size:13px;color:#cfe0b0}
.sl-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sl-btn{min-height:44px;border-radius:10px;border:2px solid #5a3416;background:#3a200b;color:#fff3cf;font:700 14px Quicksand,sans-serif;padding:8px 12px;cursor:pointer}
.sl-chk{display:flex;gap:8px;align-items:center;font-weight:700;font-size:14px;min-height:44px}.sl-chk input{width:20px;height:20px}
.sl-feed{list-style:none;margin:0;padding:0;max-height:260px;overflow-y:auto}
.sl-feed li{padding:8px 0;border-top:1px solid #2a5a33;font-size:14px}.sl-feed li:first-child{border-top:0}
.sl-feed .pity{color:#b9c99a;font-style:italic}
.sl-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.sl-stat{background:#0c2213;border-radius:10px;padding:8px}.sl-stat b{display:block;font:400 20px "Titan One",sans-serif;color:#fff}.sl-stat span{font-size:12px;color:#b9c99a}
.sl-jp{position:fixed;inset:0;z-index:9100;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 45%,rgba(120,60,0,.78),rgba(5,20,10,.94) 70%);cursor:pointer}
.sl-jp[hidden]{display:none}
.sl-rays{position:absolute;left:50%;top:45%;width:220vmax;height:220vmax;margin:-110vmax 0 0 -110vmax;background:repeating-conic-gradient(var(--ray,rgba(255,210,63,.32)) 0 9deg,transparent 9deg 18deg);-webkit-mask:radial-gradient(circle,#000 0,transparent 45%);mask:radial-gradient(circle,#000 0,transparent 45%);animation:slTurn 14s linear infinite}
@keyframes slTurn{to{transform:rotate(360deg)}}
.sl-jpin{position:relative;z-index:2;text-align:center;padding:16px}
.sl-coin{width:min(52vw,260px);filter:drop-shadow(0 0 40px rgba(255,200,60,.9));animation:slPop .9s cubic-bezier(.2,1.7,.4,1) both,slBob 2.2s .9s ease-in-out infinite}
.sl-jpt{font:400 clamp(56px,13vw,120px)/1 "Titan One",sans-serif;color:#ffd23f;margin-top:6px;text-shadow:0 7px 0 #8a4b00,5px 0 0 #8a4b00,-5px 0 0 #8a4b00,0 0 40px #ffb300;animation:slPop .8s .25s cubic-bezier(.2,1.7,.4,1) both,slGlow .45s 1.1s ease-in-out 8 alternate}
.sl-jps{font:700 clamp(18px,3vw,24px) Quicksand,sans-serif;color:#fff3cf;margin:10px 0 20px;animation:slPop .6s .6s both}
.sl-jp.flip .sl-coin{animation:slPop .9s cubic-bezier(.2,1.7,.4,1) both,slFlip 1.6s 1s ease-in-out infinite}
@keyframes slFlip{0%,35%{transform:rotate(0)}65%,100%{transform:rotate(180deg)}}
.sl-jp.tilt .sl-coin{animation:slPop .9s cubic-bezier(.2,1.7,.4,1) both,slWig .9s .9s ease-in-out infinite}
@keyframes slWig{25%{transform:rotate(-7deg) scale(1.04)}75%{transform:rotate(7deg) scale(1.04)}}
.sl-jp.peek .sl-coin{animation:slPeek 1s cubic-bezier(.2,1.5,.4,1) both,slBob 1.4s 1s ease-in-out infinite}
@keyframes slPeek{from{transform:translateX(60vw) rotate(25deg);opacity:0}to{transform:none;opacity:1}}
.sl-jpt.small{font-size:clamp(44px,10vw,96px)}
@keyframes slPop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes slBob{50%{transform:translateY(-12px) rotate(4deg)}}
@keyframes slGlow{to{color:#fff6c2;text-shadow:0 7px 0 #8a4b00,5px 0 0 #8a4b00,-5px 0 0 #8a4b00,0 0 70px #ffd23f}}
.sl-flash{position:fixed;inset:0;z-index:9200;background:#fff7d0;pointer-events:none;animation:slFlash .7s ease-out forwards}@keyframes slFlash{from{opacity:.95}to{opacity:0}}
.sl-pt{position:absolute;left:50%;top:45%;width:56px;height:56px;margin:-28px;z-index:1;pointer-events:none}
@media(prefers-reduced-motion:reduce){.sl-m.spin .sl-lights i,.sl-rays,.sl-coin,.sl-jpt,.sl-m.shake{animation:none}}
`;
const LEAF=`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
 <g id="slLeaf"><path d="M0 0C12-17 40-19 58 0C40 19 12 17 0 0Z" fill="#4f9a2e"/><path d="M0 0C12-17 40-19 58 0C40-6 14-6 0 0Z" fill="#6fbf3f"/><path d="M2 0H54" stroke="#2e6418" stroke-width="2"/></g>
 <g id="slBig"><path d="M0 0C30-46 110-52 150 0C110 52 30 46 0 0Z" fill="#2f7a2a"/><path d="M0 0C30-46 110-52 150 0C108-14 34-14 0 0Z" fill="#45a03a"/><path d="M4 0H144M40 0l20-22M70 0l20-26M100 0l18-22M40 0l20 22M70 0l20 26M100 0l18 22" stroke="#1f5a1c" stroke-width="3" fill="none"/></g>
 <g id="slVine"><use href="#slBig" transform="translate(6 40) rotate(28) scale(.85)"/><use href="#slBig" transform="translate(20 22) rotate(-8) scale(.7)"/>
  <path d="M10 30C60 40 80 70 92 112C98 130 100 140 102 150" fill="none" stroke="#3d6b1f" stroke-width="6" stroke-linecap="round"/>
  <path d="M30 34C70 30 120 40 150 70C164 84 170 94 174 104" fill="none" stroke="#4a7d22" stroke-width="4.5" stroke-linecap="round"/>
  <use href="#slLeaf" transform="translate(70 52) rotate(35) scale(.8)"/><use href="#slLeaf" transform="translate(92 110) rotate(140) scale(.75)"/><use href="#slLeaf" transform="translate(101 146) rotate(70) scale(.6)"/>
  <use href="#slLeaf" transform="translate(132 50) rotate(-20) scale(.7)"/><use href="#slLeaf" transform="translate(166 88) rotate(70) scale(.7)"/></g></defs></svg>`;

/* ---------- interface ---------- */
let root=null;const $=s=>root.querySelector(s);
function icons(k){const [n,e]=k.split(":");const im=`<img src="${src(e)}" alt="${esc(NAME[e])}">`;return n==="3"?im+im+im:n==="2"?im+im+"<i>✕</i>":im+"<i>✕</i><i>✕</i>";}
function prize(r){return r.t==="ban"?r.v+` <img src="${src("banane")}" alt="bananes">`:esc(short(r));}
function build(){
  const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  root=document.createElement("div");root.id="mfSlot";if(ADMIN)root.classList.add("admin");root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Banana Machine");
  root.innerHTML=LEAF+`<div class="sl-top"><h2>Banana Machine</h2><span class="sl-tag sl-adm">Admin</span><button type="button" class="sl-tog sl-adm" id="slTog" aria-controls="slSide" aria-expanded="false">Réglages</button><button type="button" class="sl-x" id="slClose" aria-label="Fermer">✕</button></div>
  <div class="sl-body">
   <div class="sl-stage"><div class="sl-board" id="slBoard"></div><div class="sl-col"><img class="sl-logo" src="packs/banana-machine-titre.webp" alt="Banana Machine" width="1400" height="474"><div class="sl-m" id="slM">
    <svg class="sl-vine l" viewBox="0 0 230 190" aria-hidden="true"><use href="#slVine"/></svg><svg class="sl-vine r" viewBox="0 0 230 190" aria-hidden="true"><use href="#slVine"/></svg>
    <div class="sl-sign">MONKEY FAMILY<small>Trois singes = 7 boosters</small></div>
    <div class="sl-tb" id="slTb"><div class="sl-tbt">Table des gains</div><div class="sl-tbg">${ORDER.map(k=>{const [n,e]=k.split(":");const r=n==="3"?TRI[e]:n==="2"?PAIR.find(p=>p[0]===e)[1]:{t:"ban",v:1};
      return `<div class="sl-row${k==="3:singe"?" jk":""}" data-k="${k}"><span class="ic">${icons(k)}</span>${k==="3:singe"?"":'<span class="dt"></span>'}<span class="pz">${prize(r)}</span></div>`;}).join("")}</div>
     </div>
    <div class="sl-lights" aria-hidden="true">${"<i></i>".repeat(11)}</div>
    <div class="sl-win" aria-label="Rouleaux">${[0,1,2].map(i=>`<div class="sl-reel" id="slR${i}"><div class="sl-cells"></div></div>`).join("")}</div>
    <div class="sl-ctl"><button type="button" class="sl-go" id="slGo">Lancer · 1 <img src="${src("banane")}" alt="banane"></button>
     <div class="sl-pills"><div class="sl-pill">Bananes<b id="slBal"></b></div><div class="sl-pill">Tours<b id="slLeft"></b></div></div></div>
    <div class="sl-res" id="slRes" role="status">Mise 1 banane et tente ta chance.</div>
   </div></div></div>
   <aside class="sl-side sl-adm" id="slSide" aria-label="Réglages admin">
    <div class="sl-sidehead"><h3>Réglages admin</h3><button type="button" class="sl-x" id="slSideX" aria-label="Fermer les réglages">✕</button></div>
    <p class="sl-note">Ici tout est réel : tes vraies bananes sont misées, et les boosters et heures d'attente gagnés vont sur ton compte.</p>
    <label class="sl-chk" for="slForce" style="flex-wrap:wrap">Prochain tour
     <select id="slForce" style="min-height:44px;border-radius:10px;border:2px solid #5a3416;background:#3a200b;color:#fff3cf;font:700 14px Quicksand,sans-serif;padding:0 8px">
      <option value="">Tirage normal</option>${SYM.slice().reverse().map(x=>`<option value="${x.e}">Forcer 3 × ${esc(x.n)}</option>`).join("")}</select></label>
    <div class="sl-bar"><button type="button" class="sl-btn" id="slAdd">+50 🍌</button><button type="button" class="sl-btn" id="slDay">Rendre mes 10 tours</button></div>
    <div class="sl-bar"><label class="sl-chk"><input type="checkbox" id="slSnd" checked> Sons</label></div>
    <h3>Annonces envoyées</h3>
    <p class="sl-note">L'admin n'apparaît jamais dans le fil d'actu : voici ce que verraient tes potes.</p>
    <ul class="sl-feed" id="slFeed"></ul>
    <h3>Cette session</h3>
    <div class="sl-stats" id="slStats"></div>
   </aside>
  </div>
  <div class="sl-jp" id="slJpBox" hidden><div class="sl-rays"></div><div class="sl-jpin"><img class="sl-coin" id="slJpImg" src="${src("singe")}" alt=""><div class="sl-jpt" id="slJpT">JACKPOT !</div><div class="sl-jps" id="slJpSub"></div><button type="button" class="sl-go" style="display:inline-flex;min-height:52px;padding:0 26px;font-size:21px" id="slJpOk">Récupérer</button></div></div>`;
  document.body.appendChild(root);
  REELS.push(...[0,1,2].map(i=>{const el=$("#slR"+i),box=el.querySelector(".sl-cells");
    const strip=shuffle(SYM.flatMap(s=>Array(s.w).fill(s.e)));
    const imgs=Array.from({length:5},()=>{const im=document.createElement("img");im.alt="";box.appendChild(im);return im;});
    return {el,box,strip,imgs,p:Math.floor(Math.random()*strip.length),ch:80,h:160};}));
  new ResizeObserver(()=>REELS.forEach(R=>{layout(R);paint(R);})).observe($("#slM"));
  new ResizeObserver(fit).observe($(".sl-body"));new ResizeObserver(fit).observe($(".sl-stage"));
  $("#slSideX").addEventListener("click",()=>{side(false);$("#slTog").focus({preventScroll:true});});
  $("#slTog").addEventListener("click",()=>side(!$("#slSide").classList.contains("open")));
  $("#slClose").addEventListener("click",close);
  $("#slGo").addEventListener("click",spin);
  $("#slAdd").addEventListener("click",async e=>{e.target.disabled=true;try{applyState(await rpc("mf_admin_bananas",{p_n:50}));say("+50 bananes sur ton compte.");}catch(x){say(errText(x));}e.target.disabled=false;render();});
  $("#slDay").addEventListener("click",async e=>{e.target.disabled=true;try{const r=await rpc("mf_slot_admin_reset");S.left=+r.left;applyState(r.state);say("Tes 10 tours sont rendus.");}catch(x){say(errText(x));}e.target.disabled=false;render();});
  $("#slForce").addEventListener("change",e=>{force=e.target.value;});
  $("#slSnd").addEventListener("change",e=>{sound=e.target.checked;});
  $("#slJpBox").addEventListener("click",closeJp);
  document.addEventListener("keydown",e=>{if(e.key!=="Escape"||root.hidden)return;if(!$("#slJpBox").hidden)closeJp();else if($("#slSide").classList.contains("open"))side(false);else close();});
}
let fitting=false;
function fit(){if(!root||root.hidden||fitting)return;fitting=true;
  const b=$(".sl-body"),st=$(".sl-stage");
  // PC / écran large : table des gains à gauche, sinon au-dessus des rouleaux
  const wide=b.clientWidth>=900&&b.clientWidth/b.clientHeight>1.15;
  if(wide!==root.classList.contains("wide")){root.classList.toggle("wide",wide);
    const tb=$("#slTb");if(wide)$("#slBoard").appendChild(tb);else $("#slM").insertBefore(tb,$(".sl-lights"));}
  // téléphone : remplir tout l'écran ; si même ainsi ça ne tient pas (très petit écran), on réduit l'ensemble
  root.classList.toggle("fill",!wide&&b.clientWidth<700);
  if(root.classList.contains("fill")){st.style.transform="";
    const tb=$("#slTb"),fits=()=>{const bb=b.getBoundingClientRect(),m=$("#slRes").getBoundingClientRect();return m.bottom<=bb.bottom-6&&$(".sl-reel").clientHeight>=110;};
    tb.classList.add("open");  // la table des gains est toujours dépliée (elle défile dans son cadre si l'écran est petit)
    if(!fits())root.classList.remove("fill");
}
  if(!root.classList.contains("fill")){
    const k=Math.min(wide?1.7:1,(b.clientWidth-16)/st.offsetWidth,(b.clientHeight-10)/st.offsetHeight);
    st.style.transform=`translate(-50%,-50%) scale(${k>0?k:1})`;}
  REELS.forEach(R=>{layout(R);paint(R);});
  fitting=false;}
function side(o){$("#slSide").classList.toggle("open",o);$("#slTog").setAttribute("aria-expanded",String(o));}
function say(t,cls){const r=$("#slRes");r.className="sl-res"+(cls?" "+cls:"");r.textContent=t;}
function render(){
  $("#slBal").textContent=loaded?S.bal:"…";$("#slLeft").textContent=loaded?S.left:"…";
  $("#slGo").disabled=busy||!loaded||S.bal<COST||S.left<1;
  $("#slFeed").innerHTML=S.feed.length?S.feed.slice(0,20).map(f=>`<li class="${f.c||""}">${esc(f.t)}</li>`).join(""):'<li class="pity">Rien pour l\'instant.</li>';
  $("#slStats").innerHTML=[[S.spins,"tours"],[S.spent?Math.round(S.won/S.spent*100)+" %":"—","rendu"],[S.boosters,"boosters"],[S.won,"bananes gagnées"],[S.mins?(S.mins/60)+" h":"0","d'attente en moins"],[S.spent,"bananes misées"]]
    .map(([v,l])=>`<div class="sl-stat"><b>${esc(v)}</b><span>${l}</span></div>`).join("");
}
function hit(k){root.querySelectorAll(".sl-row").forEach(x=>x.classList.toggle("hit",!!k&&x.dataset.k===k));}
function post(t,c){if(!ADMIN)return;S.feed.unshift({t,c});S.feed=S.feed.slice(0,20);}

/* ---------- rouleaux : vrai défilement ---------- */
const REELS=[];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function layout(R){R.h=R.el.clientHeight;R.ch=R.h*.5;R.el.style.setProperty("--ch",R.ch+"px");}
function paint(R){const N=R.strip.length,base=Math.floor(R.p);
  R.imgs.forEach((im,k)=>{const i=base-2+k,e=R.strip[mod(i,N)];if(im.dataset.e!==e){im.dataset.e=e;im.src=src(e);}
    im.style.transform=`translateY(${(R.h/2+(i-R.p)*R.ch-R.ch*.42).toFixed(1)}px)`;});}
let ac=null;
function tone(type,f0,f1,vol,len){if(!sound||!ac)return;try{const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+len*.8);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+len+.01);}catch(e){}}
const clunk=f=>tone("triangle",f||170,55,.3,.16),tick=()=>tone("square",900,0,.025,.03);
const easeBack=x=>{const c1=1.3,c3=c1+1;return 1+c3*(x-1)**3+c1*(x-1)**2;};
const VMAX=20;
/* les rouleaux partent tout de suite ; ils ne s'arrêtent qu'une fois le résultat du serveur reçu (got() renvoie les 3 symboles, ou null tant qu'il n'est pas là) */
function roll(got,done){
  if(reduce){const wait=()=>{const s=got();if(!s){setTimeout(wait,30);return;}REELS.forEach((R,i)=>{const j=Math.floor(R.p);R.strip[mod(j,R.strip.length)]=s[i];R.p=j;paint(R);});done();};wait();return;}
  const stops=[800,1250,1700];let s=null,tense=false;
  const q=REELS.map(()=>({ph:"run",v:0}));const t0=performance.now();let last=t0,lastTick=0;
  function frame(t){const dt=Math.min(.05,(t-last)/1000);last=t;const el=t-t0;let all=true,fast=false;
    if(!s){s=got();if(s){tense=s[0]===s[1]&&(s[0]==="singe"||s[0]==="booster");if(tense)stops[2]+=1300;
      const late=el+100-stops[0];if(late>0)for(let i=0;i<3;i++)stops[i]+=late;}}
    REELS.forEach((R,i)=>{const Q=q[i],before=R.p;
      if(Q.ph==="run"){Q.v=el<110?-4:Math.min(VMAX,(el-110)/260*VMAX);R.p-=Q.v*dt;
        if(s&&tense&&i===2&&el>stops[1]+300)R.el.classList.add("tense");
        if(s&&el>=stops[i]){Q.ph="dec";const j=Math.floor(R.p)-4;R.strip[mod(j,R.strip.length)]=s[i];Q.from=R.p;Q.dist=R.p-j;Q.dur=Q.dist*4.2/VMAX*1000*(tense&&i===2?1.6:1);Q.ts=t;}}
      if(Q.ph==="dec"){const u=Math.min(1,(t-Q.ts)/Q.dur);R.p=Q.from-Q.dist*easeBack(u);
        if(Math.floor(before)!==Math.floor(R.p))tick();
        if(u>=1){R.p=Math.round(R.p);Q.ph="done";R.el.classList.remove("tense");clunk(i===2?140:170);}}
      const sp=Math.abs(R.p-before)/(dt||.016);R.box.style.filter=sp>6?`blur(${Math.min(3.5,sp/7).toFixed(1)}px)`:"none";if(sp>6)fast=true;
      paint(R);if(Q.ph!=="done")all=false;});
    if(fast&&t-lastTick>70){tick();lastTick=t;}
    if(all){REELS.forEach(R=>R.box.style.filter="none");done();}else requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
}

/* ---------- un tour ---------- */
function spin(){
  if(busy||!loaded||S.bal<COST||S.left<1)return;
  busy=true;
  if(!ac&&sound){try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  if(ac&&ac.state==="suspended")ac.resume().catch(()=>{});
  const f=force;force="";const fs=$("#slForce");if(fs)fs.value="";
  let res=null,err=null;
  rpc("mf_slot_spin",{p_force:f||null}).then(r=>{res=r;},e=>{err=e;});
  S.bal-=COST;render();
  REELS.forEach(R=>R.el.classList.remove("win"));hit(null);$("#slM").classList.add("spin");say("…");
  // en cas d'erreur, les rouleaux s'arrêtent sur des symboles qui ne gagnent rien
  const loser=()=>{for(;;){const x=[draw(),draw(),draw()];if(!pay(x))return x;}};let errS=null;
  roll(()=>res?res.s:err?(errS=errS||loser()):null,()=>{
    $("#slM").classList.remove("spin");
    if(err){S.bal+=COST;say(errText(err));busy=false;rpc("mf_slot_status").then(r=>{S.left=+r.left;applyState(r.state);render();},()=>{});render();return;}
    const s=res.s,r=res.win;S.left=+res.left;applyState(res.state);
    S.spins++;S.spent+=COST;
    if(r){if(r.t==="ban")S.won+=r.v;else if(r.t==="boost")S.boosters+=r.v;else S.mins+=r.v;
      hit(r.k);const tri=s[0]===s[1]&&s[1]===s[2];
      s.forEach((e,i)=>{if(tri||(r.k.startsWith("2:")&&r.k.slice(2)===e)||(r.k==="1:banane"&&i===0))REELS[i].el.classList.add("win");});
      if(r.k==="3:singe"){say("JACKPOT ! 7 boosters ajoutés à ton stock !","jack");post(`🎰 ${ME} a touché le JACKPOT à la Banana Machine : 7 boosters !`);celebrate("singe");}
      else{const kept=r.t==="time"&&+res.bank>0;
        say("Gagné : "+label(r)+(r.k==="1:banane"?" (mise rendue)":r.t==="boost"?" dans ton stock":kept?", gardé pour ta prochaine attente":""),"good");tone("sine",660,990,.15,.25);
        if(r.t!=="ban"||r.v>=10)post(`🎰 ${ME} a gagné ${label(r)} à la Banana Machine.`);
        if(r.k==="3:booster"||r.k==="3:maman")celebrate(r.k.slice(2));
        if(r.k==="3:sablier")celebrate("sablier",kept?"d'attente, gardées pour ton prochain booster":"d'attente en moins sur ton prochain booster");}
    }else say("Perdu. La banane est partie.");
    if(res.pity){post(`🐒 ${ME} a tout perdu à la machine… Le singe a eu pitié : +${PITY} bananes.`,"pity");say(`Tu as tout perdu… Le singe a pitié de toi : +${PITY} bananes.`);}
    busy=false;render();
  });
}

/* ---------- jackpot ---------- */
let jpT=[];
/* grands gains : jackpot (3 singes), 3 boosters, −6 h (3 sabliers), 40 bananes (3 mamans) */
const BIG={
  singe:{t:"JACKPOT !",s:()=>`${esc(ME)} gagne <b>7 boosters</b>`,parts:["singe","banane"],mode:"burst",waves:[40,30,30,24],ray:"rgba(255,210,63,.32)",shake:true,notes:[523,659,784,1047]},
  booster:{t:"3 BOOSTERS !",s:()=>"ajoutés à ton stock",parts:["booster"],mode:"burst",waves:[26,20],ray:"rgba(255,95,60,.32)",cls:"tilt",shake:true,notes:[523,659,784]},
  sablier:{t:"−6 H !",s:x=>esc(x||"d'attente en moins"),parts:["sablier"],mode:"spiral",ray:"rgba(120,220,255,.28)",cls:"flip",notes:[784,659,523,659,784]},
  maman:{t:"40 BANANES !",count:40,s:()=>"Planquez vos mamans…",parts:["banane"],mode:"rain",ray:"rgba(255,150,200,.30)",cls:"peek",notes:[659,784,880]}};
function celebrate(kind,sub){
  const C=BIG[kind],box=$("#slJpBox");
  box.className="sl-jp"+(C.cls?" "+C.cls:"");box.style.setProperty("--ray",C.ray);
  const img=$("#slJpImg");img.src=src(kind);
  const T=$("#slJpT");T.className="sl-jpt"+(kind==="singe"?"":" small");T.textContent=C.t;
  $("#slJpSub").innerHTML=C.s(sub);
  box.hidden=false;$("#slJpOk").focus({preventScroll:true});
  C.notes.forEach((f,i)=>setTimeout(()=>tone("triangle",f,0,.2,.35),i*140));
  if(C.count&&!reduce){const t0=performance.now(),run=t=>{const u=Math.min(1,(t-t0)/1300);T.textContent=Math.round(C.count*(1-(1-u)**3))+" BANANES !";if(u<1&&!box.hidden)requestAnimationFrame(run);else T.textContent=C.t;};requestAnimationFrame(run);}
  if(reduce)return;
  if(C.shake){const m=$("#slM");m.classList.remove("shake");void m.offsetWidth;m.classList.add("shake");}
  const f=document.createElement("div");f.className="sl-flash";if(kind!=="singe")f.style.opacity=".6";root.appendChild(f);setTimeout(()=>f.remove(),800);
  const sprite=()=>src(C.parts[Math.floor(Math.random()*C.parts.length)]);
  const add=(kf,dur,size)=>{const im=document.createElement("img");im.className="sl-pt";im.alt="";im.src=sprite();if(size)im.style.width=im.style.height=size+"px";box.appendChild(im);im.animate(kf,{duration:dur,easing:"cubic-bezier(.15,.7,.4,1)"}).onfinish=()=>im.remove();};
  const burst=n=>{for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,d=220+Math.random()*Math.max(innerWidth,innerHeight)*.6,x=Math.cos(a)*d,y=Math.sin(a)*d*.8,sc=.5+Math.random()*.9,rot=(Math.random()-.5)*900;
    add([{transform:"translate(0,0) scale(.2)",opacity:1},{transform:`translate(${x*.85}px,${y*.85-140}px) scale(${sc}) rotate(${rot*.6}deg)`,opacity:1,offset:.45},{transform:`translate(${x}px,${y+420}px) scale(${sc}) rotate(${rot}deg)`,opacity:0}],1600+Math.random()*1400);}};
  const rain=n=>{for(let i=0;i<n;i++){const x=(Math.random()-.5)*innerWidth,y0=-innerHeight*.45-80-Math.random()*200,rot=(Math.random()-.5)*720,sc=.5+Math.random()*.7;
    setTimeout(()=>{if(!box.hidden)add([{transform:`translate(${x}px,${y0}px) scale(${sc}) rotate(0deg)`,opacity:1},{transform:`translate(${x+(Math.random()-.5)*80}px,${innerHeight*.65}px) scale(${sc}) rotate(${rot}deg)`,opacity:1}],1500+Math.random()*900,48);},Math.random()*2600);}};
  const spiral=n=>{for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,r1=140+Math.random()*60,r2=Math.max(innerWidth,innerHeight)*.7,dir=1;
    const kf=[0,.25,.5,.75,1].map(u=>{const a=a0+u*Math.PI*1.5*dir,r=r1*(1-u)+r2*u;return {transform:`translate(${Math.cos(a)*r*(u?1:.1)}px,${Math.sin(a)*r*(u?1:.1)}px) scale(${.4+u*.4}) rotate(${u*540}deg)`,opacity:u<.85?1:0};});
    setTimeout(()=>{if(!box.hidden)add(kf,2200,44);},i*45);}};
  if(C.mode==="burst"){burst(C.waves[0]);jpT=C.waves.slice(1).map((n,i)=>setTimeout(()=>burst(n),700+i*800));}
  if(C.mode==="rain"){rain(70);jpT=[setTimeout(()=>rain(40),1800)];}
  if(C.mode==="spiral"){spiral(24);jpT=[setTimeout(()=>spiral(24),1300)];}
}
function closeJp(){jpT.forEach(clearTimeout);$("#slJpBox").hidden=true;$("#slJpBox").querySelectorAll(".sl-pt").forEach(x=>x.remove());$("#slGo").focus({preventScroll:true});}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
function open(){
  if(!root)build();
  root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
  REELS.forEach(R=>{layout(R);paint(R);});render();fit();$("#slGo").focus({preventScroll:true});
  if(!busy)rpc("mf_slot_status").then(r=>{S.left=+r.left;applyState(r.state);loaded=true;render();},e=>{say(errText(e));});
}
function close(){if(busy)return;root.hidden=true;document.body.style.overflow=prevOverflow;if(opener&&opener.focus)opener.focus();}

/* ---------- démarrage : admin seulement ---------- */
async function boot(){
  if(!window.claude||!window.claude.use)return;
  let user=null;try{user=await window.claude.use("user");}catch(e){}
  if(!user||typeof window.MF_RPC!=="function")return;
  try{ADMIN=!!(await user.isOwner());}catch(e){}
  try{const me=await user.me();if(me&&me.name)ME=me.name;}catch(e){}
  // la machine s'inscrit au Casino (bouton rond commun sous le Classement)
  if(window.MF_CASINO)window.MF_CASINO.add({id:"slot",name:"Banana Machine",order:1,root:"mfSlot",open,
    icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 5v-1.5a.5 .5 0 0 1 .5 -.5h7a.5 .5 0 0 1 .5 .5v1.5"/><rect x="3" y="5" width="14" height="15.5" rx="2"/><rect x="5.5" y="8" width="9" height="5" rx="1"/><path d="M8.5 8v5"/><path d="M11.5 8v5"/><path d="M7.5 17h5"/><path d="M17 14h2a1 1 0 0 0 1 -1v-5.5"/><circle cx="20" cy="5.5" r="1.5"/></svg>`,
    status:async()=>{const r=await rpc("mf_slot_status"),n=+r.left;if(!busy)S.left=n;
      return {line:n>0?`${n} tour${n>1?"s":""} restant${n>1?"s":""} aujourd'hui`:"Plus de tours aujourd'hui · reviens demain",hot:false};}});
  SYM.forEach(s=>{const i=new Image();i.src=src(s.e);});{const i=new Image();i.src="packs/banana-machine-titre.webp";}
}
window.MF_SLOT={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

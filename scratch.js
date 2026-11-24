/* Monkey Family — Ticket à gratter « Monkey Cash »
   1 ticket gratuit par jour, ou un ticket payant (prix et nombre par jour réglés côté serveur).
   9 cases : 3 symboles identiques = le lot de ce symbole.
   Le tirage, le gain et les limites sont décidés par le serveur (mf_scratch_buy) : le gain est déjà sur le compte
   quand le ticket arrive. Cette page ne fait que cacher le résultat sous la couche à gratter, puis prévient le serveur
   (mf_scratch_done) une fois le ticket gratté, pour l'annonce dans le fil d'actu.
   Visible par l'admin seulement tant que le ticket n'est pas « ouvert à tous » (réglages admin). */
(function(){
"use strict";

/* ---------- symboles et lots (mêmes valeurs que _scratch_prize côté serveur) ---------- */
const SYM={
  singe:{n:"Singe Monkey Family",p:"3 boosters"},
  booster:{n:"Booster",p:"1 booster"},
  maman:{n:"Planquez vos mamans",p:"25 🍌"},
  sablier:{n:"Sablier",p:"−2 h"},
  camera:{n:"Caméra",p:"10 🍌"},
  banane:{n:"Banane",p:"5 🍌"}};
const ORDER=["singe","booster","maman","sablier","camera","banane"];
const src=e=>"packs/slot-"+e+".webp";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const label=r=>!r?"":r.t==="ban"?r.v+" banane"+(r.v>1?"s":""):r.t==="boost"?r.v+" booster"+(r.v>1?"s":""):(r.v/60)+" h d'attente en moins";
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const ERR={no_bananas:"Pas assez de bananes.",scratch_limit:"Plus de tickets payants aujourd'hui : reviens demain !",scratch_free_used:"Ton ticket gratuit du jour est déjà pris.",scratch_closed:"Les tickets ne sont pas encore en vente.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};

/* ---------- état ---------- */
let INFO=null,skew=0;          // dernière réponse du serveur ; décalage entre l'horloge du serveur et celle du téléphone
let T=null,phase="none";        // ticket affiché ; none (pas de ticket) | scratch (à gratter) | done (gratté)
let ADMIN=false,USER=null,busy=false,sound=true,buzz=true,force="",armed=false;
function applyState(st){if(!st)return;try{if(window.MF_APPLY)window.MF_APPLY(st);}catch(e){}}
function take(r){if(!r)return;INFO=r;if(r.state&&+r.state.now)skew=+r.state.now-Date.now();badge();}
/* le solde affiché ne montre pas encore le gain d'un ticket pas gratté (sinon ça vend la mèche) */
/* état du compte sans le gain du ticket pas encore gratté (pour le reste du jeu, en attendant) */
function hidden(){if(!INFO||!INFO.state)return null;const st={...INFO.state};
  if(phase==="scratch"&&T&&T.win){if(T.win.t==="ban")st.bananas=+st.bananas-T.win.v;if(T.win.t==="boost")st.stock=Math.max(0,+st.stock-T.win.v);}
  return st;}
function balance(){if(!INFO||!INFO.state)return null;let b=+INFO.state.bananas||0;
  if(phase==="scratch"&&T&&T.win&&T.win.t==="ban")b-=T.win.v;return b;}

/* ---------- style ---------- */
const CSS=`
#mfScratch{position:fixed;inset:0;z-index:9000;overflow:hidden;overscroll-behavior:none;display:flex;flex-direction:column;color:#fff4dc;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:radial-gradient(ellipse 80% 55% at 50% 38%,rgba(255,150,60,.28),transparent 70%),radial-gradient(circle at 20% 90%,rgba(120,60,200,.35),transparent 50%),linear-gradient(180deg,#2b0f4a,#14072a)}
#mfScratch[hidden]{display:none}
#mfScratch *{box-sizing:border-box;min-width:0}
#mfScratch button{font-family:inherit}
#mfScratch button:focus-visible,#mfScratch select:focus-visible,#mfScratch input:focus-visible{outline:3px solid #ffd23f;outline-offset:3px}
.sc-stars{position:absolute;inset:0;pointer-events:none;opacity:.55;background-image:radial-gradient(1.5px 1.5px at 12% 18%,#ffe9a8 50%,transparent 51%),radial-gradient(1px 1px at 78% 12%,#fff 50%,transparent 51%),radial-gradient(2px 2px at 88% 46%,#ffd23f 50%,transparent 51%),radial-gradient(1px 1px at 6% 62%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 30% 84%,#ffe9a8 50%,transparent 51%),radial-gradient(1px 1px at 64% 92%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 94% 80%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 44% 6%,#ffd23f 50%,transparent 51%)}
.sc-top{flex:none;position:relative;z-index:6;display:flex;align-items:center;gap:8px;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 4px max(12px,env(safe-area-inset-left))}
.sc-top h2{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.sc-x,.sc-gear{min-width:44px;min-height:44px;border-radius:12px;border:2px solid #6a3aa0;background:#2a1145;color:#ffd23f;font:400 20px "Titan One",sans-serif;cursor:pointer;display:grid;place-items:center}
.sc-gear[aria-expanded=true]{background:#ffd23f;color:#2a1145}
.sc-tag{font:700 12px Quicksand,sans-serif;background:#ffd23f;color:#2a1145;border-radius:99px;padding:3px 10px}
.sc-pill{margin-left:auto;background:#2a1145;border-radius:12px;padding:6px 12px;font-weight:700;color:#ffd23f;white-space:nowrap;box-shadow:inset 0 0 0 2px #6a3aa0}
.sc-pill b{font:400 20px "Titan One",sans-serif;color:#fff;margin-left:4px}
#mfScratch:not(.admin) .sc-adm,body.preview #mfScratch .sc-adm{display:none!important}

.sc-main{flex:1;min-height:0;position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:4px 12px max(14px,env(safe-area-inset-bottom))}
.sc-ticket{--w:min(430px,94vw,calc((100svh - 270px) / 1.52));width:var(--w);flex:none;position:relative;border-radius:18px;padding:calc(var(--w)*.035);
 background:linear-gradient(160deg,#ffe28a,#ffb347 45%,#ff7b54);
 box-shadow:0 0 0 3px #8a3b12,0 14px 0 #5b2208,0 24px 44px rgba(0,0,0,.55)}
.sc-ticket::before,.sc-ticket::after{content:"";position:absolute;top:calc(var(--w)*.205);width:18px;height:18px;border-radius:50%;background:#1f0b38;box-shadow:inset 0 0 0 3px #8a3b12}
.sc-ticket::before{left:-9px}.sc-ticket::after{right:-9px}
.sc-ticket.new{animation:scIn .55s cubic-bezier(.2,1.3,.4,1) both}
@keyframes scIn{from{transform:translateY(60vh) rotate(8deg);opacity:0}to{transform:none;opacity:1}}
.sc-head{text-align:center;padding:0 0 calc(var(--w)*.03);border-bottom:3px dashed rgba(138,59,18,.45);margin-bottom:calc(var(--w)*.035)}
.sc-brand{font:400 calc(var(--w)*.115)/1 "Titan One",sans-serif;color:#fff6c8;letter-spacing:.02em;text-shadow:0 4px 0 #8a3b12,3px 0 0 #8a3b12,-3px 0 0 #8a3b12,0 -3px 0 #8a3b12,0 8px 14px rgba(90,20,0,.35)}
.sc-brand span{color:#ffd23f;margin-left:.2em}
.sc-sub{margin-top:calc(var(--w)*.022);font:700 calc(var(--w)*.035)/1.2 Quicksand,sans-serif;color:#5b2208}
.sc-zone{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:#fff6dc;box-shadow:inset 0 0 0 3px #8a3b12}
.sc-grid{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:calc(var(--w)*.012);padding:calc(var(--w)*.02);
 background:repeating-linear-gradient(45deg,#fff1c9 0 10px,#ffe9b5 10px 20px)}
.sc-cell{position:relative;border-radius:10px;background:#fffaf0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:inset 0 0 0 2px rgba(138,59,18,.25)}
.sc-cell img{width:62%;height:auto;aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 3px 2px rgba(0,0,0,.2))}
.sc-cell span{font:400 calc(var(--w)*.032)/1 "Titan One",sans-serif;color:#8a3b12;white-space:nowrap}
.sc-cell.hit{background:radial-gradient(circle,#fff6b0,#ffd23f);box-shadow:0 0 0 3px #ff7b00,0 0 22px #ffb300;animation:scHit .6s cubic-bezier(.2,1.6,.4,1) both;z-index:1}
.sc-cell.hit:nth-child(n){animation-delay:var(--d,0s)}
@keyframes scHit{0%{transform:scale(1)}50%{transform:scale(1.14) rotate(-3deg)}100%{transform:scale(1.04)}}
.sc-cell.dim{opacity:.45;filter:grayscale(.5)}
.sc-foil,.sc-dust{position:absolute;inset:0;width:100%;height:100%}
.sc-foil{touch-action:none;cursor:grab;transition:opacity .6s ease}
.sc-foil.gone{opacity:0;pointer-events:none}
.sc-foil.off{pointer-events:none}
.sc-dust{pointer-events:none;z-index:2}
.sc-hand{position:absolute;left:50%;top:55%;z-index:3;pointer-events:none;font-size:calc(var(--w)*.13);filter:drop-shadow(0 4px 4px rgba(0,0,0,.4));animation:scHand 1.6s ease-in-out infinite}
.sc-hand[hidden]{display:none}
@keyframes scHand{0%,100%{transform:translate(-90%,0) rotate(-10deg)}50%{transform:translate(-10%,-14%) rotate(10deg)}}
.sc-cover{position:absolute;inset:0;z-index:3;display:grid;place-items:center;text-align:center;padding:16px;pointer-events:none}
.sc-cover span{padding:.55em .9em;border-radius:14px;background:rgba(42,17,69,.86);box-shadow:0 0 0 3px #ffd23f,0 10px 24px rgba(0,0,0,.4);font:400 calc(var(--w)*.055)/1.15 "Titan One",sans-serif;color:#ffd23f}
.sc-cover[hidden]{display:none}
.sc-legend{display:grid;grid-template-columns:repeat(3,1fr);gap:calc(var(--w)*.012) calc(var(--w)*.02);margin-top:calc(var(--w)*.03);padding:calc(var(--w)*.02);border-radius:10px;background:rgba(255,250,235,.55);box-shadow:inset 0 0 0 2px rgba(138,59,18,.3)}
.sc-lg{display:flex;align-items:center;gap:4px;font:700 calc(var(--w)*.032)/1.1 Quicksand,sans-serif;color:#5b2208;white-space:nowrap}
.sc-lg img{width:calc(var(--w)*.062);height:calc(var(--w)*.062);flex:none}
.sc-lg b{font:400 calc(var(--w)*.034)/1 "Titan One",sans-serif;color:#8a3b12}
.sc-lg.jk b{color:#c2410c}
.sc-foot{display:flex;justify-content:space-between;gap:8px;margin-top:calc(var(--w)*.022);font:700 calc(var(--w)*.026)/1 Quicksand,sans-serif;color:#7a3410;letter-spacing:.03em}

.sc-res{width:min(430px,94vw);min-height:48px;border-radius:12px;padding:8px 14px;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;text-align:center;color:#2a1145;background:#f3e6ff;box-shadow:inset 0 0 0 2px #b48be0}
.sc-res.good{background:#d7f5b0;box-shadow:inset 0 0 0 2px #7cbf3c}
.sc-res.jack{background:linear-gradient(90deg,#ffd23f,#ffb300);font:400 20px "Titan One",sans-serif}
.sc-res.bad{background:#ffd6d6;box-shadow:inset 0 0 0 2px #e07a7a}
.sc-ctl{width:min(430px,94vw);display:flex;gap:10px}
.sc-ctl[hidden]{display:none}
.sc-btn{flex:1 1 0;min-height:58px;border:0;border-radius:16px;cursor:pointer;color:#4a2a10;font:400 19px/1.05 "Titan One",sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 10px;
 background:linear-gradient(180deg,#ffe066,#f5b700);box-shadow:0 5px 0 #a86c00,0 9px 14px rgba(0,0,0,.35)}
.sc-btn small{font:700 12px/1.1 Quicksand,sans-serif;opacity:.85}
.sc-btn.alt{background:linear-gradient(180deg,#d6b4ff,#9b5de5);color:#1f0b38;box-shadow:0 5px 0 #5b2d99,0 9px 14px rgba(0,0,0,.35)}
.sc-btn.ghost{background:#2a1145;color:#ffd23f;box-shadow:inset 0 0 0 2px #6a3aa0;min-height:48px;font-size:16px}
.sc-btn:active:not(:disabled){transform:translateY(4px);box-shadow:0 1px 0 #a86c00}
.sc-btn:disabled{background:#5d4a72;color:#c9b8de;box-shadow:0 5px 0 #3a2a4e;cursor:not-allowed}
.sc-btn.free:not(:disabled){animation:scGlow 1.4s ease-in-out infinite alternate}
@keyframes scGlow{to{box-shadow:0 5px 0 #a86c00,0 0 24px rgba(255,210,63,.85)}}

.sc-side{position:absolute;top:0;left:0;bottom:0;z-index:7;width:min(380px,100%);overflow-y:auto;overscroll-behavior:contain;background:#1c0b33;border-right:2px solid #6a3aa0;padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px;box-shadow:20px 0 40px rgba(0,0,0,.5)}
.sc-side:not(.open){display:none}
.sc-side>*{flex-shrink:0}
.sc-sidehead{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sc-side h3{margin:0;font:400 20px "Titan One",sans-serif;color:#ffd23f}
.sc-note{margin:0;font-size:13px;color:#d9c6f2}
.sc-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sc-sbtn{min-height:44px;border-radius:10px;border:2px solid #6a3aa0;background:#2a1145;color:#fff4dc;font:700 14px Quicksand,sans-serif;padding:8px 12px;cursor:pointer}
.sc-sbtn.warn{border-color:#ff9a3d;color:#ffd23f}
.sc-chk{display:flex;gap:8px;align-items:center;font-weight:700;font-size:14px;min-height:44px;flex-wrap:wrap}.sc-chk input{width:20px;height:20px}
.sc-chk select{min-height:44px;border-radius:10px;border:2px solid #6a3aa0;background:#2a1145;color:#fff4dc;font:700 14px Quicksand,sans-serif;padding:0 8px}
.sc-odds{margin:0;padding:0;list-style:none;font-size:13px;color:#d9c6f2}
.sc-odds li{display:flex;justify-content:space-between;padding:3px 0;border-top:1px solid #3a1d5e}.sc-odds li:first-child{border-top:0}

.sc-jp{position:fixed;inset:0;z-index:9100;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 45%,rgba(140,60,0,.8),rgba(20,7,42,.95) 70%);cursor:pointer}
.sc-jp[hidden]{display:none}
.sc-rays{position:absolute;left:50%;top:45%;width:220vmax;height:220vmax;margin:-110vmax 0 0 -110vmax;background:repeating-conic-gradient(var(--ray,rgba(255,210,63,.32)) 0 9deg,transparent 9deg 18deg);-webkit-mask:radial-gradient(circle,#000 0,transparent 45%);mask:radial-gradient(circle,#000 0,transparent 45%);animation:scTurn 14s linear infinite}
@keyframes scTurn{to{transform:rotate(360deg)}}
.sc-jpin{position:relative;z-index:2;text-align:center;padding:16px}
.sc-coin{width:min(50vw,240px);filter:drop-shadow(0 0 40px rgba(255,200,60,.9));animation:scPop .9s cubic-bezier(.2,1.7,.4,1) both,scBob 2.2s .9s ease-in-out infinite}
.sc-jpt{font:400 clamp(48px,12vw,110px)/1 "Titan One",sans-serif;color:#ffd23f;margin-top:6px;text-shadow:0 7px 0 #8a4b00,5px 0 0 #8a4b00,-5px 0 0 #8a4b00,0 0 40px #ffb300;animation:scPop .8s .25s cubic-bezier(.2,1.7,.4,1) both}
.sc-jps{font:700 clamp(18px,3vw,24px) Quicksand,sans-serif;color:#fff3cf;margin:10px 0 20px;animation:scPop .6s .6s both}
.sc-jp .sc-btn{display:inline-flex;min-height:52px;padding:0 26px;font-size:21px}
@keyframes scPop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes scBob{50%{transform:translateY(-12px) rotate(4deg)}}
.sc-flash{position:fixed;inset:0;z-index:9200;background:#fff7d0;pointer-events:none;animation:scFlash .7s ease-out forwards}@keyframes scFlash{from{opacity:.9}to{opacity:0}}
.sc-pt{position:absolute;left:50%;top:45%;width:54px;height:54px;margin:-27px;z-index:1;pointer-events:none}
@media(max-height:640px){.sc-ticket{--w:min(430px,94vw,calc((100svh - 230px) / 1.52))}.sc-btn{min-height:50px;font-size:17px}.sc-res{min-height:40px;font-size:14px}}
@media(prefers-reduced-motion:reduce){.sc-ticket.new,.sc-hand,.sc-cell.hit,.sc-btn.free,.sc-rays,.sc-coin,.sc-jpt{animation:none}}
`;

/* ---------- interface ---------- */
let root=null;const $=s=>root.querySelector(s);
function build(){
  const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  root=document.createElement("div");root.id="mfScratch";if(ADMIN)root.classList.add("admin");root.hidden=true;
  root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Monkey Cash, ticket à gratter");
  root.innerHTML=`<div class="sc-stars"></div>
  <div class="sc-top"><h2>Monkey Cash</h2>
   <button type="button" class="sc-gear sc-adm" id="scTog" aria-controls="scSide" aria-expanded="false" aria-label="Réglages admin">⚙</button><span class="sc-tag sc-adm">Admin</span>
   <div class="sc-pill">🍌<b id="scBal">…</b></div>
   <button type="button" class="sc-x" id="scClose" aria-label="Fermer">✕</button></div>
  <div class="sc-main">
   <div class="sc-ticket" id="scTicket">
    <div class="sc-head"><div class="sc-brand">MONKEY<span>CASH</span></div><div class="sc-sub">3 symboles identiques = tu gagnes le lot !</div></div>
    <div class="sc-zone" id="scZone">
     <div class="sc-grid" id="scGrid" aria-label="Cases du ticket"></div>
     <canvas class="sc-foil" id="scFoil" aria-label="Couche à gratter : glisse le doigt dessus"></canvas>
     <canvas class="sc-dust" id="scDust" aria-hidden="true"></canvas>
     <div class="sc-hand" id="scHand" aria-hidden="true" hidden>👆</div>
     <div class="sc-cover" id="scCover"><span>Prends un ticket<br>pour gratter !</span></div>
    </div>
    <div class="sc-legend">${ORDER.map(e=>`<div class="sc-lg${e==="singe"?" jk":""}"><img src="${src(e)}" alt="${esc(SYM[e].n)}"><b>${esc(SYM[e].p)}</b></div>`).join("")}</div>
    <div class="sc-foot"><span>N° <b id="scNo">——</b></span><span>Jeu de grattage · Monkey Family</span></div>
   </div>
   <div class="sc-res" id="scRes" role="status">…</div>
   <div class="sc-ctl" id="scBuy">
    <button type="button" class="sc-btn free" id="scFree">Ticket gratuit<small id="scFreeS">1 par jour</small></button>
    <button type="button" class="sc-btn alt" id="scPaid">Acheter<small id="scPaidS">…</small></button></div>
   <div class="sc-ctl" id="scPlay" hidden><button type="button" class="sc-btn ghost" id="scAll">Tout gratter d'un coup</button></div>
  </div>
  <aside class="sc-side sc-adm" id="scSide" aria-label="Réglages admin">
   <div class="sc-sidehead"><h3>Réglages admin</h3><button type="button" class="sc-x" id="scSideX" aria-label="Fermer les réglages">✕</button></div>
   <p class="sc-note">Ici tout est réel : tes vraies bananes sont dépensées et les lots arrivent sur ton compte. L'admin n'apparaît jamais dans le fil d'actu.</p>
   <label class="sc-chk" for="scForce">Prochain ticket
    <select id="scForce"><option value="">Tirage normal</option><option value="perdu">Forcer : perdu</option>${ORDER.map(e=>`<option value="${e}">Forcer : 3 × ${esc(SYM[e].n)} (${esc(SYM[e].p)})</option>`).join("")}</select></label>
   <div class="sc-bar"><button type="button" class="sc-sbtn" id="scAdd">+50 🍌</button><button type="button" class="sc-sbtn" id="scReset">Rendre mes tickets du jour</button></div>
   <div class="sc-bar"><label class="sc-chk"><input type="checkbox" id="scSnd" checked> Sons</label><label class="sc-chk"><input type="checkbox" id="scVib" checked> Vibrations</label></div>
   <h3>Joueurs</h3>
   <p class="sc-note" id="scOpenNote"></p>
   <div class="sc-bar"><button type="button" class="sc-sbtn warn" id="scOpen"></button></div>
   <h3>Chances par ticket</h3>
   <ul class="sc-odds">${[["Jackpot · 3 boosters","0,4 %"],["1 booster","2,5 %"],["25 🍌","3 %"],["−2 h d'attente","4 %"],["10 🍌","7 %"],["5 🍌","15 %"],["Perdu","68,1 %"]].map(([a,b])=>`<li><span>${a}</span><b>${b}</b></li>`).join("")}</ul>
   <p class="sc-note">Un ticket gagne 1 fois sur 3. Un ticket payant rend en moyenne 3,7 🍌 pour 5 🍌 (en comptant un booster à 40 🍌), sans compter le sablier.</p>
  </aside>
  <div class="sc-jp" id="scJp" hidden><div class="sc-rays"></div><div class="sc-jpin"><img class="sc-coin" id="scJpImg" alt=""><div class="sc-jpt" id="scJpT"></div><div class="sc-jps" id="scJpS"></div><button type="button" class="sc-btn" id="scJpOk">Récupérer</button></div></div>`;
  document.body.appendChild(root);
  $("#scClose").addEventListener("click",close);
  $("#scTog").addEventListener("click",()=>side(!$("#scSide").classList.contains("open")));
  $("#scSideX").addEventListener("click",()=>{side(false);$("#scTog").focus({preventScroll:true});});
  $("#scFree").addEventListener("click",()=>buy(false));
  $("#scPaid").addEventListener("click",()=>buy(true));
  $("#scAll").addEventListener("click",()=>reveal(true));
  $("#scForce").addEventListener("change",e=>{force=e.target.value;});
  $("#scSnd").addEventListener("change",e=>{sound=e.target.checked;});
  $("#scVib").addEventListener("change",e=>{buzz=e.target.checked;});
  $("#scAdd").addEventListener("click",async e=>{e.target.disabled=true;try{const st=await rpc("mf_admin_bananas",{p_n:50});if(INFO)INFO.state=st;applyState(st);say("+50 bananes sur ton compte.");}catch(x){say(errText(x),"bad");}e.target.disabled=false;render();});
  $("#scReset").addEventListener("click",async e=>{e.target.disabled=true;try{take(await rpc("mf_scratch_admin",{p_action:"reset"}));T=null;phase="none";paintGrid();foil.reset();say("Ton ticket gratuit et tes tickets payants du jour sont rendus.");}catch(x){say(errText(x),"bad");}e.target.disabled=false;render();});
  $("#scOpen").addEventListener("click",openToAll);
  $("#scJp").addEventListener("click",e=>{if(e.target.id==="scJp"||e.target.id==="scJpOk"||e.target.closest(".sc-jpin"))closeJp();});
  document.addEventListener("keydown",e=>{if(e.key!=="Escape"||!root||root.hidden)return;if(!$("#scJp").hidden)closeJp();else if($("#scSide").classList.contains("open"))side(false);else close();});
  foil.init($("#scZone"),$("#scFoil"),$("#scDust"));
  paintGrid();
}
function side(o){$("#scSide").classList.toggle("open",o);$("#scTog").setAttribute("aria-expanded",String(o));if(o)render();}
function say(t,cls){const r=$("#scRes");r.className="sc-res"+(cls?" "+cls:"");r.textContent=t;}
function paintGrid(){
  const g=T&&T.grid?T.grid:Array(9).fill(null);
  $("#scGrid").innerHTML=g.map((e,i)=>e?`<div class="sc-cell" data-e="${esc(e)}" data-i="${i}"><img src="${src(e)}" alt="${esc(SYM[e]?SYM[e].n:e)}"><span>${esc(SYM[e]?SYM[e].p:"")}</span></div>`:`<div class="sc-cell"></div>`).join("");
  $("#scNo").textContent=T&&T.id?String(T.id).padStart(6,"0"):"——";
}
function hm(ms){ms=Math.max(0,ms);const h=Math.floor(ms/3600000),m=Math.ceil((ms%3600000)/60000);return h?`${h} h ${String(m===60?59:m).padStart(2,"0")}`:`${Math.max(1,m)} min`;}
function render(){
  if(!root)return;
  const b=balance();$("#scBal").textContent=b==null?"…":b;
  $("#scBuy").hidden=phase==="scratch";$("#scPlay").hidden=phase!=="scratch";
  $("#scCover").hidden=phase!=="none";
  const ok=!!INFO&&!busy;
  const fr=$("#scFree"),pd=$("#scPaid");
  fr.disabled=!ok||!INFO.free;fr.classList.toggle("free",ok&&INFO.free);
  fr.firstChild.textContent=INFO&&!INFO.free?"Gratuit pris":"Ticket gratuit";
  $("#scFreeS").textContent=!INFO?"…":INFO.free?"offert aujourd'hui":"nouveau dans "+hm(+INFO.nextFree-(Date.now()+skew));
  const price=INFO?+INFO.price:5,left=INFO?+INFO.paidLeft:0;
  pd.firstChild.textContent=`Acheter · ${price} 🍌`;
  $("#scPaidS").textContent=!INFO?"…":left>0?`encore ${left} aujourd'hui`:"plus de tickets aujourd'hui";
  pd.disabled=!ok||left<1||(b!=null&&b<price);
  if(ADMIN&&INFO){const o=!!INFO.open;
    $("#scOpenNote").textContent=o?"Le ticket est ouvert : tous les joueurs voient le bouton.":"Le ticket est caché : toi seul vois le bouton.";
    $("#scOpen").textContent=armed?(o?"Sûr ? Cacher le ticket":"Sûr ? Ouvrir à tous les joueurs"):(o?"Cacher aux joueurs":"Ouvrir à tous les joueurs");}
}
function idleText(){if(!INFO)return "…";
  if(INFO.free)return "Ton ticket gratuit du jour t'attend !";
  if(+INFO.paidLeft>0)return `Ticket gratuit déjà pris. Un autre pour ${INFO.price} 🍌 ?`;
  return "C'est tout pour aujourd'hui : reviens demain !";}
async function openToAll(){
  if(!armed){armed=true;render();setTimeout(()=>{armed=false;render();},4000);return;}
  armed=false;const b=$("#scOpen");b.disabled=true;
  try{take(await rpc("mf_scratch_admin",{p_action:INFO&&INFO.open?"close":"open"}));say(INFO.open?"Le ticket est ouvert à tous les joueurs !":"Le ticket est de nouveau caché.");}catch(x){say(errText(x),"bad");}
  b.disabled=false;render();}

/* ---------- acheter / recevoir un ticket ---------- */
async function buy(paid){
  if(busy||phase==="scratch")return;
  busy=true;render();audio();
  const f=force;force="";const fs=$("#scForce");if(fs)fs.value="";
  try{const r=await rpc("mf_scratch_buy",{p_paid:!!paid,p_force:f||null});take(r);
    if(r.pending)show(r.pending,true);else say(idleText());applyState(hidden());}
  catch(e){say(errText(e),"bad");try{take(await rpc("mf_scratch_status"));}catch(x){}}
  busy=false;render();
}
function show(p,fresh){
  T=p;phase="scratch";paintGrid();foil.reset();
  const t=$("#scTicket");t.classList.remove("new");if(fresh&&!reduce){void t.offsetWidth;t.classList.add("new");}
  $("#scHand").hidden=false;
  say("Gratte avec ton doigt !");render();
  if(fresh)tone("triangle",520,780,.12,.18);
}

/* ---------- résultat ---------- */
let revealing=false;
async function reveal(all){
  if(phase!=="scratch"||revealing)return;revealing=true;
  foil.finish(all);
  $("#scHand").hidden=true;
  await new Promise(r=>setTimeout(r,reduce?0:450));
  const p=T,w=p.win&&typeof p.win==="object"?p.win:null;
  phase="done";render();
  const cells=[...root.querySelectorAll(".sc-cell")];
  if(w){let k=0;cells.forEach(c=>{if(c.dataset.e===w.k){c.classList.add("hit");c.style.setProperty("--d",(k++*.12)+"s");}else c.classList.add("dim");});
    if(w.k==="singe"){say("JACKPOT ! 3 boosters dans ton stock !","jack");celebrate("singe");}
    else if(w.k==="booster"){say("Gagné : 1 booster dans ton stock !","good");celebrate("booster");}
    else if(w.k==="maman"){say("Gagné : 25 bananes ! Planquez vos mamans…","good");celebrate("maman");}
    else{say("Gagné : "+label(w)+(w.t==="time"&&p.kept?", gardées pour ta prochaine attente":"")+" !","good");win();}
  }else{
    const n=cells.filter(c=>c.dataset.e==="singe").length;
    say(n===2?"Perdu… deux singes, si près du jackpot !":"Perdu. Pas de chance cette fois.");
    tone("sawtooth",300,140,.08,.35);
  }
  try{take(await rpc("mf_scratch_done"));}catch(e){}
  if(INFO&&INFO.state)applyState(INFO.state);
  revealing=false;render();
}
function win(){[660,880,1175].forEach((f,i)=>setTimeout(()=>tone("triangle",f,0,.16,.3),i*110));if(buzz&&navigator.vibrate)try{navigator.vibrate([30,40,60]);}catch(e){}}

/* ---------- la couche à gratter ---------- */
const foil=(()=>{
  let zone,cv,ctx,dust,dx,W=0,H=0,dpr=1,segs=[],mask=null,down=false,last=null,lastT=0,started=false,flakes=[],raf=0,checkT=0,buzzT=0,gone=false;
  const MG=24;   // grille de contrôle de la surface grattée (24 × 24)
  function init(z,c,d){zone=z;cv=c;dust=d;ctx=cv.getContext("2d");dx=dust.getContext("2d");mask=new Uint8Array(MG*MG);
    new ResizeObserver(size).observe(zone);
    try{document.fonts.load('400 20px "Titan One"').then(()=>size(),()=>{});}catch(e){}
    cv.addEventListener("pointerdown",e=>{if(phase!=="scratch"||gone)return;e.preventDefault();audio();try{cv.setPointerCapture(e.pointerId);}catch(x){}
      down=true;last=pt(e);lastT=performance.now();stroke(last,last);if(!started){started=true;$("#scHand").hidden=true;}});
    cv.addEventListener("pointermove",e=>{if(!down)return;e.preventDefault();
      const evs=e.getCoalescedEvents?e.getCoalescedEvents():[];const from=last;
      for(const ev of (evs.length?evs:[e])){const p=pt(ev);stroke(last,p);last=p;}
      const now=performance.now(),dt=Math.max(8,now-lastT);lastT=now;
      scrape(Math.min(1,.2+dist2(from,last)/dt*300));
      if(now-checkT>140){checkT=now;check();}});
    const up=()=>{if(!down)return;down=false;scrape(0);check();};
    cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);cv.addEventListener("lostpointercapture",up);
    cv.addEventListener("contextmenu",e=>e.preventDefault());
  }
  function pt(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
  const dist2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const R=()=>.075;   // rayon du « doigt », en fraction de la largeur
  function size(){if(!zone)return;const r=zone.getBoundingClientRect();if(!r.width)return;
    dpr=Math.min(2,window.devicePixelRatio||1);W=Math.round(r.width*dpr);H=Math.round(r.height*dpr);
    cv.width=W;cv.height=H;dust.width=W;dust.height=H;paint();segs.forEach(s=>cut(s[0],s[1]));}
  /* couche argentée, avec « GRATTE ICI » et des bananes en filigrane */
  function paint(){
    ctx.globalCompositeOperation="source-over";ctx.clearRect(0,0,W,H);
    const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,"#d9dde6");g.addColorStop(.25,"#9aa1b2");g.addColorStop(.5,"#eef1f6");g.addColorStop(.75,"#a4abbb");g.addColorStop(1,"#dde1ea");
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
    for(let i=0;i<W*H/260;i++){ctx.fillStyle=rnd()<.5?"rgba(255,255,255,.35)":"rgba(70,75,90,.18)";ctx.fillRect(rnd()*W,rnd()*H,dpr*1.4,dpr*1.4);}
    ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-Math.PI/9);
    const fs=Math.round(W*.058);ctx.font=`400 ${fs}px "Titan One",sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
    for(let row=-6;row<=6;row++){const y=row*fs*1.9,off=(row%2)*fs*3;
      for(let col=-3;col<=3;col++){const x=col*fs*6.2+off;
        ctx.fillStyle="rgba(90,95,112,.22)";ctx.fillText("GRATTE ICI",x+1.5*dpr,y+1.5*dpr);ctx.fillStyle="rgba(255,255,255,.55)";ctx.fillText("GRATTE ICI",x,y);
        ctx.font=`${Math.round(fs*.9)}px sans-serif`;ctx.globalAlpha=.35;ctx.fillText("🍌",x+fs*3.1,y);ctx.globalAlpha=1;ctx.font=`400 ${fs}px "Titan One",sans-serif`;}}
    ctx.restore();
    ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2*dpr;ctx.strokeRect(dpr*4,dpr*4,W-dpr*8,H-dpr*8);
    ctx.globalCompositeOperation="destination-out";
  }
  function cut(a,b){ctx.globalCompositeOperation="destination-out";ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=R()*2*W;
    ctx.beginPath();ctx.moveTo(a.x*W,a.y*H);ctx.lineTo(b.x*W+.01,b.y*H);ctx.stroke();}
  function stroke(a,b){segs.push([a,b]);cut(a,b);mark(a,b);
    const n=Math.min(4,1+Math.floor(dist2(a,b)*40));for(let i=0;i<n;i++)flake(b);}
  /* on note quelles parties de la grille de contrôle ont été grattées */
  function mark(a,b){const r=R()*.8,steps=Math.max(1,Math.ceil(dist2(a,b)/(r*.5)));
    for(let s=0;s<=steps;s++){const x=a.x+(b.x-a.x)*s/steps,y=a.y+(b.y-a.y)*s/steps;
      const i0=Math.max(0,Math.floor((x-r)*MG)),i1=Math.min(MG-1,Math.floor((x+r)*MG)),j0=Math.max(0,Math.floor((y-r)*MG)),j1=Math.min(MG-1,Math.floor((y+r)*MG));
      for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const cx=(i+.5)/MG,cy=(j+.5)/MG;if((cx-x)**2+(cy-y)**2<=r*r)mask[j*MG+i]=1;}}}
  /* assez gratté ? (60 % du ticket, ou chacune des 9 cases à moitié) → on découvre tout */
  function check(){if(phase!=="scratch"||gone)return;let tot=0;const cell=Array(9).fill(0);
    for(let j=0;j<MG;j++)for(let i=0;i<MG;i++)if(mask[j*MG+i]){tot++;cell[Math.min(2,Math.floor(j*3/MG))*3+Math.min(2,Math.floor(i*3/MG))]++;}
    const per=MG*MG/9;if(tot/(MG*MG)>=.6||cell.every(c=>c/per>=.45))reveal(false);}
  function finish(){gone=true;cv.classList.add("gone");down=false;scrape(0);if(!reduce)for(let i=0;i<40;i++)flake({x:Math.random(),y:Math.random()});}
  function reset(){segs=[];mask=new Uint8Array(MG*MG);started=false;gone=false;down=false;cv.classList.remove("gone");size();cv.classList.toggle("off",phase!=="scratch");}
  /* paillettes argentées qui tombent sous le doigt */
  function flake(p){if(reduce||flakes.length>160)return;
    flakes.push({x:p.x*W,y:p.y*H,vx:(Math.random()-.5)*3*dpr,vy:(-Math.random()*2.2)*dpr,s:(1.5+Math.random()*3)*dpr,r:Math.random()*6,c:Math.random()<.5?"#c8cdd8":"#eef1f6",l:1});
    if(!raf)raf=requestAnimationFrame(tickDust);}
  function tickDust(){dx.clearRect(0,0,W,H);
    flakes=flakes.filter(f=>(f.l-=.028)>0);
    flakes.forEach(f=>{f.vy+=.25*dpr;f.x+=f.vx;f.y+=f.vy;f.r+=.2;dx.save();dx.globalAlpha=Math.min(1,f.l*1.5);dx.translate(f.x,f.y);dx.rotate(f.r);dx.fillStyle=f.c;dx.fillRect(-f.s/2,-f.s/3,f.s,f.s*.66);dx.restore();});
    raf=flakes.length?requestAnimationFrame(tickDust):0;if(!raf)dx.clearRect(0,0,W,H);}
  /* bruit de grattage (et petites vibrations sur Android) */
  function scrape(level){
    if(noise){try{const t=ac.currentTime;noise.g.gain.cancelScheduledValues(t);noise.g.gain.setTargetAtTime(sound?level*.22:0,t,level?.02:.06);noise.f.frequency.setTargetAtTime(2200+level*2600,t,.05);}catch(e){}}
    const now=performance.now();if(level>.3&&buzz&&navigator.vibrate&&now-buzzT>70){buzzT=now;try{navigator.vibrate(6);}catch(e){}}}
  return {init,reset,finish,size};
})();

/* ---------- sons ---------- */
let ac=null,noise=null;
function audio(){
  if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}}
  if(ac.state==="suspended")ac.resume().catch(()=>{});
  if(!noise){try{const len=ac.sampleRate*2,buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(.6+.4*Math.sin(i/37));
    const s=ac.createBufferSource();s.buffer=buf;s.loop=true;const f=ac.createBiquadFilter();f.type="bandpass";f.frequency.value=3000;f.Q.value=.9;
    const g=ac.createGain();g.gain.value=0;s.connect(f).connect(g).connect(ac.destination);s.start();noise={s,f,g};}catch(e){}}
}
function tone(type,f0,f1,vol,len){if(!sound||!ac)return;try{const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+len*.8);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+len+.01);}catch(e){}}

/* ---------- grands gains ---------- */
let jpT=[];
const BIG={
  singe:{t:"JACKPOT !",s:"<b>3 boosters</b> dans ton stock",parts:["singe","banane","booster"],ray:"rgba(255,210,63,.32)",waves:[40,30,24],notes:[523,659,784,1047]},
  booster:{t:"1 BOOSTER !",s:"ajouté à ton stock",parts:["booster"],ray:"rgba(255,95,60,.32)",waves:[24],notes:[523,659,784]},
  maman:{t:"25 BANANES !",s:"Planquez vos mamans…",parts:["banane"],ray:"rgba(255,150,200,.3)",waves:[30],notes:[659,784,880]}};
function celebrate(kind){
  const C=BIG[kind],box=$("#scJp");box.style.setProperty("--ray",C.ray);
  $("#scJpImg").src=src(kind);$("#scJpT").textContent=C.t;$("#scJpS").innerHTML=C.s;
  box.hidden=false;$("#scJpOk").focus({preventScroll:true});
  C.notes.forEach((f,i)=>setTimeout(()=>tone("triangle",f,0,.2,.35),i*140));
  if(buzz&&navigator.vibrate)try{navigator.vibrate(kind==="singe"?[60,50,60,50,200]:[40,40,90]);}catch(e){}
  if(reduce)return;
  const fl=document.createElement("div");fl.className="sc-flash";if(kind!=="singe")fl.style.opacity=".6";root.appendChild(fl);setTimeout(()=>fl.remove(),800);
  const burst=n=>{for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,d=220+Math.random()*Math.max(innerWidth,innerHeight)*.6,x=Math.cos(a)*d,y=Math.sin(a)*d*.8,sc=.5+Math.random()*.9,rot=(Math.random()-.5)*900;
    const im=document.createElement("img");im.className="sc-pt";im.alt="";im.src=src(C.parts[Math.floor(Math.random()*C.parts.length)]);box.appendChild(im);
    im.animate([{transform:"translate(0,0) scale(.2)",opacity:1},{transform:`translate(${x*.85}px,${y*.85-140}px) scale(${sc}) rotate(${rot*.6}deg)`,opacity:1,offset:.45},{transform:`translate(${x}px,${y+420}px) scale(${sc}) rotate(${rot}deg)`,opacity:0}],{duration:1600+Math.random()*1400,easing:"cubic-bezier(.15,.7,.4,1)"}).onfinish=()=>im.remove();}};
  burst(C.waves[0]);jpT=C.waves.slice(1).map((n,i)=>setTimeout(()=>burst(n),700+i*800));
}
function closeJp(){jpT.forEach(clearTimeout);jpT=[];const b=$("#scJp");b.hidden=true;b.querySelectorAll(".sc-pt").forEach(x=>x.remove());}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="",clock=null;
async function open(){
  if(!root)build();
  root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
  foil.size();render();$("#scClose").focus({preventScroll:true});
  clearInterval(clock);clock=setInterval(render,30000);
  if(phase==="scratch")return;
  say("…");
  try{const r=await rpc("mf_scratch_status");take(r);
    if(r.pending)show(r.pending,false);     // ticket acheté mais pas encore gratté (appli fermée entre-temps)
    else{if(phase!=="done")say(idleText());render();}}
  catch(e){say(errText(e),"bad");}
}
function close(){closeJp();side(false);root.hidden=true;document.body.style.overflow=prevOverflow;clearInterval(clock);clock=null;
  if(phase==="done"){phase="none";T=null;paintGrid();foil.reset();say(idleText());}
  if(opener&&opener.focus)opener.focus();}

/* ---------- bouton rond (sous la Banana Machine et la Monkey Run), avec une pastille quand un ticket attend ---------- */
let btn=null;
function badge(){if(!btn||!INFO)return;const n=(INFO.free?1:0)||(INFO.pending?1:0),b=btn.querySelector(".sbadge");b.hidden=!n;b.textContent="1";
  btn.setAttribute("aria-label",n?"Monkey Cash : un ticket t'attend":"Monkey Cash, ticket à gratter");}
async function boot(){
  if(!window.claude||!window.claude.use)return;
  try{USER=await window.claude.use("user");}catch(e){}
  if(!USER||typeof window.MF_RPC!=="function")return;
  try{ADMIN=!!(await USER.isOwner());}catch(e){}
  let ok=ADMIN;if(!ok){try{ok=!!(await rpc("mf_scratch_open"));}catch(e){}}
  if(!ok||document.getElementById("scratchBtn"))return;
  btn=document.createElement("button");btn.className="socialbtn";btn.id="scratchBtn";btn.type="button";btn.title="Monkey Cash";btn.setAttribute("aria-label","Monkey Cash, ticket à gratter");
  btn.innerHTML=`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l0 2"/><path d="M15 11l0 2"/><path d="M15 17l0 2"/><path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4v-3a2 2 0 0 1 2 -2"/></svg><span class="sbadge" hidden></span>`;
  btn.addEventListener("click",open);
  // place sous les boutons ronds déjà là (la Monkey Run crée le sien après un appel au serveur, d'où les nouveaux essais)
  const place=()=>{const above=["slotBtn","raceBtn"].filter(id=>document.getElementById(id)).length;btn.style.top=`calc(max(12px,env(safe-area-inset-top,0px)) + ${112+56*above}px)`;};
  place();[500,1500,4000].forEach(t=>setTimeout(place,t));
  const prev=document.getElementById("raceBtn")||document.getElementById("slotBtn")||document.getElementById("rankBtn");if(prev)prev.after(btn);else document.body.appendChild(btn);
  ORDER.forEach(e=>{const i=new Image();i.src=src(e);});
  const refresh=()=>{if(root&&!root.hidden)return;rpc("mf_scratch_status").then(take,()=>{});};
  refresh();
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh();});
  setInterval(refresh,10*60*1000);   // à minuit, la pastille du ticket gratuit revient sans relancer l'appli
}
window.MF_SCRATCH={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

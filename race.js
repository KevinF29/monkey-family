/* Monkey Family — Monkey Run
   1 course par jour à 21h (heure de Paris), 8 singes, cotes selon la forme du jour, 1 pari de 1 à 20 bananes par course.
   Le serveur fait foi : il fixe les cotes, prend les mises, tire l'arrivée (mf_race_*) et paie les gagnants.
   Cette page n'anime la course qu'à partir de l'arrivée et de la graine reçues : tout le monde voit la même course.
   Tant que la course n'est pas ouverte à tous (réglage admin), seul l'admin la voit. */
(function(){
"use strict";

/* ---------- les singes et la piste ---------- */
const M=[
  {n:"Le Rageux",c:"#9b4fe0"},{n:"Le Tryharder",c:"#2f6fe0"},{n:"Le Chill",c:"#2fa84f"},{n:"Le Iencli",c:"#e8b800"},
  {n:"L'Alcoolique",c:"#e0352f"},{n:"Le Fantôme",c:"#cfe6ff"},{n:"Le Geek",c:"#ff8a1e"},{n:"Le Séducteur",c:"#9a6232"}];
/* la fête du gagnant : son animation et ses confettis à lui */
const FX=[
  {a:"rcShake",d:".5s",p:["🎮","💢","💥"],glow:"#c77dff"},          // le Rageux casse tout
  {a:"rcFlex",d:".9s",p:["⚡","💧","🏅"],glow:"#4d8dff"},           // le Tryharder célèbre comme un pro
  {a:"rcSway",d:"2.4s",p:["🍃","😎","🎧"],glow:"#5bd17a"},          // le Chill, tranquille
  {a:"rcHop",d:"1s",p:["🛍️","💸","🏷️"],glow:"#ffd23f"},            // le Iencli dépense déjà ses gains
  {a:"rcWobble",d:"1.6s",p:["🍺","🫧","⭐"],glow:"#ff5a4f"},         // l'Alcoolique trinque
  {a:"rcFloat",d:"2.2s",p:["👻","✨","💙"],glow:"#8fd3ff"},          // le Fantôme hante le podium
  {a:"rcGlitch",d:"1.8s",p:["👾","🕹️","💾"],glow:"#ff9a3c"},        // le Geek bug de joie
  {a:"rcCharm",d:"1.3s",p:["❤️","🌹","💋"],glow:"#ff6b8b"}];        // le Séducteur fait son numéro
const TW=1672,TH=941;                                        // taille de l'image de la piste
const LINES=[253,312,379,450,524,600,680,759,843];            // bambous qui séparent les 8 couloirs
const X0=300;                                                 // le museau des singes au départ
const finishX=i=>{const y=(LINES[i]+LINES[i+1])/2;return 1455+(y-253)*95/590;};  // la ligne d'arrivée est un peu penchée
const SH=165,SW=248;                                          // taille des singes sur la piste (ils débordent de leur couloir, comme aux courses de chevaux)
const img=i=>"packs/race-"+(i+1)+".webp",TRACK="packs/race-piste.webp",LOGO="packs/race-logo.webp";
const MIN=1,MAX=20;

const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const odd=o=>"×"+(+o).toFixed(1).replace(".",",");
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const ERR={no_bananas:"Pas assez de bananes.",race_started:"La course est déjà partie !",race_closed:"La course n'est pas encore ouverte.",race_bad_amount:"Mise entre 1 et 20 bananes.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});

/* ---------- état ---------- */
let S=null,ADMIN=false,USER=null,names={},pick=null,amount=5,busy=false,sound=true,playing=null,poll=null,clock=null,skew=0;
function applyState(st){if(!st)return;try{if(window.MF_APPLY)window.MF_APPLY(st);}catch(e){}}
const bal=()=>S&&S.state?+S.state.bananas||0:0;
const now=()=>Date.now()+skew;
const seenKey="mf-race-seen";
const seen=()=>{try{return localStorage.getItem(seenKey)||"";}catch(e){return "";}};
const markSeen=d=>{try{localStorage.setItem(seenKey,d);}catch(e){}};

/* ---------- style ---------- */
const CSS=`
#mfRace{position:fixed;inset:0;z-index:9000;overflow:hidden;overscroll-behavior:none;display:flex;flex-direction:column;color:#f6f0d8;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:radial-gradient(ellipse 80% 50% at 50% 0,rgba(120,200,80,.22),transparent 70%),linear-gradient(180deg,#0f3a1f,#082414)}
#mfRace[hidden]{display:none}
#mfRace *{box-sizing:border-box;min-width:0}
.rc-top{flex:none;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:max(8px,env(safe-area-inset-top)) max(3vw,10px) 6px}
.rc-top h2{margin:0;grid-column:2;display:flex;justify-content:center;line-height:0}
.rc-logo{display:block;height:clamp(52px,12vw,92px);width:auto;max-width:100%;filter:drop-shadow(0 5px 6px rgba(0,0,0,.45))}
.rc-ctl{grid-column:3;justify-self:end;display:flex;align-items:center;gap:8px}
.rc-lft{grid-column:1;justify-self:start;display:flex;align-items:center;gap:8px}
@media(max-width:700px){.rc-tag{display:none}.rc-logo{height:auto;width:min(62vw,300px)}#mfRace.admin .rc-logo{width:min(56vw,300px)}}
.rc-tag{font:700 12px Quicksand,sans-serif;background:#ffd23f;color:#3a200b;border-radius:99px;padding:3px 10px}
.rc-x,.rc-tog{min-width:44px;min-height:44px;border-radius:12px;border:2px solid #5a3416;background:#3a200b;color:#ffd23f;font:400 20px "Titan One",sans-serif;cursor:pointer}
.rc-tog{font:700 20px Quicksand,sans-serif;padding:0;width:44px;flex:none}.rc-tog[aria-expanded=true]{background:#ffd23f;color:#3a200b}
.rc-body{flex:1;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;overscroll-behavior:contain;padding:10px max(3vw,12px) max(20px,env(safe-area-inset-bottom));position:relative}
.rc-wrap{max-width:1040px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.rc-view{position:relative;overflow:hidden;border-radius:16px;background:#2b5a1d;box-shadow:0 0 0 4px #5a3416,0 0 0 7px #a8c04a,0 12px 30px rgba(0,0,0,.5)}
.rc-world{position:absolute;left:0;top:0;width:${TW}px;height:${TH}px;transform-origin:0 0;background:url(${TRACK}) 0 0/100% 100% no-repeat;will-change:transform}
.rc-sp{position:absolute;left:0;top:0;width:${SW}px;height:${SH}px;will-change:transform;filter:drop-shadow(0 6px 3px rgba(0,0,0,.35))}
.rc-sp img{width:100%;height:100%;display:block}
.rc-sp.dim{opacity:.55}.rc-sp.win{filter:drop-shadow(0 0 14px #ffd23f) drop-shadow(0 0 4px #fff)}
.rc-sp b{position:absolute;right:2%;top:-14px;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font:400 28px/1 "Titan One",sans-serif;color:#3a200b;background:#ffd23f;box-shadow:0 0 0 4px #3a200b,0 4px 10px rgba(0,0,0,.5);opacity:0;transition:opacity .3s}
.rc-sp b.r2{background:#e3e6ea}.rc-sp b.r3{background:#e0a56a}
.rc-sp.mine::after{content:"";position:absolute;left:30%;right:30%;bottom:-8px;height:8px;border-radius:50%;background:#ffd23f;box-shadow:0 0 12px #ffd23f}
.rc-hud{position:absolute;left:10px;right:10px;top:10px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;pointer-events:none;z-index:3}
.rc-lead{background:rgba(20,12,4,.78);border-radius:10px;padding:5px 10px;font-weight:700;font-size:14px;color:#ffe08a;opacity:0;transition:opacity .3s}
.rc-lead.on{opacity:1}
.rc-big{position:absolute;inset:0;display:grid;place-items:center;z-index:4;pointer-events:none;font:400 clamp(60px,14vw,150px)/1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 7px 0 #8a4b00,5px 0 0 #8a4b00,-5px 0 0 #8a4b00,0 0 40px #ffb300}
.rc-big:empty{display:none}
.rc-big span{animation:rcPop .5s cubic-bezier(.2,1.7,.4,1) both;background:rgba(20,12,4,.55);padding:.12em .4em;border-radius:.3em}
@keyframes rcPop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
.rc-idle{position:absolute;inset:auto 10px 10px 10px;z-index:3;display:flex;justify-content:center}
.rc-idle button,.rc-go{min-height:48px;border:0;border-radius:14px;cursor:pointer;color:#4a2a10;font:400 19px "Titan One",sans-serif;padding:0 20px;
 background:linear-gradient(180deg,#ffe066,#f5b700);box-shadow:0 5px 0 #a86c00,0 8px 14px rgba(0,0,0,.35)}
.rc-go:active,.rc-idle button:active{transform:translateY(3px);box-shadow:0 2px 0 #a86c00}
.rc-go:disabled{background:#8d7a5a;color:#3a2a14;box-shadow:0 5px 0 #4e3d22;cursor:not-allowed}
.rc-card{background:linear-gradient(180deg,#a36b35,#6e411d);border-radius:16px;padding:14px;box-shadow:inset 0 0 0 4px #4a2a10,0 8px 0 #3a200b}
.rc-card h3{margin:0 0 8px;font:400 20px/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 2px 0 #4a2a10}
.rc-cd{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;justify-content:space-between;margin-bottom:10px;font-weight:700;color:#fff3cf}
.rc-cd b{font:400 24px "Titan One",sans-serif;color:#fff}
.rc-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
@media(max-width:600px){.rc-list{grid-template-columns:minmax(0,1fr)}}
.rc-m{display:flex;align-items:center;gap:8px;padding:6px 10px 6px 6px;border-radius:12px;border:2px solid transparent;background:#f3e2b8;color:#3a200b;cursor:pointer;text-align:left;font:inherit;min-height:56px}
.rc-m img{width:66px;height:44px;flex:none;object-fit:contain}
.rc-m .nm{flex:1;font-weight:700;line-height:1.15}.rc-m .nm small{display:block;font-size:12px;color:#6e4a20;font-weight:700}
.rc-m .od{font:400 20px "Titan One",sans-serif;color:#6e2f00;white-space:nowrap}
.rc-m .dot{width:12px;height:12px;border-radius:50%;flex:none;box-shadow:0 0 0 2px rgba(0,0,0,.25)}
.rc-m[aria-pressed=true]{border-color:#ffd23f;background:#ffe9a0;box-shadow:0 0 0 3px #3a200b,0 0 16px rgba(255,210,63,.8)}
.rc-m.mine{background:#d7ecb0}
.rc-bet{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px}
.rc-step{display:flex;align-items:center;gap:6px;background:#3a200b;border-radius:12px;padding:4px}
.rc-step button{width:44px;height:44px;border-radius:10px;border:0;background:#5a3416;color:#ffd23f;font:400 22px "Titan One",sans-serif;cursor:pointer}
.rc-step output{min-width:46px;text-align:center;font:400 24px "Titan One",sans-serif;color:#fff}
.rc-quick{display:flex;gap:6px}.rc-quick button{min-height:44px;min-width:44px;border-radius:10px;border:2px solid #5a3416;background:#3a200b;color:#fff3cf;font:700 14px Quicksand,sans-serif;cursor:pointer}
.rc-bet .rc-go{flex:1 1 220px}
.rc-msg{margin-top:10px;min-height:24px;font-weight:700;color:#fff3cf}
.rc-msg.ok{color:#d7ecb0}.rc-msg.bad{color:#ffb3a0}
.rc-link{background:none;border:0;color:#ffd23f;text-decoration:underline;font:700 14px Quicksand,sans-serif;cursor:pointer;min-height:44px;padding:0 4px}
.rc-res ol{margin:0;padding:0;list-style:none;display:grid;gap:4px}
.rc-res li{display:flex;align-items:center;gap:8px;background:#f3e2b8;color:#3a200b;border-radius:10px;padding:4px 10px;font-weight:700}
.rc-res li img{width:48px;height:32px;object-fit:contain}
.rc-res li .rk{font:400 20px "Titan One",sans-serif;width:26px;text-align:center;color:#6e2f00}
.rc-res li:first-child{background:linear-gradient(90deg,#ffd23f,#ffb300)}
.rc-res .me{margin:10px 0 0;font-weight:700;color:#fff3cf}
.rc-pill{display:inline-block;background:#3a200b;color:#ffd23f;border-radius:12px;padding:4px 12px;font-weight:700;box-shadow:inset 0 0 0 2px #5a3416}
.rc-pill b{font:400 20px "Titan One",sans-serif;color:#fff;margin-left:4px}
.rc-rules{font-size:13px;color:#cfe0b0;margin:0}
.rc-side{position:absolute;top:0;left:0;bottom:0;z-index:7;width:min(380px,100%);overflow-y:auto;background:#0c2213;border-right:2px solid #2a5a33;padding:16px 16px max(16px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px;box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s ease;visibility:hidden}
.rc-side.open{transform:none;visibility:visible}
.rc-side:not(.open){display:none}
.rc-sidehead{display:flex;align-items:center;justify-content:space-between;gap:8px}
.rc-side h3{margin:0;font:400 20px "Titan One",sans-serif;color:#ffd23f}
.rc-note{margin:0;font-size:13px;color:#cfe0b0}
.rc-btn{min-height:44px;border-radius:10px;border:2px solid #5a3416;background:#3a200b;color:#fff3cf;font:700 14px Quicksand,sans-serif;padding:8px 12px;cursor:pointer;text-align:left}
.rc-chk{display:flex;gap:8px;align-items:center;font-weight:700;font-size:14px;min-height:44px}.rc-chk input{width:20px;height:20px}
.rc-sel{min-height:44px;border-radius:10px;border:2px solid #5a3416;background:#3a200b;color:#fff3cf;font:700 14px Quicksand,sans-serif;padding:0 8px;width:100%}
.rc-win{position:fixed;inset:0;z-index:9100;display:grid;place-items:center;overflow:hidden;cursor:pointer;background:radial-gradient(circle at 50% 45%,var(--wc2,rgba(120,60,0,.8)),rgba(5,20,10,.95) 70%)}
.rc-win[hidden]{display:none}
.rc-wrays{position:absolute;left:50%;top:42%;width:220vmax;height:220vmax;margin:-110vmax 0 0 -110vmax;background:repeating-conic-gradient(var(--wc,rgba(255,210,63,.35)) 0 9deg,transparent 9deg 18deg);-webkit-mask:radial-gradient(circle,#000 0,transparent 45%);mask:radial-gradient(circle,#000 0,transparent 45%);animation:rcTurn 16s linear infinite}
@keyframes rcTurn{to{transform:rotate(360deg)}}
.rc-win-in{position:relative;z-index:2;text-align:center;padding:16px;max-width:100%}
.rc-trophy{font-size:clamp(34px,7vw,56px);line-height:1;animation:rcDrop .7s cubic-bezier(.2,1.6,.4,1) both}
@keyframes rcDrop{from{transform:translateY(-60vh) rotate(-30deg)}to{transform:none}}
.rc-wimg{display:block;margin:0 auto;width:min(88vw,560px);height:auto;filter:drop-shadow(0 0 34px var(--wglow,#ffd23f)) drop-shadow(0 14px 10px rgba(0,0,0,.5));animation:rcEnter 1s cubic-bezier(.2,1.5,.4,1) both,var(--wanim,rcBob) var(--wdur,1.4s) 1s ease-in-out infinite}
@keyframes rcEnter{from{transform:translateX(-90vw) scale(.4) rotate(-12deg);opacity:0}70%{transform:translateX(4vw) scale(1.05)}to{transform:none;opacity:1}}
@keyframes rcBob{50%{transform:translateY(-14px) rotate(2deg)}}
@keyframes rcShake{0%,100%{transform:none}20%{transform:translate(-8px,2px) rotate(-3deg)}40%{transform:translate(7px,-3px) rotate(3deg)}60%{transform:translate(-6px,1px) rotate(-2deg)}80%{transform:translate(5px,-1px) rotate(2deg)}}
@keyframes rcFlex{0%,100%{transform:none}30%{transform:translateY(-22px) scale(1.06)}60%{transform:translateY(0) scale(.98,1.02)}}
@keyframes rcSway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg) translateY(-6px)}}
@keyframes rcHop{0%,100%{transform:none}25%{transform:translateY(-30px) rotate(-5deg)}50%{transform:none}75%{transform:translateY(-16px) rotate(5deg)}}
@keyframes rcWobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg) translateX(-14px)}75%{transform:rotate(9deg) translateX(14px)}}
@keyframes rcFloat{0%,100%{transform:translateY(0);opacity:.95}50%{transform:translateY(-26px);opacity:.7}}
@keyframes rcGlitch{0%,92%,100%{transform:none}94%{transform:translate(-6px,0) skewX(8deg)}96%{transform:translate(6px,0) skewX(-8deg)}}
@keyframes rcCharm{0%,100%{transform:none}40%{transform:scale(1.07) rotate(-3deg)}55%{transform:scale(1.04) rotate(2deg)}}
.rc-wt{font:400 clamp(40px,9vw,88px)/1 "Titan One",sans-serif;color:#ffd23f;margin-top:4px;text-shadow:0 6px 0 #8a4b00,4px 0 0 #8a4b00,-4px 0 0 #8a4b00,0 0 40px #ffb300;animation:rcPop .7s .5s cubic-bezier(.2,1.7,.4,1) both}
.rc-ws{font:700 clamp(17px,3vw,22px) Quicksand,sans-serif;color:#fff3cf;margin:8px 0 4px;animation:rcPop .5s .8s both}
.rc-wme{display:inline-block;margin:10px 0 18px;padding:8px 18px;border-radius:14px;font:400 clamp(20px,4vw,30px) "Titan One",sans-serif;animation:rcPop .6s 1.2s cubic-bezier(.2,1.7,.4,1) both}
.rc-wme.won{background:linear-gradient(90deg,#ffd23f,#ffb300);color:#3a200b;box-shadow:0 0 30px rgba(255,200,60,.8)}
.rc-wme.lost{background:rgba(0,0,0,.45);color:#f3e2b8;font-size:clamp(16px,3vw,20px);font-family:Quicksand,sans-serif;font-weight:700}
.rc-wme:empty{display:none}
.rc-pt{position:absolute;left:50%;top:42%;z-index:1;pointer-events:none;font-size:42px;line-height:1;margin:-21px}
.rc-flash{position:fixed;inset:0;z-index:9200;background:#fff7d0;pointer-events:none;animation:rcFlash .7s ease-out forwards}@keyframes rcFlash{from{opacity:.9}to{opacity:0}}
@media(prefers-reduced-motion:reduce){.rc-wrays,.rc-wimg,.rc-trophy,.rc-wt,.rc-ws,.rc-wme{animation:none!important}}
#mfRace:not(.admin) .rc-adm{display:none!important}
#mfRace button:focus-visible,#mfRace select:focus-visible,#mfRace input:focus-visible{outline:3px solid #ffd23f;outline-offset:3px}
`;

/* ---------- interface ---------- */
let root=null;const $=s=>root.querySelector(s);
let SP=[];  // les 8 singes sur la piste
function build(){
  const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  root=document.createElement("div");root.id="mfRace";if(ADMIN)root.classList.add("admin");root.hidden=true;
  root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Monkey Run");
  root.innerHTML=`<div class="rc-top"><div class="rc-lft"><button type="button" class="rc-tog rc-adm" id="rcTog" aria-controls="rcSide" aria-expanded="false" aria-label="Réglages admin">⚙</button><span class="rc-tag rc-adm" id="rcTag">Admin</span></div>
    <h2><img class="rc-logo" src="${LOGO}" alt="Monkey Run"></h2>
    <div class="rc-ctl"><button type="button" class="rc-x" id="rcClose" aria-label="Fermer">✕</button></div></div>
  <div class="rc-body"><div class="rc-wrap">
    <div class="rc-view" id="rcView"><div class="rc-world" id="rcWorld">${M.map((m,i)=>`<div class="rc-sp" data-i="${i}"><img src="${img(i)}" alt="${esc(m.n)}"><b></b></div>`).join("")}</div>
      <div class="rc-hud"><div class="rc-lead" id="rcLead" aria-live="polite"></div></div>
      <div class="rc-big" id="rcBig" aria-live="assertive"></div>
      <div class="rc-idle" id="rcIdle"></div></div>
    <div class="rc-card" id="rcBetCard"><h3>Paris de la prochaine course</h3>
      <div class="rc-cd"><span id="rcWhen">…</span><span class="rc-pill">Bananes<b id="rcBal">…</b></span></div>
      <div class="rc-list" id="rcList" role="group" aria-label="Choisis ton singe"></div>
      <div class="rc-bet"><div class="rc-step"><button type="button" id="rcMinus" aria-label="Miser une banane de moins">−</button><output id="rcAmt" aria-live="polite"></output><button type="button" id="rcPlus" aria-label="Miser une banane de plus">+</button></div>
        <div class="rc-quick">${[1,5,10,20].map(n=>`<button type="button" data-a="${n}">${n}</button>`).join("")}</div>
        <button type="button" class="rc-go" id="rcGo">Parier</button></div>
      <div class="rc-msg" id="rcMsg" role="status"></div>
      <p class="rc-rules">Une course par jour à 21h · un pari par course, de 1 à 20 bananes · si ton singe gagne, tu touches ta mise × la cote · tu peux changer ou annuler ton pari jusqu'au départ.</p>
    </div>
    <div class="rc-card rc-res" id="rcRes" hidden></div>
  </div>
  <aside class="rc-side rc-adm" id="rcSide" aria-label="Réglages admin">
    <div class="rc-sidehead"><h3>Réglages admin</h3><button type="button" class="rc-x" id="rcSideX" aria-label="Fermer les réglages">✕</button></div>
    <label class="rc-chk"><input type="checkbox" id="rcOpen"> Ouverte à tous les joueurs</label>
    <p class="rc-note">Tant que c'est décoché, seul toi vois la course et rien n'est annoncé dans le fil d'actu.</p>
    <label class="rc-note" for="rcForce">Gagnant de la prochaine course</label>
    <select class="rc-sel" id="rcForce"><option value="0">Tirage normal (selon la forme du jour)</option>${M.map((m,i)=>`<option value="${i+1}">Forcer ${esc(m.n)}</option>`).join("")}</select>
    <button type="button" class="rc-btn" id="rcTest">🎬 Course d'essai (sans mise, rien n'est enregistré)</button>
    <button type="button" class="rc-btn" id="rcNow">🏁 Lancer la vraie course maintenant (paie les paris)</button>
    <button type="button" class="rc-btn" id="rcAdd">+50 🍌 sur mon compte</button>
    <label class="rc-chk"><input type="checkbox" id="rcSnd" checked> Sons</label>
    <p class="rc-note" id="rcAdmMsg" role="status"></p>
  </aside></div>
  <div class="rc-win" id="rcWin" hidden role="dialog" aria-modal="true" aria-label="Vainqueur de la course"><div class="rc-wrays"></div>
    <div class="rc-win-in"><div class="rc-trophy" aria-hidden="true">🏆</div><img class="rc-wimg" id="rcWImg" alt=""><div class="rc-wt" id="rcWT"></div><div class="rc-ws" id="rcWS"></div><div class="rc-wme" id="rcWMe"></div><br>
    <button type="button" class="rc-go" id="rcWOk">Super !</button></div></div>`;
  document.body.appendChild(root);
  SP=[...root.querySelectorAll(".rc-sp")];
  new ResizeObserver(fit).observe($("#rcView").parentElement);
  $("#rcClose").addEventListener("click",close);
  $("#rcTog").addEventListener("click",()=>side(!$("#rcSide").classList.contains("open")));
  $("#rcSideX").addEventListener("click",()=>{side(false);$("#rcTog").focus();});
  $("#rcList").addEventListener("click",e=>{const b=e.target.closest(".rc-m");if(!b||playing)return;pick=+b.dataset.m;renderBet();});
  $("#rcMinus").addEventListener("click",()=>{amount=Math.max(MIN,amount-1);renderBet();});
  $("#rcPlus").addEventListener("click",()=>{amount=Math.min(MAX,amount+1);renderBet();});
  root.querySelector(".rc-quick").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;amount=+b.dataset.a;renderBet();});
  $("#rcGo").addEventListener("click",bet);
  $("#rcMsg").addEventListener("click",e=>{if(e.target.id==="rcCancel")cancel();});
  $("#rcIdle").addEventListener("click",e=>{if(e.target.id==="rcReplay")replay();});
  $("#rcRes").addEventListener("click",e=>{if(e.target.id==="rcReplay2")replay();});
  $("#rcOpen").addEventListener("change",e=>admin("open",e.target.checked?1:0,e.target.checked?"La course est ouverte à tous.":"La course est de nouveau réservée à l'admin."));
  $("#rcForce").addEventListener("change",e=>admin("force",+e.target.value,+e.target.value?"Gagnant forcé : "+M[+e.target.value-1].n+".":"Tirage normal."));
  $("#rcTest").addEventListener("click",test);
  $("#rcNow").addEventListener("click",()=>admin("now",null,"Course lancée.").then(ok=>{if(ok&&S.last)play(S.last,true);}));
  $("#rcAdd").addEventListener("click",async()=>{try{const st=await rpc("mf_admin_bananas",{p_n:50});S.state=st;applyState(st);render();adminMsg("+50 bananes.");}catch(x){adminMsg(errText(x));}});
  $("#rcSnd").addEventListener("change",e=>{sound=e.target.checked;});
  $("#rcWin").addEventListener("click",()=>closeWin());
  document.addEventListener("keydown",e=>{if(e.key!=="Escape"||!root||root.hidden)return;if(!$("#rcWin").hidden){closeWin();return;}if($("#rcSide").classList.contains("open"))side(false);else close();});
  pose(null);
}
function side(o){$("#rcSide").classList.toggle("open",o);$("#rcTog").setAttribute("aria-expanded",String(o));}
function adminMsg(t){$("#rcAdmMsg").textContent=t;}
function msg(t,c){const m=$("#rcMsg");m.className="rc-msg"+(c?" "+c:"");m.innerHTML=t;}

/* la piste remplit la largeur ; sur un téléphone en portrait elle garde une hauteur lisible et la caméra suit la tête de course */
let K=1,VW=0,cam=0;
function fit(){if(!root||root.hidden)return;const v=$("#rcView"),w=v.parentElement.clientWidth;VW=w;
  const minH=Math.min(Math.max(260,innerHeight*.42),380);K=Math.max(w/TW,minH/TH);v.style.height=Math.round(TH*K)+"px";place();}
function place(){const max=Math.max(0,TW*K-VW);cam=Math.min(max,Math.max(0,cam));$("#rcWorld").style.transform=`translateX(${-cam}px) scale(${K})`;}

/* ---------- état de la course ---------- */
function render(){if(!root||!S)return;
  $("#rcBal").textContent=bal();
  if(ADMIN){$("#rcOpen").checked=!!S.open;$("#rcForce").value=String((S.next&&S.next.forced)||0);$("#rcTag").textContent=S.open?"Admin · ouverte à tous":"Admin · cachée";}
  renderBet();renderRes();renderIdle();}
function renderBet(){if(!S||!S.next)return;const N=S.next,mine=N.mine;
  const by={};(N.bets||[]).forEach(b=>{(by[b.m]=by[b.m]||[]).push(names[b.uid]||"Un pote");});
  $("#rcList").innerHTML=M.map((m,i)=>{const k=i+1,who=by[k]||[];
    return `<button type="button" class="rc-m${mine&&mine.m===k?" mine":""}" data-m="${k}" aria-pressed="${pick===k}">
      <span class="dot" style="background:${m.c}"></span><img src="${img(i)}" alt=""><span class="nm">${esc(m.n)}<small>${mine&&mine.m===k?"Ton pari : "+mine.a+" 🍌 · ":""}${who.length?esc(who.join(", "))+" "+(who.length>1?"ont":"a")+" parié":"n° "+k}</small></span><span class="od">${odd(N.odds[i])}</span></button>`;}).join("");
  $("#rcAmt").textContent=amount;
  const g=$("#rcGo");
  if(pick){const o=N.odds[pick-1],same=mine&&mine.m===pick&&mine.a===amount;
    g.textContent=same?"Pari enregistré ✓":(mine?"Changer : ":"Parier ")+amount+" 🍌 sur "+M[pick-1].n;
    g.disabled=busy||!!playing||same||bal()+(mine?mine.a:0)<amount;
    if(!$("#rcMsg").dataset.keep)msg(same?`Si ${esc(M[pick-1].n)} gagne, tu touches <b>${Math.floor(mine.a*mine.o)} 🍌</b> · <button type="button" class="rc-link" id="rcCancel">Annuler mon pari</button>`:
      `Gain possible : <b>${Math.floor(amount*o)} 🍌</b> (${amount} × ${odd(o).slice(1)})`+(bal()+(mine?mine.a:0)<amount?" · pas assez de bananes":""));}
  else{g.textContent="Choisis un singe";g.disabled=true;if(!$("#rcMsg").dataset.keep)msg(mine?"":"Choisis ton champion puis ta mise.");}
}
function when(){if(!S||!S.next)return;const ms=S.next.start-now();
  const t=new Date(S.next.start),today=new Date(now()).toDateString()===t.toDateString();
  let s;if(ms<=0)s="Départ !";else{const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),sec=Math.floor(ms%60000/1000);
    s=(today?"Ce soir 21h":"Demain 21h")+" · départ dans <b>"+(h?h+" h "+String(m).padStart(2,"0"):m?m+" min "+String(sec).padStart(2,"0"):sec+" s")+"</b>";}
  $("#rcWhen").innerHTML=s;
  // le départ vient de passer : on attend l'arrivée du serveur et on lance la course pour tout le monde
  if(ms<=0&&!poll&&!playing){const day=S.next.day;poll=setInterval(async()=>{try{const r=await rpc("mf_race_status");take(r);
      if(r.last&&r.last.day===day){clearInterval(poll);poll=null;play(r.last,true);}}catch(e){}},3000);}
}
function renderIdle(){const box=$("#rcIdle");if(playing){box.innerHTML="";return;}
  box.innerHTML=S&&S.last?`<button type="button" id="rcReplay">▶ Revoir la dernière course</button>`:"";}
function renderRes(){const box=$("#rcRes"),L=S&&S.last;if(!L||!L.result){box.hidden=true;return;}
  if(playing&&playing.day===L.day&&!playing.over){box.hidden=true;return;}
  box.hidden=false;const d=new Date(L.start);
  const mine=L.mine,w=L.result[0];
  const me=mine?(mine.p>0?`🎉 Tu avais misé ${mine.a} 🍌 sur ${esc(M[mine.m-1].n)} : <b>+${mine.p} 🍌</b> !`:`Tu avais misé ${mine.a} 🍌 sur ${esc(M[mine.m-1].n)}… perdu.`):"Tu n'avais pas parié sur cette course.";
  const others=(L.gains||[]).map(g=>esc(names[g.uid]||"Un pote")+" +"+g.v+" 🍌").join(" · ");
  box.innerHTML=`<h3>Résultat · ${d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</h3>
    <ol>${L.result.map((k,r)=>`<li><span class="rk">${r+1}</span><img src="${img(k-1)}" alt=""><span style="flex:1">${esc(M[k-1].n)}</span>${r===0?`<span>${odd(L.odds[w-1])}</span>`:""}</li>`).join("")}</ol>
    <p class="me">${me}</p>${others?`<p class="rc-note">Aussi gagnants : ${others}</p>`:""}
    <button type="button" class="rc-link" id="rcReplay2">▶ Revoir la course</button>`;
}
let inited=false;
function take(r){if(!r)return;if(r.now)skew=r.now-Date.now();S=r;
  if(!inited&&r.next){inited=true;if(r.next.mine){pick=r.next.mine.m;amount=r.next.mine.a;}}
  applyState(r.state);names_(r);render();}
async function names_(r){if(!USER)return;const ids=[...new Set([...(r.next&&r.next.bets||[]).map(b=>b.uid),...(r.last&&r.last.gains||[]).map(g=>g.uid)])].filter(i=>!(i in names));
  if(!ids.length)return;ids.forEach(i=>names[i]="Un pote");try{const ps=await USER.profiles(ids);Object.entries(ps||{}).forEach(([i,p])=>{if(p&&p.name)names[i]=p.name;});}catch(e){}render();}

/* ---------- parier ---------- */
async function bet(){if(!pick||busy)return;busy=true;renderBet();
  try{const r=await rpc("mf_race_bet",{p_monkey:pick,p_amount:amount});take(r);tone("sine",660,990,.15,.25);
    keep(`Pari enregistré : ${amount} 🍌 sur ${esc(M[pick-1].n)}. Rendez-vous à 21h !`,"ok");}
  catch(e){keep(errText(e),"bad");}busy=false;renderBet();}
async function cancel(){if(busy)return;busy=true;
  try{const r=await rpc("mf_race_cancel");pick=null;take(r);keep("Pari annulé, ta mise est rendue.","ok");}catch(e){keep(errText(e),"bad");}busy=false;renderBet();}
let keepT=0;function keep(t,c){const m=$("#rcMsg");msg(t,c);m.dataset.keep="1";clearTimeout(keepT);keepT=setTimeout(()=>{delete m.dataset.keep;renderBet();},3500);}
async function admin(a,arg,ok){try{const r=await rpc("mf_race_admin",{p_action:a,p_arg:arg});take(r);adminMsg(ok);return true;}catch(e){adminMsg(errText(e));render();return false;}}
async function test(){if(playing)return;try{const f=+$("#rcForce").value;const r=await rpc("mf_race_admin",{p_action:"test",p_arg:f||null});side(false);play({day:"essai",result:r.result,seed:r.seed,odds:r.odds},false);}catch(e){adminMsg(errText(e));}}
function replay(){if(S&&S.last&&!playing)play(S.last,false);}

/* ---------- la course ---------- */
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
/* chaque singe suit une courbe qui part de 0 et arrive à 1 au moment prévu par le classement du serveur,
   avec des accélérations et des coups de mou différents (et le caractère de chacun) : les positions changent en route */
function plan(L){const R=rng(L.seed||1),T=15.5,fin=[];let t=T;
  L.result.forEach((k,r)=>{if(r)t+=.18+R()*.75;fin[k-1]=t;});
  return M.map((m,i)=>{const a=[(R()*2-1)*.09,(R()*2-1)*.055,(R()*2-1)*.03];
    if(i===1)a[0]=Math.min(.09,Math.abs(a[0])+.03);        // le tryharder part fort
    if(i===2)a[0]=-.09;                       // le chill se réveille sur la fin
    if(i===4)a[2]=(R()<.5?-1:1)*.03;          // l'alcoolique avance par à-coups
    if(i===0)a[1]=(R()<.5?-1:1)*.055;         // le rageux s'énerve en plein milieu
    return {T:fin[i],a,w:7+R()*3,ph:R()*6.28,D:finishX(i)-X0};});}
const g=(a,u)=>u+a[0]*Math.sin(Math.PI*u)+a[1]*Math.sin(2*Math.PI*u)+a[2]*Math.sin(3*Math.PI*u);
function xAt(P,t){if(t<=0)return X0;if(t<P.T)return X0+P.D*g(P.a,t/P.T);const v=P.D/P.T;const e=Math.min(1.4,t-P.T);return X0+P.D+v*(e-e*e/2.8);}
function pose(pl,t,done){SP.forEach((el,i)=>{const P=pl&&pl[i];let x=P?xAt(P,t):X0,dy=0,rot=0,op=1;
    const run=P&&t>0&&t<P.T+1.4,ph=P?P.ph:i,w=P?P.w:8,tt=t||0;
    if(run){dy=-Math.abs(Math.sin(tt*w+ph))*7;rot=Math.sin(tt*w+ph)*3;}
    if(i===5){dy=-12-Math.sin(tt*2.2+ph)*9;op=.88;rot=Math.sin(tt*1.6)*4;}              // le fantôme flotte
    if(i===4&&run){dy+=Math.sin(tt*1.9+ph)*9;rot+=Math.sin(tt*3.1+ph)*9;}               // l'alcoolique zigzague
    if(i===2&&run){dy*=.5;}                                                              // le chill trottine
    if(i===0&&run){x+=Math.sin(tt*31)*1.5;}                                              // le rageux tremble de rage
    const y=LINES[i+1]-SH-2;el.style.transform=`translate(${(x-SW*.97).toFixed(1)}px,${(y+dy).toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;el.style.opacity=op;
    if(!done)el.classList.remove("win","dim");});}
function play(L,live){if(!L||!L.result||playing)return;if(!root.hidden)side(false);
  const pl=plan(L),order=L.result,total=Math.max(...pl.map(p=>p.T))+1.6;
  playing={day:L.day,over:false};renderIdle();renderRes();renderBet();
  const mineM=(S&&S.last&&S.last.day===L.day&&S.last.mine)?S.last.mine.m:null;
  SP.forEach((el,i)=>{el.classList.toggle("mine",mineM===i+1);el.querySelector("b").style.opacity=0;});
  if(!ac&&sound){try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(ac&&ac.state==="suspended")ac.resume().catch(()=>{});
  $("#rcView").scrollIntoView({block:"nearest",behavior:reduce?"auto":"smooth"});
  cam=0;place();pose(pl,0);
  const big=$("#rcBig"),lead=$("#rcLead");let leader=-1;
  const finish=()=>{playing.over=true;
    order.forEach((k,r)=>{const el=SP[k-1];el.classList.toggle("win",r===0);el.classList.toggle("dim",r>2);const b=el.querySelector("b");b.textContent=r+1;b.className=r?"r"+(r+1):"";b.style.opacity=r<3?1:0;});
    big.innerHTML=`<span style="font-size:.5em">ARRIVÉE !</span>`;tone("sawtooth",880,440,.12,.4);
    lead.classList.remove("on");
    if(L.day!=="essai")markSeen(String(L.day));
    const mine=S&&S.last&&S.last.day===L.day?S.last.mine:null;
    setTimeout(()=>{big.innerHTML="";celebrate(order[0]-1,L.odds?L.odds[order[0]-1]:null,mine,()=>{playing=null;render();});},reduce?300:1300);};
  if(reduce){pose(pl,total,true);finish();return;}
  // 3, 2, 1, partez !
  const steps=["3","2","1","PARTEZ !"];
  steps.forEach((s,i)=>setTimeout(()=>{big.innerHTML=`<span>${s}</span>`;tone(i<3?"square":"sawtooth",i<3?440:880,0,.12,i<3?.15:.45);},i*800));
  setTimeout(()=>{big.innerHTML="";const t0=performance.now();
    const frame=t=>{const el=(t-t0)/1000;pose(pl,el);
      // la caméra suit la tête de course
      let lx=X0,li=0,lp=-1;pl.forEach((P,i)=>{const x=xAt(P,el),pr=(x-X0)/P.D;if(x>lx)lx=x;if(pr>lp){lp=pr;li=i;}});
      const target=lx*K-VW*.62;cam+= (target-cam)*.08;place();
      if(li!==leader&&lp<1){leader=li;lead.textContent="En tête : "+M[li].n;lead.classList.add("on");tick();}
      if(el<total)requestAnimationFrame(frame);else finish();};
    requestAnimationFrame(frame);},steps.length*800-200);
}

/* ---------- le vainqueur en grand ---------- */
let winT=[],winDone=null;
function celebrate(i,o,mine,done){
  const box=$("#rcWin"),F=FX[i],m=M[i];winDone=done;
  box.style.setProperty("--wc",hexA(m.c,.35));box.style.setProperty("--wc2",hexA(m.c,.55));
  const im=$("#rcWImg");im.src=img(i);im.alt=m.n;im.style.setProperty("--wanim",F.a);im.style.setProperty("--wdur",F.d);im.style.setProperty("--wglow",F.glow);
  $("#rcWT").textContent=m.n.toUpperCase();
  $("#rcWS").textContent="remporte la course"+(o?" · cote "+odd(o):"")+" !";
  const me=$("#rcWMe");
  if(mine&&mine.m===i+1){me.className="rc-wme won";me.textContent="+"+mine.p+" 🍌 pour toi !";}
  else if(mine){me.className="rc-wme lost";me.textContent=`Ton ${M[mine.m-1].n.replace(/^(Le |L')/,"")} n'a pas gagné… ${mine.a} 🍌 envolées.`;}
  else{me.className="rc-wme";me.textContent="";}
  box.hidden=false;$("#rcWOk").focus({preventScroll:true});
  [523,659,784,1047,784,1047].forEach((f,k)=>setTimeout(()=>tone("triangle",f,0,.2,k>3?.5:.3),k*150));
  if(mine&&mine.m===i+1)setTimeout(()=>[1047,1319,1568].forEach((f,k)=>setTimeout(()=>tone("sine",f,0,.16,.3),k*90)),1200);
  if(reduce)return;
  const fl=document.createElement("div");fl.className="rc-flash";root.appendChild(fl);setTimeout(()=>fl.remove(),800);
  const add=(kf,dur)=>{const p=document.createElement("div");p.className="rc-pt";p.textContent=F.p[Math.floor(Math.random()*F.p.length)];box.appendChild(p);p.animate(kf,{duration:dur,easing:"cubic-bezier(.15,.7,.4,1)"}).onfinish=()=>p.remove();};
  const burst=n=>{for(let k=0;k<n;k++){const a=Math.random()*Math.PI*2,d=200+Math.random()*Math.max(innerWidth,innerHeight)*.6,x=Math.cos(a)*d,y=Math.sin(a)*d*.8,sc=.5+Math.random()*.9,rot=(Math.random()-.5)*720;
    add([{transform:"translate(0,0) scale(.2)",opacity:1},{transform:`translate(${x*.85}px,${y*.85-120}px) scale(${sc}) rotate(${rot*.6}deg)`,opacity:1,offset:.45},{transform:`translate(${x}px,${y+400}px) scale(${sc}) rotate(${rot}deg)`,opacity:0}],1700+Math.random()*1300);}};
  const rain=n=>{for(let k=0;k<n;k++){const x=(Math.random()-.5)*innerWidth,y0=-innerHeight*.42-60-Math.random()*160,rot=(Math.random()-.5)*540,sc=.5+Math.random()*.6;
    setTimeout(()=>{if(!box.hidden)add([{transform:`translate(${x}px,${y0}px) scale(${sc})`,opacity:1},{transform:`translate(${x+(Math.random()-.5)*90}px,${innerHeight*.65}px) scale(${sc}) rotate(${rot}deg)`,opacity:1}],1600+Math.random()*900);},Math.random()*2400);}};
  burst(36);winT=[setTimeout(()=>burst(24),900),setTimeout(()=>rain(40),1600),setTimeout(()=>burst(20),3200)];
}
function closeWin(){const box=$("#rcWin");if(box.hidden)return;winT.forEach(clearTimeout);winT=[];box.hidden=true;box.querySelectorAll(".rc-pt").forEach(x=>x.remove());
  const d=winDone;winDone=null;if(d)d();}
function hexA(h,a){const n=parseInt(h.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}

/* ---------- sons ---------- */
let ac=null;
function tone(type,f0,f1,vol,len){if(!sound||!ac)return;try{const t=ac.currentTime,o=ac.createOscillator(),gn=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+len*.8);gn.gain.setValueAtTime(vol,t);gn.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(gn).connect(ac.destination);o.start(t);o.stop(t+len+.01);}catch(e){}}
const tick=()=>tone("square",1200,0,.03,.04);

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
  if(!root)build();
  root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
  fit();render();$("#rcClose").focus({preventScroll:true});
  clearInterval(clock);clock=setInterval(when,1000);
  try{const r=await rpc("mf_race_status");take(r);when();
    // la dernière course n'a pas encore été vue sur cet appareil (et date de moins d'un jour) : on la montre
    if(r.last&&r.last.day&&seen()!==String(r.last.day)&&now()-r.last.settled<86400000)play(r.last,true);}
  catch(e){msg(errText(e),"bad");}
}
function close(){closeWin();root.hidden=true;document.body.style.overflow=prevOverflow;clearInterval(clock);clock=null;clearInterval(poll);poll=null;if(opener&&opener.focus)opener.focus();}

/* ---------- démarrage : bouton visible par l'admin, et par tous une fois la course ouverte ---------- */
async function boot(){
  if(!window.claude||!window.claude.use)return;
  try{USER=await window.claude.use("user");}catch(e){}
  if(!USER||typeof window.MF_RPC!=="function")return;
  try{ADMIN=!!(await USER.isOwner());}catch(e){}
  let ok=ADMIN;if(!ok){try{ok=!!(await rpc("mf_race_open"));}catch(e){}}
  if(!ok||document.getElementById("raceBtn"))return;
  const st=document.createElement("style");
  st.textContent=`#raceBtn{top:calc(max(12px,env(safe-area-inset-top,0px)) + 168px)}`;
  document.head.appendChild(st);
  const b=document.createElement("button");b.className="socialbtn";b.id="raceBtn";b.type="button";b.setAttribute("aria-label","Monkey Run");b.title="Monkey Run";
  b.innerHTML=`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h13l-2 4 2 4H5"/><path d="M9 4v8"/><path d="M13 4v8"/><path d="M5 8h13"/></svg>`;
  b.addEventListener("click",open);
  const prev=document.getElementById("slotBtn")||document.getElementById("rankBtn");if(prev)prev.after(b);else document.body.appendChild(b);
  [TRACK,LOGO,...M.map((m,i)=>img(i))].forEach(s=>{const i=new Image();i.src=s;});
}
window.MF_RACE={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

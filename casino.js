/* Monkey Family — Casino
   Un seul bouton rond (sous le Classement) qui ouvre la salle de jeux : une carte par mini-jeu, avec son état du moment.
   Chaque jeu s'inscrit lui-même avec MF_CASINO.add({...}) une fois ses droits vérifiés (admin, ou jeu ouvert à tous).
   La pastille rouge du bouton compte les jeux qui ont quelque chose pour le joueur (ticket gratuit, résultat de course non vu…).
   Tant que OPEN_TO_ALL est faux, seul l'admin voit le Casino ; les autres joueurs gardent les anciens boutons ronds. */
(function(){
"use strict";
const OPEN_TO_ALL=false;          // passer à true pour lancer le Casino chez tous les joueurs
const TOP=112,STEP=56;            // position sous le bouton Classement (et espacement des anciens boutons)
const LOGO="packs/casino-titre.webp";
const GAMES=[];                   // {id,name,icon,order,open,status,root,line,hot}
let ADMIN=null,adminP=null,btn=null,hub=null,watch=null,want=null,wantT=0;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const useHub=()=>OPEN_TO_ALL||ADMIN;
const CLOCK=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
// durée lisible qui ne se coupe jamais (espaces insécables) : « 22 h 18 », « 45 min »
const dur=ms=>{ms=Math.max(0,ms);const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);return h?`${h}\u00a0h\u00a0${String(m).padStart(2,"0")}`:`${Math.max(1,m)}\u00a0min`;};

function isAdmin(){
  if(!adminP)adminP=(async()=>{try{const u=await window.claude.use("user");ADMIN=!!(await u.isOwner());}catch(e){ADMIN=false;}return ADMIN;})();
  return adminP;
}

/* ---------- style ---------- */
const CSS=`
#casinoBtn{top:calc(max(12px,env(safe-area-inset-top,0px)) + ${TOP}px)}
#mfCasino{position:fixed;inset:0;z-index:8900;display:flex;flex-direction:column;align-items:center;overflow-y:auto;overscroll-behavior:contain;
 padding:max(16px,env(safe-area-inset-top)) 16px max(20px,env(safe-area-inset-bottom));box-sizing:border-box;color:#f6f0d8;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:radial-gradient(ellipse 90% 45% at 50% 0,rgba(255,200,60,.18),transparent 70%),linear-gradient(180deg,#2a1450,#140a26)}
#mfCasino[hidden]{display:none}
.cs-top{position:relative;width:min(520px,100%);margin:0 0 14px;padding-top:44px}
.cs-top h2{margin:0}
.cs-top img{display:block;width:100%;height:auto;aspect-ratio:1100/367;filter:drop-shadow(0 8px 18px rgba(0,0,0,.45))}
.cs-x{position:absolute;top:0;right:0;z-index:1;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font-size:22px;cursor:pointer}
.cs-list{width:min(520px,100%);display:flex;flex-direction:column;gap:12px}
.cs-card{position:relative;display:flex;align-items:center;gap:14px;width:100%;text-align:left;padding:14px 16px;border-radius:18px;cursor:pointer;color:inherit;font:inherit;
 background:linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,.03));border:1px solid rgba(255,217,138,.28);box-shadow:0 8px 22px rgba(0,0,0,.35);transition:transform .12s ease,border-color .12s}
.cs-card:hover,.cs-card:focus-visible{border-color:#ffd23f;outline:none}
.cs-card:active{transform:scale(.98)}
.cs-ic{flex:none;width:58px;height:58px;border-radius:16px;display:grid;place-items:center;color:#ffd98a;background:rgba(20,18,32,.7);border:1px solid rgba(255,255,255,.18)}
.cs-ic svg{width:32px;height:32px}
.cs-tx{flex:1;min-width:0}
.cs-tx b{display:block;font:400 21px/1.15 "Titan One",sans-serif;color:#fff}
.cs-tx span{display:block;margin-top:3px;font-weight:700;font-size:14.5px;color:#d9cdb0}
.cs-card.hot .cs-tx span{color:#ffd23f}
.cs-tx .cs-when{display:inline-flex;align-items:center;gap:6px;margin-top:7px;padding:3px 10px 3px 8px;border-radius:999px;font-size:13.5px;font-weight:700;white-space:nowrap;
 color:#ffe7a8;background:rgba(255,210,63,.12);border:1px solid rgba(255,210,63,.3)}
.cs-when i{font-style:normal}
.cs-when svg{width:14px;height:14px;flex:none}
.cs-card .cs-dot{position:absolute;top:10px;right:12px;width:11px;height:11px;border-radius:50%;background:#ff4b45;box-shadow:0 0 0 3px rgba(255,75,69,.25)}
.cs-card:not(.hot) .cs-dot{display:none}
.cs-go{flex:none;font-size:22px;color:#ffd23f}
.cs-note{width:min(520px,100%);margin-top:16px;text-align:center;font-size:13px;color:#a99cc4}
`;

/* ---------- bouton rond ---------- */
function ensureBtn(){
  if(btn)return;
  const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  btn=document.createElement("button");btn.className="socialbtn";btn.id="casinoBtn";btn.type="button";btn.title="Casino";btn.setAttribute("aria-label","Casino");
  // jeton de casino
  btn.innerHTML=`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="M5.6 5.6l2.9 2.9"/><path d="M15.5 15.5l2.9 2.9"/><path d="M18.4 5.6l-2.9 2.9"/><path d="M8.5 15.5l-2.9 2.9"/></svg><span class="sbadge" hidden></span>`;
  btn.addEventListener("click",openHub);
  {const i=new Image();i.src=LOGO;}
  const rank=document.getElementById("rankBtn");if(rank)rank.after(btn);else document.body.appendChild(btn);
}
function badge(){
  if(!btn)return;const n=GAMES.filter(g=>g.hot).length,b=btn.querySelector(".sbadge");
  b.hidden=!n;b.textContent=String(n);btn.setAttribute("aria-label",n?`Casino : ${n} jeu${n>1?"x":""} t'attend${n>1?"ent":""}`:"Casino");
}

/* ---------- anciens boutons (joueurs, tant que le Casino n'est pas lancé) ---------- */
function legacy(g){
  const b=document.createElement("button");b.className="socialbtn";b.id=g.id+"Btn";b.type="button";b.title=g.name;b.setAttribute("aria-label",g.name);
  b.innerHTML=g.icon+`<span class="sbadge" hidden>1</span>`;b.addEventListener("click",()=>g.open());
  g.btn=b;document.body.appendChild(b);
  GAMES.forEach((x,i)=>{if(x.btn)x.btn.style.top=`calc(max(12px,env(safe-area-inset-top,0px)) + ${TOP+STEP*i}px)`;});
  const rank=document.getElementById("rankBtn");if(rank)GAMES.slice().reverse().forEach(x=>{if(x.btn)rank.after(x.btn);});
}

/* ---------- la salle ---------- */
function build(){
  hub=document.createElement("div");hub.id="mfCasino";hub.hidden=true;hub.setAttribute("role","dialog");hub.setAttribute("aria-modal","true");hub.setAttribute("aria-label","Casino");
  hub.innerHTML=`<div class="cs-top"><h2><img src="${LOGO}" alt="Monkey Family Casino"></h2><button type="button" class="cs-x" id="csClose" aria-label="Fermer">✕</button></div>
    <div class="cs-list" id="csList"></div><p class="cs-note">Joue avec modération, singe 🐒</p>`;
  document.body.appendChild(hub);
  hub.querySelector("#csClose").addEventListener("click",closeHub);
  hub.addEventListener("keydown",e=>{if(e.key==="Escape"&&!gameOpen())closeHub();});
}
function paint(){
  if(!hub)return;const list=hub.querySelector("#csList");
  list.innerHTML=GAMES.map(g=>`<button type="button" class="cs-card${g.hot?" hot":""}" data-id="${g.id}"><span class="cs-ic">${g.icon}</span>
    <span class="cs-tx"><b>${esc(g.name)}</b><span>${esc(g.line||"…")}</span>${g.until?`<span class="cs-when">${CLOCK}<i>${esc(when(g))}</i></span>`:""}</span><span class="cs-go" aria-hidden="true">›</span><i class="cs-dot"></i></button>`).join("");
  list.querySelectorAll(".cs-card").forEach(c=>c.addEventListener("click",()=>launch(c.dataset.id)));
}
const when=g=>g.pre+dur(g.until-Date.now());
// le compte à rebours avance tout seul tant que la salle est ouverte
function tick(){if(!hub||hub.hidden)return;GAMES.forEach(g=>{const el=g.until&&hub.querySelector(`.cs-card[data-id="${g.id}"] .cs-when i`);if(el)el.textContent=when(g);});}
setInterval(tick,15000);
const gameOpen=()=>GAMES.some(g=>{const r=document.getElementById(g.root);return r&&!r.hidden;});
let opener=null,prevOverflow="";
function openHub(){
  if(!hub)build();paint();
  hub.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
  hub.querySelector("#csClose").focus({preventScroll:true});
  refresh();
}
function closeHub(){
  if(!hub||hub.hidden)return;hub.hidden=true;document.body.style.overflow=prevOverflow;clearInterval(watch);watch=null;
  if(opener&&opener.focus)opener.focus();
}
// le jeu s'ouvre par-dessus la salle ; quand on le ferme, on retombe dans la salle avec les états à jour
function launch(id){
  const g=GAMES.find(x=>x.id===id);if(!g)return;
  g.open();
  clearInterval(watch);let seen=false;
  watch=setInterval(()=>{const o=gameOpen();if(o)seen=true;else if(seen||!hub||hub.hidden){clearInterval(watch);watch=null;refresh();}},700);
}

/* ---------- états ---------- */
async function one(g){
  try{const s=await g.status();if(s){g.line=s.line;g.hot=!!s.hot;g.until=s.in!=null?Date.now()+s.in:0;g.pre=s.pre||"";}}catch(e){}
  if(g.btn){const b=g.btn.querySelector(".sbadge");b.hidden=!g.hot;}
}
let busy=null;
function refresh(){
  if(busy)return busy;
  busy=Promise.all(GAMES.map(one)).then(()=>{busy=null;badge();paint();});
  return busy;
}

/* ---------- inscription d'un jeu ---------- */
async function add(g){
  if(GAMES.some(x=>x.id===g.id))return;
  GAMES.push(g);GAMES.sort((a,b)=>(a.order||0)-(b.order||0));
  await isAdmin();
  if(useHub())ensureBtn();else legacy(g);
  await one(g);badge();paint();
  if(want===g.id){want=null;clearTimeout(wantT);openGame(g.id);}
}
// ouvrir un jeu directement (notification de la Monkey Run…), sans passer par la salle
function openGame(id){
  const g=GAMES.find(x=>x.id===id);
  if(!g){want=id;clearTimeout(wantT);wantT=setTimeout(()=>{want=null;},20000);return;}
  g.open();
}

window.MF_CASINO={add,refresh,openGame,open:openHub};

// rafraîchit la pastille : au retour dans l'appli, et toutes les 10 min (à minuit, le ticket gratuit revient sans relancer)
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&GAMES.length)refresh();});
setInterval(()=>{if(GAMES.length&&(!hub||hub.hidden))refresh();},10*60*1000);

// clic sur une notification de course : l'appli était fermée (#race) ou déjà ouverte (message du service worker)
if(location.hash==="#race"){openGame("race");try{history.replaceState(null,"",location.pathname+location.search);}catch(e){}}
if(navigator.serviceWorker)navigator.serviceWorker.addEventListener("message",e=>{const d=e.data;if(d&&d.mf==="open"&&d.game)openGame(d.game);});
})();

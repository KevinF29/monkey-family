/* Monkey Family — Casino et Arène
   Deux salles, chacune derrière un bouton rond sous le Classement : le Casino (jeux contre la banque, rotation des jeux de la semaine)
   et l'Arène (jeux communautaires et compétitifs : L'Expédition, Monkey Rush, Flying Monkey). Les jeux de l'Arène s'inscrivent
   aussi avec MF_CASINO.add : la liste ARENA les envoie dans la bonne salle.
   Casino : un seul bouton rond (sous le Classement) qui ouvre la salle de jeux : une carte par mini-jeu, avec son état du moment.
   Chaque jeu s'inscrit lui-même avec MF_CASINO.add({...}) une fois ses droits vérifiés (admin, ou jeu ouvert à tous).
   La pastille rouge du bouton compte les jeux qui ont quelque chose pour le joueur (ticket gratuit, résultat de course non vu…).
   Tant que OPEN_TO_ALL est faux, seul l'admin voit le Casino ; les autres joueurs gardent les anciens boutons ronds. */
(function(){
"use strict";
const OPEN_TO_ALL=true;           // passer à true pour lancer le Casino chez tous les joueurs
const TOP=112,STEP=56;            // position sous le bouton Classement (et espacement des anciens boutons)
const LOGO="packs/casino-titre.webp";
const ARENA=["exp","rush","fly"];     // jeux communautaires et compétitifs : dans l'Arène, hors rotation du Casino
let ADMIN=null,adminP=null,want=null,wantT=0,cssDone=false;
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
#arenaBtn{top:calc(max(12px,env(safe-area-inset-top,0px)) + ${TOP+STEP}px)}
.cs-hub{position:fixed;inset:0;z-index:8900;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;touch-action:manipulation;height:100dvh;
 padding:max(12px,env(safe-area-inset-top)) 16px max(12px,env(safe-area-inset-bottom));box-sizing:border-box;color:#f6f0d8;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:radial-gradient(ellipse 90% 45% at 50% 0,rgba(255,200,60,.18),transparent 70%),linear-gradient(180deg,#2a1450,#140a26)}
.cs-hub[hidden]{display:none}
.cs-top{flex:none;position:relative;width:min(520px,100%);margin:0 0 clamp(8px,1.6dvh,14px);padding-top:clamp(30px,5dvh,44px)}
.cs-top h2{margin:0;display:flex;justify-content:center}
.cs-top img{display:block;width:100%;max-width:calc(min(20dvh,170px)*1100/367);height:auto;aspect-ratio:1100/367;filter:drop-shadow(0 8px 18px rgba(0,0,0,.45))}
.cs-x{position:absolute;top:0;right:0;z-index:1;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font-size:22px;cursor:pointer}
.cs-list{flex:1 1 auto;min-height:0;width:min(520px,100%);display:flex;flex-direction:column;gap:clamp(6px,1.4dvh,12px)}
.cs-card{position:relative;display:flex;align-items:center;gap:14px;width:100%;flex:0 1 auto;min-height:0;text-align:left;padding:clamp(7px,1.5dvh,14px) 16px;border-radius:18px;cursor:pointer;color:inherit;font:inherit;
 background:linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,.03));border:1px solid rgba(255,217,138,.28);box-shadow:0 8px 22px rgba(0,0,0,.35);transition:transform .12s ease,border-color .12s}
.cs-card:hover,.cs-card:focus-visible{border-color:#ffd23f;outline:none}
.cs-card:active{transform:scale(.98)}
.cs-ic{flex:none;width:clamp(44px,7dvh,58px);height:clamp(44px,7dvh,58px);border-radius:16px;display:grid;place-items:center;color:#ffd98a;background:rgba(20,18,32,.7);border:1px solid rgba(255,255,255,.18)}
.cs-ic svg{width:32px;height:32px}
.cs-tx{flex:1;min-width:0}
.cs-tx b{display:block;font:400 clamp(18px,2.7dvh,21px)/1.15 "Titan One",sans-serif;color:#fff}
.cs-tx span{display:block;margin-top:3px;font-weight:700;font-size:14.5px;color:#d9cdb0}
.cs-card.hot .cs-tx span{color:#ffd23f}
.cs-tx .cs-when{display:inline-flex;align-items:center;gap:6px;margin-top:clamp(3px,.8dvh,7px);padding:3px 10px 3px 8px;border-radius:999px;font-size:13.5px;font-weight:700;white-space:nowrap;
 color:#ffe7a8;background:rgba(255,210,63,.12);border:1px solid rgba(255,210,63,.3)}
.cs-when i{font-style:normal}
.cs-when svg{width:14px;height:14px;flex:none}
.cs-card .cs-dot{position:absolute;top:10px;right:12px;width:11px;height:11px;border-radius:50%;background:#ff4b45;box-shadow:0 0 0 3px rgba(255,75,69,.25)}
.cs-card:not(.hot) .cs-dot{display:none}
.cs-go{flex:none;font-size:22px;color:#ffd23f}
/* très petit écran (téléphone couché…) : on laisse défiler plutôt que de couper un jeu */
@media (max-height:540px){.cs-hub{overflow-y:auto;overscroll-behavior:contain}.cs-list{flex:none}}
.cs-sec{flex:none;display:flex;align-items:center;gap:8px;margin:2px 2px 0;font:400 16px/1.2 "Titan One",sans-serif;color:#ffd23f}
.cs-sec small{margin-left:auto;display:inline-flex;align-items:center;gap:5px;padding:3px 10px 3px 8px;border-radius:999px;font:700 12.5px/1.3 Quicksand,system-ui,sans-serif;white-space:nowrap;color:#ffe7a8;background:rgba(255,210,63,.12);border:1px solid rgba(255,210,63,.3)}
.cs-sec small svg{width:13px;height:13px}.cs-sec i{font-style:normal}
.cs-sec.off{color:#a99cc4}
.cs-card.off{opacity:.55;border-style:dashed}
.cs-adm{position:absolute;top:0;left:0;z-index:1;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#ffd23f;font-size:20px;cursor:pointer}
.cs-adm[hidden]{display:none}
.cs-hub.admin,.cs-hub.many{overflow-y:auto;overscroll-behavior:contain}.cs-hub.admin .cs-list,.cs-hub.many .cs-list{flex:none}
.cs-panel{position:absolute;inset:0;z-index:5;display:flex;justify-content:center;align-items:flex-start;padding:max(12px,env(safe-area-inset-top)) 16px 16px;background:rgba(10,5,20,.78);overflow-y:auto}
.cs-panel[hidden]{display:none}
.cs-pbox{width:min(440px,100%);padding:16px 18px;border-radius:18px;background:#24123f;border:1px solid rgba(255,217,138,.35);box-shadow:0 18px 40px rgba(0,0,0,.5)}
.cs-pbox h3{margin:0 0 4px;font:400 20px "Titan One",sans-serif;color:#ffd23f}
.cs-pbox p{margin:0 0 12px;font-size:13.5px;color:#cbbfe0}
.cs-row{display:flex;align-items:center;gap:10px;margin:10px 0;font-weight:700}
.cs-row select{margin-left:auto;font:inherit;padding:6px 8px;border-radius:10px;background:#160b29;color:#fff;border:1px solid rgba(255,255,255,.25)}
.cs-pick{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px}
.cs-pick label{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);font-weight:700;font-size:14px}
.cs-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.cs-btns button{flex:1 1 auto;min-height:42px;padding:8px 12px;border-radius:12px;font:700 14px Quicksand,system-ui,sans-serif;cursor:pointer;border:1px solid rgba(255,217,138,.4);background:rgba(255,255,255,.06);color:#fff}
.cs-btns .cs-main{background:#ffd23f;color:#2a1450;border-color:#ffd23f}
.cs-msg{min-height:1.2em;margin:10px 0 0;font-size:13px;color:#8fe3a8}
.cs-hub.arena{background:radial-gradient(ellipse 90% 45% at 50% 0,rgba(90,200,255,.18),transparent 70%),linear-gradient(180deg,#123049,#0a1424)}
.cs-title{margin:0;font:400 clamp(34px,6.5dvh,52px)/1 "Titan One",sans-serif;color:#ffd23f;letter-spacing:.02em;text-shadow:0 4px 0 #8a4b00,0 0 24px rgba(255,180,0,.4);text-align:center}
.cs-sub{display:block;margin-top:6px;font:700 14px/1.3 Quicksand,system-ui,sans-serif;color:#bfe3ff;text-shadow:none;letter-spacing:0}
.cs-note{flex:none;width:min(520px,100%);margin:clamp(8px,1.6dvh,16px) 0 0;text-align:center;font-size:13px;color:#a99cc4}
`;

function makeHub(K){
const GAMES=[];                   // {id,name,icon,order,open,status,root,line,hot}
let btn=null,hub=null,watch=null;
let CFG=null,cfgAt=0;          // rotation des jeux de la semaine (mf_casino_status), Casino seulement
/* ---------- bouton rond ---------- */
function ensureBtn(){
  if(btn)return;
  if(!cssDone){cssDone=true;const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);}
  btn=document.createElement("button");btn.className="socialbtn";btn.id=K.btnId;btn.type="button";btn.title=K.name;btn.setAttribute("aria-label",K.name);
  btn.innerHTML=K.icon+`<span class="sbadge" hidden></span>`;
  btn.addEventListener("click",openHub);
  if(K.logo){const i=new Image();i.src=K.logo;}
  // toujours dans le même ordre sous le Classement : Casino puis Arène
  const prev=K.after&&document.getElementById(K.after),rank=document.getElementById("rankBtn");
  if(prev)prev.after(btn);else if(rank)rank.after(btn);else document.body.appendChild(btn);
  const nxt=K.before&&document.getElementById(K.before);if(nxt)btn.after(nxt);
}
function badge(){
  if(!btn)return;const n=GAMES.filter(g=>g.hot).length,b=btn.querySelector(".sbadge");
  b.hidden=!n;b.textContent=String(n);btn.setAttribute("aria-label",n?`${K.name} : ${n} jeu${n>1?"x":""} t'attend${n>1?"ent":""}`:K.name);
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
  hub=document.createElement("div");hub.id=K.rootId;hub.className="cs-hub"+(K.cls?" "+K.cls:"");hub.hidden=true;hub.setAttribute("role","dialog");hub.setAttribute("aria-modal","true");hub.setAttribute("aria-label",K.name);
  hub.innerHTML=`<div class="cs-top"><h2>${K.logo?`<img src="${K.logo}" alt="${esc(K.alt)}">`:`<span class="cs-title">${esc(K.name)}<span class="cs-sub">${esc(K.sub||"")}</span></span>`}</h2><button type="button" class="cs-adm" id="csAdm" aria-label="Réglages de la rotation" hidden>⚙</button><button type="button" class="cs-x" id="csClose" aria-label="Fermer">✕</button></div>
    <div class="cs-list" id="csList"></div><div class="cs-panel" id="csPanel" hidden role="dialog" aria-label="Rotation des jeux"><div class="cs-pbox" id="csPbox"></div></div><p class="cs-note">${esc(K.note)}</p>`;
  document.body.appendChild(hub);
  hub.querySelector("#csClose").addEventListener("click",closeHub);
  hub.querySelector("#csAdm").addEventListener("click",()=>panel(true));
  hub.addEventListener("keydown",e=>{if(e.key!=="Escape"||gameOpen())return;if(!hub.querySelector("#csPanel").hidden)panel(false);else closeHub();});
}
const card=(g,off)=>`<button type="button" class="cs-card${g.hot&&!off?" hot":""}${off?" off":""}" data-id="${g.id}"><span class="cs-ic">${g.icon}</span>
    <span class="cs-tx"><b>${esc(g.name)}</b><span>${esc(off?"Hors rotation cette semaine (visible par toi seul)":g.line||"…")}</span>${g.until&&!off?`<span class="cs-when">${CLOCK}<i>${esc(when(g))}</i></span>`:""}</span><span class="cs-go" aria-hidden="true">›</span><i class="cs-dot"></i></button>`;
const inPool=g=>!!(K.rotation&&CFG&&CFG.pool&&CFG.pool.includes(g.id));
const featured=g=>!CFG||!CFG.enabled||!inPool(g)||CFG.featured.includes(g.id);
function paint(){
  if(!hub)return;const list=hub.querySelector("#csList");
  hub.classList.toggle("admin",!!ADMIN);
  // plus de 6 jeux affichés (rotation coupée) : la salle défile au lieu de tout tasser
  const rot=!!(K.rotation&&CFG&&CFG.enabled);
  hub.classList.toggle("many",GAMES.filter(g=>!rot||!inPool(g)||featured(g)).length>6);hub.querySelector("#csAdm").hidden=!(ADMIN&&K.rotation);
  // jeux fixes en haut, puis les jeux de la rotation (même quand la rotation est coupée)
  const fixed=GAMES.filter(g=>!inPool(g)),week=GAMES.filter(g=>inPool(g)&&(!rot||featured(g))),out=rot&&ADMIN?GAMES.filter(g=>inPool(g)&&!featured(g)):[];
  let h=fixed.map(g=>card(g)).join("");
  if(!rot)h+=week.map(g=>card(g)).join("");
  else if(week.length)h+=`<div class="cs-sec">Jeux de la semaine<small>${CLOCK}<i id="csNext">Changement dans ${esc(durLong(nextIn()))}</i></small></div>`+week.map(g=>card(g)).join("");
  if(out.length)h+=`<div class="cs-sec off">Hors rotation</div>`+out.map(g=>card(g,true)).join("");
  list.innerHTML=h;
  list.querySelectorAll(".cs-card").forEach(c=>c.addEventListener("click",()=>launch(c.dataset.id)));
}
/* ---------- réglages admin de la rotation ---------- */
function panel(o){
  const p=hub.querySelector("#csPanel");p.hidden=!o;
  if(!o){hub.querySelector("#csAdm").focus({preventScroll:true});return;}
  const c=CFG||{enabled:false,slots:1,pool:[],featured:[]},nm=id=>(GAMES.find(g=>g.id===id)||{name:id}).name,man=c.manual||[];
  hub.querySelector("#csPbox").innerHTML=`<h3>Jeux de la semaine</h3>
    <p>La Banana Machine, le Monkey Cash et The Monkey Wheel restent toujours là. Les jeux ci-dessous tournent chaque lundi à 0 h.</p>
    <label class="cs-row"><input type="checkbox" id="csOn"${c.enabled?" checked":""}> Rotation activée</label>${!c.enabled&&c.from?`<div class="cs-row" style="color:#8fe3a8">Tous les jeux sont ouverts ; la rotation reprend toute seule le ${esc(new Date(c.from).toLocaleString("fr-FR",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"}))}.</div>`:""}
    <label class="cs-row">Jeux par semaine<select id="csSlots">${c.pool.map((_,i)=>`<option${i+1===c.slots?" selected":""}>${i+1}</option>`).join("")}</select></label>
    <div class="cs-row">Cette semaine : ${c.enabled?esc(c.featured.map(nm).join(", ")||"aucun"):"tous (rotation coupée)"}</div>
    <div class="cs-row">Choisir les jeux (sinon rotation automatique)</div>
    <div class="cs-pick">${c.pool.map(id=>`<label><input type="checkbox" value="${esc(id)}"${man.includes(id)?" checked":""}> ${esc(nm(id))}</label>`).join("")}</div>
    <div class="cs-btns"><button type="button" class="cs-main" id="csSave">Enregistrer (lundi prochain)</button><button type="button" id="csNow">Appliquer tout de suite</button><button type="button" id="csPx">Fermer</button></div>
    <p class="cs-msg" id="csMsg" role="status"></p>`;
  const $p=q=>hub.querySelector(q);
  const send=async now=>{
    const pick=[...hub.querySelectorAll(".cs-pick input:checked")].map(i=>i.value);
    $p("#csMsg").textContent="…";
    try{CFG=await window.MF_RPC("mf_casino_admin",{p:{enabled:$p("#csOn").checked,slots:+$p("#csSlots").value,manual:pick.length?pick:null,now}});cfgAt=Date.now();stamp();
      $p("#csMsg").textContent=now?"C'est appliqué : les joueurs voient la nouvelle sélection à la prochaine ouverture de l'appli.":"Enregistré.";paint();}
    catch(e){$p("#csMsg").textContent="Erreur : "+(e&&e.message||e);}
  };
  $p("#csSave").addEventListener("click",()=>send(false));
  $p("#csNow").addEventListener("click",()=>send(true));
  $p("#csPx").addEventListener("click",()=>panel(false));
  $p("#csOn").focus({preventScroll:true});
}
const stamp=()=>{if(CFG&&CFG.now)CFG.skew=CFG.now-Date.now();};
async function loadCfg(force){
  if(!force&&CFG&&Date.now()-cfgAt<60000)return CFG;
  try{CFG=await window.MF_RPC("mf_casino_status",{});cfgAt=Date.now();stamp();}catch(e){}
  return CFG;
}
const durLong=ms=>{ms=Math.max(0,ms);const d=Math.floor(ms/86400000);return d?`${d}\u00a0j\u00a0${Math.floor(ms%86400000/3600000)}\u00a0h`:dur(ms);};
const nextIn=()=>CFG?CFG.next-(Date.now()+(CFG.skew||0)):0;
const when=g=>g.pre+dur(g.until-Date.now());
// le compte à rebours avance tout seul tant que la salle est ouverte
function tick(){if(!hub||hub.hidden)return;const nx=hub.querySelector("#csNext");if(nx)nx.textContent="Changement dans "+durLong(nextIn());GAMES.forEach(g=>{const el=g.until&&hub.querySelector(`.cs-card[data-id="${g.id}"] .cs-when i`);if(el)el.textContent=when(g);});}
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
  busy=Promise.all([K.rotation?loadCfg():null,...GAMES.map(one)]).then(()=>{busy=null;badge();paint();});
  return busy;
}

/* ---------- inscription d'un jeu ---------- */
async function add(g){
  if(GAMES.some(x=>x.id===g.id))return;
  GAMES.push(g);GAMES.sort((a,b)=>(a.order||0)-(b.order||0));
  await isAdmin();if(K.rotation)await loadCfg();
  if(useHub())ensureBtn();else legacy(g);
  await one(g);badge();paint();
  if(want===g.id){want=null;clearTimeout(wantT);openGame(g.id);}
}

// rafraîchit la pastille : au retour dans l'appli, et toutes les 10 min (à minuit, le ticket gratuit revient sans relancer)
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&GAMES.length)refresh();});
setInterval(()=>{if(GAMES.length&&(!hub||hub.hidden))refresh();},10*60*1000);
return {add,refresh,open:openHub,find:id=>GAMES.find(g=>g.id===id)};
}

const CASINO=makeHub({name:"Casino",btnId:"casinoBtn",rootId:"mfCasino",before:"arenaBtn",rotation:true,logo:LOGO,alt:"Monkey Family Casino",
  note:"N'oubliez jamais qu'à la fin, c'est toujours le Casino qui gagne 🎰",
  // jeton de casino avec une banane au centre (redessiné d'après l'icône de Kévin)
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.3"/><circle cx="12" cy="12" r="6.6" stroke-dasharray="1.6 3.58" transform="rotate(-6 12 12)"/><path d="M8.4 12.2c.7 2.5 2.9 3.6 5 3 1.8-.5 2.7-2.3 2.3-4.5-.8 1.8-2.5 2.8-4.5 2.7-1 0-1.9-.4-2.8-1.2z"/><path d="M15.7 10.7l.3-1.5"/></svg>`});
const ARENA_HUB=makeHub({name:"L'Arène",btnId:"arenaBtn",rootId:"mfArena",after:"casinoBtn",cls:"arena",rotation:false,logo:"packs/arene-titre.webp",alt:"L'Arène",
  sub:"Jeux entre potes : que le meilleur singe gagne",note:"Le classement ne ment jamais 🏆",
  // podium à trois marches avec une étoile au-dessus de la première
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 20v-9h6v9"/><path d="M3 20v-5h6"/><path d="M15 15h6v5"/><path d="M2 20h20"/><path d="M12 3.2l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z"/></svg>`});

const hubOf=id=>ARENA.includes(id)?ARENA_HUB:CASINO;
const add=g=>hubOf(g.id).add(g);
// ouvrir un jeu directement (notification de la Monkey Run, de L'Expédition…), sans passer par la salle
function openGame(id){
  const g=hubOf(id).find(id);
  if(!g){want=id;clearTimeout(wantT);wantT=setTimeout(()=>{want=null;},20000);return;}
  g.open();
}
const refresh=()=>Promise.all([CASINO.refresh(),ARENA_HUB.refresh()]);
window.MF_CASINO={add,refresh,openGame,open:CASINO.open};
window.MF_ARENA={add:g=>ARENA_HUB.add(g),refresh:ARENA_HUB.refresh,openGame,open:ARENA_HUB.open};

// clic sur une notification de course : l'appli était fermée (#race) ou déjà ouverte (message du service worker)
if(location.hash==="#race"||location.hash==="#exp"){openGame(location.hash.slice(1));try{history.replaceState(null,"",location.pathname+location.search);}catch(e){}}
if(navigator.serviceWorker)navigator.serviceWorker.addEventListener("message",e=>{const d=e.data;if(d&&d.mf==="open"&&d.game)openGame(d.game);});
})();

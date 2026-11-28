/* Monkey Family — Salle de jeux (Monkey Run, Casino et Arène)
   Un seul bouton rond sous le Classement ouvre la salle de jeux :
     - le jeu fixe (la Monkey Run), toujours là ;
     - le sous-menu « Casino » : les jeux contre la banque, 3 tirés au hasard chaque lundi (liste pool du serveur) ;
     - le sous-menu « L'Arène » : L'Expédition (toujours là) et 1 jeu compétitif qui tourne chaque lundi (liste arena_pool).
   Chaque jeu s'inscrit lui-même avec MF_CASINO.add({...}) une fois ses droits vérifiés : la liste HUB_OF l'envoie dans la bonne salle.
   La rotation est décidée par le serveur (mf_casino_status) ; l'admin la règle avec le ⚙ de la salle de jeux.
   La pastille rouge du bouton compte les jeux qui ont quelque chose pour le joueur (ticket gratuit, résultat de course non vu…). */
(function(){
"use strict";
const TOP=112;                    // position sous le bouton Classement
const MAIN_IDS=["race"];                       // jeu fixe, directement dans la salle de jeux
const ARENA=["exp","rush","fly","jump"];       // jeux communautaires et compétitifs : dans l'Arène
// noms de secours (réglages admin) pour les jeux qu'un joueur n'a pas chargés
const NAMES={race:"Monkey Run",slot:"Banana Machine",scratch:"Monkey Cash",wheel:"The Monkey Wheel",mine:"Le Champ de Cocos",tour:"The Monkey Tower",
  coco:"Crash Cocotier",bj:"MonkeyJack 21",bon:"Bananateau",vp:"Poker Monkey",pk:"Plinko Banana",fly:"Flying Monkey",rush:"Monkey Rush",jump:"Monkey Jump",exp:"L'Expédition"};
let ADMIN=null,adminP=null,want=null,wantT=0,cssDone=false;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CLOCK=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
// durée lisible qui ne se coupe jamais (espaces insécables) : « 22 h 18 », « 45 min »
const dur=ms=>{ms=Math.max(0,ms);const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);return h?`${h} h ${String(m).padStart(2,"0")}`:`${Math.max(1,m)} min`;};
const durLong=ms=>{ms=Math.max(0,ms);const d=Math.floor(ms/86400000);return d?`${d} j ${Math.floor(ms%86400000/3600000)} h`:dur(ms);};
const andList=a=>a.length>1?a.slice(0,-1).join(", ")+" et "+a[a.length-1]:a[0]||"";

function isAdmin(){
  if(!adminP)adminP=(async()=>{try{const u=await window.claude.use("user");ADMIN=!!(await u.isOwner());}catch(e){ADMIN=false;}return ADMIN;})();
  return adminP;
}

/* ---------- rotation (commune aux salles) ---------- */
let CFG=null,cfgAt=0,cfgP=null;
const stamp=()=>{if(CFG&&CFG.now)CFG.skew=CFG.now-Date.now();};
function loadCfg(force){
  if(!force&&CFG&&Date.now()-cfgAt<60000)return Promise.resolve(CFG);
  if(!cfgP)cfgP=(async()=>{try{CFG=await window.MF_RPC("mf_casino_status",{});cfgAt=Date.now();stamp();}catch(e){}cfgP=null;return CFG;})();
  return cfgP;
}
const rotOn=()=>!!(CFG&&CFG.enabled);
const nextIn=()=>CFG?CFG.next-(Date.now()+(CFG.skew||0)):0;

const CSS=`
#gamesBtn{top:calc(max(12px,env(safe-area-inset-top,0px)) + ${TOP}px)}
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
/* salle de jeux : les deux sous-menus en grandes cartes avec leur logo */
.cs-hub.games{background:radial-gradient(ellipse 90% 45% at 50% 0,rgba(140,230,120,.16),transparent 70%),linear-gradient(180deg,#1d3a1c,#0d1a0d)}
#mfCasino,#mfArena{z-index:8910}
.cs-room{position:relative;flex:0 1 auto;min-height:0;display:flex;flex-direction:column;align-items:center;gap:clamp(4px,1dvh,8px);width:100%;padding:clamp(8px,1.8dvh,16px) 16px clamp(10px,1.8dvh,16px);border-radius:20px;cursor:pointer;color:inherit;font:inherit;
 background:linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.03));border:1px solid rgba(255,217,138,.32);box-shadow:0 10px 26px rgba(0,0,0,.4);transition:transform .12s ease,border-color .12s}
.cs-room:hover,.cs-room:focus-visible{border-color:#ffd23f;outline:none}
.cs-room:active{transform:scale(.98)}
.cs-room img{display:block;width:auto;max-width:86%;height:clamp(54px,12dvh,104px);object-fit:contain;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))}
.cs-rl{font-weight:700;font-size:14.5px;line-height:1.3;color:#e8dcbc;text-align:center}
.cs-room.hot .cs-rl{color:#ffd23f}
.cs-room .cs-go{position:absolute;right:14px;top:50%;transform:translateY(-50%)}
.cs-num{position:absolute;top:10px;right:12px;min-width:22px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:999px;background:#ff4b45;color:#fff;font:700 12.5px/22px Quicksand,system-ui,sans-serif;font-style:normal;text-align:center;box-shadow:0 0 0 3px rgba(255,75,69,.25)}
`;


function makeHub(K){
const GAMES=[];                   // {id,name,icon,order,open,status,root,line,hot,room}
let btn=null,hub=null,watch=null;
const inPool=g=>!!(K.pool&&CFG&&CFG[K.pool]&&CFG[K.pool].includes(g.id));
const featured=g=>!rotOn()||!inPool(g)||(CFG.featured||[]).includes(g.id);
const shown=()=>GAMES.filter(featured);
const hotCount=()=>shown().reduce((n,g)=>n+(g.room?(g.n||0):g.hot?1:0),0);

/* ---------- bouton rond (salle de jeux seulement) ---------- */
function ensureCss(){if(!cssDone){cssDone=true;const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);}}
function ensureBtn(){
  ensureCss();if(btn||!K.btnId)return;
  btn=document.createElement("button");btn.className="socialbtn";btn.id=K.btnId;btn.type="button";btn.title=K.name;btn.setAttribute("aria-label",K.name);
  btn.innerHTML=K.icon+`<span class="sbadge" hidden></span>`;
  btn.addEventListener("click",openHub);
  const rank=document.getElementById("rankBtn");if(rank)rank.after(btn);else document.body.appendChild(btn);
}
function badge(){
  if(!btn)return;const n=hotCount(),b=btn.querySelector(".sbadge");
  b.hidden=!n;b.textContent=String(n);btn.setAttribute("aria-label",n?`${K.name} : ${n} jeu${n>1?"x":""} t'attend${n>1?"ent":""}`:K.name);
}

/* ---------- la salle ---------- */
function build(){
  ensureCss();
  hub=document.createElement("div");hub.id=K.rootId;hub.className="cs-hub"+(K.cls?" "+K.cls:"");hub.hidden=true;hub.setAttribute("role","dialog");hub.setAttribute("aria-modal","true");hub.setAttribute("aria-label",K.name);
  hub.innerHTML=`<div class="cs-top"><h2>${K.logo?`<img src="${K.logo}" alt="${esc(K.alt)}">`:`<span class="cs-title">${esc(K.name)}<span class="cs-sub">${esc(K.sub||"")}</span></span>`}</h2>${K.admin?`<button type="button" class="cs-adm" id="csAdm" aria-label="Réglages de la rotation" hidden>⚙</button>`:""}<button type="button" class="cs-x" aria-label="${K.parent?"Retour à la salle de jeux":"Fermer"}">${K.parent?"‹":"✕"}</button></div>
    <div class="cs-list"></div>${K.admin?`<div class="cs-panel" id="csPanel" hidden role="dialog" aria-label="Rotation des jeux"><div class="cs-pbox" id="csPbox"></div></div>`:""}<p class="cs-note">${esc(K.note)}</p>`;
  document.body.appendChild(hub);
  hub.querySelector(".cs-x").addEventListener("click",closeHub);
  if(K.admin)hub.querySelector("#csAdm").addEventListener("click",()=>panel(true));
  hub.addEventListener("keydown",e=>{if(e.key!=="Escape"||gameOpen())return;const p=K.admin&&hub.querySelector("#csPanel");if(p&&!p.hidden)panel(false);else closeHub();});
}
const when=g=>g.pre+dur(g.until-Date.now());
const card=(g,off)=>`<button type="button" class="cs-card${g.hot&&!off?" hot":""}${off?" off":""}" data-id="${g.id}"><span class="cs-ic">${g.icon}</span>
    <span class="cs-tx"><b>${esc(g.name)}</b><span>${esc(off?"Hors rotation cette semaine (visible par toi seul)":g.line||"…")}</span>${g.until&&!off?`<span class="cs-when">${CLOCK}<i>${esc(when(g))}</i></span>`:""}</span><span class="cs-go" aria-hidden="true">›</span><i class="cs-dot"></i></button>`;
const room=g=>`<button type="button" class="cs-room${g.n?" hot":""}" data-id="${g.id}" aria-label="${esc(g.name+(g.n?` : ${g.n} jeu${g.n>1?"x":""} t'attend${g.n>1?"ent":""}`:""))}">
    <img src="${g.logo}" alt=""><span class="cs-rl">${esc(g.line||"…")}</span><span class="cs-go" aria-hidden="true">›</span>${g.n?`<i class="cs-num">${g.n}</i>`:""}</button>`;
const weekSec=()=>`<div class="cs-sec">Jeux de la semaine<small>${CLOCK}<i class="cs-next">Changement dans ${esc(durLong(nextIn()))}</i></small></div>`;
function paint(){
  if(!hub)return;const list=hub.querySelector(".cs-list"),rot=rotOn();
  hub.classList.toggle("admin",!!ADMIN);
  if(K.admin)hub.querySelector("#csAdm").hidden=!ADMIN;
  let h="";
  if(K.main){
    // le jeu fixe en haut, puis les deux sous-menus
    h=GAMES.filter(g=>!g.room).map(g=>card(g)).join("");
    h+=rot?weekSec():`<div class="cs-sec">Les salles${CFG&&CFG.from?`<small>${CLOCK}<i>Rotation dès ${esc(new Date(CFG.from).toLocaleDateString("fr-FR",{weekday:"long"}))}</i></small>`:""}</div>`;
    h+=GAMES.filter(g=>g.room).map(room).join("");
  }else{
    // jeux fixes en haut, puis les jeux de la rotation (tous, quand la rotation est coupée)
    const fixed=GAMES.filter(g=>!inPool(g)),week=GAMES.filter(g=>inPool(g)&&featured(g)),out=rot&&ADMIN?GAMES.filter(g=>inPool(g)&&!featured(g)):[];
    h=fixed.map(g=>card(g)).join("");
    if(!rot)h+=week.map(g=>card(g)).join("");
    else if(week.length)h+=weekSec()+week.map(g=>card(g)).join("");
    if(out.length)h+=`<div class="cs-sec off">Hors rotation</div>`+out.map(g=>card(g,true)).join("");
  }
  // plus de 6 jeux affichés (rotation coupée) : la salle défile au lieu de tout tasser
  hub.classList.toggle("many",shown().length>6);
  list.innerHTML=h;
  list.querySelectorAll("[data-id]").forEach(c=>c.addEventListener("click",()=>launch(c.dataset.id)));
}
/* ---------- réglages admin de la rotation (salle de jeux) ---------- */
function panel(o){
  const p=hub.querySelector("#csPanel");p.hidden=!o;
  if(!o){hub.querySelector("#csAdm").focus({preventScroll:true});return;}
  const c=CFG||{enabled:false,slots:3,arena_slots:1,pool:[],arena_pool:[],featured:[]},nm=id=>K.nameOf(id),man=c.manual||[];
  const pool=c.pool||[],apool=c.arena_pool||[],fe=c.featured||[];
  const opts=(n,v)=>Array.from({length:Math.max(1,n)},(_,i)=>`<option${i+1===v?" selected":""}>${i+1}</option>`).join("");
  const pick=ids=>`<div class="cs-pick">${ids.map(id=>`<label><input type="checkbox" value="${esc(id)}"${man.includes(id)?" checked":""}> ${esc(nm(id))}</label>`).join("")}</div>`;
  hub.querySelector("#csPbox").innerHTML=`<h3>Jeux de la semaine</h3>
    <p>La Monkey Run et L'Expédition restent toujours là. Chaque lundi à 0 h : des jeux du Casino tirés au hasard (jamais les mêmes que la semaine d'avant) et un jeu de l'Arène, chacun son tour.</p>
    <label class="cs-row"><input type="checkbox" id="csOn"${c.enabled?" checked":""}> Rotation activée</label>${!c.enabled&&c.from?`<div class="cs-row" style="color:#8fe3a8">Tous les jeux sont ouverts ; la rotation démarre toute seule le ${esc(new Date(c.from).toLocaleString("fr-FR",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"}))}.</div>`:""}
    <label class="cs-row">Jeux du Casino par semaine<select id="csSlots">${opts(pool.length,c.slots)}</select></label>
    <label class="cs-row">Jeux de l'Arène par semaine<select id="csASlots">${opts(apool.length,c.arena_slots)}</select></label>
    <div class="cs-row">Cette semaine : ${c.enabled?esc(fe.map(nm).join(", ")||"aucun"):"tous (rotation coupée)"}</div>
    <div class="cs-row">Choisir les jeux de la semaine prochaine (sinon tirage automatique)</div>
    <div class="cs-row" style="margin:4px 0 0;color:#ffd23f">Casino</div>${pick(pool)}
    <div class="cs-row" style="margin:4px 0 0;color:#8fd3ff">Arène</div>${pick(apool)}
    <div class="cs-btns"><button type="button" class="cs-main" id="csSave">Enregistrer (lundi prochain)</button><button type="button" id="csNow">Appliquer tout de suite</button><button type="button" id="csPx">Fermer</button></div>
    <p class="cs-msg" id="csMsg" role="status"></p>`;
  const $p=q=>hub.querySelector(q);
  const send=async now=>{
    const sel=[...hub.querySelectorAll(".cs-pick input:checked")].map(i=>i.value);
    $p("#csMsg").textContent="…";
    try{CFG=await window.MF_RPC("mf_casino_admin",{p:{enabled:$p("#csOn").checked,slots:+$p("#csSlots").value,arena_slots:+$p("#csASlots").value,manual:sel.length?sel:null,now}});cfgAt=Date.now();stamp();
      $p("#csMsg").textContent=now?"C'est appliqué : les joueurs voient la nouvelle sélection à la prochaine ouverture de l'appli.":"Enregistré.";K.refreshAll();}
    catch(e){$p("#csMsg").textContent="Erreur : "+(e&&e.message||e);}
  };
  $p("#csSave").addEventListener("click",()=>send(false));
  $p("#csNow").addEventListener("click",()=>send(true));
  $p("#csPx").addEventListener("click",()=>panel(false));
  $p("#csOn").focus({preventScroll:true});
}
// le compte à rebours avance tout seul tant que la salle est ouverte
function tick(){if(!hub||hub.hidden)return;const nx=hub.querySelector(".cs-next");if(nx)nx.textContent="Changement dans "+durLong(nextIn());GAMES.forEach(g=>{const el=g.until&&hub.querySelector(`.cs-card[data-id="${g.id}"] .cs-when i`);if(el)el.textContent=when(g);});}
setInterval(tick,15000);
const gameOpen=()=>GAMES.some(g=>{const r=document.getElementById(g.root);return r&&!r.hidden;});
let opener=null,prevOverflow="";
function openHub(){
  if(!hub)build();paint();
  if(hub.hidden){hub.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";}
  hub.querySelector(".cs-x").focus({preventScroll:true});
  refresh();
}
function closeHub(){
  if(!hub||hub.hidden)return;hub.hidden=true;document.body.style.overflow=prevOverflow;clearInterval(watch);watch=null;
  if(opener&&opener.focus)opener.focus({preventScroll:true});
}
// le jeu (ou le sous-menu) s'ouvre par-dessus la salle ; quand on le ferme, on retombe dans la salle avec les états à jour
function launch(id){
  const g=GAMES.find(x=>x.id===id);if(!g)return;
  g.open();
  clearInterval(watch);let seen=false;
  watch=setInterval(()=>{const o=gameOpen();if(o)seen=true;else if(seen||!hub||hub.hidden){clearInterval(watch);watch=null;refresh();}},700);
}

/* ---------- états ---------- */
async function one(g){
  try{const s=await g.status();if(s){g.line=s.line;g.hot=!!s.hot;g.n=s.n||0;g.until=s.in!=null?Date.now()+s.in:0;g.pre=s.pre||"";}}catch(e){}
}
let busy=null,at=0,again=false;
// un appel pendant un rafraîchissement en relance un juste après (pour ne pas garder un état dépassé)
function refresh(){
  if(busy){again=true;return busy;}
  busy=Promise.all([loadCfg(),...GAMES.map(one)]).then(()=>{busy=null;at=Date.now();badge();paint();if(K.onRefresh)K.onRefresh();if(again){again=false;return refresh();}});
  return busy;
}
const fresh=ms=>busy||(Date.now()-at<ms?Promise.resolve():refresh());

/* ---------- inscription d'un jeu ---------- */
async function add(g){
  if(GAMES.some(x=>x.id===g.id))return;
  GAMES.push(g);GAMES.sort((a,b)=>(a.order||0)-(b.order||0));
  await isAdmin();await loadCfg();
  ensureBtn();
  await one(g);badge();paint();
  if(K.onAdd)K.onAdd(g);
  if(K.onRefresh&&!busy){at=Date.now();K.onRefresh();}
  if(want===g.id){want=null;clearTimeout(wantT);openGame(g.id);}
}

// rafraîchit la pastille : au retour dans l'appli, et toutes les 10 min (à minuit, le ticket gratuit revient sans relancer)
if(K.btnId){
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&GAMES.length)refresh();});
  setInterval(()=>{if(GAMES.length&&(!hub||hub.hidden))refresh();},10*60*1000);
}
const names=()=>({week:shown().filter(inPool).map(g=>g.name),fixed:shown().filter(g=>!inPool(g)).map(g=>g.name)});
return {add,refresh,fresh,open:openHub,find:id=>GAMES.find(g=>g.id===id),hotCount,names,count:()=>shown().length,has:()=>GAMES.length>0,inPool,featured};
}

const nameOf=id=>{for(const h of [MAIN,CASINO,ARENA_HUB]){const g=h&&h.find(id);if(g)return g.name;}return NAMES[id]||id;};
const refreshAll=()=>Promise.all([CASINO.refresh(),ARENA_HUB.refresh()]);   // chaque sous-salle met ensuite à jour la salle de jeux

const MAIN=makeHub({name:"Salle de jeux",btnId:"gamesBtn",rootId:"mfGames",cls:"games",main:true,admin:true,nameOf,refreshAll:()=>refreshAll(),
  sub:"Monkey Family",note:"Nouveaux jeux chaque lundi : reviens voir ce qui a changé 🐒",
  // manette de jeu
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 5.4l-.9 4.3a2.4 2.4 0 0 1-4.2 1l-1.9-2.3h-3.8l-1.9 2.3a2.4 2.4 0 0 1-4.2-1l-.9-4.3A4.5 4.5 0 0 1 7.5 7z"/><path d="M8 10v3M6.5 11.5h3"/><circle cx="15.5" cy="10.6" r=".6" fill="currentColor"/><circle cx="17.2" cy="12.4" r=".6" fill="currentColor"/></svg>`});
const CASINO=makeHub({name:"Casino",rootId:"mfCasino",parent:true,pool:"pool",logo:"packs/casino-titre.webp",alt:"Monkey Family Casino",
  note:"N'oubliez jamais qu'à la fin, c'est toujours le Casino qui gagne 🎰",onAdd:()=>addRoom("casino"),onRefresh:()=>MAIN.refresh()});
const ARENA_HUB=makeHub({name:"L'Arène",rootId:"mfArena",parent:true,cls:"arena",pool:"arena_pool",logo:"packs/arene-titre.webp",alt:"L'Arène",
  note:"Le classement ne ment jamais 🏆",onAdd:()=>addRoom("arena"),onRefresh:()=>MAIN.refresh()});

// les deux sous-menus sont des cartes de la salle de jeux, ajoutées dès qu'un de leurs jeux est inscrit
const ROOMS={
  casino:{hub:CASINO,name:"Casino",order:100,root:"mfCasino",logo:"packs/casino-titre.webp"},
  arena:{hub:ARENA_HUB,name:"L'Arène",order:101,root:"mfArena",logo:"packs/arene-titre.webp"}};
function addRoom(k){
  const R=ROOMS[k];if(R.added)return;R.added=true;
  MAIN.add({id:"room-"+k,room:true,name:R.name,order:R.order,root:R.root,logo:R.logo,icon:"",open:R.hub.open,
    status:async()=>{await R.hub.fresh(5000);const {week,fixed}=R.hub.names(),all=fixed.concat(week);
      // « Cette semaine : Flying Monkey + L'Expédition » (jeux qui tournent d'abord, puis ceux toujours là)
      const line=rotOn()&&week.length?`Cette semaine : ${andList(week)}${fixed.length?" + "+andList(fixed):""}`:all.length<=4?andList(all):`${all.length} jeux ouverts`;
      return {line,hot:R.hub.hotCount()>0,n:R.hub.hotCount()};}});
}

const hubOf=id=>MAIN_IDS.includes(id)?MAIN:ARENA.includes(id)?ARENA_HUB:CASINO;
const add=g=>hubOf(g.id).add(g);
// ouvrir un jeu directement (notification de la Monkey Run, de L'Expédition…), sans passer par la salle
function openGame(id){
  const g=hubOf(id).find(id);
  if(!g){want=id;clearTimeout(wantT);wantT=setTimeout(()=>{want=null;},20000);return;}
  g.open();
}
// un jeu d'une sous-salle qui change d'état met aussi à jour la pastille du bouton
const refresh=()=>refreshAll();
window.MF_CASINO={add,refresh,openGame,open:()=>{MAIN.open();CASINO.open();}};
window.MF_ARENA={add:g=>ARENA_HUB.add(g),refresh,openGame,open:()=>{MAIN.open();ARENA_HUB.open();}};
window.MF_GAMES={open:MAIN.open,refresh};

// clic sur une notification de course : l'appli était fermée (#race) ou déjà ouverte (message du service worker)
if(location.hash==="#race"||location.hash==="#exp"){openGame(location.hash.slice(1));try{history.replaceState(null,"",location.pathname+location.search);}catch(e){}}
if(navigator.serviceWorker)navigator.serviceWorker.addEventListener("message",e=>{const d=e.data;if(d&&d.mf==="open"&&d.game)openGame(d.game);});
})();

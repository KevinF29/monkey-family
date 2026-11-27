/* Monkey Family — Crash Cocotier (jeu « crash »)
   Le joueur mise, le singe grimpe au cocotier et le multiplicateur monte (×1,2… ×2… ×5…). À tout moment il peut tomber.
   Encaisser avant la chute = mise × multiplicateur ; sinon la mise est perdue. Le singe qui atteint le sommet encaisse tout seul.
   Le serveur fait foi (mf_coco_*) : il tire le point de chute au départ et ne l'envoie qu'à la fin, il vérifie l'encaissement
   avec sa propre horloge et limite le nombre de parties par jour. Cette page ne fait qu'animer la grimpe et demander
   toutes les ~0,3 s si le singe est tombé.
   Visible par l'admin seulement tant que le jeu n'est pas « ouvert à tous » (réglages admin). */
(function(){
"use strict";

const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const ERR={no_bananas:"Pas assez de bananes.",coco_limit:"Plus de parties aujourd'hui : reviens demain !",coco_bad_amount:"Mise hors limites.",coco_closed:"Crash Cocotier n'est pas encore ouvert.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const fx=m=>"×"+(+m).toFixed(2).replace(".",",");
const pct=x=>(Math.round(x*1000)/10).toString().replace(".",",")+" %";
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,v);}catch(e){}}};

/* ---------- état ---------- */
let INFO=null,skew=0,ADMIN=false,USER=null,busy=false,force="",armed=false;
let bet=+store.get("mf-coco-bet",5)||5,sound=store.get("mf-coco-sound","1")!=="0",buzz=true;
let R=null;              // partie en cours : {id, bet, start}
let mode="idle";         // idle | wait (départ imminent) | climb | ghost (encaissé, le singe continue sans toi) | done
let cashing=false,cashM=null,crashM=null,raf=0,pollT=0,lastTick=0,result=null;
const now=()=>Date.now()+skew;
const speed=()=>INFO?+INFO.speed||.12:.12;
const cap=()=>INFO?+INFO.cap||25:25;
const multAt=ms=>Math.min(cap(),Math.floor(Math.exp(speed()*Math.max(0,ms)/1000)*100)/100);
const msAt=m=>Math.log(Math.max(1,m))/speed()*1000;
function applyState(st){if(!st)return;try{if(window.MF_APPLY)window.MF_APPLY(st);}catch(e){}}
function take(r){if(!r)return;INFO=r;if(r.now&&mode!=="climb"&&mode!=="ghost")skew=+r.now-Date.now();}
const bal=()=>INFO&&INFO.state?+INFO.state.bananas||0:null;

/* ---------- style ---------- */
const CSS=`
#mfCoco{position:fixed;inset:0;z-index:9000;overflow:hidden;overscroll-behavior:none;display:flex;flex-direction:column;color:#fff4dc;font:16px/1.45 Quicksand,system-ui,sans-serif;background:#1b0f33;
 -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
#mfCoco[hidden]{display:none}
#mfCoco *{box-sizing:border-box;min-width:0}
#mfCoco button{font-family:inherit}
#mfCoco button:focus-visible,#mfCoco select:focus-visible,#mfCoco input:focus-visible{outline:3px solid #ffd23f;outline-offset:3px}
.co-top{flex:none;position:relative;z-index:6;display:flex;align-items:center;gap:8px;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 6px max(12px,env(safe-area-inset-left));background:linear-gradient(180deg,rgba(27,15,51,.95),rgba(27,15,51,.6))}
.co-top h2{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;margin:0}
.co-x,.co-gear,.co-snd{min-width:44px;min-height:44px;border-radius:12px;border:2px solid #6a3aa0;background:#2a1145;color:#ffd23f;font:400 20px "Titan One",sans-serif;cursor:pointer;display:grid;place-items:center;flex:none}
.co-snd{font:400 19px/1 system-ui,sans-serif}
.co-gear[aria-expanded=true]{background:#ffd23f;color:#2a1145}
.co-tag{font:700 12px Quicksand,sans-serif;background:#ffd23f;color:#2a1145;border-radius:99px;padding:3px 10px}
.co-pill{margin-left:auto;background:#2a1145;border-radius:12px;padding:6px 12px;font-weight:700;color:#ffd23f;white-space:nowrap;box-shadow:inset 0 0 0 2px #6a3aa0}
.co-pill b{font:400 20px "Titan One",sans-serif;color:#fff;margin-left:4px}
#mfCoco:not(.co-admin) .co-adm{display:none!important}
@media(max-width:420px){.co-tag{display:none}}

.co-scene{flex:1;min-height:0;position:relative;overflow:hidden;background:linear-gradient(180deg,#2b1257,#7b2d74 45%,#f0705a 75%,#ffb26b)}
.co-scene svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;display:block}
.co-mult{position:absolute;left:0;right:0;top:4%;z-index:2;text-align:center;pointer-events:none}
.co-mult b{display:inline-block;font:400 clamp(46px,14vw,92px)/1 "Titan One",sans-serif;color:#fff;text-shadow:0 5px 0 rgba(60,20,60,.8),0 0 26px rgba(255,200,80,.55);font-variant-numeric:tabular-nums;transition:color .2s}
.co-mult b.hot{color:#ffd23f}.co-mult b.fire{color:#ff9a3d}
.co-mult b.cash{color:#8dff7a;text-shadow:0 5px 0 #1d5a17,0 0 26px rgba(120,255,90,.6)}
.co-mult b.dead{color:#ff6b5e;text-shadow:0 5px 0 #6a1410,0 0 26px rgba(255,80,60,.5);animation:coShake .45s}
.co-mult b.wait{color:#ffe7a8;font-size:clamp(34px,10vw,60px)}
.co-mult small{display:block;margin-top:6px;font:700 clamp(14px,3.8vw,17px)/1.25 Quicksand,sans-serif;color:#fff3cf;text-shadow:0 2px 4px rgba(0,0,0,.6);min-height:1.25em}
@keyframes coShake{20%{transform:translateX(-8px) rotate(-3deg)}40%{transform:translateX(7px) rotate(2deg)}60%{transform:translateX(-5px)}80%{transform:translateX(3px)}}
.co-bg{position:absolute;inset:0;background:url(packs/coco-fond.webp) center 62%/cover no-repeat}
.co-logo{position:absolute;left:50%;top:2%;z-index:2;width:min(88%,440px);height:auto;transform:translateX(-50%);pointer-events:none;filter:drop-shadow(0 8px 12px rgba(0,0,0,.45));transition:opacity .25s,transform .25s}
#mfCoco:not(.co-idle) .co-logo{opacity:0;transform:translateX(-50%) scale(.9)}
.co-idle .co-mult{visibility:hidden}
.co-idle .co-marks{opacity:0}
.co-marks{transition:opacity .25s}
.co-mklt{transform-box:fill-box;transform-origin:50% 50%}
.co-climb #coMkIn{animation:coBob .3s ease-in-out infinite alternate}
@keyframes coBob{from{transform:translateY(0) rotate(-3deg) scaleY(.97)}to{transform:translateY(-9px) rotate(3deg) scaleY(1.03)}}
.co-ghost #coMk{opacity:.5}
.co-marks text{paint-order:stroke;stroke:#2a1145;stroke-width:7px;stroke-linejoin:round}
.co-flag{opacity:0;transition:opacity .25s}.co-flag.on{opacity:1}

.co-panel{flex:none;position:relative;z-index:3;display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px max(12px,env(safe-area-inset-right)) max(14px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));
 background:linear-gradient(180deg,#5b3a17,#3a240e);box-shadow:0 -4px 0 #2a1a08,0 -10px 24px rgba(0,0,0,.4)}
.co-panel>*{width:min(460px,100%)}
.co-res{min-height:44px;border-radius:12px;padding:8px 12px;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;text-align:center;color:#2a1145;background:#f3e6c4;box-shadow:inset 0 0 0 2px #c9a66a}
.co-res.good{background:#d7f5b0;box-shadow:inset 0 0 0 2px #7cbf3c}
.co-res.bad{background:#ffd6d6;box-shadow:inset 0 0 0 2px #e07a7a}
.co-res.jack{background:linear-gradient(90deg,#ffd23f,#ffb300);font:400 18px "Titan One",sans-serif}
.co-bet{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:space-between}
.co-bet>span{font-weight:700;color:#ffe7a8}
.co-step{display:flex;align-items:center;gap:4px;background:#2a1a08;border-radius:12px;padding:3px}
.co-step button{width:44px;height:44px;border-radius:10px;border:0;background:#5b3a17;color:#ffd23f;font:400 22px "Titan One",sans-serif;cursor:pointer}
.co-step output{min-width:52px;text-align:center;font:400 22px "Titan One",sans-serif;color:#fff}
.co-quick{display:flex;gap:6px}
.co-quick button{min-height:44px;min-width:48px;border-radius:10px;border:2px solid #7a5222;background:#2a1a08;color:#fff3cf;font:700 14px Quicksand,sans-serif;cursor:pointer}
.co-bet button:disabled{opacity:.45;cursor:not-allowed}
.co-go{min-height:64px;border:0;border-radius:18px;cursor:pointer;color:#4a2a10;font:400 22px/1.05 "Titan One",sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 12px;
 background:linear-gradient(180deg,#ffe066,#f5b700);box-shadow:0 6px 0 #a86c00,0 10px 16px rgba(0,0,0,.35);touch-action:manipulation}
.co-go small{font:700 12.5px/1.1 Quicksand,sans-serif;opacity:.85}
.co-go.cash{background:linear-gradient(180deg,#9dff7a,#3fbf3a);color:#0f3a0c;box-shadow:0 6px 0 #1f6b1b,0 0 0 3px rgba(157,255,122,.35),0 10px 18px rgba(0,0,0,.35);font-size:24px;animation:coPulse .6s ease-in-out infinite alternate}
@keyframes coPulse{to{box-shadow:0 6px 0 #1f6b1b,0 0 26px rgba(157,255,122,.9),0 10px 18px rgba(0,0,0,.35)}}
.co-go:active:not(:disabled){transform:translateY(4px);box-shadow:0 2px 0 #a86c00}
.co-go:disabled{background:#6b5a44;color:#d6c7ad;box-shadow:0 6px 0 #3e3020;cursor:not-allowed;animation:none}
.co-hist{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;min-height:28px;align-items:center}
.co-hist::-webkit-scrollbar{display:none}
.co-hist>span{font-size:12px;font-weight:700;color:#d9c39b;white-space:nowrap}
.co-hist i{flex:none;font:400 13px/1 "Titan One",sans-serif;font-style:normal;padding:6px 9px;border-radius:99px;background:#2a1a08;color:#ff8f7f;box-shadow:inset 0 0 0 2px #6a2a20}
.co-hist i.mid{color:#ffd23f;box-shadow:inset 0 0 0 2px #7a5a10}.co-hist i.hi{color:#9dff7a;box-shadow:inset 0 0 0 2px #2f6b1f}
.co-hist i.me{background:#1d3a12}

.co-side{position:absolute;top:0;left:0;bottom:0;z-index:7;width:min(380px,100%);overflow-y:auto;overscroll-behavior:contain;background:#1c0b33;border-right:2px solid #6a3aa0;padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px;box-shadow:20px 0 40px rgba(0,0,0,.5)}
.co-side:not(.open){display:none}
.co-side>*{flex-shrink:0}
.co-sidehead{display:flex;align-items:center;justify-content:space-between;gap:8px}
.co-side h3{margin:0;font:400 20px "Titan One",sans-serif;color:#ffd23f}
.co-note{margin:0;font-size:13px;color:#d9c6f2}
.co-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.co-sbtn{min-height:44px;border-radius:10px;border:2px solid #6a3aa0;background:#2a1145;color:#fff4dc;font:700 14px Quicksand,sans-serif;padding:8px 12px;cursor:pointer}
.co-sbtn.warn{border-color:#ff9a3d;color:#ffd23f}
.co-chk{display:flex;gap:8px;align-items:center;font-weight:700;font-size:14px;min-height:44px;flex-wrap:wrap}.co-chk input{width:20px;height:20px}
.co-chk select{min-height:44px;border-radius:10px;border:2px solid #6a3aa0;background:#2a1145;color:#fff4dc;font:700 14px Quicksand,sans-serif;padding:0 8px}
.co-odds{margin:0;padding:0;list-style:none;font-size:13px;color:#d9c6f2}
.co-odds li{display:flex;justify-content:space-between;padding:3px 0;border-top:1px solid #3a1d5e}.co-odds li:first-child{border-top:0}

.co-jp{position:fixed;inset:0;z-index:9100;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 45%,rgba(30,120,40,.8),rgba(20,7,42,.95) 70%);cursor:pointer}
.co-jp[hidden]{display:none}
.co-rays{position:absolute;left:50%;top:45%;width:220vmax;height:220vmax;margin:-110vmax 0 0 -110vmax;background:repeating-conic-gradient(rgba(157,255,122,.28) 0 9deg,transparent 9deg 18deg);-webkit-mask:radial-gradient(circle,#000 0,transparent 45%);mask:radial-gradient(circle,#000 0,transparent 45%);animation:coTurn 14s linear infinite}
@keyframes coTurn{to{transform:rotate(360deg)}}
.co-jpin{position:relative;z-index:2;text-align:center;padding:16px}
.co-jpe{display:block;margin:0 auto;height:min(42svh,360px);width:auto;filter:drop-shadow(0 0 30px rgba(255,220,90,.7));animation:coPop .9s cubic-bezier(.2,1.7,.4,1) both}
.co-jpt{font:400 clamp(48px,12vw,110px)/1 "Titan One",sans-serif;color:#ffd23f;margin-top:6px;text-shadow:0 7px 0 #8a4b00,5px 0 0 #8a4b00,-5px 0 0 #8a4b00,0 0 40px #ffb300;animation:coPop .8s .25s cubic-bezier(.2,1.7,.4,1) both}
.co-jps{font:700 clamp(18px,3vw,24px) Quicksand,sans-serif;color:#fff3cf;margin:10px 0 20px;animation:coPop .6s .6s both}
.co-jp .co-go{display:inline-flex;min-height:52px;padding:0 26px}
.co-pt{position:absolute;left:50%;top:45%;font-size:40px;line-height:1;pointer-events:none;z-index:1}
@keyframes coPop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
@media(max-height:620px){.co-go{min-height:54px;font-size:19px}.co-res{min-height:38px;font-size:14px}.co-panel{gap:7px}}
@media(prefers-reduced-motion:reduce){.co-climb #coMkIn,.co-go.cash,.co-rays,.co-jpe,.co-jpt,.co-mult b.dead{animation:none}}
`;

/* ---------- le décor : images de Kévin (plage, cocotier, singe), le tronc relevé sur l'image du cocotier ---------- */
const IMG={fond:"packs/coco-fond.webp",arbre:"packs/coco-arbre.webp",singe:"packs/coco-singe.webp",chute:"packs/coco-chute.webp",sonne:"packs/coco-sonne.webp",sommet:"packs/coco-sommet.webp",titre:"packs/coco-titre.webp"};
const TW=666,TH=1100;                                     // taille de l'image du cocotier (unités du dessin)
// milieu du tronc, du bas (où le singe démarre) jusque sous les noix de coco : [y, x, demi-largeur]
const TRUNK=[[915,277,40],[900,271,38],[860,258,35],[820,249,33],[780,242,30],[740,240,28],[700,241,26],[660,247,25],[620,255,23],[580,265,21],[540,277,21],[500,290,19],[460,303,17],[425,316,16]];
const TRUNK_D="M"+TRUNK.map(t=>t[1]+" "+t[0]).join(" L");
const GROUND=1062,BASEX=262;                              // le sable au pied de l'arbre
const MK={singe:{h:176,w:108,cx:98,ry:.21},chute:{h:175,w:169},sonne:{h:170,w:157}};
function hwAt(y){for(let i=1;i<TRUNK.length;i++){const a=TRUNK[i-1],b=TRUNK[i];if(y>=b[0]){const k=(a[0]-y)/(a[0]-b[0]);return a[2]+(b[2]-a[2])*k;}}return TRUNK[TRUNK.length-1][2];}
function sceneSVG(){
  return `<div class="co-bg"></div><img class="co-logo" src="${IMG.titre}" alt="" width="900" height="475">
  <svg viewBox="0 0 ${TW} ${TH}" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
  <image href="${IMG.arbre}" x="0" y="0" width="${TW}" height="${TH}"/>
  <g id="coMarks" class="co-marks"></g>
  <path id="coPath" d="${TRUNK_D}" fill="none" stroke="none"/>
  <g id="coFlag" class="co-flag"><g transform="scale(2.3)"><path d="M0 0v-26" stroke="#fff" stroke-width="2.5"/><path d="M0 -26h34v14H0z" fill="#3fbf3a" stroke="#0f3a0c" stroke-width="1"/><text id="coFlagT" x="17" y="-15.5" text-anchor="middle" font-family="Titan One,sans-serif" font-size="9.5" fill="#0f3a0c"></text></g></g>
  <g id="coMk"><g id="coMkIn" class="co-mklt"><image id="coMkImg" href="${IMG.singe}" width="${MK.singe.w}" height="${MK.singe.h}"/></g></g>
 </svg>`;
}

/* ---------- interface ---------- */
let root=null,path=null,plen=0;const $=s=>root.querySelector(s);
function build(){
  const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  root=document.createElement("div");root.id="mfCoco";if(ADMIN)root.classList.add("co-admin");root.hidden=true;
  root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Crash Cocotier");
  root.innerHTML=`<div class="co-top">
    <button type="button" class="co-gear co-adm" id="coTog" aria-controls="coSide" aria-expanded="false" aria-label="Réglages admin">⚙</button>
    <h2>Crash Cocotier</h2><span class="co-tag co-adm">Admin</span>
    <div class="co-pill">🍌<b id="coBal">…</b></div>
    <button type="button" class="co-snd" id="coSnd" aria-pressed="true" aria-label="Son">🔊</button>
    <button type="button" class="co-x" id="coClose" aria-label="Fermer">✕</button></div>
   <div class="co-scene" id="coScene">${sceneSVG()}
    <div class="co-mult"><b id="coM">×1,00</b><small id="coSub"></small></div></div>
   <div class="co-panel">
    <div class="co-res" id="coRes" role="status" aria-live="polite">…</div>
    <div class="co-bet" id="coBetRow"><span>Mise</span>
     <div class="co-step"><button type="button" id="coMinus" aria-label="Miser une banane de moins">−</button><output id="coBet" aria-live="polite">5</output><button type="button" id="coPlus" aria-label="Miser une banane de plus">+</button></div>
     <div class="co-quick"><button type="button" data-b="1">1</button><button type="button" data-b="5">5</button><button type="button" data-b="max">Max</button></div></div>
    <button type="button" class="co-go" id="coGo">Grimper<small id="coGoS">…</small></button>
    <div class="co-hist" id="coHist"></div>
   </div>
   <aside class="co-side co-adm" id="coSide" aria-label="Réglages admin">
    <div class="co-sidehead"><h3>Réglages admin</h3><button type="button" class="co-x" id="coSideX" aria-label="Fermer les réglages">✕</button></div>
    <p class="co-note">Ici tout est réel : tes vraies bananes sont misées et les gains arrivent sur ton compte. L'admin n'apparaît jamais dans le fil d'actu.</p>
    <label class="co-chk" for="coForce">Prochaine partie
     <select id="coForce"><option value="">Tirage normal</option><option value="1">Forcer : chute immédiate (×1,00)</option><option value="1.5">Forcer : chute à ×1,50</option><option value="2.4">Forcer : chute à ×2,40</option><option value="6">Forcer : chute à ×6,00</option><option value="12">Forcer : chute à ×12,00</option><option value="24">Forcer : chute à ×24,00</option><option value="999">Forcer : sommet</option></select></label>
    <div class="co-bar"><button type="button" class="co-sbtn" id="coAdd">+50 🍌</button><button type="button" class="co-sbtn" id="coReset">Rendre mes parties du jour</button></div>
    <div class="co-bar"><label class="co-chk"><input type="checkbox" id="coVib" checked> Vibrations</label></div>
    <h3>Joueurs</h3>
    <p class="co-note" id="coOpenNote"></p>
    <div class="co-bar"><button type="button" class="co-sbtn warn" id="coOpen"></button></div>
    <h3>Chances</h3>
    <ul class="co-odds" id="coOdds"></ul>
    <p class="co-note" id="coOddsNote"></p>
   </aside>
   <div class="co-jp" id="coJp" hidden><div class="co-rays"></div><div class="co-jpin"><img class="co-jpe" src="${IMG.sommet}" alt=""><div class="co-jpt">SOMMET !</div><div class="co-jps" id="coJpS"></div><button type="button" class="co-go" id="coJpOk">Récupérer</button></div></div>`;
  document.body.appendChild(root);
  path=$("#coPath");plen=path.getTotalLength();
  $("#coClose").addEventListener("click",close);
  $("#coTog").addEventListener("click",()=>side(!$("#coSide").classList.contains("open")));
  $("#coSideX").addEventListener("click",()=>{side(false);$("#coTog").focus({preventScroll:true});});
  $("#coSnd").addEventListener("click",()=>{sound=!sound;store.set("mf-coco-sound",sound?"1":"0");paintSnd();});
  $("#coGo").addEventListener("click",go);
  $("#coMinus").addEventListener("click",()=>setBet(bet-1));
  $("#coPlus").addEventListener("click",()=>setBet(bet+1));
  root.querySelectorAll(".co-quick button").forEach(b=>b.addEventListener("click",()=>setBet(b.dataset.b==="max"?maxBet():+b.dataset.b)));
  $("#coForce").addEventListener("change",e=>{force=e.target.value;});
  $("#coVib").addEventListener("change",e=>{buzz=e.target.checked;});
  $("#coAdd").addEventListener("click",async e=>{e.target.disabled=true;try{const st=await rpc("mf_admin_bananas",{p_n:50});if(INFO)INFO.state=st;applyState(st);say("+50 bananes sur ton compte.");}catch(x){say(errText(x),"bad");}e.target.disabled=false;render();});
  if(window.MF_MYSTERY)$("#coReset").parentNode.appendChild(window.MF_MYSTERY.adminButton("coco"));
  $("#coReset").addEventListener("click",async e=>{e.target.disabled=true;try{take(await rpc("mf_coco_admin",{p_action:"reset"}));say("Tes parties du jour sont rendues.");}catch(x){say(errText(x),"bad");}e.target.disabled=false;render();});
  $("#coOpen").addEventListener("click",openToAll);
  $("#coJp").addEventListener("click",closeJp);
  document.addEventListener("keydown",e=>{
    if(!root||root.hidden)return;
    if(e.key==="Escape"){if(!$("#coJp").hidden)closeJp();else if($("#coSide").classList.contains("open"))side(false);else close();return;}
    // barre d'espace : grimper / encaisser (pratique sur ordinateur)
    if((e.key===" "||e.code==="Space")&&!e.repeat&&!$("#coSide").classList.contains("open")&&!/^(INPUT|SELECT|BUTTON)$/.test(document.activeElement&&document.activeElement.tagName||"")){e.preventDefault();go();}
  });
  marks();place(1);paintSnd();
}
function side(o){$("#coSide").classList.toggle("open",o);$("#coTog").setAttribute("aria-expanded",String(o));if(o)render();}
function say(t,cls){const r=$("#coRes");r.className="co-res"+(cls?" "+cls:"");r.textContent=t;}
function paintSnd(){const b=$("#coSnd");b.textContent=sound?"🔊":"🔇";b.setAttribute("aria-pressed",String(sound));b.setAttribute("aria-label",sound?"Couper le son":"Remettre le son");}
const maxBet=()=>{const mx=INFO?+INFO.max:10,b=bal();return Math.max(INFO?+INFO.min:1,Math.min(mx,b==null?mx:b));};
function setBet(v){const mn=INFO?+INFO.min:1,mx=INFO?+INFO.max:10;bet=Math.max(mn,Math.min(mx,Math.round(v)||mn));store.set("mf-coco-bet",bet);render();}

/* hauteur sur le tronc : le singe grimpe à vitesse constante, ×1 en bas, le plafond tout en haut */
const frac=m=>Math.max(0,Math.min(1,Math.log(Math.max(1,m))/Math.log(cap())));
const pointAt=m=>path.getPointAtLength(plen*frac(m));
// le singe est à gauche du tronc, mains posées sur l'écorce
function sprite(k,x,y){const i=$("#coMkImg"),d=MK[k];i.setAttribute("href",IMG[k]);i.setAttribute("width",d.w);i.setAttribute("height",d.h);i.setAttribute("x",x.toFixed(1));i.setAttribute("y",y.toFixed(1));}
// repère du singe = hauteur de sa tête (c'est là que l'œil lit le palier) ; il penche avec le tronc pour garder les mains dessus
function lean(m){const L=plen*frac(m),a=path.getPointAtLength(Math.max(0,L-8)),b=path.getPointAtLength(Math.min(plen,L+8));return Math.atan2(b.x-a.x,-(b.y-a.y))*180/Math.PI;}
function place(m){const p=pointAt(m),hw=hwAt(p.y),d=MK.singe;
  $("#coMk").setAttribute("transform",`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${lean(m).toFixed(1)})`);
  if(mode!=="done")sprite("singe",-hw-d.cx,-d.h*d.ry);}
function marks(){
  const c=cap(),list=[1.5,2,3,5,10,c].filter((x,i,a)=>x<=c&&a.indexOf(x)===i&&(x===c||x<c*.8));
  $("#coMarks").innerHTML=list.map(m=>{const p=pointAt(m),top=m===c,x=p.x+hwAt(p.y)+10;
    return `<g transform="translate(${x.toFixed(1)} ${p.y.toFixed(1)})"><path d="M0 0h22" stroke="#fff3cf" stroke-width="5" stroke-linecap="round"/>
     <text x="30" y="11" font-family="Titan One,sans-serif" font-size="${top?34:32}" fill="${top?"#ffd23f":"#fff3cf"}">${top?"Sommet "+fx(m).replace(",00",""):fx(m).replace(",00","")}</text></g>`;}).join("");
}
function setM(m,cls,sub){const b=$("#coM");b.textContent=typeof m==="string"?m:fx(m);b.className=cls||(m>=10?"fire":m>=2?"hot":"");$("#coSub").textContent=sub||"";}

function render(){
  if(!root)return;
  root.classList.toggle("co-idle",mode==="idle");
  const b=bal();$("#coBal").textContent=b==null?"…":b;
  const playing=mode==="wait"||mode==="climb";
  const mn=INFO?+INFO.min:1,mx=INFO?+INFO.max:10;if(INFO&&(bet<mn||bet>mx))bet=Math.max(mn,Math.min(mx,bet));
  $("#coBet").textContent=bet;
  root.querySelectorAll("#coBetRow button").forEach(x=>x.disabled=playing||busy);
  $("#coMinus").disabled=playing||busy||bet<=mn;$("#coPlus").disabled=playing||busy||bet>=mx;
  const g=$("#coGo"),left=INFO?+INFO.left:0;
  g.classList.toggle("cash",mode==="climb"&&!cashing);
  if(mode==="climb"){g.firstChild.textContent=cashing?"Encaissement…":"Encaisser";g.disabled=cashing;}
  else if(mode==="wait"){g.firstChild.textContent="Le singe s'élance…";g.disabled=true;$("#coGoS").textContent=`mise ${R?R.bet:bet} 🍌`;}
  else{g.firstChild.textContent=`${mode==="idle"?"Grimper":"Rejouer"} · ${bet} 🍌`;
    g.disabled=!INFO||busy||left<1||(b!=null&&b<bet);
    $("#coGoS").textContent=!INFO?"…":left<1?"plus de parties aujourd'hui":b!=null&&b<bet?"pas assez de bananes":`encore ${left} partie${left>1?"s":""} aujourd'hui`;}
  if(ADMIN&&INFO){const o=!!INFO.open;
    $("#coOpenNote").textContent=o?"Crash Cocotier est ouvert : tous les joueurs le voient au Casino.":"Crash Cocotier est caché : toi seul le vois au Casino.";
    $("#coOpen").textContent=armed?(o?"Sûr ? Cacher le jeu":"Sûr ? Ouvrir à tous les joueurs"):(o?"Cacher aux joueurs":"Ouvrir à tous les joueurs");
    const rtp=+INFO.rtp,c=+INFO.cap;
    $("#coOdds").innerHTML=[["Tombe tout de suite (×1,00)",1-rtp],["Dépasse ×2",rtp/2],["Dépasse ×5",rtp/5],["Dépasse ×10",rtp/10],[`Atteint le sommet (${fx(c).replace(",00","")})`,rtp/c]].map(([a,p])=>`<li><span>${a}</span><b>${pct(p)}</b></li>`).join("");
    $("#coOddsNote").textContent=`Quelle que soit la façon de jouer, Crash Cocotier rend en moyenne ${pct(rtp)} des mises. Mise ${INFO.min} à ${INFO.max} 🍌, ${INFO.daily} parties par jour, gain maximum ${Math.floor(+INFO.max*c)} 🍌.`;}
}
function idleText(){if(!INFO)return "…";if(+INFO.left<1)return "C'est tout pour aujourd'hui : reviens demain !";return "Mise, puis encaisse avant que le singe tombe !";}
async function openToAll(){
  if(!armed){armed=true;render();setTimeout(()=>{armed=false;render();},4000);return;}
  armed=false;const b=$("#coOpen");b.disabled=true;
  try{take(await rpc("mf_coco_admin",{p_action:INFO&&INFO.open?"close":"open"}));say(INFO.open?"Crash Cocotier est ouvert à tous les joueurs !":"Crash Cocotier est de nouveau caché.");}catch(x){say(errText(x),"bad");}
  b.disabled=false;render();}

/* ---------- historique de tes dernières parties (sur ce téléphone) ---------- */
function hist(){try{return JSON.parse(store.get("mf-coco-hist","[]"))||[];}catch(e){return [];}}
function pushHist(c,cash){const h=hist();h.unshift({c,k:cash!=null});store.set("mf-coco-hist",JSON.stringify(h.slice(0,12)));paintHist();}
function paintHist(){const h=hist();$("#coHist").innerHTML=h.length?`<span>Tes chutes :</span>`+h.map(x=>`<i class="${x.c>=10?"hi":x.c>=2?"mid":""}${x.k?" me":""}" title="${x.k?"encaissé":"perdu"}">${fx(x.c).replace(",00","")}</i>`).join(""):`<span>Tes dernières chutes s'afficheront ici.</span>`;}

/* ---------- partie ---------- */
function go(){if(mode==="climb")cash();else if(mode!=="wait")start();}
async function start(){
  if(busy||!INFO)return;
  // rejouer sans attendre la chute du singe « fantôme » : sa chute est quand même notée dans l'historique
  if(mode==="ghost"){cancelAnimationFrame(raf);raf=0;pushHist(crashM,cashM);mode="done";root.classList.remove("co-climb");}
  busy=true;closeJp();audio();
  const f=force;force="";const fs=$("#coForce");if(fs)fs.value="";
  say("…");render();
  try{const r=await rpc("mf_coco_start",{p_bet:bet,p_force:f?+f:null});take(r);applyState(r.state);
    if(r.round){begin(r.round);
      if(r.mys&&window.MF_MYSTERY)window.MF_MYSTERY.show(r.mys,{ms:Math.max(1500,+r.round.start-now()-500)}).then(()=>{if(R&&mode==="wait")say("🔮 Il tiendra au moins jusqu'à ×5 !");});}
    else say(idleText());}
  catch(e){say(errText(e),"bad");}
  busy=false;render();
}
function begin(round){
  R=round;cashing=false;cashM=null;crashM=null;result=null;lastTick=0;
  resetMonkey();$("#coFlag").classList.remove("on");
  mode=now()<+R.start?"wait":"climb";
  say(`Mise : ${R.bet} 🍌. Encaisse avant la chute !`);
  root.classList.add("co-climb");
  cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);
  clearTimeout(pollT);pollT=setTimeout(poll,Math.max(250,+R.start-now()));
  render();
}
function frame(){
  raf=0;if(!R||!root||root.hidden&&mode!=="ghost")return;
  const t=now()-(+R.start);
  if(mode==="wait"){
    if(t<0){setM(Math.ceil(-t/500)>2?"Prêt…":"Partez !","wait");place(1);raf=requestAnimationFrame(frame);return;}
    mode="climb";render();tone("triangle",392,523,.14,.18);
  }
  if(mode==="climb"){
    const m=multAt(t);place(m);setM(m,null,"");
    if(!cashing){$("#coGoS").textContent=`+${Math.floor(R.bet*m)} 🍌`;}
    const step=Math.floor(m*10);if(step!==lastTick){lastTick=step;tick(m,step);}
    raf=requestAnimationFrame(frame);return;
  }
  if(mode==="ghost"){
    // tu as encaissé : le singe continue sans toi jusqu'à son vrai point de chute
    const m=Math.min(crashM,multAt(t));place(m);
    $("#coSub").textContent=`le singe continue sans toi… ${fx(m)}`;
    if(t>=msAt(crashM)){
      if(crashM>=cap()){pushHist(crashM,cashM);$("#coSub").textContent=`il serait allé jusqu'au sommet 🙈`;mode="done";root.classList.remove("co-climb");finishText();render();}
      else fall(crashM,true);
      return;}
    raf=requestAnimationFrame(frame);return;
  }
}
async function poll(){
  pollT=0;if(!R||(mode!=="wait"&&mode!=="climb")||cashing)return;
  try{const r=await rpc("mf_coco_poll");
    if(r&&r.run===false&&mode==="climb"||r&&r.run===false&&mode==="wait"){end(r.last,r.state);return;}}
  catch(e){}
  if(mode==="climb"||mode==="wait")pollT=setTimeout(poll,300);
}
/* fin annoncée par le serveur pendant la grimpe : chute, ou arrivée au sommet */
function end(l,state){
  if(state){if(INFO)INFO.state=state;applyState(state);}
  INFO&&(INFO.round=null);
  if(!l||!R||+l.id!==+R.id){mode="done";root.classList.remove("co-climb");render();return;}
  if(l.cash!=null)won(l);else fall(+l.crash,false);
}
async function cash(){
  if(mode!=="climb"||cashing||!R)return;
  const m=multAt(now()-(+R.start));
  cashing=true;clearTimeout(pollT);render();
  try{const r=await rpc("mf_coco_cash",{p_at:m});take(r);applyState(r.state);
    const l=r.last;
    if(r.round){cashing=false;pollT=setTimeout(poll,200);render();return;}    // pas encore parti : on continue
    if(l&&+l.id===+R.id){if(l.cash!=null)won(l);else fall(+l.crash,false,true);}
    else{mode="done";render();}}
  catch(e){cashing=false;say(errText(e),"bad");if(mode==="climb")pollT=setTimeout(poll,300);render();}
}
function won(l){
  cashing=false;cashM=+l.cash;crashM=+l.crash;result=l;
  const p=pointAt(cashM);$("#coFlag").setAttribute("transform",`translate(${(p.x+hwAt(p.y)+4).toFixed(1)} ${(p.y+10).toFixed(1)})`);$("#coFlagT").textContent=fx(cashM);$("#coFlag").classList.add("on");
  setM(cashM,"cash","");
  if(l.top){pushHist(crashM,cashM);mode="done";root.classList.remove("co-climb");place(cap());say(`SOMMET ! Le singe a décroché les noix de coco : +${l.gain} 🍌`,"jack");celebrate(l);render();return;}
  mode="ghost";root.classList.add("co-ghost");
  say(`Encaissé à ${fx(cashM)} : +${l.gain} 🍌`,"good");
  [784,988,1319].forEach((f,i)=>setTimeout(()=>tone("triangle",f,0,.16,.28),i*90));
  vib([30,40,60]);
  cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);
  render();
}
function finishText(){
  if(!result)return;const c=crashM,m=cashM;
  if(c>=cap())say(`Encaissé à ${fx(m)} (+${result.gain} 🍌)… et il serait allé jusqu'au sommet. Aïe.`,"good");
  else if(c>=m*4&&c>=5)say(`Encaissé à ${fx(m)} (+${result.gain} 🍌)… mais il est monté jusqu'à ${fx(c)} 😱`,"good");
  else say(`Bien vu ! Encaissé à ${fx(m)} (+${result.gain} 🍌), il est tombé à ${fx(c)}.`,"good");
}
/* la chute (ghost : le singe tombe tout seul, tu avais déjà encaissé ; late : ton clic est arrivé trop tard) */
function fall(c,ghost,late){
  cancelAnimationFrame(raf);raf=0;clearTimeout(pollT);cashing=false;crashM=c;
  mode="done";root.classList.remove("co-climb");
  place(c);
  if(ghost){pushHist(c,cashM);finishText();$("#coSub").textContent=`il est tombé à ${fx(c)}`;}
  else{setM(c,"dead",c<=1?"il a glissé tout de suite !":"le singe est tombé !");pushHist(c,null);
    say(late?`Trop tard ! Le singe est tombé à ${fx(c)}. Perdu : −${R.bet} 🍌`:c<=1?`Le singe a glissé dès le départ… Perdu : −${R.bet} 🍌`:`Le singe est tombé à ${fx(c)}. Perdu : −${R.bet} 🍌`,"bad");
    vib([80,40,120]);}
  // le singe lâche le tronc (image de chute), tombe jusqu'au sable, puis reste assis, sonné, au pied de l'arbre
  const p=pointAt(c),inner=$("#coMkIn"),hw=hwAt(p.y),drop=Math.max(0,GROUND-MK.chute.h*.5-p.y);
  $("#coMk").setAttribute("transform",`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  sprite("chute",-hw-MK.chute.w+24,-MK.chute.h*.5);
  const land=()=>{thud();sonne();};
  if(!reduce&&inner.animate&&drop>20){
    inner.animate([{transform:"translate(0,0) rotate(0)"},{transform:`translate(-14px,${drop*.12}px) rotate(-14deg)`,offset:.25},{transform:`translate(-34px,${drop}px) rotate(-28deg)`}],{duration:Math.min(950,380+drop*.9),easing:"cubic-bezier(.5,0,1,.6)",fill:"forwards"})
      .onfinish=land;
    whistle(drop/1.6);
  }else setTimeout(land,reduce?0:250);
  render();
}
function sonne(){const inner=$("#coMkIn");inner.getAnimations&&inner.getAnimations().forEach(a=>a.cancel());
  $("#coMk").setAttribute("transform",`translate(${BASEX} ${GROUND})`);sprite("sonne",-MK.sonne.w+8,-MK.sonne.h+6);
  if(!reduce&&inner.animate)inner.animate([{transform:"scale(1.12,.86)"},{transform:"scale(.95,1.06)"},{transform:"scale(1)"}],{duration:380,easing:"ease-out"});}
function resetMonkey(){const inner=$("#coMkIn");inner.getAnimations&&inner.getAnimations().forEach(a=>a.cancel());
  root.classList.remove("co-ghost");const md=mode;mode="idle";place(1);mode=md;}
function vib(p){if(buzz&&navigator.vibrate)try{navigator.vibrate(p);}catch(e){}}

/* ---------- sons ---------- */
let ac=null;
function audio(){if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}}if(ac.state==="suspended")ac.resume().catch(()=>{});}
function tone(type,f0,f1,vol,len){if(!sound||!ac)return;try{const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+len*.8);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+len+.01);}catch(e){}}
// un petit « tic » tous les ×0,1, de plus en plus aigu : la tension monte avec le singe
function tick(m,step){tone("square",260+Math.log(m)*260,0,.025+Math.min(.03,Math.log(m)*.01),.05);if(m>=2&&step%10===0)vib(8);}
function whistle(drop){tone("sine",900,180,.12,Math.min(.9,.35+drop/700));}
function thud(){tone("sine",120,40,.35,.35);tone("triangle",80,50,.2,.25);vib(60);}

/* ---------- le sommet ---------- */
let jpT=[];
function celebrate(l){
  const box=$("#coJp");$("#coJpS").textContent=`${fx(l.cash)} · +${l.gain} 🍌`;box.hidden=false;$("#coJpOk").focus({preventScroll:true});
  [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>tone("triangle",f,0,.2,.35),i*130));vib([60,50,60,50,200]);
  if(reduce)return;
  const burst=n=>{for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,d=200+Math.random()*Math.max(innerWidth,innerHeight)*.6,x=Math.cos(a)*d,y=Math.sin(a)*d*.8,rot=(Math.random()-.5)*900;
    const s=document.createElement("span");s.className="co-pt";s.textContent=["🥥","🍌","🌴"][i%3];box.appendChild(s);
    s.animate([{transform:"translate(-50%,-50%) scale(.2)",opacity:1},{transform:`translate(${x*.85}px,${y*.85-140}px) rotate(${rot*.6}deg)`,opacity:1,offset:.45},{transform:`translate(${x}px,${y+420}px) rotate(${rot}deg)`,opacity:0}],{duration:1600+Math.random()*1400,easing:"cubic-bezier(.15,.7,.4,1)"}).onfinish=()=>s.remove();}};
  burst(36);jpT=[setTimeout(()=>burst(24),700)];
}
function closeJp(){if(!root)return;jpT.forEach(clearTimeout);jpT=[];const b=$("#coJp");b.hidden=true;b.querySelectorAll(".co-pt").forEach(x=>x.remove());}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
  if(!root)build();
  root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
  $("#coClose").focus({preventScroll:true});paintHist();render();
  if(mode==="climb"||mode==="wait"||mode==="ghost"){if(!raf)raf=requestAnimationFrame(frame);return;}
  say("…");
  try{const r=await rpc("mf_coco_status");take(r);marks();
    if(r.round){begin(r.round);}                 // partie lancée puis appli fermée : on reprend la grimpe
    else{if(mode!=="done"){say(idleText());setM(1,"","");}render();}}
  catch(e){say(errText(e),"bad");}
}
function close(){
  if((mode==="climb"||mode==="wait")&&!cashing){say(mode==="wait"?"Le singe s'élance : reste pour encaisser !":"Le singe grimpe encore : encaisse ou attends sa chute !");return;}   // on ne quitte pas en pleine grimpe
  closeJp();side(false);root.hidden=true;document.body.style.overflow=prevOverflow;
  if(mode==="done"||mode==="ghost"){mode="idle";R=null;cancelAnimationFrame(raf);raf=0;resetMonkey();$("#coFlag").classList.remove("on");setM(1,"","");say(idleText());}
  if(opener&&opener.focus)opener.focus();
}

/* ---------- démarrage : le Cocotier s'inscrit au Casino ---------- */
async function boot(){
  if(!window.claude||!window.claude.use)return;
  try{USER=await window.claude.use("user");}catch(e){}
  if(!USER||typeof window.MF_RPC!=="function")return;
  try{ADMIN=!!(await USER.isOwner());}catch(e){}
  let ok=ADMIN;if(!ok){try{ok=!!(await rpc("mf_coco_open"));}catch(e){}}
  if(!ok||!window.MF_CASINO)return;
  preload();
  window.MF_CASINO.add({id:"coco",name:"Crash Cocotier",order:4,root:"mfCoco",open,
    icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 21c.6-4 .4-8.2-1-12"/><path d="M11.5 9C9.6 6.6 6.6 6 3.6 7c2.4.4 4 1.5 5 3"/><path d="M11.5 9c1-3 4-4.6 7-4.1-2 1-3.4 2.2-4 3.6"/><path d="M11.5 9c3-.5 6 .8 8 3.6-2.6-.9-4.8-1-6.5-.4"/><path d="M11.5 9c-2.6.2-4.8 2-6 4.7 2-1.1 3.9-1.6 5.6-1.5"/><path d="M8 21h9"/></svg>`,
    status:async()=>{if(!(root&&!root.hidden))take(await rpc("mf_coco_status"));const I=INFO;if(!I)return null;
      if(I.round)return {line:"Ton singe est en train de grimper !",hot:true};
      if(+I.left>0)return {line:`Encore ${I.left} partie${+I.left>1?"s":""} aujourd'hui`,hot:false};
      return {line:"Plus de parties aujourd'hui",pre:"Nouvelles parties dans ",in:+I.nextDay-(Date.now()+skew),hot:false};}});
}
window.MF_COCO={open};
function preload(){Object.values(IMG).forEach(u=>{const i=new Image();i.src=u;});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

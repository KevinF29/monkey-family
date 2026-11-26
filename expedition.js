/* Monkey Family — L'Expédition (jeu de « greed » entre potes, façon Diamant)
   Chaque jour, une expédition commune dans la jungle : une carte révélée par heure, de 10 h à 22 h.
   Avant chaque étape, chaque joueur choisit en secret de continuer ou de rentrer au camp.
   Trésors partagés entre ceux qui sont dedans ; le 2e danger du même type fait perdre le butin à ceux qui restent.
   Tout se passe sur le serveur (mf_exp_*, supabase-expedition.sql) ; jeu fixe du Casino.
   Visuels provisoires (émojis et dégradés) en attendant ceux de Kévin : packs/exp-logo.webp est utilisé s'il existe.
   Visible par l'admin seulement tant que le jeu n'est pas ouvert (réglages admin → « Ouvrir à tous »). */
(function(){
"use strict";

const LOGO="packs/exp-logo.webp";
const DANGER=[{e:"🐍",n:"Serpent"},{e:"🕷️",n:"Araignée"},{e:"🏜️",n:"Sables mouvants"},{e:"🐆",n:"Panthère"},{e:"🪨",n:"Éboulement"}];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR={exp_closed:"L'Expédition n'est pas ouverte en ce moment.",exp_over:"Cette expédition est terminée.",exp_already:"Tu fais déjà partie de cette expédition.",
 exp_not_in:"Tu n'es plus dans l'expédition.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const dur=ms=>{ms=Math.max(0,ms);const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);return h?`${h} h ${String(m).padStart(2,"0")}`:`${Math.max(1,m)} min`;};
const hh=ms=>{const d=new Date(ms);return d.getMinutes()?`${d.getHours()} h ${String(d.getMinutes()).padStart(2,"0")}`:`${d.getHours()} h`;};
const AUTO=[0,10,15,20,30,50];

/* ---------- style (provisoire) ---------- */
const CSS=`
#mfEXP{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;touch-action:manipulation;color:#f6f0d8;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:#0d3322;background-image:radial-gradient(ellipse at 50% -10%,#3f8f52,transparent 60%),repeating-linear-gradient(115deg,rgba(0,0,0,.08) 0 18px,transparent 18px 40px),linear-gradient(180deg,#14482e,#0a2416)}
#mfEXP[hidden]{display:none}
#mfEXP *{box-sizing:border-box;min-width:0}
#mfEXP [hidden]{display:none!important}
#mfEXP,#mfEXP *{-webkit-tap-highlight-color:transparent}
#mfEXP button:focus-visible,#mfEXP select:focus-visible{outline:3px solid #8fd3ff;outline-offset:2px}
.ex-top{flex:none;position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:4px;padding:max(8px,env(safe-area-inset-top)) 58px 6px}
.ex-logo{display:block;height:clamp(44px,8svh,84px);width:auto;max-width:100%;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
.ex-logoT{margin:0;font:400 clamp(26px,7vw,36px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 #6b3f1d}
.ex-btn{position:absolute;top:max(8px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(10,30,18,.8);color:#ffd23f;font:700 19px Quicksand,sans-serif;cursor:pointer;display:grid;place-items:center}
.ex-btn.l{left:10px}.ex-btn.r{right:10px}
.ex-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px}
.ex-chip{background:#2a1a0c;border:1px solid #6b4520;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13.5px;white-space:nowrap}
.ex-chip b{color:#ffd23f}
.ex-main{flex:1;min-height:0;width:100%;max-width:560px;overflow-y:auto;overscroll-behavior:contain;padding:4px 12px max(16px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px}
.ex-box{background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:12px}
.ex-box h3{margin:0 0 8px;font:400 16px "Titan One",sans-serif;color:#ffd23f;display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.ex-box h3 small{font:700 12.5px Quicksand,sans-serif;color:#cfe0c8}
.ex-ban{text-align:center;font-weight:700}
.ex-ban .big{display:block;font:400 clamp(20px,5.5vw,26px)/1.2 "Titan One",sans-serif;color:#fff}
.ex-ban.bad .big{color:#ff8f7a}.ex-ban.good .big{color:#8fe3a8}
.ex-trail{display:flex;gap:6px;overflow-x:auto;padding:4px 2px 8px;scroll-snap-type:x proximity}
.ex-c{flex:none;width:58px;height:80px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;scroll-snap-align:end;
 background:linear-gradient(160deg,#f7e7bd,#e0c286);color:#3b2410;border:2px solid #8a5a2e;box-shadow:0 3px 0 rgba(0,0,0,.35);font:700 12px/1.1 Quicksand,sans-serif;position:relative}
.ex-c i{font-style:normal;font-size:26px;line-height:1}
.ex-c b{font:400 15px "Titan One",sans-serif}
.ex-c small{position:absolute;top:2px;left:5px;font-size:10px;opacity:.6}
.ex-c.d{background:linear-gradient(160deg,#5a2a2a,#2e1414);color:#ffd9cf;border-color:#a0482f}
.ex-c.fatal{background:linear-gradient(160deg,#c8102e,#6a0716);color:#fff;border-color:#ffd23f;box-shadow:0 0 0 3px rgba(255,80,60,.5)}
.ex-c.r{background:linear-gradient(160deg,#ffe36e,#d9a514);border-color:#fff3b0}
.ex-c.q{background:repeating-linear-gradient(135deg,#2f6a42 0 8px,#285c39 8px 16px);border:2px dashed #9fd3a8;color:#e3f5df}
.ex-c.q i{animation:exPulse 1.6s ease-in-out infinite}
.ex-c.off{background:rgba(255,255,255,.05);border:2px dashed rgba(255,255,255,.18);box-shadow:none;color:rgba(255,255,255,.3)}
.ex-c.new{animation:exFlip .6s cubic-bezier(.2,1.4,.4,1) both}
@keyframes exFlip{from{transform:rotateY(90deg) scale(.8);opacity:0}to{transform:none;opacity:1}}
@keyframes exPulse{50%{transform:scale(1.15)}}
.ex-path{display:flex;flex-wrap:wrap;gap:6px 14px;font-weight:700;font-size:14px;color:#ffe7a8}
.ex-dang{display:flex;justify-content:space-between;gap:4px;margin-top:8px}
.ex-dg{flex:1;text-align:center;border-radius:10px;padding:5px 2px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);font-size:11.5px;font-weight:700;color:#9fb59a}
.ex-dg i{display:block;font-style:normal;font-size:22px;filter:grayscale(1) opacity(.45)}
.ex-dg.on{background:rgba(200,16,46,.25);border-color:#ff8f7a;color:#ffd9cf}
.ex-dg.on i{filter:none}
.ex-me{display:flex;flex-direction:column;gap:10px;align-items:stretch;text-align:center}
.ex-loot{font:400 clamp(30px,8vw,42px)/1 "Titan One",sans-serif;color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.4)}
.ex-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ex-ch{min-height:64px;border-radius:16px;border:2px solid rgba(255,255,255,.25);background:rgba(10,30,18,.7);color:#f6f0d8;font:400 17px/1.1 "Titan One",sans-serif;cursor:pointer;padding:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
.ex-ch small{font:700 12px Quicksand,sans-serif;opacity:.85}
.ex-ch.on.go{background:#2e8a4a;border-color:#8fe3a8;box-shadow:0 0 0 3px rgba(143,227,168,.35)}
.ex-ch.on.home{background:#b86a1a;border-color:#ffd23f;box-shadow:0 0 0 3px rgba(255,210,63,.35)}
.ex-ch:disabled{opacity:.45;cursor:default}
.ex-big{min-height:56px;padding:8px 24px;border-radius:16px;border:0;background:#ffd23f;color:#3b2410;font:400 19px "Titan One",sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8901a}
.ex-big:active{transform:translateY(2px);box-shadow:0 2px 0 #b8901a}
.ex-big:disabled{background:#4a4030;color:#a09880;box-shadow:none;cursor:default}
.ex-sub{font-size:13.5px;font-weight:700;color:#d6e4cc}
.ex-auto{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;font-size:14px;font-weight:700}
.ex-auto select{min-height:44px;border-radius:10px;border:1px solid #3f6a4a;background:#1f4a30;color:#f6f0d8;font:700 14px Quicksand,sans-serif;padding:0 8px}
.ex-pl{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.ex-pl li{display:grid;grid-template-columns:1.6em minmax(0,1fr) auto;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:rgba(0,0,0,.3);font-size:14px}
.ex-pl li.me{background:rgba(255,210,63,.16);box-shadow:inset 0 0 0 2px #ffd23f}
.ex-pl .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.ex-pl .v{font-weight:700;white-space:nowrap;text-align:right;color:#ffe7a8}
.ex-pl .lost .v{color:#ff8f7a}
.ex-empty{color:#cfe0c8;font-size:14px}
.ex-ov{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(4,20,12,.78)}
.ex-card{width:min(380px,100%);background:#14301f;border:2px solid #ffd23f;border-radius:20px;padding:18px 16px;text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center;box-shadow:0 18px 40px rgba(0,0,0,.5);animation:exFlip .5s both}
.ex-card h3{margin:0;font:400 24px "Titan One",sans-serif;color:#ffd23f}
.ex-card .em{font-size:54px;line-height:1}
.ex-panel{position:absolute;top:0;left:0;bottom:0;z-index:30;width:min(400px,100%);overflow-y:auto;overscroll-behavior:contain;background:#14301f;border-right:1px solid #2f5a3a;
 padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s;visibility:hidden}
.ex-panel.open{transform:none;visibility:visible}
.ex-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.ex-panel h3{font:400 19px "Titan One",sans-serif;color:#ffd23f;margin:14px 0 6px}
.ex-ph h3{margin:0}
.ex-panel p,.ex-panel li{color:#d6e4cc;font-size:14px}
.ex-panel ul.r{margin:4px 0;padding-left:18px}
.ex-hist{list-style:none;margin:0;padding:0;font-size:14px}
.ex-hist li{padding:5px 0;border-bottom:1px solid #2a4a32}
.ex-hist:empty::after{content:"Aucune expédition pour l'instant.";color:#9fb59a}
.ex-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ex-btns button{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid #3f6a4a;background:#1f4a30;color:#f6f0d8;font:700 14px Quicksand,sans-serif;cursor:pointer}
.ex-btns button.on{background:#ffd23f;color:#3b2410;border-color:#ffd23f}
.ex-toast{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));z-index:40;transform:translate(-50%,12px);background:#1f4a30;border:1px solid #ffd23f;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;max-width:92%;transition:transform .3s,opacity .3s;pointer-events:none;opacity:0}
.ex-toast.on{transform:translate(-50%,0);opacity:1}
@media(prefers-reduced-motion:reduce){.ex-toast,.ex-panel{transition:none}.ex-c.new,.ex-card,.ex-c.q i{animation:none}.ex-big:active{transform:none}}
`;

/* ---------- état ---------- */
let root=null,USER=null,ADMIN=false,S=null,skew=0,busy=false,poll=0;
const $=s=>root.querySelector(s);
const nowS=()=>Date.now()+skew;
function take(info){if(!info)return;S=info;if(info.now)skew=+info.now-Date.now();try{if(info.state&&window.MF_APPLY)window.MF_APPLY(info.state);}catch(e){}}
const seenKey="mf-exp-shown";
const shownStep=()=>{try{const v=JSON.parse(localStorage.getItem(seenKey)||"{}");return v.day===S.day?+v.step||0:0;}catch(e){return 0;}};
const setShown=()=>{try{localStorage.setItem(seenKey,JSON.stringify({day:S.day,step:S.step}));}catch(e){}};
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};

/* ---------- morceaux d'écran ---------- */
function cardHTML(c,isNew){const cls=c.k==="t"?"":c.k==="r"?"r":c.fatal?"d fatal":"d";
 const body=c.k==="t"?`<i>🍌</i><b>${esc(c.v)}</b>`:c.k==="r"?`<i>🗿</i><b>Idole</b>`:`<i>${DANGER[c.d]?DANGER[c.d].e:"⚠️"}</i>${c.fatal?"<b>2e !</b>":""}`;
 const t=c.k==="t"?`Étape ${c.s} : trésor de ${c.v} bananes`:c.k==="r"?`Étape ${c.s} : Idole d'or`:`Étape ${c.s} : ${DANGER[c.d]?DANGER[c.d].n:"danger"}${c.fatal?", deuxième : fin de l'expédition":""}`;
 return `<div class="ex-c ${cls}${isNew?" new":""}" role="listitem" aria-label="${esc(t)}"><small>${esc(c.s)}</small>${body}</div>`;}
function trailHTML(){const cards=S.cards||[],n=+S.steps,old=shownStep();let h=cards.map(c=>cardHTML(c,+c.s>old)).join("");
 if(S.status==="run"&&cards.length<n)h+=`<div class="ex-c q" role="listitem" aria-label="Prochaine carte"><small>${cards.length+1}</small><i>❓</i><span>${S.nextAt?esc(hh(+S.nextAt)):""}</span></div>`;
 for(let i=cards.length+(S.status==="run"?2:1);i<=n;i++)h+=`<div class="ex-c off" role="listitem" aria-label="Étape ${i}"><small>${i}</small><i>·</i></div>`;
 return h;}
function bannerHTML(){const me=S.me,next=S.nextAt?+S.nextAt-nowS():0;
 if(S.status==="run"&&S.step===0)return `<div class="ex-ban"><span class="big">Départ à ${esc(hh(+S.startAt))}</span>dans ${esc(dur(+S.startAt-nowS()))} · une étape par heure jusqu'à ${esc(hh(+S.startAt+(+S.steps-1)*3600000))}</div>`;
 if(S.status==="run")return `<div class="ex-ban"><span class="big">Étape ${S.step+1} à ${esc(hh(+S.nextAt))}</span>dans ${esc(dur(next))}${me&&me.state==="in"?" · ton choix reste secret jusque-là":""}</div>`;
 const last=(S.cards||[])[S.cards.length-1]||{};
 if(S.status==="dead")return `<div class="ex-ban bad"><span class="big">${esc(DANGER[last.d]?DANGER[last.d].e+" "+DANGER[last.d].n:"Danger")} !</span>Le même danger est sorti deux fois : l'expédition s'est arrêtée à l'étape ${esc(last.s)}.</div>`;
 return `<div class="ex-ban good"><span class="big">Expédition terminée</span>Tous ceux qui restaient sont rentrés au camp à ${esc(hh(+S.startAt+(+S.steps-1)*3600000))}.</div>`;}
function dangersHTML(){const seen=S.seen||[];
 return `<div class="ex-dang">${DANGER.slice(0,+S.dangers||5).map((d,i)=>`<div class="ex-dg${seen.includes(i)?" on":""}" title="${esc(d.n)}"><i>${d.e}</i>${seen.includes(i)?"déjà sorti":"pas encore"}</div>`).join("")}</div>`;}
function meHTML(){const me=S.me,run=S.status==="run"&&S.step<+S.steps;
 if(!me){
  if(run)return `<p class="ex-sub">${S.step?`L'expédition a déjà passé ${S.step} carte${S.step>1?"s":""}. Tu peux encore la rejoindre : tu partageras les prochains trésors (et ce qui traîne sur le chemin quand tu rentreras).`:"Rejoins l'expédition avant le départ, c'est gratuit !"}</p>
   <button type="button" class="ex-big" id="exJoin"${busy?" disabled":""}>${busy?"…":"Rejoindre l'expédition"}</button>`;
  const nx=S.next||{};
  if(nx.joined)return `<p><b>Tu es inscrit pour l'expédition de demain</b> (départ ${esc(hh(+nx.startAt))}).</p>${autoHTML(nx.auto)}<p class="ex-sub">${+nx.n} explorateur${+nx.n>1?"s":""} inscrit${+nx.n>1?"s":""} pour l'instant.</p>`;
  return `<p class="ex-sub">Tu n'as pas participé à l'expédition d'aujourd'hui.</p><button type="button" class="ex-big" id="exJoin"${busy?" disabled":""}>${busy?"…":"Je pars demain"}</button>`;}
 if(me.state==="in"){const can=me.canLeave;
  return `<div class="ex-sub">Ton butin</div><div class="ex-loot">${esc(me.loot)} 🍌</div>
   ${S.status==="run"&&S.step<+S.steps?`<div class="ex-two" role="group" aria-label="Ton choix pour la prochaine étape">
    <button type="button" class="ex-ch go${me.choice==="go"?" on":""}" data-c="go" aria-pressed="${me.choice==="go"}"${busy?" disabled":""}>🧗 Continuer<small>je tente la suite</small></button>
    <button type="button" class="ex-ch home${me.choice==="home"?" on":""}" data-c="home" aria-pressed="${me.choice==="home"}"${busy||!can?" disabled":""}>🏕️ Rentrer<small>${can?"je garde mon butin":"après ta 1re carte"}</small></button></div>
   <p class="ex-sub">${!can?"Tu pourras rentrer au camp une fois que tu auras passé au moins une carte."
     :me.choice==="home"?`À ${esc(hh(+S.nextAt))}, tu rentres au camp avec ton butin et ta part de ce qui traîne sur le chemin.`
     :"Ton choix reste valable pour les étapes suivantes tant que tu ne le changes pas."}</p>${autoHTML(me.auto)}`:""}`;}
 if(me.state==="home")return `<div class="ex-sub">Rentré au camp${me.out?` après l'étape ${esc(me.out)}`:""}</div><div class="ex-loot">+${esc(me.gain)} 🍌</div>${+me.relic?`<p><b>🗿 Et l'Idole d'or : +${esc(+me.relic*(+S.relicBoost||1))} booster !</b></p>`:""}`;
 return `<div class="ex-sub">Butin perdu à l'étape ${esc(me.out)}…</div><div class="ex-loot" style="color:#ff8f7a">${esc(me.loot)} 🍌</div><p class="ex-sub">Consolation : +${esc(me.gain)} 🍌 (${esc(S.consol)} par carte passée).</p>`;}
function autoHTML(v){v=+v||0;const opts=AUTO.includes(v)?AUTO:AUTO.concat(v).sort((a,b)=>a-b);
 return `<label class="ex-auto">Rentrer tout seul dès que j'ai <select id="exAuto">${opts.map(x=>`<option value="${x}"${x===v?" selected":""}>${x?x+" 🍌":"non, je décide"}</option>`).join("")}</select></label>`;}
function playersHTML(){const L=S.players||[],me=S.me_uid;if(!L.length)return `<p class="ex-empty">Personne n'est encore parti. Sois le premier !</p>`;
 return `<ul class="ex-pl">${L.map(p=>{const ic=p.state==="in"?"🧗":p.state==="home"?"🏕️":"💀",
  v=p.state==="in"?`${p.loot} 🍌 en poche`:p.state==="home"?`+${p.gain} 🍌${+p.relic?" 🗿":""} · étape ${p.out}`:`perdu ${p.loot} 🍌 · étape ${p.out}`;
  return `<li class="${p.uid===me?"me":""} ${p.state}"><span aria-hidden="true">${ic}</span><span class="nm">${esc(p.name)}${p.uid===me?" (toi)":""}</span><span class="v">${esc(v)}</span></li>`;}).join("")}</ul>`;}

function render(){if(!root||!S)return;const st=S.state;
 $("#exBan").textContent=st?st.bananas:"…";$("#exStep").textContent=`${S.step}/${S.steps}`;
 const inN=(S.players||[]).filter(p=>p.state==="in").length;
 $("#exMain").innerHTML=`<div class="ex-box">${bannerHTML()}</div>
  <div class="ex-box"><h3>Le chemin<small>${esc(S.step)}/${esc(S.steps)} cartes</small></h3><div class="ex-trail" role="list">${trailHTML()}</div>
   <div class="ex-path"><span>🍌 ${esc(S.path)} sur le chemin</span>${+S.relic?`<span>🗿 ${+S.relic>1?esc(S.relic)+" Idoles":"une Idole d'or"} sur le chemin</span>`:""}</div>${dangersHTML()}</div>
  <div class="ex-box ex-me">${meHTML()}</div>
  <div class="ex-box"><h3>Les explorateurs<small>${inN} dans la jungle</small></h3>${playersHTML()}</div>`;
 const tr=$(".ex-trail");if(tr){const k=tr.querySelector(".ex-c.q")||tr.querySelector(".ex-c:not(.off):last-of-type")||[...tr.querySelectorAll(".ex-c:not(.off)")].pop();if(k)tr.scrollLeft=Math.max(0,k.offsetLeft-tr.offsetLeft+k.offsetWidth+40-tr.clientWidth);}
 const j=$("#exJoin");if(j)j.addEventListener("click",join);
 root.querySelectorAll(".ex-ch").forEach(b=>b.addEventListener("click",()=>choose(b.dataset.c)));
 const a=$("#exAuto");if(a)a.addEventListener("change",()=>choose(null,+a.value));
 $("#exHist").innerHTML=(S.hist||[]).map(h=>`<li>${esc(fmtDay(h.day))} : ${h.state==="home"?`rentré après l'étape ${esc(h.out)}, +${esc(h.gain)} 🍌${+h.relic?" et l'Idole 🗿":""}`:`butin perdu à l'étape ${esc(h.out)} (consolation +${esc(h.gain)} 🍌)`}</li>`).join("");
 if(ADMIN){const o=$("#exOpen");o.textContent=S.open?"Cacher aux joueurs":"Ouvrir à tous les joueurs";o.classList.toggle("on",!S.open);
  $("#exState").textContent=S.open?"L'Expédition est ouverte à tous les joueurs (jeu fixe du Casino).":"L'Expédition est visible par toi seulement.";}
 // nouvelles cartes depuis la dernière visite : petite vibration
 if(S.step>shownStep()&&shownStep()>0)vib(30);
 setShown();
 if(S.last&&!$(".ex-ov"))showLast();}
const fmtDay=d=>{try{const [Y,M,D]=String(d).split("-").map(Number);return `${D}/${M}`;}catch(e){return d;}};
function showLast(){const L=S.last;if(!L)return;
 const o=document.createElement("div");o.className="ex-ov";o.setAttribute("role","dialog");o.setAttribute("aria-label","Résultat de l'expédition");
 const lost=L.state==="lost";
 o.innerHTML=`<div class="ex-card"><h3>Expédition du ${esc(fmtDay(L.day))}</h3><div class="em">${lost?(DANGER[L.danger]?DANGER[L.danger].e:"💀"):+L.relic?"🗿":"🏕️"}</div>
  <p>${lost?`Le 2e ${esc(DANGER[L.danger]?DANGER[L.danger].n.toLowerCase():"danger")} t'a surpris à l'étape ${esc(L.out)} : tu as perdu ton butin de <b>${esc(L.loot)} 🍌</b>.<br>Consolation : <b>+${esc(L.gain)} 🍌</b>.`
   :`Tu es rentré au camp après l'étape ${esc(L.out)} avec <b>+${esc(L.gain)} 🍌</b>${+L.relic?" et l'<b>Idole d'or</b> (+1 booster)":""} !`}</p>
  <button type="button" class="ex-big" id="exOk">Continuer</button></div>`;
 root.appendChild(o);const b=o.querySelector("#exOk");b.focus({preventScroll:true});
 b.addEventListener("click",()=>{o.remove();const d=L.day;S.last=null;rpc("mf_exp_seen",{p_day:d}).then(x=>{take(x);render();},()=>{});});}

/* ---------- actions ---------- */
async function refresh(){try{take(await rpc("mf_exp_status"));render();}catch(e){toast(errText(e));}schedule();}
function schedule(){clearTimeout(poll);if(!root||root.hidden)return;
 // toutes les 30 s, et juste après la prochaine étape (le serveur la révèle dans la minute)
 let w=30000;if(S&&S.nextAt){const t=+S.nextAt-nowS()+65000;if(t>0&&t<w)w=t;}poll=setTimeout(refresh,w);}
async function join(){if(busy)return;busy=true;render();
 try{take(await rpc("mf_exp_join"));toast(S.me?"Tu fais partie de l'expédition ! 🌴":"Inscrit pour l'expédition de demain !");}catch(e){toast(errText(e));}
 busy=false;render();}
async function choose(c,auto){if(busy)return;const me=S.me||(S.next&&S.next.joined?{choice:S.next.choice||"go"}:null);if(!me)return;
 busy=true;render();
 try{take(await rpc("mf_exp_choose",{p_choice:c||me.choice||"go",p_auto:auto==null?null:auto}));
  toast(c==="home"?`Tu rentreras au camp à ${hh(+S.nextAt)}.`:c==="go"?"Tu continues l'aventure !":auto?`Tu rentreras tout seul dès ${auto} 🍌.`:"Retour automatique coupé.");}
 catch(e){toast(errText(e));}
 busy=false;render();}
let tt=0;function toast(m){const e=$(".ex-toast");e.textContent=m;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500);}
function panel(o){$("#exPanel").classList.toggle("open",o);$("#exTog").setAttribute("aria-expanded",String(o));}
async function adm(a,m){try{take(await rpc("mf_exp_admin",{p_action:a}));render();if(m)toast(m);}catch(e){toast(errText(e));}}

/* ---------- construction ---------- */
function build(){
 const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
 root=document.createElement("div");root.id="mfEXP";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","L'Expédition");
 root.innerHTML=`<div class="ex-top"><button type="button" class="ex-btn l" id="exTog" aria-controls="exPanel" aria-expanded="false" aria-label="Règles">?</button>
  <h2 style="margin:0"><img class="ex-logo" src="${LOGO}" alt="L'Expédition"><span class="ex-logoT" hidden>L'Expédition</span></h2>
  <div class="ex-chips"><span class="ex-chip">🍌 <b id="exBan">…</b></span><span class="ex-chip">Étape <b id="exStep">…</b></span></div>
  <button type="button" class="ex-btn r" id="exClose" aria-label="Fermer">✕</button></div>
 <div class="ex-main" id="exMain" aria-live="polite"><div class="ex-box ex-ban">Chargement…</div></div>
 <aside class="ex-panel" id="exPanel" aria-label="Règles et réglages">
  <div class="ex-ph"><h3>Règles</h3><button type="button" class="ex-btn" style="position:static" id="exPanelX" aria-label="Fermer les règles">✕</button></div>
  <ul class="r">
   <li>Chaque jour, une <b>expédition commune</b> part dans la jungle. C'est <b>gratuit</b>.</li>
   <li>Une carte est révélée <b>toutes les heures, de 10 h à 22 h</b> (13 étapes) : un <b>trésor</b> 🍌, un <b>danger</b> ou l'<b>Idole d'or</b> 🗿.</li>
   <li>Avant chaque étape, tu choisis en secret : <b>continuer</b> ou <b>rentrer au camp</b>. Ton choix reste valable tant que tu ne le changes pas.</li>
   <li>Un trésor est <b>partagé</b> entre ceux qui sont dans la jungle. Ce qui ne se partage pas reste sur le chemin : ceux qui rentrent le ramassent.</li>
   <li><b>Rentrer seul</b> = tout ce qui traîne sur le chemin pour toi, Idole d'or comprise (<b>1 booster</b>).</li>
   <li>Un <b>1er danger</b> ne fait rien. Si le <b>même danger sort une 2e fois</b>, ceux qui sont encore dans la jungle perdent leur butin et l'expédition s'arrête. Consolation : 1 🍌 par carte passée.</li>
   <li>Tu ne perds jamais les bananes de ta réserve. Tu peux rejoindre une expédition déjà en route, mais il faut passer au moins une carte avant de pouvoir rentrer.</li>
   <li>Une notification à chaque étape tant que tu es dans la jungle (réglage « enchères » des notifications).</li>
  </ul>
  <h3>Mes dernières expéditions</h3><ul class="ex-hist" id="exHist"></ul>
  <div id="exAdm" hidden><h3>Réglages admin</h3><p id="exState"></p>
   <div class="ex-btns"><button type="button" id="exOpen"></button></div>
   <div class="ex-btns"><button type="button" id="exStepNow">Révéler la prochaine carte maintenant</button><button type="button" id="exReset">Nouvelle expédition du jour</button><button type="button" id="exAdd">+50 🍌</button></div>
   <p>« Nouvelle expédition » efface celle du jour (les bananes déjà gagnées restent) ; la 1re étape est alors à l'heure pile suivante.</p></div>
 </aside>
 <div class="ex-toast" role="status"></div>`;
 document.body.appendChild(root);
 $("#exAdm").hidden=!ADMIN;
 const lg=$(".ex-logo"),noLogo=()=>{lg.hidden=true;$(".ex-logoT").hidden=false;};lg.onerror=noLogo;if(lg.complete&&!lg.naturalWidth)noLogo();
 root.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if($(".ex-ov"))return;if($("#exPanel").classList.contains("open"))panel(false);else close();});
 $("#exClose").addEventListener("click",close);
 $("#exTog").addEventListener("click",()=>panel(!$("#exPanel").classList.contains("open")));
 $("#exPanelX").addEventListener("click",()=>{panel(false);$("#exTog").focus({preventScroll:true});});
 $("#exOpen").addEventListener("click",()=>adm(S&&S.open?"close":"open",S&&S.open?"L'Expédition est de nouveau cachée.":"L'Expédition est ouverte à tous."));
 $("#exStepNow").addEventListener("click",()=>adm("step","Carte révélée."));
 $("#exReset").addEventListener("click",()=>{if(window.confirm("Effacer l'expédition du jour et en créer une nouvelle ?"))adm("reset","Nouvelle expédition créée.");});
 $("#exAdd").addEventListener("click",()=>adm("bananas","+50 🍌 sur ton compte."));
 setInterval(()=>{if(root&&!root.hidden&&S&&!busy&&!$(".ex-ov"))render();},60000);
}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
 if(!root)build();if(!root.hidden)return;
 root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 if(S)render();$("#exClose").focus({preventScroll:true});
 await refresh();
}
function close(){panel(false);clearTimeout(poll);const o=$(".ex-ov");if(o)o.remove();root.hidden=true;document.body.style.overflow=prevOverflow;if(opener&&opener.focus)opener.focus();}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&root&&!root.hidden)refresh();});

/* ---------- démarrage : le jeu s'inscrit au Casino ---------- */
async function boot(){
 if(!window.claude||!window.claude.use)return;
 try{USER=await window.claude.use("user");}catch(e){}
 if(!USER||typeof window.MF_RPC!=="function")return;
 try{ADMIN=!!(await USER.isOwner());}catch(e){}
 let can=ADMIN;if(!can){try{can=!!(await rpc("mf_exp_open"));}catch(e){}}
 if(!can||!window.MF_CASINO)return;
 window.MF_CASINO.add({id:"exp",name:"L'Expédition",order:13,root:"mfEXP",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20h18"/><path d="M6 20l5-9 3 5 2-3 4 7"/><path d="M11 11V4l5 2-5 2"/></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){take(await rpc("mf_exp_status"));}const I=S;if(!I)return null;
   const run=I.status==="run"&&I.step<+I.steps,me=I.me,nIn=(I.players||[]).filter(p=>p.state==="in").length;
   const nx=I.nextAt?+I.nextAt-nowS():null,tomorrow=I.next?+I.next.startAt-nowS():null;
   if(I.last)return {line:"Résultat de l'expédition à voir !",hot:true};
   if(run&&!me)return {line:I.step?`En route · étape ${I.step}/${I.steps} · ${nIn} dans la jungle : rejoins-les !`:"Départ à 10 h : rejoins l'expédition, c'est gratuit !",pre:I.step?"Prochaine étape dans ":"Départ dans ",in:nx,hot:true};
   if(me&&me.state==="in"&&run)return {line:`Butin ${me.loot} 🍌 · tu ${me.choice==="home"?"rentres au camp":"continues"} à la prochaine étape`,pre:"Prochaine étape dans ",in:nx,hot:false};
   if(me&&me.state==="home")return {line:`Rentré au camp avec ${me.gain} 🍌${run?` · ${nIn} encore dans la jungle`:""}`,pre:run?"Prochaine étape dans ":"Prochaine expédition dans ",in:run?nx:tomorrow,hot:false};
   if(me&&me.state==="lost")return {line:`Butin perdu à l'étape ${me.out}…`,pre:"Prochaine expédition dans ",in:tomorrow,hot:false};
   if(I.next&&I.next.joined)return {line:"Inscrit pour l'expédition de demain",pre:"Départ dans ",in:tomorrow,hot:false};
   return {line:"Expédition terminée · inscris-toi pour demain",pre:"Prochaine expédition dans ",in:tomorrow,hot:false};}});
}
window.MF_EXP={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

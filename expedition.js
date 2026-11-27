/* Monkey Family — L'Expédition (jeu de « greed » entre potes, façon Diamant)
   Chaque jour, une expédition commune dans la jungle, départ à 10 h. Après chaque carte, chaque joueur choisit en secret de continuer
   ou de rentrer au camp ; la carte suivante est révélée dès que tout le monde a choisi (au plus tard 1 h après la précédente).
   Trésors partagés entre ceux qui sont dedans ; le 2e danger du même type fait perdre le butin à ceux qui restent.
   Tout se passe sur le serveur (mf_exp_*, supabase-expedition.sql) ; jeu fixe du Casino.
   Visuels de Kévin (packs/exp-*.webp) ; le fond reste un dégradé.
   Visible par l'admin seulement tant que le jeu n'est pas ouvert (réglages admin → « Ouvrir à tous »). */
(function(){
"use strict";

const P="packs/exp-",LOGO=P+"logo.webp";
const IMG={singe:P+"singe.webp",camp:P+"camp.webp",perdu:P+"perdu.webp",dos:P+"dos.webp",tresor:P+"tresor.webp",idole:P+"idole.webp"};
const DANGER=[{e:"🐍",n:"Serpent",d2:"Un 2e serpent",i:P+"serpent.webp"},{e:"🕷️",n:"Araignée",d2:"Une 2e araignée",i:P+"araignee.webp"},{e:"🏜️",n:"Sables mouvants",s:"Sables",d2:"De nouveaux sables mouvants",i:P+"sables.webp"},{e:"🐆",n:"Panthère",d2:"Une 2e panthère",i:P+"panthere.webp"},{e:"🪨",n:"Éboulement",d2:"Un 2e éboulement",i:P+"eboulement.webp"}];
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
.ex-trail{gap:8px!important}
.ex-cw{flex:none;display:flex;flex-direction:column;align-items:center;gap:3px;scroll-snap-align:end}
.ex-h{font:700 11.5px/1 Quicksand,sans-serif;color:#cfe0c8;white-space:nowrap}
.ex-cw.nx .ex-h{color:#ffd23f}
.ex-c{width:92px;height:126px;position:relative;background:center/100% 100% no-repeat;filter:drop-shadow(0 3px 4px rgba(0,0,0,.5));color:#4a2a10}
.ex-c b{position:absolute;left:12%;right:12%;top:70%;bottom:9%;display:flex;align-items:center;justify-content:center;gap:2px;text-align:center;
 font:400 12.5px/1 "Titan One",sans-serif;letter-spacing:.2px;white-space:nowrap;overflow:hidden;color:#5a2a12;text-shadow:0 1px 0 rgba(255,240,200,.7)}
.ex-c b.n{top:72%;bottom:7%;font-size:22px;color:#6b3f00}
.ex-c b.n span{position:relative}
.ex-c b.n em{position:absolute;left:100%;top:50%;transform:translateY(-55%);font-style:normal;font-size:12px;margin-left:2px}
.ex-c b.i{flex-direction:column;gap:1px;font-size:12.5px;color:#6b4a00}
.ex-c b.i small{font:700 9.5px/1 Quicksand,sans-serif;color:#4a3410}
.ex-c b.d{color:#7a1a10}
.ex-c.fatal{filter:drop-shadow(0 0 7px #ff3b2f) drop-shadow(0 3px 4px rgba(0,0,0,.5))}
.ex-c .stamp{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%) rotate(-14deg);padding:3px 8px;border:3px solid #e3183d;border-radius:8px;background:rgba(255,240,220,.85);
 color:#c8102e;font:400 18px/1 "Titan One",sans-serif;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4)}
.ex-c.q{animation:exPulse 1.8s ease-in-out infinite}
.ex-c.q i{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;display:grid;place-items:center;background:rgba(30,15,5,.82);border:2px solid #ffd23f;font:400 26px/1 "Titan One",sans-serif;font-style:normal;color:#ffd23f;box-shadow:0 0 14px rgba(255,210,63,.5)}
.ex-cw.off{opacity:.35}
.ex-cw.off .ex-c{filter:grayscale(.7)}
.ex-c.new{animation:exFlip .6s cubic-bezier(.2,1.4,.4,1) both}
@keyframes exFlip{from{transform:rotateY(90deg) scale(.8);opacity:0}to{transform:none;opacity:1}}
@keyframes exPulse{50%{transform:translateY(-3px)}}
.ex-path{display:flex;flex-wrap:wrap;gap:6px 14px;font-weight:700;font-size:14px;color:#ffe7a8}
.ex-dang{display:flex;justify-content:space-between;gap:4px;margin-top:8px}
.ex-dg{flex:1;text-align:center;font-size:11px;font-weight:700;color:#9fb59a;line-height:1.15}
.ex-dg img{display:block;width:100%;max-width:56px;margin:0 auto 3px;aspect-ratio:300/410;object-fit:cover;object-position:top;border-radius:6px;filter:grayscale(1) brightness(.55)}
.ex-dg.on{color:#ffb4a5}
.ex-dg.on img{filter:drop-shadow(0 0 5px #ff3b2f)}
.ex-me{display:flex;flex-direction:column;gap:10px;align-items:stretch;text-align:center}
.ex-hero{display:block;margin:0 auto;height:clamp(90px,16svh,140px);width:auto;max-width:80%;filter:drop-shadow(0 6px 10px rgba(0,0,0,.45))}
.ex-loot{font:400 clamp(30px,8vw,42px)/1 "Titan One",sans-serif;color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.4)}
.ex-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ex-ch{min-height:64px;border-radius:16px;border:2px solid rgba(255,255,255,.25);background:rgba(10,30,18,.7);color:#f6f0d8;font:400 17px/1.1 "Titan One",sans-serif;cursor:pointer;padding:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
.ex-ch small{font:700 12px Quicksand,sans-serif;opacity:.85}
.ex-ch.on.go{background:#2e8a4a;border-color:#8fe3a8;box-shadow:0 0 0 3px rgba(143,227,168,.35)}
.ex-ch.on.home{background:#b86a1a;border-color:#ffd23f;box-shadow:0 0 0 3px rgba(255,210,63,.35)}
.ex-ch.last{border-style:dashed;border-color:rgba(255,210,63,.7)}
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
.ex-card img{height:150px;width:auto;max-width:90%}
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
@media(prefers-reduced-motion:reduce){.ex-toast,.ex-panel{transition:none}.ex-c.new,.ex-card,.ex-c.q{animation:none}.ex-big:active{transform:none}}
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
const stepAt=n=>{const c=(S.cards||[])[n-1];return c&&c.at?+c.at:n===(S.cards||[]).length+1&&S.nextAt?Math.max(+S.nextAt,nowS()):0;};
const lbl=n=>{const t=stepAt(n);if(!t)return `${n}`;return n===(S.cards||[]).length+1&&S.step>=1?`${n} · avant ${hh(t)}`:`${n} · ${hh(t)}`;};
function cardHTML(c,isNew){const D=DANGER[c.d]||{},img=c.k==="t"?IMG.tresor:c.k==="r"?IMG.idole:D.i;
 const lab=c.k==="t"?`<b class="n"><span>${esc(c.v)}<em>🍌</em></span></b>`:c.k==="r"?`<b class="i">Idole d'or<small>1 booster</small></b>`:`<b class="d">${esc(D.s||D.n||"Danger")}</b>`;
 const t=c.k==="t"?`Étape ${c.s} : trésor de ${c.v} bananes`:c.k==="r"?`Étape ${c.s} : Idole d'or`:`Étape ${c.s} : ${D.n||"danger"}${c.fatal?", deuxième : fin de l'expédition":""}`;
 return `<div class="ex-cw" role="listitem" aria-label="${esc(t)}"><div class="ex-c${c.fatal?" fatal":""}${isNew?" new":""}" style="background-image:url(${img})">${lab}${c.fatal?`<span class="stamp">2e !</span>`:""}</div><span class="ex-h">${esc(lbl(c.s))}</span></div>`;}
function trailHTML(){const cards=S.cards||[],n=+S.steps,old=shownStep();let h=cards.map(c=>cardHTML(c,+c.s>old)).join("");
 if(S.status==="run"&&cards.length<n)h+=`<div class="ex-cw nx" role="listitem" aria-label="Prochaine carte"><div class="ex-c q" style="background-image:url(${IMG.dos})"><i>?</i></div><span class="ex-h">${esc(lbl(cards.length+1))}</span></div>`;
 for(let i=cards.length+(S.status==="run"?2:1);i<=n;i++)h+=`<div class="ex-cw off" role="listitem" aria-label="Étape ${i}${S.status==="run"?"":" (non jouée)"}"><div class="ex-c" style="background-image:url(${IMG.dos})"></div><span class="ex-h">${i}</span></div>`;
 return h;}
function bannerHTML(){const me=S.me,next=S.nextAt?+S.nextAt-nowS():0;
 if(S.status==="run"&&S.step===0&&+S.startAt<=nowS())return `<div class="ex-ban"><span class="big">L'expédition attend ses explorateurs</span>Rejoins-la : la 1re carte est révélée dès que quelqu'un est parti.</div>`;
 if(S.status==="run"&&S.step===0)return `<div class="ex-ban"><span class="big">Départ à ${esc(hh(+S.startAt))}</span>dans ${esc(dur(+S.startAt-nowS()))} · ensuite, une carte dès que tout le monde a choisi (au plus tard 1 h après la précédente)</div>`;
 if(S.status==="run"){const inN=+S.inN||0,rd=+S.readyN||0;
  if(!inN)return `<div class="ex-ban"><span class="big">Plus personne dans la jungle</span>L'expédition attend : la carte ${S.step+1} sera révélée quand quelqu'un l'aura rejointe.</div>`;
  return `<div class="ex-ban"><span class="big">Étape ${S.step+1} dès que tout le monde a choisi</span>${rd}/${inN} explorateur${inN>1?"s ont":" a"} choisi · au plus tard à ${esc(hh(+S.nextAt))} (dans ${esc(dur(next))})</div>`;}
 const last=(S.cards||[])[S.cards.length-1]||{};
 if(S.status==="dead")return `<div class="ex-ban bad"><span class="big">${esc(DANGER[last.d]?DANGER[last.d].e+" "+DANGER[last.d].n:"Danger")} !</span>Le même danger est sorti deux fois : l'expédition s'est arrêtée à l'étape ${esc(last.s)}.</div>`;
 return `<div class="ex-ban good"><span class="big">Expédition terminée</span>Tous ceux qui restaient sont rentrés au camp${last.at?` à ${esc(hh(+last.at))}`:""}.</div>`;}
function dangersHTML(){const seen=S.seen||[];
 return `<div class="ex-dang">${DANGER.slice(0,+S.dangers||5).map((d,i)=>`<div class="ex-dg${seen.includes(i)?" on":""}" title="${esc(d.n)}"><img src="${d.i}" alt="">${seen.includes(i)?"déjà sorti":"pas encore"}</div>`).join("")}</div>`;}
function meHTML(){const me=S.me,run=S.status==="run"&&S.step<+S.steps;
 if(!me){
  if(run)return `<p class="ex-sub">${S.step?`L'expédition a déjà passé ${S.step} carte${S.step>1?"s":""}. Tu peux encore la rejoindre : tu partageras les prochains trésors (et ce qui traîne sur le chemin quand tu rentreras).`:"Rejoins l'expédition avant le départ, c'est gratuit !"}</p>
   <button type="button" class="ex-big" id="exJoin"${busy?" disabled":""}>${busy?"…":"Rejoindre l'expédition"}</button>`;
  const nx=S.next||{};
  if(nx.joined)return `<p><b>Tu es inscrit pour l'expédition de demain</b> (départ ${esc(hh(+nx.startAt))}).</p>${autoHTML(nx.auto)}<p class="ex-sub">${+nx.n} explorateur${+nx.n>1?"s":""} inscrit${+nx.n>1?"s":""} pour l'instant.</p>`;
  return `<p class="ex-sub">Tu n'as pas participé à l'expédition d'aujourd'hui.</p><button type="button" class="ex-big" id="exJoin"${busy?" disabled":""}>${busy?"…":"Je pars demain"}</button>`;}
 if(me.state==="in"){const can=me.canLeave,live=S.status==="run"&&S.step<+S.steps,first=S.step===0,rd=!!me.ready,wait=Math.max(0,(+S.inN||0)-(+S.readyN||0));
  const on=c=>me.choice===c?(rd||first?" on":" last"):"";
  const msg=first?`Départ à ${esc(hh(+S.startAt))} : tout le monde passe la 1re carte. Tu pourras choisir ensuite.`
   :rd?`<b>✅ Choix confirmé : ${me.choice==="home"?"tu rentres au camp":"tu continues"}.</b> ${wait?`En attente de ${wait} explorateur${wait>1?"s":""}… (au plus tard ${esc(hh(+S.nextAt))})`:"La carte arrive !"}<br>Tu peux encore changer d'avis.`
   :`<b>À toi de choisir pour l'étape ${S.step+1} !</b> Dès que tout le monde a choisi, la carte est révélée. Sans réponse à ${esc(hh(+S.nextAt))}, tu ${me.choice==="home"?"rentres":"continues"} (ton dernier choix).`;
  return `<img class="ex-hero" src="${IMG.singe}" alt=""><div class="ex-sub">Ton butin</div><div class="ex-loot">${esc(me.loot)} 🍌</div>
   ${live?`<div class="ex-two" role="group" aria-label="Ton choix pour la prochaine étape">
    <button type="button" class="ex-ch go${on("go")}" data-c="go" aria-pressed="${me.choice==="go"&&rd}"${busy||first?" disabled":""}>🧗 Continuer<small>je tente la suite</small></button>
    <button type="button" class="ex-ch home${on("home")}" data-c="home" aria-pressed="${me.choice==="home"&&rd}"${busy||!can||first?" disabled":""}>🏕️ Rentrer<small>${can?"je garde mon butin":"après ta 1re carte"}</small></button></div>
   <p class="ex-sub">${msg}</p>${me.ghost?`<p class="ex-sub">👻 Admin : tu joues sans compter. Tu ne bloques personne, tu ne prends rien aux parts des potes et tu ne peux pas ramasser l'Idole.</p>`:""}${autoHTML(me.auto)}`:""}`;}
 if(me.state==="home")return `<img class="ex-hero" src="${IMG.camp}" alt=""><div class="ex-sub">Rentré au camp${me.out?` après l'étape ${esc(me.out)}`:""}</div><div class="ex-loot">+${esc(me.gain)} 🍌</div>${+me.relic?`<p><b>🗿 Et l'Idole d'or : +${esc(+me.relic*(+S.relicBoost||1))} booster !</b></p>`:""}`;
 return `<img class="ex-hero" src="${IMG.perdu}" alt=""><div class="ex-sub">Butin perdu à l'étape ${esc(me.out)}…</div><div class="ex-loot" style="color:#ff8f7a">${esc(me.loot)} 🍌</div><p class="ex-sub">Consolation : +${esc(me.gain)} 🍌 (${esc(S.consol)} par carte passée).</p>`;}
function autoHTML(v){v=+v||0;const opts=AUTO.includes(v)?AUTO:AUTO.concat(v).sort((a,b)=>a-b);
 return `<label class="ex-auto">Rentrer tout seul dès que j'ai <select id="exAuto">${opts.map(x=>`<option value="${x}"${x===v?" selected":""}>${x?x+" 🍌":"non, je décide"}</option>`).join("")}</select></label>`;}
function playersHTML(){const L=S.players||[],me=S.me_uid,live=S.status==="run"&&S.step>=1&&S.step<+S.steps;if(!L.length)return `<p class="ex-empty">Personne n'est encore parti. Sois le premier !</p>`;
 return `<ul class="ex-pl">${L.map(p=>{const ic=p.state==="in"?"🧗":p.state==="home"?"🏕️":"💀",
  v=p.state==="in"?`${live?(p.ready?"✅ ":"⏳ "):""}${p.loot} 🍌 en poche`:p.state==="home"?`+${p.gain} 🍌${+p.relic?" 🗿":""} · étape ${p.out}`:`perdu ${p.loot} 🍌 · étape ${p.out}`;
  return `<li class="${p.uid===me?"me":""} ${p.state}"><span aria-hidden="true">${ic}</span><span class="nm">${esc(p.name)}${p.uid===me?(p.admin?" (toi · ne compte pas)":" (toi)"):""}</span><span class="v">${esc(v)}</span></li>`;}).join("")}</ul>`;}

function render(){if(!root||!S)return;const st=S.state;
 $("#exBan").textContent=st?st.bananas:"…";$("#exStep").textContent=`${S.step}/${S.steps}`;
 const inN=(S.players||[]).filter(p=>p.state==="in").length;
 $("#exMain").innerHTML=`<div class="ex-box">${bannerHTML()}</div>
  <div class="ex-box"><h3>Le chemin<small>${esc(S.step)}/${esc(S.steps)} cartes</small></h3><div class="ex-trail" role="list">${trailHTML()}</div>
   <div class="ex-path"><span>🍌 ${esc(S.path)} sur le chemin</span>${+S.relic?`<span>🗿 ${+S.relic>1?esc(S.relic)+" Idoles":"une Idole d'or"} sur le chemin</span>`:""}</div>${dangersHTML()}</div>
  <div class="ex-box ex-me">${meHTML()}</div>
  <div class="ex-box"><h3>Les explorateurs<small>${inN} dans la jungle</small></h3>${playersHTML()}</div>`;
 const tr=$(".ex-trail");if(tr){const k=tr.querySelector(".ex-cw.nx")||[...tr.querySelectorAll(".ex-cw:not(.off)")].pop();if(k)tr.scrollLeft=Math.max(0,k.offsetLeft-tr.offsetLeft+k.offsetWidth+40-tr.clientWidth);}
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
 o.innerHTML=`<div class="ex-card"><h3>Expédition du ${esc(fmtDay(L.day))}</h3><img src="${lost?IMG.perdu:+L.relic?IMG.idole:IMG.camp}" alt="">
  <p>${lost?`${esc(DANGER[L.danger]?DANGER[L.danger].d2:"Un 2e danger")} t'a surpris à l'étape ${esc(L.out)} : tu as perdu ton butin de <b>${esc(L.loot)} 🍌</b>.<br>Consolation : <b>+${esc(L.gain)} 🍌</b>.`
   :`Tu es rentré au camp après l'étape ${esc(L.out)} avec <b>+${esc(L.gain)} 🍌</b>${+L.relic?" et l'<b>Idole d'or</b> (+1 booster)":""} !`}</p>
  <button type="button" class="ex-big" id="exOk">Continuer</button></div>`;
 root.appendChild(o);const b=o.querySelector("#exOk");b.focus({preventScroll:true});
 b.addEventListener("click",()=>{o.remove();const d=L.day;S.last=null;rpc("mf_exp_seen",{p_day:d}).then(x=>{take(x);render();},()=>{});});}

/* ---------- actions ---------- */
async function refresh(){try{take(await rpc("mf_exp_status"));render();}catch(e){toast(errText(e));}schedule();}
function schedule(){clearTimeout(poll);if(!root||root.hidden)return;
 // toutes les 30 s, et juste après la prochaine étape (le serveur la révèle dans la minute)
 let w=S&&S.me&&S.me.state==="in"&&S.status==="run"&&S.step>=1?15000:30000;if(S&&S.nextAt){const t=+S.nextAt-nowS()+65000;if(t>0&&t<w)w=t;}poll=setTimeout(refresh,w);}
async function join(){if(busy)return;busy=true;render();
 try{take(await rpc("mf_exp_join"));toast(S.me?"Tu fais partie de l'expédition ! 🌴":"Inscrit pour l'expédition de demain !");}catch(e){toast(errText(e));}
 busy=false;render();}
async function choose(c,auto){if(busy)return;const me=S.me||(S.next&&S.next.joined?{choice:S.next.choice||"go"}:null);if(!me)return;
 busy=true;render();const st0=S.step;
 try{take(await rpc("mf_exp_choose",{p_choice:c||me.choice||"go",p_auto:auto==null?null:auto,p_ready:c?true:null}));
  toast(S.step>st0?"Tout le monde a choisi : nouvelle carte !":c==="home"?"Choix confirmé : tu rentres au camp.":c==="go"?"Choix confirmé : tu continues l'aventure !":auto?`Tu rentreras tout seul dès ${auto} 🍌.`:"Retour automatique coupé.");}
 catch(e){toast(errText(e));}
 busy=false;render();schedule();}
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
   <li>Départ à <b>10 h</b>, 13 cartes en tout : un <b>trésor</b> 🍌, un <b>danger</b> ou l'<b>Idole d'or</b> 🗿.</li>
   <li>Après chaque carte, chacun choisit en secret : <b>continuer</b> ou <b>rentrer au camp</b>. <b>Dès que tout le monde a choisi, la carte suivante est révélée.</b> Au plus tard 1 h après la précédente ; sans réponse, tu gardes ton dernier choix. S'il n'y a plus personne dans la jungle, l'expédition attend.</li>
   <li>Un trésor est <b>partagé</b> entre ceux qui sont dans la jungle. Ce qui ne se partage pas reste sur le chemin : ceux qui rentrent le ramassent.</li>
   <li><b>Rentrer seul</b> = tout ce qui traîne sur le chemin pour toi, Idole d'or comprise (<b>1 booster</b>).</li>
   <li>Un <b>1er danger</b> ne fait rien. Si le <b>même danger sort une 2e fois</b>, ceux qui sont encore dans la jungle perdent leur butin et l'expédition s'arrête. Consolation : 1 🍌 par carte passée.</li>
   <li>Tu ne perds jamais les bananes de ta réserve. Tu peux rejoindre une expédition déjà en route, mais il faut passer au moins une carte avant de pouvoir rentrer.</li>
   <li>Une notification à chaque carte tant que tu es dans la jungle, et une quand tout le monde n'attend plus que toi (réglage « enchères » des notifications).</li>
  </ul>
  <h3>Mes dernières expéditions</h3><ul class="ex-hist" id="exHist"></ul>
  <div id="exAdm" hidden><h3>Réglages admin</h3><p id="exState"></p>
   <div class="ex-btns"><button type="button" id="exOpen"></button></div>
   <div class="ex-btns"><button type="button" id="exStepNow">Révéler la prochaine carte maintenant</button><button type="button" id="exReset">Nouvelle expédition du jour</button><button type="button" id="exAdd">+50 🍌</button></div>
   <p>« Nouvelle expédition » efface celle du jour (les bananes déjà gagnées restent) ; elle part 1 minute plus tard. Une expédition encore en route à minuit s'arrête : tout le monde rentre au camp avec son butin.</p></div>
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
 Object.values(IMG).concat(DANGER.map(d=>d.i),LOGO).forEach(u=>{const i=new Image();i.src=u;});
 window.MF_CASINO.add({id:"exp",name:"L'Expédition",order:13,root:"mfEXP",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20h18"/><path d="M6 20l5-9 3 5 2-3 4 7"/><path d="M11 11V4l5 2-5 2"/></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){take(await rpc("mf_exp_status"));}const I=S;if(!I)return null;
   const run=I.status==="run"&&I.step<+I.steps,me=I.me,nIn=(I.players||[]).filter(p=>p.state==="in").length;
   const nx=I.nextAt?+I.nextAt-nowS():null,tomorrow=I.next?+I.next.startAt-nowS():null;
   if(I.last)return {line:"Résultat de l'expédition à voir !",hot:true};
   if(run&&!me){const started=+I.startAt<=nowS();
    if(!nIn)return {line:I.step?`L'expédition t'attend à l'étape ${I.step+1} : rejoins-la !`:started?"L'expédition attend son 1er explorateur : pars maintenant !":`Départ à ${hh(+I.startAt)} : rejoins l'expédition, c'est gratuit !`,pre:started?"":"Départ dans ",in:started?null:nx,hot:true};
    return {line:I.step?`En route · étape ${I.step}/${I.steps} · ${nIn} dans la jungle : rejoins-les !`:`Départ à ${hh(+I.startAt)} : rejoins l'expédition, c'est gratuit !`,pre:I.step?"Au plus tard dans ":"Départ dans ",in:nx,hot:true};}
   if(me&&me.state==="in"&&run&&I.step>=1&&!me.ready)return {line:`À toi de choisir pour l'étape ${I.step+1} ! Butin ${me.loot} 🍌`,pre:"Au plus tard dans ",in:nx,hot:true};
   if(me&&me.state==="in"&&run)return {line:`Butin ${me.loot} 🍌 · ${I.step?`choix confirmé, en attente des autres (${I.readyN}/${I.inN})`:`départ à ${hh(+I.startAt)}`}`,pre:I.step?"Au plus tard dans ":"Départ dans ",in:nx,hot:false};
   if(me&&me.state==="home")return {line:`Rentré au camp avec ${me.gain} 🍌${run?` · ${nIn} encore dans la jungle`:""}`,pre:run?"Prochaine étape dans ":"Prochaine expédition dans ",in:run?nx:tomorrow,hot:false};
   if(me&&me.state==="lost")return {line:`Butin perdu à l'étape ${me.out}…`,pre:"Prochaine expédition dans ",in:tomorrow,hot:false};
   if(I.next&&I.next.joined)return {line:"Inscrit pour l'expédition de demain",pre:"Départ dans ",in:tomorrow,hot:false};
   return {line:"Expédition terminée · inscris-toi pour demain",pre:"Prochaine expédition dans ",in:tomorrow,hot:false};}});
}
window.MF_EXP={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

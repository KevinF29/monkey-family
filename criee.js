/* Monkey Family — La Criée aux bananes (enchères secrètes entre potes, façon Raj / Hol's der Geier)
   Chaque jour, 15 lots mis aux enchères (bananes, 1 booster, pertes). Chaque joueur a 15 cartes de 1 à 15 et en mise une en secret
   par lot : la plus haute gagne un lot positif, la plus BASSE prend une perte, les mises identiques s'annulent.
   Le lot suivant arrive dès que tout le monde a misé (au plus tard 1 h après). Tout se passe sur le serveur (mf_cri_*, supabase-criee.sql).
   Jeu de l'Arène, toujours là. Visible par l'admin seulement tant que le jeu n'est pas ouvert (réglages admin → « Ouvrir à tous »).
   Pas encore d'illustrations : si packs/cri-logo.webp existe, il remplace le titre en texte. */
(function(){
"use strict";

const LOGO="packs/cri-logo.webp";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR={cri_closed:"La Criée n'est pas ouverte en ce moment.",cri_over:"La Criée du jour est terminée.",cri_already:"Tu es déjà inscrit.",
 cri_not_in:"Tu ne fais pas partie de cette Criée.",cri_not_open:"Pas de lot en vente pour l'instant.",cri_bad:"Cette carte n'est plus dans ta main.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const dur=ms=>{ms=Math.max(0,ms);const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);return h?`${h} h ${String(m).padStart(2,"0")}`:`${Math.max(1,m)} min`;};
const hh=ms=>{const d=new Date(ms);return d.getMinutes()?`${d.getHours()} h ${String(d.getMinutes()).padStart(2,"0")}`:`${d.getHours()} h`;};
const sgn=v=>(v>0?"+":"")+v;
// « +8 🍌 », « -6 🍌 », « 1 booster et +4 🍌 »
const ltxt=(v,b)=>{const a=[];if(b>0)a.push(`${b} booster${b>1?"s":""}`);if(v)a.push(`${sgn(v)} 🍌`);return a.join(" et ")||"rien";};
const rk=r=>r===1?"1er":`${r}e`;

/* ---------- style ---------- */
const CSS=`
#mfCRI{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;touch-action:manipulation;color:#fbf3dc;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:#3a1f0e;background-image:radial-gradient(ellipse at 50% -10%,#b0702a,transparent 60%),repeating-linear-gradient(90deg,rgba(0,0,0,.10) 0 2px,transparent 2px 46px),linear-gradient(180deg,#5a3216,#24120a)}
#mfCRI[hidden]{display:none}
#mfCRI *{box-sizing:border-box;min-width:0}
#mfCRI [hidden]{display:none!important}
#mfCRI,#mfCRI *{-webkit-tap-highlight-color:transparent}
#mfCRI button:focus-visible{outline:3px solid #8fd3ff;outline-offset:2px}
.cr-top{flex:none;position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:4px;padding:max(8px,env(safe-area-inset-top)) 58px 6px}
.cr-logo{display:block;height:clamp(44px,8svh,84px);width:auto;max-width:100%;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
.cr-logoT{margin:0;font:400 clamp(24px,6.6vw,34px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 #6b3f1d;text-align:center}
.cr-btn{position:absolute;top:max(8px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(40,20,8,.85);color:#ffd23f;font:700 19px Quicksand,sans-serif;cursor:pointer;display:grid;place-items:center}
.cr-btn.l{left:10px}.cr-btn.r{right:10px}
.cr-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px}
.cr-chip{background:#2a1408;border:1px solid #7a4a20;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13.5px;white-space:nowrap}
.cr-chip b{color:#ffd23f}
.cr-main{flex:1;min-height:0;width:100%;max-width:560px;overflow-y:auto;overscroll-behavior:contain;padding:4px 12px max(16px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px}
.cr-box{background:rgba(0,0,0,.30);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:12px}
.cr-box h3{margin:0 0 8px;font:400 16px "Titan One",sans-serif;color:#ffd23f;display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.cr-box h3 small{font:700 12.5px Quicksand,sans-serif;color:#f0dcb8}
.cr-ban{text-align:center;font-weight:700}
.cr-ban .big{display:block;font:400 clamp(19px,5.3vw,25px)/1.2 "Titan One",sans-serif;color:#fff}
.cr-sub{font-size:13.5px;font-weight:700;color:#f0dcb8}
/* le lot */
.cr-lotw{display:flex;align-items:center;gap:14px}
.cr-lot{flex:none;width:104px;height:140px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-align:center;
 border:3px solid #fff3c4;box-shadow:0 6px 14px rgba(0,0,0,.45),inset 0 0 0 3px rgba(0,0,0,.12);font:400 30px/1 "Titan One",sans-serif;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.cr-lot small{font:700 12px/1.1 Quicksand,sans-serif;text-shadow:none;opacity:.95}
.cr-lot .e{font-size:34px}
.cr-lot.g{background:linear-gradient(160deg,#4fb24a,#1f6b2a)}
.cr-lot.x{background:linear-gradient(160deg,#d0503a,#7a1a12)}
.cr-lot.b{background:linear-gradient(160deg,#ffd86a,#c48a12);color:#4a2a00;text-shadow:0 1px 0 rgba(255,255,255,.5)}
.cr-lot.q{background:repeating-linear-gradient(45deg,#6b3f1d 0 10px,#5a3216 10px 20px);font-size:40px;color:#ffd23f}
.cr-lot.new{animation:crFlip .6s cubic-bezier(.2,1.4,.4,1) both}
.cr-lotd{flex:1;display:flex;flex-direction:column;gap:6px}
.cr-dir{font:400 16px/1.2 "Titan One",sans-serif}
.cr-dir.up{color:#9ff0a0}.cr-dir.dn{color:#ffab98}
.cr-pot{display:inline-block;align-self:flex-start;background:#ffd23f;color:#3b2410;border-radius:999px;padding:2px 10px;font-weight:700;font-size:13px}
.cr-left{display:flex;flex-wrap:wrap;gap:4px;margin-top:10px}
.cr-left span{font:700 12px/1 Quicksand,sans-serif;padding:4px 6px;border-radius:6px;background:rgba(0,0,0,.35)}
.cr-left .g{color:#9ff0a0}.cr-left .x{color:#ffab98}.cr-left .b{color:#ffd23f}
/* ta main */
.cr-hand{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
.cr-c{aspect-ratio:3/4;border-radius:10px;border:2px solid #fff3c4;background:linear-gradient(160deg,#fff8e0,#f0d79a);color:#5a2a12;font:400 clamp(20px,6vw,28px)/1 "Titan One",sans-serif;cursor:pointer;
 display:grid;place-items:center;box-shadow:0 3px 0 #a07428;position:relative;padding:0}
.cr-c:active{transform:translateY(2px);box-shadow:0 1px 0 #a07428}
.cr-c.on{background:linear-gradient(160deg,#ffd23f,#e09a10);border-color:#fff;box-shadow:0 0 0 3px #ffd23f,0 3px 0 #8a5a08;transform:translateY(-4px)}
.cr-c.gone{background:rgba(0,0,0,.25);border:2px dashed rgba(255,255,255,.2);color:rgba(255,255,255,.25);box-shadow:none;cursor:default}
.cr-c:disabled:not(.gone){opacity:.55;cursor:default}
.cr-me{display:flex;justify-content:space-around;gap:8px;text-align:center;margin-bottom:10px}
.cr-me b{display:block;font:400 26px/1.1 "Titan One",sans-serif;color:#fff}
.cr-me b.neg{color:#ffab98}
.cr-big{min-height:56px;padding:8px 24px;border-radius:16px;border:0;background:#ffd23f;color:#3b2410;font:400 19px "Titan One",sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8901a;align-self:center}
.cr-big:active{transform:translateY(2px);box-shadow:0 2px 0 #b8901a}
.cr-big:disabled{background:#4a4030;color:#a09880;box-shadow:none;cursor:default}
.cr-join{display:flex;flex-direction:column;gap:10px;text-align:center}
/* dernier lot */
.cr-res{display:flex;flex-direction:column;gap:6px}
.cr-res.new{animation:crPop .5s both}
.cr-bids{display:flex;flex-wrap:wrap;gap:6px}
.cr-bid{display:flex;align-items:center;gap:6px;padding:4px 8px 4px 4px;border-radius:10px;background:rgba(0,0,0,.35);font-size:13.5px;font-weight:700}
.cr-bid i{font-style:normal;display:grid;place-items:center;width:30px;height:38px;border-radius:6px;background:#f6e6b8;color:#5a2a12;font:400 17px/1 "Titan One",sans-serif}
.cr-bid.x i{background:#6a5a48;color:#cbb;text-decoration:line-through}
.cr-bid.x{opacity:.7}
.cr-bid.w{background:rgba(255,210,63,.25);box-shadow:inset 0 0 0 2px #ffd23f}
.cr-bid.w.neg{background:rgba(255,120,90,.22);box-shadow:inset 0 0 0 2px #ff8f7a}
.cr-bid small{font-weight:700;opacity:.75}
/* joueurs */
.cr-pl{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.cr-pl li{display:grid;grid-template-columns:1.6em minmax(0,1fr) auto;align-items:center;gap:4px 8px;padding:6px 10px;border-radius:10px;background:rgba(0,0,0,.3);font-size:14px}
.cr-pl li.me{background:rgba(255,210,63,.16);box-shadow:inset 0 0 0 2px #ffd23f}
.cr-pl .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.cr-pl .v{font-weight:700;white-space:nowrap;text-align:right;color:#ffe7a8}
.cr-pl .v.neg{color:#ffab98}
.cr-pl .hd{grid-column:2/4;font-size:11.5px;color:#d8c4a0;letter-spacing:.3px;overflow-wrap:anywhere}
.cr-log{list-style:none;margin:0;padding:0;font-size:13.5px;display:grid;gap:3px}
.cr-log li{padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.cr-empty{color:#f0dcb8;font-size:14px}
.cr-ov{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(20,8,2,.78)}
.cr-card{width:min(380px,100%);background:#3a1f0e;border:2px solid #ffd23f;border-radius:20px;padding:18px 16px;text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center;box-shadow:0 18px 40px rgba(0,0,0,.5);animation:crFlip .5s both}
.cr-card h3{margin:0;font:400 24px "Titan One",sans-serif;color:#ffd23f}
.cr-card .em{font-size:58px;line-height:1}
.cr-panel{position:absolute;top:0;left:0;bottom:0;z-index:30;width:min(400px,100%);overflow-y:auto;overscroll-behavior:contain;background:#3a1f0e;border-right:1px solid #7a4a20;
 padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s;visibility:hidden}
.cr-panel.open{transform:none;visibility:visible}
.cr-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.cr-panel h3{font:400 19px "Titan One",sans-serif;color:#ffd23f;margin:14px 0 6px}
.cr-ph h3{margin:0}
.cr-panel p,.cr-panel li{color:#f0dcb8;font-size:14px}
.cr-panel ul.r{margin:4px 0;padding-left:18px}
.cr-hist{list-style:none;margin:0;padding:0;font-size:14px}
.cr-hist li{padding:5px 0;border-bottom:1px solid #5a3216}
.cr-hist:empty::after{content:"Aucune Criée pour l'instant.";color:#c8a880}
.cr-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.cr-btns button{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid #7a4a20;background:#5a3216;color:#fbf3dc;font:700 14px Quicksand,sans-serif;cursor:pointer}
.cr-btns button.on{background:#ffd23f;color:#3b2410;border-color:#ffd23f}
.cr-toast{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));z-index:40;transform:translate(-50%,12px);background:#5a3216;border:1px solid #ffd23f;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;max-width:92%;transition:transform .3s,opacity .3s;pointer-events:none;opacity:0;text-align:center}
.cr-toast.on{transform:translate(-50%,0);opacity:1}
@keyframes crFlip{from{transform:rotateY(90deg) scale(.8);opacity:0}to{transform:none;opacity:1}}
@keyframes crPop{from{transform:scale(.9);opacity:0}to{transform:none;opacity:1}}
@media(prefers-reduced-motion:reduce){.cr-toast,.cr-panel{transition:none}.cr-lot.new,.cr-card,.cr-res.new{animation:none}.cr-c.on,.cr-c:active,.cr-big:active{transform:none}}
`;

/* ---------- état ---------- */
let root=null,USER=null,ADMIN=false,S=null,skew=0,busy=false,poll=0;
const $=s=>root.querySelector(s);
const nowS=()=>Date.now()+skew;
function take(info){if(!info)return;S=info;if(info.now)skew=+info.now-Date.now();try{if(info.state&&window.MF_APPLY)window.MF_APPLY(info.state);}catch(e){}}
const seenKey="mf-cri-shown";
const shownStep=()=>{try{const v=JSON.parse(localStorage.getItem(seenKey)||"{}");return v.day===S.day?+v.step||0:-1;}catch(e){return -1;}};
const setShown=()=>{try{localStorage.setItem(seenKey,JSON.stringify({day:S.day,step:S.step}));}catch(e){}};
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};
const nameOf=uid=>{const p=(S.players||[]).find(x=>x.uid===uid);return p?p.name:"?";};
const run=()=>S&&S.status==="run"&&S.step<+S.cards;
const live=()=>run()&&!!S.lot;

/* ---------- morceaux d'écran ---------- */
function lotCard(v,b,isNew){const cls=b>0?"b":v<0?"x":"g";
 const main=b>0?`<span class="e">🎁</span>${v?`<small>et ${esc(sgn(v))} 🍌</small>`:""}`:`${esc(sgn(v))}<small>🍌</small>`;
 return `<div class="cr-lot ${cls}${isNew?" new":""}" aria-hidden="true">${main}${b>1?`<small>${b} boosters</small>`:b?`<small>1 booster</small>`:""}</div>`;}
// lots encore à venir (le paquet du jour est public, l'ordre non)
function leftLots(){const all=(S.lots||[]).map(v=>({v,b:0})).concat(Array.from({length:+S.boosts||0},()=>({v:0,b:1})));
 const out=(S.rounds||[]).map(r=>({v:+r.lv,b:+r.lb}));if(S.lot)out.push({v:+S.lot.lv,b:+S.lot.lb});
 out.forEach(o=>{const i=all.findIndex(a=>a.v===o.v&&a.b===o.b);if(i>=0)all.splice(i,1);});
 return all.sort((a,b)=>b.b-a.b||b.v-a.v);}
function bannerHTML(){const n=+S.inN||0,need=+S.minPlayers||2;
 if(S.status!=="run"){const last=(S.rounds||[]).slice(-1)[0];return `<div class="cr-ban"><span class="big">Criée terminée</span>${last&&last.at?`Dernier lot adjugé à ${esc(hh(+last.at))}. `:""}Prochaine Criée demain à ${esc(hh(+S.next.startAt))}.</div>`;}
 if(!S.lot){
  if(+S.startAt>nowS())return `<div class="cr-ban"><span class="big">Ouverture à ${esc(hh(+S.startAt))}</span>dans ${esc(dur(+S.startAt-nowS()))} · ${n} joueur${n>1?"s":""} inscrit${n>1?"s":""}${n<need?` (il en faut ${need})`:""}</div>`;
  return `<div class="cr-ban"><span class="big">La Criée attend ses enchérisseurs</span>${n} joueur${n>1?"s":""} sur ${need} minimum : le 1er lot part dès que ${need-n>1?`${need-n} potes de plus seront là`:"le prochain pote sera là"}.</div>`;}
 const bd=+S.bidN||0,left=+S.dueAt-nowS();
 return `<div class="cr-ban"><span class="big">Lot ${S.step+1}/${S.cards} : misez !</span>${bd}/${n} ${n>1?"ont":"a"} misé · adjugé dès que tout le monde a misé, au plus tard à ${esc(hh(+S.dueAt))} (dans ${esc(dur(left))})</div>`;}
function lotHTML(){const L=S.lot,isNew=S.step+1>shownStep();
 const left=leftLots().map(x=>`<span class="${x.b?"b":x.v<0?"x":"g"}">${x.b?"🎁":esc(sgn(x.v))}</span>`).join("");
 const head=`<h3>Le lot en vente<small>${esc(S.step)}/${esc(S.cards)} adjugés</small></h3>`;
 if(!L)return `${head}<div class="cr-lotw"><div class="cr-lot q" aria-hidden="true">?</div><div class="cr-lotd"><span class="cr-sub">${run()?"Le commissaire-priseur singe prépare le premier lot…":"Plus rien à vendre aujourd'hui."}</span></div></div>${left&&run()?`<div class="cr-left" aria-label="Lots à venir">${left}</div>`:""}`;
 const pos=!!L.pos;
 return `${head}<div class="cr-lotw" role="group" aria-label="Lot ${S.step+1} : ${esc(ltxt(+L.v,+L.b))}">${lotCard(+L.v,+L.b,isNew)}<div class="cr-lotd">
   <span class="cr-dir ${pos?"up":"dn"}">${pos?"⬆️ La plus HAUTE mise l'emporte":"⬇️ La plus BASSE mise prend la perte"}</span>
   ${+L.n>1?`<span class="cr-pot">Avec le report de ${+L.n-1} lot${+L.n>2?"s":""} : ${esc(ltxt(+L.v,+L.b))}</span>`:""}
   <span class="cr-sub">Les mises identiques s'annulent. Si tout s'annule, le lot reste en jeu et s'ajoute au suivant.</span></div></div>
  ${left?`<div class="cr-left" aria-label="Lots à venir après celui-ci">${left}</div>`:""}`;}
function meHTML(){const me=S.me;
 if(!me){const nx=S.next||{};
  if(run())return `<div class="cr-join"><p class="cr-sub">${S.step?`${S.step} lot${S.step>1?"s":""} déjà adjugé${S.step>1?"s":""}. Tu peux encore entrer : tu recevras ${+S.cards-S.step} cartes tirées au hasard (une par lot restant).`:"Inscris-toi, c'est gratuit ! Tu reçois 15 cartes, de 1 à 15."}</p>
   <button type="button" class="cr-big" id="crJoin"${busy?" disabled":""}>${busy?"…":"Entrer dans la Criée"}</button></div>`;
  if(nx.joined)return `<div class="cr-join"><p><b>Tu es inscrit pour la Criée de demain</b> (ouverture ${esc(hh(+nx.startAt))}).</p><p class="cr-sub">${+nx.n} joueur${+nx.n>1?"s":""} inscrit${+nx.n>1?"s":""} pour l'instant.</p></div>`;
  return `<div class="cr-join"><p class="cr-sub">Tu n'as pas participé à la Criée d'aujourd'hui.</p><button type="button" class="cr-big" id="crJoin"${busy?" disabled":""}>${busy?"…":"Je m'inscris pour demain"}</button></div>`;}
 const hand=me.hand||[],lv=live(),bid=lv?me.bid:null,all=Array.from({length:+S.cards||15},(_,i)=>i+1);
 const sc=+me.score;
 const msg=me.done?`Criée terminée${me.rank?` : tu finis <b>${esc(rk(+me.rank))}</b>`:""} avec ${esc(sc)} 🍌 → <b>+${esc(me.gain)} 🍌</b>${+me.boost?` et <b>${esc(me.boost)} booster${+me.boost>1?"s":""}</b>`:""}.`
  :!lv?"Tes cartes sont prêtes. Tu pourras miser dès que le lot est dévoilé."
  :bid?`<b>✅ Tu mises ton ${esc(bid)}.</b> ${(+S.inN-(+S.bidN))>0?`En attente de ${+S.inN-(+S.bidN)} joueur${+S.inN-(+S.bidN)>1?"s":""}…`:"Adjugé dans un instant !"} Tu peux encore changer de carte.`
  :`<b>Choisis ta carte pour le lot ${S.step+1} !</b> Sans mise à ${esc(hh(+S.dueAt))}, une de tes cartes sera jouée au hasard.`;
 return `<h3>Ta main<small>${hand.length} carte${hand.length>1?"s":""}</small></h3>
  <div class="cr-me"><div><span class="cr-sub">Score du jour</span><b class="${sc<0?"neg":""}">${esc(sgn(sc))} 🍌</b></div><div><span class="cr-sub">Boosters</span><b>${esc(me.boost)} 🎁</b></div><div><span class="cr-sub">Lots gagnés</span><b>${esc(me.wins)}</b></div></div>
  ${me.done?"":`<div class="cr-hand" role="group" aria-label="Tes cartes">${all.map(c=>{const has=hand.includes(c);
   return has?`<button type="button" class="cr-c${bid===c?" on":""}" data-c="${c}" aria-pressed="${bid===c}"${busy||!lv?" disabled":""} aria-label="Miser ${c}">${c}</button>`
    :`<span class="cr-c gone" aria-hidden="true">${c}</span>`;}).join("")}</div>`}
  <p class="cr-sub" style="margin:10px 0 0;text-align:center">${msg}</p>
  ${me.ghost?`<p class="cr-sub" style="text-align:center">👻 Admin : tu joues sans compter. Ta carte ne gêne personne, tu gagnes seulement les bananes d'un lot que tu aurais remporté (jamais de booster), et tu ne bloques pas les lots.</p>`:""}`;}
function roundHTML(r,isNew){const pos=!!r.pos,bids=r.bids||[],cnt={};bids.forEach(b=>{cnt[b.c]=(cnt[b.c]||0)+1;});
 const w=r.w,me=S.me_uid,meAdm=S.me&&S.me.ghost;
 const head=w?`<b>${esc(nameOf(w))}</b> ${pos?"remporte":"se prend"} <b>${esc(ltxt(+r.v,+r.b))}</b> avec un ${esc(r.wc)} !`:`Toutes les mises se sont annulées : <b>${esc(ltxt(+r.v,+r.b))}</b> ${+r.s<+S.cards?"reste en jeu":"ne part chez personne"} !`;
 return `<div class="cr-res${isNew?" new":""}"><span>Lot ${esc(r.s)} · ${head}</span>
  <div class="cr-bids">${bids.map(b=>`<span class="cr-bid${cnt[b.c]>1?" x":""}${b.uid===w?" w"+(pos?"":" neg"):""}"><i>${esc(b.c)}</i>${esc(nameOf(b.uid))}${b.uid===me?" (toi)":""}${b.a?" <small>· au hasard</small>":""}</span>`).join("")}</div>
  ${meAdm&&r.agc!=null?`<span class="cr-sub">👻 Ta carte : ${esc(r.agc)}${r.ag?` → tu ${pos?"gagnes":"prends"} ${esc(sgn(+r.v))} 🍌`:""}</span>`:""}</div>`;}
function playersHTML(){const L=S.players||[],me=S.me_uid,lv=live();if(!L.length)return `<p class="cr-empty">Personne n'est encore inscrit. Sois le premier !</p>`;
 return `<ul class="cr-pl">${L.map((p,i)=>{const sc=+p.score,ic=S.status!=="run"&&p.rank?(["🥇","🥈","🥉"][+p.rank-1]||"🐒"):lv&&!p.admin?(p.bid?"✅":"⏳"):"🐒";
  return `<li class="${p.uid===me?"me":""}"><span aria-hidden="true">${ic}</span><span class="nm">${esc(p.name)}${p.uid===me?(p.admin?" (toi · ne compte pas)":" (toi)"):""}</span>
   <span class="v${sc<0?" neg":""}">${esc(sgn(sc))} 🍌${+p.boost?` · ${esc(p.boost)} 🎁`:""}</span>
   ${S.status==="run"&&(p.hand||[]).length?`<span class="hd" aria-label="Cartes restantes de ${esc(p.name)}">Reste : ${(p.hand||[]).join(" ")}</span>`:""}</li>`;}).join("")}</ul>`;}
function logHTML(){const R=(S.rounds||[]).slice(0,-1).reverse();if(!R.length)return "";
 return `<div class="cr-box"><h3>Les lots précédents<small>${R.length}</small></h3><ul class="cr-log">${R.map(r=>`<li>Lot ${esc(r.s)} · ${esc(ltxt(+r.v,+r.b))} : ${r.w?`${esc(nameOf(r.w))} (${esc(r.wc)})`:"tout s'est annulé"}<br><small class="cr-sub">${(r.bids||[]).map(b=>`${esc(nameOf(b.uid))} ${esc(b.c)}`).join(" · ")}</small></li>`).join("")}</ul></div>`;}

function render(){if(!root||!S)return;const st=S.state,old=shownStep();
 $("#crBan").textContent=st?st.bananas:"…";$("#crStep").textContent=`${S.step}/${S.cards}`;
 const last=(S.rounds||[]).slice(-1)[0];
 $("#crMain").innerHTML=`<div class="cr-box">${bannerHTML()}</div>
  <div class="cr-box">${lotHTML()}</div>
  <div class="cr-box">${meHTML()}</div>
  ${last?`<div class="cr-box"><h3>Dernier lot</h3>${roundHTML(last,old>=0&&+last.s>old)}</div>`:""}
  <div class="cr-box"><h3>Les enchérisseurs<small>${esc(S.inN)} joueur${+S.inN>1?"s":""}</small></h3>${playersHTML()}</div>
  ${logHTML()}`;
 const j=$("#crJoin");if(j)j.addEventListener("click",join);
 root.querySelectorAll("button.cr-c").forEach(b=>b.addEventListener("click",()=>bid(+b.dataset.c)));
 $("#crHist").innerHTML=(S.hist||[]).map(h=>`<li>${esc(fmtDay(h.day))} : ${h.rank?`${esc(rk(+h.rank))}, `:""}${esc(sgn(+h.score))} 🍌 → +${esc(h.gain)} 🍌${+h.boost?` et ${esc(h.boost)} 🎁`:""}</li>`).join("");
 if(ADMIN){const o=$("#crOpen");o.textContent=S.open?"Cacher aux joueurs":"Ouvrir à tous les joueurs";o.classList.toggle("on",!S.open);
  $("#crState").textContent=S.open?"La Criée est ouverte à tous les joueurs (jeu de l'Arène, toujours là).":"La Criée est visible par toi seulement.";}
 if(old>=0&&S.step>old)vib(30);
 setShown();
 if(S.last&&!$(".cr-ov"))showLast();}
const fmtDay=d=>{try{const [Y,M,D]=String(d).split("-").map(Number);return `${D}/${M}`;}catch(e){return d;}};
function showLast(){const L=S.last;if(!L)return;
 const o=document.createElement("div");o.className="cr-ov";o.setAttribute("role","dialog");o.setAttribute("aria-label","Résultat de la Criée");
 const em=L.rank===1?"🥇":L.rank===2?"🥈":L.rank===3?"🥉":"🍌";
 o.innerHTML=`<div class="cr-card"><h3>Criée du ${esc(fmtDay(L.day))}</h3><div class="em" aria-hidden="true">${em}</div>
  <p>${L.rank?`Tu termines <b>${esc(rk(+L.rank))}</b> sur ${esc(L.n)} avec ${esc(sgn(+L.score))} 🍌 (${esc(L.wins)} lot${+L.wins>1?"s":""} gagné${+L.wins>1?"s":""}).`:`Tu as fini avec ${esc(sgn(+L.score))} 🍌.`}<br>
  ${+L.gain||+L.boost?`Gain : <b>+${esc(L.gain)} 🍌</b>${+L.boost?` et <b>${esc(L.boost)} booster${+L.boost>1?"s":""}</b> 🎁`:""} !`:"Score négatif : pas de gain, mais tu ne perds rien de ta réserve."}</p>
  <button type="button" class="cr-big" id="crOk">Continuer</button></div>`;
 root.appendChild(o);const b=o.querySelector("#crOk");b.focus({preventScroll:true});
 b.addEventListener("click",()=>{o.remove();const d=L.day;S.last=null;rpc("mf_cri_seen",{p_day:d}).then(x=>{take(x);render();},()=>{});});}

/* ---------- actions ---------- */
async function refresh(){try{take(await rpc("mf_cri_status"));render();}catch(e){toast(errText(e));}schedule();}
function schedule(){clearTimeout(poll);if(!root||root.hidden)return;
 let w=S&&S.me&&live()?10000:30000;if(S&&S.dueAt){const t=+S.dueAt-nowS()+65000;if(t>0&&t<w)w=t;}poll=setTimeout(refresh,w);}
async function join(){if(busy)return;busy=true;render();
 try{take(await rpc("mf_cri_join"));toast(S.me?"Tu es dans la Criée ! 🍌":"Inscrit pour la Criée de demain !");}catch(e){toast(errText(e));}
 busy=false;render();}
async function bid(c){if(busy||!S.me||!live())return;if(S.me.bid===c)return;busy=true;const st0=S.step;render();
 try{take(await rpc("mf_cri_bid",{p_card:c}));
  if(S.step>st0){const r=(S.rounds||[]).slice(-1)[0];toast(r&&r.w===S.me_uid?(r.pos?"Adjugé : le lot est pour toi ! 🎉":"Aïe, la perte est pour toi…"):"Tout le monde a misé : adjugé !");}
  else toast(`Tu mises ton ${c}.`);}
 catch(e){toast(errText(e));}
 busy=false;render();schedule();}
let tt=0;function toast(m){const e=$(".cr-toast");e.textContent=m;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500);}
function panel(o){$("#crPanel").classList.toggle("open",o);$("#crTog").setAttribute("aria-expanded",String(o));}
async function adm(a,m){try{take(await rpc("mf_cri_admin",{p_action:a}));render();if(m)toast(m);}catch(e){toast(errText(e));}}

/* ---------- construction ---------- */
function build(){
 const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
 root=document.createElement("div");root.id="mfCRI";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","La Criée aux bananes");
 root.innerHTML=`<div class="cr-top"><button type="button" class="cr-btn l" id="crTog" aria-controls="crPanel" aria-expanded="false" aria-label="Règles">?</button>
  <h2 style="margin:0"><img class="cr-logo" src="${LOGO}" alt="La Criée aux bananes" hidden><span class="cr-logoT">La Criée aux bananes</span></h2>
  <div class="cr-chips"><span class="cr-chip">🍌 <b id="crBan">…</b></span><span class="cr-chip">Lot <b id="crStep">…</b></span></div>
  <button type="button" class="cr-btn r" id="crClose" aria-label="Fermer">✕</button></div>
 <div class="cr-main" id="crMain" aria-live="polite"><div class="cr-box cr-ban">Chargement…</div></div>
 <aside class="cr-panel" id="crPanel" aria-label="Règles et réglages">
  <div class="cr-ph"><h3>Règles</h3><button type="button" class="cr-btn" style="position:static" id="crPanelX" aria-label="Fermer les règles">✕</button></div>
  <ul class="r">
   <li>Chaque jour, une <b>Criée commune</b> de <b>15 lots</b> : 9 lots de bananes (+2 à +18 🍌), <b>1 booster</b> 🎁 et <b>5 pertes</b> (-2 à -10 🍌). C'est <b>gratuit</b>.</li>
   <li>Tu as <b>15 cartes, de 1 à 15</b>. Pour chaque lot, tu en mises <b>une en secret</b>. Une carte jouée est perdue pour la journée.</li>
   <li>Lot de bananes ou booster : la <b>plus haute</b> mise l'emporte. Perte : la <b>plus basse</b> mise se la prend.</li>
   <li><b>Les mises identiques s'annulent</b> : seules les cartes jouées par un seul joueur comptent. Si tout s'annule, le lot reste et <b>s'ajoute au suivant</b>.</li>
   <li>1er lot à <b>10 h</b> (il faut au moins 2 joueurs). Le lot suivant arrive <b>dès que tout le monde a misé</b>, au plus tard 1 h après. Sans mise, une de tes cartes est jouée <b>au hasard</b>.</li>
   <li>À la fin, tu gagnes ton score s'il est positif, et tes boosters. Tu ne perds jamais de bananes de ta réserve.</li>
   <li>Tu peux entrer en cours de route : tu reçois une carte au hasard par lot restant. Les cartes qui restent à chacun sont visibles.</li>
   <li>Une notification à chaque lot, et une quand tout le monde n'attend plus que toi (réglage « enchères » des notifications). À minuit, une Criée pas finie s'arrête.</li>
  </ul>
  <h3>Mes dernières Criées</h3><ul class="cr-hist" id="crHist"></ul>
  <div id="crAdm" hidden><h3>Réglages admin</h3><p id="crState"></p>
   <div class="cr-btns"><button type="button" id="crOpen"></button></div>
   <div class="cr-btns"><button type="button" id="crStart">Dévoiler le 1er lot maintenant</button><button type="button" id="crResolve">Adjuger le lot maintenant</button><button type="button" id="crReset">Nouvelle Criée du jour</button><button type="button" id="crAdd">+50 🍌</button></div>
   <p>« Dévoiler » lance la Criée même sans 2 joueurs. « Adjuger » joue une carte au hasard pour ceux qui n'ont pas misé. « Nouvelle Criée » efface celle du jour (les gains déjà crédités restent) ; elle s'ouvre 1 minute plus tard s'il y a 2 joueurs.</p></div>
 </aside>
 <div class="cr-toast" role="status"></div>`;
 document.body.appendChild(root);
 $("#crAdm").hidden=!ADMIN;
 const lg=$(".cr-logo");lg.onload=()=>{if(lg.naturalWidth){lg.hidden=false;$(".cr-logoT").hidden=true;}};
 root.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if($(".cr-ov"))return;if($("#crPanel").classList.contains("open"))panel(false);else close();});
 $("#crClose").addEventListener("click",close);
 $("#crTog").addEventListener("click",()=>panel(!$("#crPanel").classList.contains("open")));
 $("#crPanelX").addEventListener("click",()=>{panel(false);$("#crTog").focus({preventScroll:true});});
 $("#crOpen").addEventListener("click",()=>adm(S&&S.open?"close":"open",S&&S.open?"La Criée est de nouveau cachée.":"La Criée est ouverte à tous."));
 $("#crStart").addEventListener("click",()=>adm("start","Lot dévoilé."));
 $("#crResolve").addEventListener("click",()=>adm("resolve","Lot adjugé."));
 $("#crReset").addEventListener("click",()=>{if(window.confirm("Effacer la Criée du jour et en créer une nouvelle ?"))adm("reset","Nouvelle Criée créée.");});
 $("#crAdd").addEventListener("click",()=>adm("bananas","+50 🍌 sur ton compte."));
 setInterval(()=>{if(root&&!root.hidden&&S&&!busy&&!$(".cr-ov"))render();},60000);
}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
 if(!root)build();if(!root.hidden)return;
 root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 if(S)render();$("#crClose").focus({preventScroll:true});
 await refresh();
}
function close(){panel(false);clearTimeout(poll);const o=$(".cr-ov");if(o)o.remove();root.hidden=true;document.body.style.overflow=prevOverflow;if(opener&&opener.focus)opener.focus();}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&root&&!root.hidden)refresh();});

/* ---------- démarrage : le jeu s'inscrit dans l'Arène ---------- */
async function boot(){
 if(!window.claude||!window.claude.use)return;
 try{USER=await window.claude.use("user");}catch(e){}
 if(!USER||typeof window.MF_RPC!=="function")return;
 try{ADMIN=!!(await USER.isOwner());}catch(e){}
 let can=ADMIN;if(!can){try{can=!!(await rpc("mf_cri_open"));}catch(e){}}
 if(!can||!window.MF_CASINO)return;
 window.MF_CASINO.add({id:"cri",name:"La Criée aux bananes",order:14,root:"mfCRI",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4l6 6"/><path d="M11 7l6 6"/><path d="M12.5 5.5l-6 6 3 3 6-6"/><path d="M8 13l-5 5"/><path d="M4 21h9"/></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){take(await rpc("mf_cri_status"));}const I=S;if(!I)return null;
   const R=I.status==="run"&&I.step<+I.cards,me=I.me,L=!!I.lot,due=I.dueAt?+I.dueAt-nowS():null,tomorrow=I.next?+I.next.startAt-nowS():null;
   if(I.last)return {line:"Résultat de la Criée à voir !",hot:true};
   if(R&&!me){const started=+I.startAt<=nowS();
    if(L)return {line:`Lot ${I.step+1}/${I.cards} en vente · ${I.inN} joueur${+I.inN>1?"s":""} : entre dans la Criée !`,pre:"Adjugé au plus tard dans ",in:due,hot:true};
    return {line:started?`La Criée attend ses enchérisseurs (${I.inN}/${I.minPlayers}) : entre !`:`Ouverture à ${hh(+I.startAt)} : inscris-toi, c'est gratuit !`,pre:started?"":"Ouverture dans ",in:started?null:+I.startAt-nowS(),hot:true};}
   if(me&&R&&L&&!me.bid)return {line:`À toi de miser sur le lot ${I.step+1} : ${ltxt(+I.lot.v,+I.lot.b)} !`,pre:"Au plus tard dans ",in:due,hot:true};
   if(me&&R&&L)return {line:`Tu mises ton ${me.bid} · ${I.bidN}/${I.inN} ont misé · score ${sgn(+me.score)} 🍌`,pre:"Au plus tard dans ",in:due,hot:false};
   if(me&&R)return {line:`Inscrit · ${I.inN}/${I.minPlayers} joueurs`,pre:+I.startAt>nowS()?"Ouverture dans ":"",in:+I.startAt>nowS()?+I.startAt-nowS():null,hot:false};
   if(me&&me.done)return {line:`${me.rank?rk(+me.rank)+" · ":""}${sgn(+me.score)} 🍌 aujourd'hui`,pre:"Prochaine Criée dans ",in:tomorrow,hot:false};
   if(I.next&&I.next.joined)return {line:"Inscrit pour la Criée de demain",pre:"Ouverture dans ",in:tomorrow,hot:false};
   return {line:"Criée terminée · inscris-toi pour demain",pre:"Prochaine Criée dans ",in:tomorrow,hot:false};}});
}
window.MF_CRI={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

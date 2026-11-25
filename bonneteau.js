/* Monkey Family — Bananateau (bonneteau du Casino : 3 noix de coco, une banane cachée dessous)
   5 parties par jour, mise fixe de 3 🍌 (réglables dans mf_bon_cfg). Vrai mélange, qu'on peut suivre des yeux, à la vitesse choisie :
   lent ×1,5, rapide ×2, turbo ×3. Le singe triche parfois : il escamote la banane quand tu avais trouvé.
   Les échanges sont tirés par le serveur (mf_bon_*, supabase-bonneteau.sql) ; la page les rejoue à l'identique.
   Visible par l'admin seulement tant que le jeu n'est pas ouvert à tous (réglages admin → « Ouvrir à tous »). */
(function(){
"use strict";

// images de Kévin (facultatives) : sans elles, le jeu reprend le fond et le singe de MonkeyJack 21, et dessine les noix de coco
const IMG={logo:"packs/bon-titre.webp",fond:"packs/bon-fond.webp",singe:"packs/bon-singe.webp",triche:"packs/bon-singe-triche.webp",noix:"packs/bon-noix.webp",table:"packs/bon-table.webp",
 fondB:"packs/bj-fond.webp",singeB:"packs/bj-croupier.webp"};
const NAME="Bananateau";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR={no_bananas:"Pas assez de bananes.",bon_limit:"Plus de parties aujourd'hui : reviens demain !",bon_closed:"Le bonneteau n'est pas encore ouvert.",
 bon_in_game:"Une partie est déjà en cours.",bon_no_game:"Pas de partie en cours.",bon_bet:"Mise impossible.",bon_cup:"Noix de coco inconnue.",bon_speed:"Vitesse inconnue.",
 not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait=ms=>new Promise(r=>setTimeout(r,reduce?Math.min(ms,120):ms));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const SIDE=["de gauche","du milieu","de droite"];
const SPEEDS=[["slow","🐢","Lent"],["fast","🐒","Rapide"],["turbo","⚡","Turbo"]];
const SPN={slow:"lent",fast:"rapide",turbo:"turbo"};
const fx=x=>"×"+String(+x).replace(".",",");

const NUT=`<svg viewBox="0 0 120 100" aria-hidden="true"><defs><radialGradient id="bnG" cx="38%" cy="28%" r="80%"><stop offset="0" stop-color="#a8703f"/><stop offset=".55" stop-color="#6e4120"/><stop offset="1" stop-color="#3e2210"/></radialGradient></defs>
<path d="M6 90C6 34 36 6 60 6s54 28 54 84z" fill="url(#bnG)"/>
<g stroke="#c89a63" stroke-width="2" stroke-linecap="round" opacity=".55" fill="none"><path d="M22 70q4-14 2-26"/><path d="M34 82q3-22 8-40"/><path d="M50 30q6-6 14-8"/><path d="M80 44q6 10 6 30"/><path d="M96 66q2-10-2-20"/><path d="M62 84q-2-14 2-26"/><path d="M28 50q6-10 14-16"/></g>
<g fill="#2a160a"><ellipse cx="50" cy="20" rx="5" ry="4"/><ellipse cx="70" cy="20" rx="5" ry="4"/><ellipse cx="60" cy="32" rx="5" ry="4"/></g>
<ellipse cx="60" cy="90" rx="54" ry="7" fill="#2a160a"/><ellipse cx="60" cy="89" rx="48" ry="4" fill="#f4ead2" opacity=".9"/></svg>`;

/* ---------- style ---------- */
const CSS=`
#mfBON{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;color:#f1edf9;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:#15111f;background-image:linear-gradient(rgba(16,10,28,.45),rgba(16,10,28,.8)),url(${IMG.fond}),url(${IMG.fondB});background-size:cover;background-position:center}
#mfBON[hidden]{display:none}
#mfBON *{box-sizing:border-box;min-width:0}
#mfBON [hidden]{display:none!important}
#mfBON,#mfBON *{-webkit-tap-highlight-color:transparent}
#mfBON button:focus-visible,#mfBON select:focus-visible{outline:3px solid #8fd3ff;outline-offset:2px}
.bn-top{flex:none;position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;padding:max(8px,env(safe-area-inset-top)) 58px 6px}
.bn-logo{display:block;height:clamp(56px,10svh,120px);width:auto;max-width:100%;filter:drop-shadow(0 8px 12px rgba(0,0,0,.5))}
.bn-logoT{margin:0;font:400 clamp(26px,7vw,38px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 #8a5a00,0 0 16px rgba(0,0,0,.5);text-align:center}
.bn-btn{position:absolute;top:max(8px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(20,18,32,.75);color:#ffd23f;font:700 19px Quicksand,sans-serif;cursor:pointer;display:grid;place-items:center}
.bn-btn.l{left:10px}.bn-btn.r{right:10px}
.bn-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px}
.bn-chip{background:#211a33;border:1px solid #3a2f57;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13.5px;white-space:nowrap}
.bn-chip b{color:#ffd23f}
.bn-scene{flex:1;min-height:0;width:min(100%,640px);position:relative;display:flex;flex-direction:column;align-items:center;padding:4px 14px max(18px,env(safe-area-inset-bottom))}
.bn-dealer{flex:none;position:relative;display:flex;align-items:flex-end;justify-content:center;--mh:clamp(70px,16svh,190px);height:var(--mh);width:100%}
.bn-monk{height:100%;width:auto;max-width:60%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,.45));transform-origin:50% 100%}
.bn-monkE{font-size:clamp(56px,12svh,140px);line-height:1;filter:drop-shadow(0 8px 12px rgba(0,0,0,.45));transform-origin:50% 100%}
.bn-monk.wob,.bn-monkE.wob{animation:bnWob .4s 3 alternate ease-in-out}
@keyframes bnWob{from{transform:rotate(-6deg)}to{transform:rotate(6deg) scale(1.04)}}
.bn-hand{position:absolute;left:calc(50% - var(--mh)*.62);bottom:18%;font-size:calc(var(--mh)*.34);line-height:1;opacity:0;transform:scale(.2) rotate(-40deg);pointer-events:none;filter:drop-shadow(0 4px 6px rgba(0,0,0,.5))}
.bn-hand.on{animation:bnSteal 1.1s cubic-bezier(.2,1.4,.4,1) forwards}
@keyframes bnSteal{0%{opacity:0;transform:translate(60px,140px) scale(.2) rotate(-40deg)}60%{opacity:1;transform:scale(1.25) rotate(12deg)}100%{opacity:1;transform:rotate(-8deg)}}
.bn-say{position:absolute;left:calc(50% + var(--mh)*.5);top:-4px;max-width:min(200px,calc(50% - var(--mh)*.5 - 4px));background:#fff;color:#2a1145;border-radius:14px 14px 14px 4px;padding:6px 10px;font-weight:700;font-size:13.5px;line-height:1.25;box-shadow:0 4px 10px rgba(0,0,0,.35);opacity:0;transform:scale(.8);transition:opacity .2s,transform .2s;pointer-events:none}
.bn-say.on{opacity:1;transform:none}
.bn-mat{flex:1;min-height:0;width:100%;position:relative;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:2%;align-items:center;margin-top:6px;border-radius:26px;
 background:radial-gradient(ellipse at 50% 40%,#1f7a45,#0f5a30 60%,#0a4424);border:8px solid #6b3f1d;box-shadow:inset 0 0 0 2px #a0682f,inset 0 10px 30px rgba(0,0,0,.45),0 10px 24px rgba(0,0,0,.45)}
.bn-mat.img{background:transparent;border:0;box-shadow:none}
.bn-mat>.bn-tbl{position:absolute;inset:0;background:center/100% 100% no-repeat;pointer-events:none}
.bn-box{position:relative;width:100%;--cw:clamp(78px,min(27vw,17svh),150px);height:calc(var(--cw)*1.38)}
.bn-cup{position:absolute;left:50%;bottom:8%;width:var(--cw);height:calc(var(--cw)*.84);margin-left:calc(var(--cw)*-.5);padding:0;border:0;background:none;cursor:default;z-index:2;transition:transform .32s cubic-bezier(.3,.9,.4,1.1)}
.bn-cup svg,.bn-cup img{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 6px rgba(0,0,0,.45));pointer-events:none}
.bn-box.pick .bn-cup{cursor:pointer;animation:bnHint 1.2s infinite ease-in-out}
.bn-box.pick .bn-cup:nth-child(2){animation-delay:.2s}.bn-box.pick .bn-cup:nth-child(3){animation-delay:.4s}
@keyframes bnHint{50%{filter:drop-shadow(0 0 10px rgba(255,210,63,.9))}}
.bn-cup.sel svg,.bn-cup.sel img{filter:drop-shadow(0 0 12px #ffd23f) drop-shadow(0 6px 6px rgba(0,0,0,.45))}
.bn-ban{position:absolute;left:50%;bottom:10%;width:calc(var(--cw)*.62);margin-left:calc(var(--cw)*-.31);text-align:center;font-size:calc(var(--cw)*.46);line-height:1;z-index:1;filter:drop-shadow(0 3px 3px rgba(0,0,0,.5));transition:opacity .2s}
.bn-ban.no{opacity:0}
.bn-ban.gl{animation:bnGlow .5s 4 alternate}
@keyframes bnGlow{to{scale:1.25;filter:drop-shadow(0 0 14px #ffd23f)}}
.bn-ask{position:absolute;left:0;right:0;top:6px;z-index:4;text-align:center;font-weight:700;font-size:14.5px;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none;min-height:1.4em}
.bn-stamp{position:absolute;left:50%;top:66%;transform:translate(-50%,-50%) rotate(-14deg);z-index:6;background:#e3183d;color:#fff;font:400 clamp(16px,5vw,24px) "Titan One",sans-serif;padding:3px 10px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.5);animation:bnBoom .5s cubic-bezier(.2,1.6,.4,1) both}
@keyframes bnBoom{from{transform:translate(-50%,-50%) scale(.3) rotate(-30deg);opacity:0}}
.bn-act{flex:none;width:100%;text-align:center;margin-top:10px}
.bn-spd{display:flex;gap:6px;justify-content:center;margin-bottom:8px}
.bn-s{flex:1;max-width:120px;min-height:48px;border-radius:14px;border:2px solid rgba(255,255,255,.25);background:rgba(20,18,32,.8);color:#f1edf9;font:700 14px/1.1 Quicksand,sans-serif;cursor:pointer;padding:4px 6px}
.bn-s b{display:block;font:400 17px "Titan One",sans-serif;color:#ffd23f}
.bn-s.on{border-color:#ffd23f;background:#3a2a10;box-shadow:0 0 0 2px #ffd23f inset}
.bn-s:disabled{opacity:.4;cursor:default}
.bn-mise{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.bn-pm{width:46px;height:46px;border-radius:50%;border:2px solid #ffd23f;background:rgba(0,0,0,.35);color:#ffd23f;font:700 24px Quicksand,sans-serif;cursor:pointer}
.bn-pm:disabled{opacity:.35;cursor:default}
.bn-amt{min-width:84px;font:400 26px "Titan One",sans-serif;color:#fff;text-shadow:0 2px 0 #0a3f22}
.bn-quick{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:8px}
.bn-q{min-width:46px;min-height:40px;border-radius:999px;border:2px dashed rgba(255,255,255,.7);background:#c8102e;color:#fff;font:700 15px Quicksand,sans-serif;cursor:pointer;box-shadow:0 3px 0 #7a0a1c}
.bn-q:nth-child(2){background:#1f5fd1;box-shadow:0 3px 0 #123b85}.bn-q:nth-child(3){background:#2d2544;box-shadow:0 3px 0 #000}.bn-q:nth-child(4){background:#d9a514;color:#2a1145;box-shadow:0 3px 0 #8a6500}
.bn-q.on{outline:3px solid #fff;outline-offset:1px}
.bn-q:disabled{opacity:.35;cursor:default}
.bn-big{min-height:52px;padding:10px 22px;border-radius:16px;border:0;background:#ffd23f;color:#2a1145;font:400 19px "Titan One",sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8901a;transition:transform .08s,box-shadow .08s}
.bn-big:active{transform:translateY(2px);box-shadow:0 2px 0 #b8901a}
.bn-big:disabled{background:#4a4060;color:#9d93b8;box-shadow:none;cursor:default}
.bn-sub{color:#fff;text-shadow:0 1px 3px #000;font-size:13px;margin-top:6px;font-weight:700}
.bn-mat>.bn-res{position:absolute;z-index:8;left:4%;right:4%;top:8px;background:rgba(33,26,51,.96);box-shadow:0 10px 30px rgba(0,0,0,.5);border:1px solid #3a2f57;border-radius:18px;padding:12px 16px;text-align:center;cursor:pointer;-webkit-user-select:none;user-select:none;animation:bnPop .35s cubic-bezier(.2,1.5,.4,1) both}
.bn-res .t{font:400 24px/1.15 "Titan One",sans-serif;color:#ffd23f}
.bn-res .t.lose{color:#b3a8cc}.bn-res .t.cheat{color:#ff7aa8}
.bn-res .s{color:#d9d1ec;font-size:14.5px;margin-top:4px}
@keyframes bnPop{from{transform:scale(.6);opacity:0}}
.bn-flash{animation:bnRed .25s 4 alternate}@keyframes bnRed{to{box-shadow:inset 0 0 120px rgba(227,24,61,.85)}}
.bn-panel{position:absolute;top:0;left:0;bottom:0;z-index:30;width:min(400px,100%);overflow-y:auto;overscroll-behavior:contain;background:#1a1429;border-right:1px solid #3a2f57;
 padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s;visibility:hidden}
.bn-panel.open{transform:none;visibility:visible}
.bn-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.bn-panel h3{font:400 19px "Titan One",sans-serif;color:#ffd23f;margin:14px 0 6px}
.bn-ph h3{margin:0}
.bn-panel p,.bn-panel li{color:#c9c0de;font-size:14px}
.bn-panel p{margin:4px 0}
.bn-panel ul.r{margin:4px 0;padding-left:18px}
.bn-hist{list-style:none;margin:0;padding:0;font-size:14px}
.bn-hist li{padding:5px 0;border-bottom:1px solid #2e2546}
.bn-hist:empty::after{content:"Aucune partie pour l'instant.";color:#a79fc0}
.bn-adm label{display:block;margin:10px 0 4px;font-weight:700;font-size:14px}
.bn-adm select{width:100%;min-height:44px;font:16px Quicksand,sans-serif;border-radius:10px;border:1px solid #4a3a78;background:#15111f;color:#f1edf9;padding:0 10px}
.bn-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.bn-btns button{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid #4a3a78;background:#2c2148;color:#f1edf9;font:700 14px Quicksand,sans-serif;cursor:pointer}
.bn-btns button.on{background:#ffd23f;color:#2a1145;border-color:#ffd23f}
.bn-toast{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));z-index:40;transform:translate(-50%,12px);background:#2c2148;border:1px solid #ffd23f;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;max-width:92%;transition:transform .3s,opacity .3s;pointer-events:none;opacity:0}
.bn-toast.on{transform:translate(-50%,0);opacity:1}
@media(max-height:700px){.bn-quick{display:none}.bn-s{min-height:42px}.bn-mise{margin-bottom:6px}.bn-logo{height:54px}.bn-logoT{font-size:26px}.bn-top{gap:3px}}
@media(prefers-reduced-motion:reduce){.bn-monk.wob,.bn-monkE.wob,.bn-res,.bn-flash,.bn-box.pick .bn-cup,.bn-ban.gl,.bn-stamp,`;

/* ---------- état ---------- */
let root=null,USER=null,ADMIN=false,S=null,busy=false,picking=false,bet=5,speed="fast",skew=0;
const slot=[0,1,2];   // slot[noix] = place (0 gauche, 1 milieu, 2 droite)
const $=s=>root.querySelector(s);
function take(info){if(!info)return;S=info;try{if(window.MF_APPLY&&info.state)window.MF_APPLY(info.state);}catch(e){}}
try{const b=+localStorage.getItem("mf_bon_bet");if(b>0)bet=b;const v=localStorage.getItem("mf_bon_speed");if(v&&SPN[v])speed=v;}catch(e){}
const X_=k=>{const v=S&&S.speeds&&S.speeds[k];return v?+v.x:{slow:1.5,fast:2,turbo:3}[k];};
const payOf=(b,k)=>Math.ceil(X_(k)*b);

/* ---------- sons ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==="suspended")AC.resume().catch(()=>{});return AC;}
function beep(f,t0,dur,vol,type){const a=AC;if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type||"square";o.frequency.value=f;g.gain.setValueAtTime(vol,a.currentTime+t0);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t0+dur);o.connect(g).connect(a.destination);o.start(a.currentTime+t0);o.stop(a.currentTime+t0+dur+.02);}catch(e){}}
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};
const knock=()=>{beep(160,0,.07,.07,"triangle");beep(110,.02,.08,.05,"sine");vib(6);};
const swish=()=>{beep(700,0,.06,.025,"triangle");beep(500,.03,.06,.02,"triangle");};
const win=big=>{[523,659,784,1047].concat(big?[1319,1568,2093]:[]).forEach((f,i)=>beep(f,i*.09,.18,.06,"triangle"));vib(big?[60,40,60,40,160]:40);};
const sad=()=>{[392,330,262].forEach((f,i)=>beep(f,i*.14,.22,.05,"sawtooth"));vib(80);};

/* ---------- noix de coco ---------- */
const cups=()=>[...root.querySelectorAll(".bn-cup")];
const cupAt=s=>cups()[slot.indexOf(s)];
function sp(){const b=$(".bn-box"),c=cups()[0];return Math.min(b.clientWidth/3,c.offsetWidth*1.3);}
const X=s=>(s-1)*sp();
const liftH=()=>cups()[0].offsetHeight*.72;
function place(i,lift){const e=cups()[i];e.style.transform=`translate(${X(slot[i])}px,${lift?-liftH():0}px)`;}
function placeAll(){cups().forEach((e,i)=>{e.style.transition="none";place(i,false);void e.offsetWidth;e.style.transition="";});}
function lift(s,up){const i=slot.indexOf(s);place(i,up);if(up)swish();else knock();}
function banAt(s,show){const b=$(".bn-ban");b.style.transform=`translateX(${X(s)}px)`;b.classList.toggle("no",!show);b.classList.remove("gl");}
function swap(a,b,dur){
 const ia=slot.indexOf(a),ib=slot.indexOf(b),ea=cups()[ia],eb=cups()[ib],xa=X(a),xb=X(b),h=cups()[0].offsetHeight;
 slot[ia]=b;slot[ib]=a;
 if(!ea.animate){place(ia,false);place(ib,false);return Promise.resolve();}
 const go=(e,x0,x1,dy,z)=>{e.style.transition="none";e.style.zIndex=z;
  const an=e.animate([{transform:`translate(${x0}px,0)`},{transform:`translate(${(x0+x1)/2}px,${dy}px) scale(${dy<0?1.06:.94})`},{transform:`translate(${x1}px,0)`}],{duration:dur,easing:"ease-in-out",fill:"forwards"});
  return an.finished.then(()=>{e.style.transform=`translate(${x1}px,0)`;an.cancel();e.style.zIndex="";e.style.transition="";});};
 swish();
 return Promise.all([go(ea,xa,xb,-h*.28,3),go(eb,xb,xa,h*.12,2)]);}

/* ---------- le singe ---------- */
let sayT=0;
function say(t,ms){const e=$(".bn-say");e.textContent=t;e.classList.add("on");clearTimeout(sayT);sayT=setTimeout(()=>e.classList.remove("on"),ms||2600);}
function wob(){const m=$(".bn-monk:not([hidden])")||$(".bn-monkE");m.classList.remove("wob");void m.offsetWidth;m.classList.add("wob");}
let triche=false;   // l'image « singe avec la banane » de Kévin est-elle là ?

/* ---------- affichage ---------- */
const hhmm=ms=>{const m=Math.max(0,Math.round(ms/60000));return `${Math.floor(m/60)} h ${String(m%60).padStart(2,"0")}`;};
function clampBet(){if(!S)return;bet=Math.max(+S.min||1,Math.min(+S.maxBet||20,bet));}
function ask(t){$(".bn-ask").textContent=t||"";}
function render(){if(!root)return;
 const st=S&&S.state;$("#bnBan").textContent=st?st.bananas:"…";$("#bnBoo").textContent=st?st.stock:"…";
 if(!S)return;clampBet();
 const ban=st?+st.bananas:0,inGame=!!S.game;
 $("#bnBetBox").style.visibility=inGame||picking?"hidden":"";
 $("#bnAmt").textContent=`${bet} 🍌`;
 const fixed=+S.min===+S.maxBet;root.querySelector(".bn-mise").hidden=fixed;root.querySelector(".bn-quick").hidden=fixed;
 $("#bnLim").textContent=`${S.max} parties par jour, `+(fixed?`mise de ${S.min} 🍌.`:`mise de ${S.min} à ${S.maxBet} 🍌.`);
 $("#bnMinus").disabled=busy||bet<=+S.min;$("#bnPlus").disabled=busy||bet>=+S.maxBet;
 root.querySelectorAll(".bn-q").forEach(q=>{const v=+q.dataset.v;q.disabled=busy||v>+S.maxBet;q.classList.toggle("on",v===bet);});
 const d=$("#bnGo");d.disabled=busy||+S.left<=0||ban<bet;
 d.textContent=+S.left<=0?"Plus de parties aujourd'hui":ban<bet?"Pas assez de bananes":`Jouer · ${bet} 🍌`;
 root.querySelectorAll(".bn-s").forEach(e=>{const k=e.dataset.k;e.disabled=busy;e.classList.toggle("on",k===speed);e.setAttribute("aria-pressed",String(k===speed));e.querySelector("b").textContent=fx(X_(k));});
 const gs=inGame&&S.game.speed||speed;
 $("#bnSub").textContent=inGame?`Mise : ${S.game.bet} 🍌 · ${SPN[gs]||""} · trouvée = ${payOf(+S.game.bet,gs)} 🍌`:`Parties : ${S.left}/${S.max}`+(+S.left<=0?` · Nouvelles parties dans ${hhmm(+S.nextDay-(Date.now()+skew))}`:` · trouvée = ${payOf(bet,speed)} 🍌`);
 $("#bnHist").innerHTML=(S.hist||[]).map(h=>`<li>${esc(h)}</li>`).join("");
 if(ADMIN){const o=$("#bnOpen");o.textContent=S.open?"Cacher aux joueurs":"Ouvrir à tous les joueurs";o.classList.toggle("on",!S.open);
  $("#bnState").textContent=S.open?"Le bonneteau est ouvert à tous les joueurs.":"Le bonneteau est visible par toi seulement.";}}
function show(t,s,cls){const r=$("#bnRes");r.querySelector(".t").textContent=t;r.querySelector(".t").className="t"+(cls?" "+cls:"");r.querySelector(".s").textContent=s||"";r.hidden=false;}
let tt=0;function toast(t){const e=$(".bn-toast");e.textContent=t;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500);}
function setPick(on){picking=on;$(".bn-box").classList.toggle("pick",on);cups().forEach((e,i)=>{e.disabled=!on;e.setAttribute("aria-label",`Noix de coco ${SIDE[slot[i]]}`);});
 if(on)ask("Où est la banane ? Touche une noix de coco.");render();}
function reset(){root.querySelectorAll(".bn-stamp").forEach(e=>e.remove());cups().forEach(e=>e.classList.remove("sel"));$(".bn-hand").classList.remove("on");
 slot[0]=0;slot[1]=1;slot[2]=2;placeAll();banAt(1,false);ask("");}
const err=e=>{busy=false;show("Oups",errText(e),"lose");rpc("mf_bon_status").then(r=>{take(r);if(r.game)setPick(true);else{setPick(false);reset();}render();},()=>{render();});};
const takeForce=()=>{if(!ADMIN)return null;const el=$("#bnF"),v=el.value;el.value="";return v||null;};

/* ---------- une partie ---------- */
async function go(){if(busy||picking||!S||S.game)return;ac();busy=true;$("#bnRes").hidden=true;reset();render();
 try{localStorage.setItem("mf_bon_bet",String(bet));localStorage.setItem("mf_bon_speed",speed);}catch(e){}
 let r;try{r=await rpc("mf_bon_start",{p_bet:bet,p_speed:speed,p_force:takeForce()});}catch(e){return err(e);}
 take(r.info);render();const seq=Array.isArray(r.seq)?r.seq:[],ms=Math.max(90,+r.ms||300);
 // la banane sous la noix du milieu…
 banAt(1,true);say(pick(["Regarde bien la banane… 🍌","Facile, hein ? Hé hé.","Ne la quitte pas des yeux !"]),2400);
 lift(1,true);await new Promise(z=>setTimeout(z,1100));lift(1,false);await new Promise(z=>setTimeout(z,450));banAt(1,false);
 // … puis le vrai mélange, échange par échange, tel que le serveur l'a tiré
 if(speed==="turbo"){say("Turbo ! Hop hop hop ! ⚡",1600);wob();}
 for(const p of seq){await swap(+p[0],+p[1],ms);}
 await new Promise(z=>setTimeout(z,200));knock();
 busy=false;setPick(true);
 say(pick(["Alors… laquelle ? 🥥","Prends ton temps, hé hé.","Je parie que tu te trompes."]));}

async function choose(i){if(busy||!picking)return;ac();const s=slot[i];busy=true;setPick(false);ask("");cups()[i].classList.add("sel");knock();
 let r;try{r=await rpc("mf_bon_pick",{p_cup:s});}catch(e){return err(e);}
 await wait(450);
 if(r.out==="win"){banAt(s,true);lift(s,true);await wait(350);$(".bn-ban").classList.add("gl");}
 else{lift(s,true);await wait(700);
  if(r.out==="lose"){banAt(+r.pos,true);lift(+r.pos,true);await wait(300);}
  else{const o=[0,1,2].filter(x=>x!==s);lift(o[0],true);await wait(250);lift(o[1],true);await wait(400);}}
 take(r.info);busy=false;outcome(r,s);render();
 setTimeout(()=>{if(!busy&&!picking&&!S.game){[0,1,2].forEach(x=>lift(x,false));setTimeout(()=>{if(!busy&&!picking)banAt(1,false);},350);}},3200);}

function outcome(r,s){const n=+r.net,b=+r.bet;
 if(r.out==="win"){win(n>=20);show(`Trouvée ! +${n} 🍌`,`La banane était sous la noix ${SIDE[s]} : ta mise de ${b} 🍌 ${fx(X_(r.speed))} (${SPN[r.speed]||""}).`);wob();
  say(pick(["Quoi ?! Tu avais vu ?","Pfff… chance du débutant.","Rends-moi ma banane ! 🍌"]));return;}
 sad();wob();
 if(r.out==="cheat"){
  const sc=$(".bn-scene");sc.classList.remove("bn-flash");void sc.offsetWidth;sc.classList.add("bn-flash");setTimeout(()=>sc.classList.remove("bn-flash"),1100);
  const m=$(".bn-monk");if(triche&&m&&!m.hidden){m.src=IMG.triche;setTimeout(()=>{m.src=m.dataset.base||IMG.singeB;},3500);}else $(".bn-hand").classList.add("on");
  const st=document.createElement("span");st.className="bn-stamp";st.textContent="BANANE ESCAMOTÉE";$(".bn-mat").appendChild(st);
  beep(180,0,.5,.06,"sawtooth");
  show("Arnaqué !",`Les trois noix sont vides : la banane était dans la main du singe. −${b} 🍌`,"cheat");say("Quoi ? Moi, tricher ? Jamais 😇",3200);return;}
 show("Raté…",`La banane était sous la noix ${SIDE[+r.pos]}. −${b} 🍌`,"lose");
 say(pick(["Merci pour les bananes 🍌","Hé hé, la main est plus rapide que l'œil.","Encore une ?","Si près du but… 🐒"]));}

/* ---------- admin ---------- */
async function adm(x,msg){try{const r=await rpc("mf_bon_admin",{p_action:x});take(r);if(x==="reset"){setPick(false);reset();$("#bnRes").hidden=true;}render();if(msg)toast(msg);}catch(e){err(e);}}

/* ---------- construction ---------- */
function build(){
 const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
 root=document.createElement("div");root.id="mfBON";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label",NAME);
 const cup=i=>`<button type="button" class="bn-cup" data-i="${i}" disabled aria-label="Noix de coco ${SIDE[i]}">${NUT}</button>`;
 root.innerHTML=`<div class="bn-top"><button type="button" class="bn-btn l" id="bnTog" aria-controls="bnPanel" aria-expanded="false" aria-label="Règles">?</button>
  <h2 style="margin:0"><img class="bn-logo" src="${IMG.logo}" alt="${NAME}" width="1400" height="467"><span class="bn-logoT" hidden>${NAME}</span></h2>
  <div class="bn-chips"><span class="bn-chip">🍌 <b id="bnBan">…</b></span><span class="bn-chip">Boosters <b id="bnBoo">…</b></span></div>
  <button type="button" class="bn-btn r" id="bnClose" aria-label="Fermer">✕</button></div>
 <div class="bn-scene">
  <div class="bn-dealer"><img class="bn-monk" alt="Le singe du bonneteau"><span class="bn-monkE" hidden role="img" aria-label="Le singe du bonneteau">🐒</span><span class="bn-hand" aria-hidden="true">🍌</span><div class="bn-say" aria-live="polite"></div></div>
  <div class="bn-mat"><div class="bn-tbl" aria-hidden="true"></div><div class="bn-ask" aria-live="polite"></div>
   <div class="bn-box"><span class="bn-ban no" aria-hidden="true">🍌</span>${cup(0)}${cup(1)}${cup(2)}</div>
   <div class="bn-res" id="bnRes" hidden role="status"><div class="t"></div><div class="s"></div></div></div>
  <div class="bn-act">
   <div id="bnBetBox">
    <div class="bn-spd" role="group" aria-label="Vitesse du mélange">${SPEEDS.map(([k,e,n])=>`<button type="button" class="bn-s" data-k="${k}">${e} ${n}<b></b></button>`).join("")}</div>
    <div class="bn-mise"><button type="button" class="bn-pm" id="bnMinus" aria-label="Miser moins">−</button><span class="bn-amt" id="bnAmt" aria-live="polite"></span><button type="button" class="bn-pm" id="bnPlus" aria-label="Miser plus">+</button></div>
    <div class="bn-quick"><button type="button" class="bn-q" data-v="1">1</button><button type="button" class="bn-q" data-v="5">5</button><button type="button" class="bn-q" data-v="10">10</button><button type="button" class="bn-q" data-v="20">20</button></div>
    <button type="button" class="bn-big" id="bnGo"></button>
   </div>
   <div class="bn-sub" id="bnSub"></div>
  </div>
  </div>
 <aside class="bn-panel" id="bnPanel" aria-label="Règles et réglages">
  <div class="bn-ph"><h3>Règles</h3><button type="button" class="bn-btn" style="position:static" id="bnPanelX" aria-label="Fermer les règles">✕</button></div>
  <ul class="r">
   <li>Le singe montre la banane sous la noix du milieu, puis il mélange : suis-la des yeux !</li>
   <li>Choisis la vitesse avant de jouer : 🐢 <b>Lent</b> ×1,5, 🐒 <b>Rapide</b> ×2, ⚡ <b>Turbo</b> ×3. Plus c'est rapide, plus ça rapporte.</li>
   <li>À la fin, touche la noix sous laquelle tu crois qu'est la banane. Trouvée : ta mise multipliée (arrondi au-dessus).</li>
   <li id="bnLim">5 parties par jour, mise de 3 🍌.</li>
   <li>Méfie-toi du singe : même quand tu as bien suivi, il lui arrive de faire disparaître la banane…</li>
  </ul>
  <h3>Dernières parties</h3><ul class="bn-hist" id="bnHist"></ul>
  <div class="bn-adm" id="bnAdm" hidden>
   <h3>Réglages admin</h3>
   <p id="bnState"></p>
   <div class="bn-btns"><button type="button" id="bnOpen"></button></div>
   <label for="bnF">Prochaine partie</label>
   <select id="bnF"><option value="">Au hasard</option><option value="win">Je trouve la banane</option><option value="lose">Je me trompe</option><option value="cheat">Je trouve, mais le singe l'escamote</option></select>
   <div class="bn-btns"><button type="button" id="bnReset">Rendre mes parties du jour</button><button type="button" id="bnAdd">+50 🍌</button></div>
  </div>
 </aside>
 <div class="bn-toast" role="status"></div>`;
 document.body.appendChild(root);
 $("#bnAdm").hidden=!ADMIN;
 // images de Kévin : logo, singe, table, noix. Sans elles : titre en texte, singe de MonkeyJack 21 (ou emoji), tapis dessiné, noix dessinées
 const lg=$(".bn-logo"),noLogo=()=>{lg.hidden=true;$(".bn-logoT").hidden=false;};lg.onerror=noLogo;if(lg.complete&&!lg.naturalWidth)noLogo();
 const mk=$(".bn-monk");let tries=0;
 mk.onload=()=>{if(!mk.dataset.base)mk.dataset.base=mk.getAttribute("src");};
 mk.onerror=()=>{if(mk.dataset.base){mk.src=mk.dataset.base;return;}tries++;if(tries===1){mk.src=IMG.singeB;return;}mk.hidden=true;$(".bn-monkE").hidden=false;};
 mk.src=IMG.singe;
 const tri=new Image();tri.onload=()=>{triche=true;};tri.src=IMG.triche;
 const tb=new Image();tb.onload=()=>{$(".bn-mat").classList.add("img");$(".bn-tbl").style.backgroundImage=`url(${IMG.table})`;};tb.src=IMG.table;
 const nx=new Image();nx.onload=()=>{cups().forEach(c=>{c.innerHTML=`<img src="${IMG.noix}" alt="">`;});};nx.src=IMG.noix;
 $("#bnClose").addEventListener("click",close);
 $("#bnMinus").addEventListener("click",()=>{bet=Math.max(+S.min||1,bet-1);render();});
 $("#bnPlus").addEventListener("click",()=>{bet=Math.min(+S.maxBet||20,bet+1);render();});
 root.querySelectorAll(".bn-q").forEach(q=>q.addEventListener("click",()=>{bet=+q.dataset.v;clampBet();render();}));
 $("#bnGo").addEventListener("click",go);
 root.querySelectorAll(".bn-s").forEach(e=>e.addEventListener("click",()=>{if(busy)return;speed=e.dataset.k;render();}));
 cups().forEach((c,i)=>c.addEventListener("click",()=>choose(i)));
 $("#bnRes").addEventListener("click",()=>{$("#bnRes").hidden=true;});
 $("#bnTog").addEventListener("click",()=>panel(!$("#bnPanel").classList.contains("open")));
 $("#bnPanelX").addEventListener("click",()=>{panel(false);$("#bnTog").focus({preventScroll:true});});
 $("#bnOpen").addEventListener("click",()=>adm(S&&S.open?"close":"open",S&&S.open?"Le bonneteau est de nouveau caché.":`${NAME} est ouvert à tous les joueurs !`));
 $("#bnReset").addEventListener("click",()=>adm("reset","Tes parties du jour sont rendues."));
 $("#bnAdd").addEventListener("click",()=>adm("bananas","+50 🍌 sur ton compte."));
 root.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if($("#bnPanel").classList.contains("open"))panel(false);else close();});
 addEventListener("resize",()=>{if(root.hidden||busy)return;placeAll();const b=$(".bn-ban");if(b.classList.contains("no"))banAt(1,false);});
 setInterval(()=>{if(!root.hidden&&!busy)render();},30000);
}
function panel(o){$("#bnPanel").classList.toggle("open",o);$("#bnTog").setAttribute("aria-expanded",String(o));}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
 if(!root)build();
 root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 $("#bnClose").focus({preventScroll:true});
 if(!busy&&!picking)reset();render();
 try{const r=await rpc("mf_bon_status");if(r.now)skew=+r.now-Date.now();take(r);
  if(r.game&&!picking&&!busy){reset();setPick(true);say("Ta partie t'attend… tu te souviens où elle est ? 😏");}
  else if(!busy&&!picking)say(pick(["Approche, approche… 🥥","Où est la banane ? Où est la banane ?","Trois noix, une banane. Facile !"]));
  render();}catch(e){show("Oups",errText(e),"lose");}
}
function close(){
 if(busy){toast("Le singe mélange encore…");return;}
 panel(false);root.hidden=true;document.body.style.overflow=prevOverflow;if(opener&&opener.focus)opener.focus();
}

/* ---------- démarrage : le jeu s'inscrit au Casino ---------- */
async function boot(){
 if(!window.claude||!window.claude.use)return;
 try{USER=await window.claude.use("user");}catch(e){}
 if(!USER||typeof window.MF_RPC!=="function")return;
 try{ADMIN=!!(await USER.isOwner());}catch(e){}
 let ok=ADMIN;if(!ok){try{ok=!!(await rpc("mf_bon_open"));}catch(e){}}
 if(!ok||!window.MF_CASINO)return;
 window.MF_CASINO.add({id:"bon",name:NAME,order:7,root:"mfBON",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 17a3.5 3.5 0 0 1 7 0z"/><path d="M8.5 17a3.5 3.5 0 0 1 7 0z"/><path d="M15.5 17a3.5 3.5 0 0 1 7 0z"/><path d="M1 20h22"/><path d="M10 9c1.5 1.6 3.5 1.6 5 0" /></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){const r=await rpc("mf_bon_status");if(r.now)skew=+r.now-Date.now();take(r);}const I=S;if(!I)return null;
   if(I.game)return {line:"Une partie est en cours : choisis ta noix de coco !",hot:true};
   if(+I.left>0)return {line:`Encore ${I.left} partie${+I.left>1?"s":""} aujourd'hui · jusqu'à ×3 en turbo`,hot:false};
   return {line:"Plus de parties aujourd'hui",pre:"Nouvelles parties dans ",in:+I.nextDay-(Date.now()+skew),hot:false};}});
}
window.MF_BON={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

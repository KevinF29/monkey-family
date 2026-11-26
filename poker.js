/* Monkey Family — Poker Monkey (vidéo poker 5 cartes du Casino, avec le Joker singe)
   10 mains par jour, mise de 1 à 20 🍌. 5 cartes, on garde celles qu'on veut, on échange les autres une fois.
   Paire de Rois ou mieux. Le Joker singe (53e carte) remplace n'importe quelle carte.
   Le paquet est mélangé et gardé par le serveur (mf_vp_*, supabase-poker.sql) : la page ne voit que ses 5 cartes.
   Visible par l'admin seulement tant que le jeu n'est pas ouvert (réglages admin → « Ouvrir à tous »). */
(function(){
"use strict";

const IMG={logo:"packs/vp-titre.webp",croupier:"packs/bj-croupier.webp",table:"packs/bj-table.webp",fond:"packs/bj-fond.webp",
 dos:"packs/bj-dos.webp",roi:"packs/bj-roi.webp",dame:"packs/bj-dame.webp",valet:"packs/bj-valet.webp",as:"packs/bj-as.webp",joker:"packs/vp-joker.webp"};
const ART={0:"as",10:"valet",11:"dame",12:"roi"};
const RK=["A","2","3","4","5","6","7","8","9","10","V","D","R"],SU=["♠","♥","♦","♣"];
const NAMES=["Rien","Paire de Rois ou d'As","Double paire","Brelan","Quinte","Couleur","Full","Carré","Quinte flush","Quinte flush royale (Joker)","Cinq identiques","Quinte flush royale"];
const SHORT=["","Rois ou mieux","Double paire","Brelan","Quinte","Couleur","Full","Carré","Quinte flush","Royale (Joker)","Cinq identiques","Royale"];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR={no_bananas:"Pas assez de bananes.",vp_limit:"Plus de mains aujourd'hui : reviens demain !",vp_closed:"Le poker n'est pas ouvert en ce moment.",
 vp_in_hand:"Une main est déjà en cours.",vp_no_hand:"Pas de main en cours.",vp_bet:"Mise impossible.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait=ms=>new Promise(r=>setTimeout(r,reduce?Math.min(ms,120):ms));
const cname=c=>{if(c===52)return "Joker singe";const r=c%13;return (r===12?"Roi":r===11?"Dame":r===10?"Valet":r===0?"As":RK[r])+" "+SU[Math.floor(c/13)];};

/* même évaluation que le serveur (_vp_cat), pour afficher la main en cours */
function cat5(p){const cnt=Array(13).fill(0);let fl=true;p.forEach(c=>{cnt[c%13]++;if(Math.floor(c/13)!==Math.floor(p[0]/13))fl=false;});
 let mx=0,pairs=0,trips=false,dist=0,hp=false;cnt.forEach((n,r)=>{if(n)dist++;if(n>mx)mx=n;if(n===2){pairs++;if(r===0||r===12)hp=true;}if(n===3)trips=true;});
 if(mx===5)return 10;let st=false,lo=99;
 if(dist===5){const v=p.map(c=>c%13===0?14:c%13+1);lo=Math.min(...v);st=Math.max(...v)-lo===4||(cnt[0]&&cnt[1]&&cnt[2]&&cnt[3]&&cnt[4]);}
 if(st&&fl)return lo===10?11:8;if(mx===4)return 7;if(trips&&pairs)return 6;if(fl)return 5;if(st)return 4;if(trips)return 3;if(pairs===2)return 2;if(hp)return 1;return 0;}
function cat(h){const j=h.indexOf(52);if(j<0)return cat5(h);const t=h.slice();let best=0;for(let x=0;x<52;x++){t[j]=x;let k=cat5(t);if(k===11)k=9;if(k>best)best=k;}return best;}

/* ---------- style ---------- */
const CSS=`
#mfVP{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;color:#f1edf9;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:#15111f center/cover;background-image:linear-gradient(rgba(16,10,28,.5),rgba(16,10,28,.78)),url(${IMG.fond})}
#mfVP[hidden]{display:none}
#mfVP *{box-sizing:border-box;min-width:0}
#mfVP [hidden]{display:none!important}
#mfVP,#mfVP *{-webkit-tap-highlight-color:transparent}
#mfVP button:focus-visible,#mfVP select:focus-visible{outline:3px solid #8fd3ff;outline-offset:2px}
.vp-top{flex:none;position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;padding:max(8px,env(safe-area-inset-top)) 58px 6px}
.vp-logo{display:block;height:clamp(56px,10svh,120px);width:auto;max-width:100%;filter:drop-shadow(0 8px 12px rgba(0,0,0,.5))}
.vp-logoT{margin:0;font:400 clamp(26px,7vw,38px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 #8a5a00,0 0 16px rgba(0,0,0,.5)}
.vp-btn{position:absolute;top:max(8px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(20,18,32,.75);color:#ffd23f;font:700 19px Quicksand,sans-serif;cursor:pointer;display:grid;place-items:center}
.vp-btn.l{left:10px}.vp-btn.r{right:10px}
.vp-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px}
.vp-chip{background:#211a33;border:1px solid #3a2f57;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13.5px;white-space:nowrap}
.vp-chip b{color:#ffd23f}
.vp-scene{flex:1;min-height:0;width:min(100%,640px);position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 26px max(30px,env(safe-area-inset-bottom))}
.vp-scene>*{position:relative;z-index:1}
.vp-scene>.vp-tbl{position:absolute;inset:0;z-index:0;pointer-events:none;background:#0f5a30;border-style:solid;border-color:transparent;border-width:70px 50px 86px;border-image:url(${IMG.table}) 290 210 360 210 fill stretch}
@media(min-width:500px){.vp-scene>.vp-tbl{border-width:93px 67px 115px}}
@media(min-width:660px){.vp-scene{margin-top:4px}}
.vp-pay{flex:none;width:100%;max-width:520px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(6,auto);grid-auto-flow:column;gap:2px 8px;background:rgba(10,30,18,.72);border:2px solid #d9a514;border-radius:12px;padding:6px 8px;box-shadow:0 4px 12px rgba(0,0,0,.35)}
.vp-pr{display:flex;justify-content:space-between;gap:6px;padding:1px 6px;border-radius:6px;font-size:12.5px;line-height:1.35;font-weight:700;color:#e6f5ea;white-space:nowrap}
.vp-pr span{overflow:hidden;text-overflow:ellipsis}
.vp-pr b{color:#ffd23f;font-weight:700}
.vp-pr.bo b{color:#ff9ce0}
.vp-pr.now{background:rgba(255,210,63,.22);outline:1px solid rgba(255,210,63,.6)}
.vp-pr.won{background:#ffd23f;color:#2a1145;animation:vpBlink .45s 4 alternate}
.vp-pr.won b{color:#2a1145}
@keyframes vpBlink{to{background:#fff2b3}}
.vp-dealer{flex:none;position:relative;display:flex;align-items:flex-end;justify-content:center;width:100%;--mh:clamp(54px,10svh,120px);height:var(--mh)}
.vp-monk{height:100%;width:auto;max-width:60%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,.45))}
.vp-monkE{font-size:calc(var(--mh)*.8);line-height:1}
.vp-say{position:absolute;left:calc(50% + var(--mh)*.5);top:-2px;max-width:min(190px,calc(50% - var(--mh)*.5 - 4px));background:#fff;color:#2a1145;border-radius:14px 14px 14px 4px;padding:6px 10px;font-weight:700;font-size:13px;line-height:1.25;box-shadow:0 4px 10px rgba(0,0,0,.35);opacity:0;transform:scale(.8);transition:opacity .2s,transform .2s;pointer-events:none}
.vp-say.on{opacity:1;transform:none}
.vp-msg{flex:none;min-height:1.6em;font:400 clamp(17px,4.6vw,22px)/1.2 "Titan One",sans-serif;color:#fff;text-shadow:0 2px 0 #0a3f22,0 0 10px rgba(0,0,0,.5);text-align:center}
.vp-msg.win{color:#ffd23f}
.vp-mid{flex:1;min-height:0;width:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px}
.vp-hand{display:flex;justify-content:center;gap:clamp(3px,1.2vw,8px);--cw:clamp(46px,min(15.5vw,12svh),100px);padding-top:10px}
.vp-slot{display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:0;padding:0;color:inherit;font:inherit;cursor:pointer;border-radius:10px}
.vp-slot:disabled{cursor:default}
.vp-card{position:relative;width:var(--cw);height:calc(var(--cw)*4/3);perspective:600px;transition:transform .15s}
.vp-slot.held .vp-card{transform:translateY(-10px)}
.vp-in{position:absolute;inset:0;transition:transform .35s;transform-style:preserve-3d}
.vp-card.back .vp-in{transform:rotateY(180deg)}
.vp-f,.vp-b{position:absolute;inset:0;border-radius:calc(var(--cw)*.1);backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:0 3px 8px rgba(0,0,0,.4)}
.vp-f{background:#fffdf5;border:1px solid #d9d2bd;color:#1d1a24;display:flex;align-items:center;justify-content:center}
.vp-f.red{color:#c8102e}
.vp-f .c{position:absolute;left:6%;top:3%;font:800 calc(var(--cw)*.24)/1 Quicksand,sans-serif;text-align:center}
.vp-f .c i{display:block;font-style:normal;font-size:.85em}
.vp-f .c2{left:auto;top:auto;right:6%;bottom:3%;transform:rotate(180deg)}
.vp-f .m{font-size:calc(var(--cw)*.46);line-height:1}
.vp-f.art{background:#fdf1d6 center/100% 100% no-repeat;border:0}
.vp-f.art .c{left:7%;top:4%;background:rgba(255,250,235,.93);border-radius:5px;padding:2px 2px 1px;box-shadow:0 0 0 1px rgba(201,151,26,.5)}
.vp-f.art .c2{left:auto;top:auto;right:7%;bottom:4%}
.vp-f.jk{background:linear-gradient(160deg,#ffe36e,#ff9f1c 55%,#e3183d);border:2px solid #fff3b0;color:#2a1145}
.vp-f.jk .m{font-size:calc(var(--cw)*.55)}
.vp-f.jk .c{font-size:calc(var(--cw)*.15);letter-spacing:.5px;writing-mode:vertical-rl;text-orientation:upright;line-height:1}
.vp-f.jk.img{background:#fdf1d6 center/100% 100% no-repeat;border:0}
.vp-f.jk.img .m,.vp-f.jk.img .c{display:none}
.vp-b{transform:rotateY(180deg);background:#a3101e url(${IMG.dos}) center/100% 100% no-repeat}
.vp-tag{font:700 11.5px Quicksand,sans-serif;letter-spacing:.5px;padding:1px 6px;border-radius:6px;color:transparent;background:transparent;min-height:1.5em}
.vp-slot.held .vp-tag{color:#2a1145;background:#ffd23f}
.vp-help{font-size:12.5px;font-weight:700;color:#e6f5ea;text-shadow:0 1px 2px #000;min-height:1.3em;text-align:center}
.vp-act{flex:none;width:100%;text-align:center}
.vp-mise{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.vp-pm{width:44px;height:44px;border-radius:50%;border:2px solid #ffd23f;background:rgba(0,0,0,.35);color:#ffd23f;font:700 24px Quicksand,sans-serif;cursor:pointer}
.vp-pm:disabled{opacity:.35;cursor:default}
.vp-amt{min-width:84px;font:400 26px "Titan One",sans-serif;color:#fff;text-shadow:0 2px 0 #0a3f22}
.vp-quick{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:8px}
.vp-q{min-width:46px;min-height:40px;border-radius:999px;border:2px dashed rgba(255,255,255,.7);background:#c8102e;color:#fff;font:700 15px Quicksand,sans-serif;cursor:pointer;box-shadow:0 3px 0 #7a0a1c}
.vp-q:nth-child(2){background:#1f5fd1;box-shadow:0 3px 0 #123b85}.vp-q:nth-child(3){background:#2d2544;box-shadow:0 3px 0 #000}.vp-q:nth-child(4){background:#d9a514;color:#2a1145;box-shadow:0 3px 0 #8a6500}
.vp-q.on{outline:3px solid #fff;outline-offset:1px}
.vp-q:disabled{opacity:.35;cursor:default}
.vp-big{min-height:52px;padding:10px 22px;border-radius:16px;border:0;background:#ffd23f;color:#2a1145;font:400 19px "Titan One",sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8901a;transition:transform .08s,box-shadow .08s}
.vp-big:active{transform:translateY(2px);box-shadow:0 2px 0 #b8901a}
.vp-big:disabled{background:#4a4060;color:#9d93b8;box-shadow:none;cursor:default}
.vp-big.p{background:#ff7aa8;box-shadow:0 4px 0 #a8305c}
.vp-sub{color:#fff;text-shadow:0 1px 3px #000;font-size:13px;margin-top:6px;font-weight:700}
.vp-mk{position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:radial-gradient(circle at 50% 45%,rgba(255,210,63,.6),rgba(21,17,31,.94) 70%);cursor:pointer;animation:vpFade .25s}
.vp-mkT{font:400 clamp(30px,9vw,52px)/1.05 "Titan One",sans-serif;text-align:center;color:#ffd23f;transform:rotate(-4deg);text-shadow:0 4px 0 #8a5a00,0 0 24px rgba(0,0,0,.6);animation:vpBoom .6s cubic-bezier(.2,1.6,.4,1) both;padding:0 12px}
.vp-mkS{font-weight:700;font-size:17px;text-shadow:0 1px 3px #000;text-align:center;padding:0 16px}
.vp-mkE{font-size:clamp(64px,18vw,110px);animation:vpWob .35s infinite alternate ease-in-out}
@keyframes vpBoom{from{transform:scale(.3) rotate(-20deg);opacity:0}}
@keyframes vpWob{from{transform:rotate(-8deg)}to{transform:rotate(8deg) scale(1.05)}}
@keyframes vpFade{from{opacity:0}}
.vp-panel{position:absolute;top:0;left:0;bottom:0;z-index:30;width:min(400px,100%);overflow-y:auto;overscroll-behavior:contain;background:#1a1429;border-right:1px solid #3a2f57;
 padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s;visibility:hidden}
.vp-panel.open{transform:none;visibility:visible}
.vp-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.vp-panel h3{font:400 19px "Titan One",sans-serif;color:#ffd23f;margin:14px 0 6px}
.vp-ph h3{margin:0}
.vp-panel p,.vp-panel li{color:#c9c0de;font-size:14px}
.vp-panel p{margin:4px 0}
.vp-panel ul.r{margin:4px 0;padding-left:18px}
.vp-hist{list-style:none;margin:0;padding:0;font-size:14px}
.vp-hist li{padding:5px 0;border-bottom:1px solid #2e2546}
.vp-hist:empty::after{content:"Aucune main pour l'instant.";color:#a79fc0}
.vp-adm label{display:block;margin:10px 0 4px;font-weight:700;font-size:14px}
.vp-adm select{width:100%;min-height:44px;font:16px Quicksand,sans-serif;border-radius:10px;border:1px solid #4a3a78;background:#15111f;color:#f1edf9;padding:0 10px}
.vp-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.vp-btns button{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid #4a3a78;background:#2c2148;color:#f1edf9;font:700 14px Quicksand,sans-serif;cursor:pointer}
.vp-btns button.on{background:#ffd23f;color:#2a1145;border-color:#ffd23f}
.vp-toast{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));z-index:40;transform:translate(-50%,12px);background:#2c2148;border:1px solid #ffd23f;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;max-width:92%;transition:transform .3s,opacity .3s;pointer-events:none;opacity:0}
.vp-toast.on{transform:translate(-50%,0);opacity:1}
@media(max-height:760px){.vp-dealer{display:none}}
@media(max-height:700px){.vp-quick{display:none}.vp-logo{height:52px}.vp-logoT{font-size:26px}.vp-top{gap:3px}.vp-pr{font-size:11.5px;line-height:1.25}}
@media(prefers-reduced-motion:reduce){.vp-mkT,.vp-mkE,.vp-pr.won{animation:none}.vp-in,.vp-say,.vp-toast,.vp-panel,.vp-card{transition:none}}
`;

/* ---------- état ---------- */
let root=null,USER=null,ADMIN=false,S=null,busy=false,bet=5,skew=0;
let C=[],held=[false,false,false,false,false],phase="bet";   // phase : bet (choix de la mise) | hold (choix des cartes) | done
const $=s=>root.querySelector(s);
function take(info){if(!info)return;S=info;try{if(window.MF_APPLY&&info.state)window.MF_APPLY(info.state);}catch(e){}}
try{const b=+localStorage.getItem("mf_vp_bet");if(b>0)bet=b;}catch(e){}

/* ---------- sons ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==="suspended")AC.resume().catch(()=>{});return AC;}
function beep(f,t0,dur,vol,type){const a=AC;if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type||"square";o.frequency.value=f;g.gain.setValueAtTime(vol,a.currentTime+t0);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t0+dur);o.connect(g).connect(a.destination);o.start(a.currentTime+t0);o.stop(a.currentTime+t0+dur+.02);}catch(e){}}
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};
const flick=()=>{beep(2400,0,.03,.03,"triangle");beep(1300,.02,.04,.03,"triangle");vib(5);};
const tick=()=>{beep(880,0,.05,.04,"triangle");vib(8);};
const win=big=>{[523,659,784,1047].concat(big?[1319,1568,2093]:[]).forEach((f,i)=>beep(f,i*.09,.18,.06,"triangle"));vib(big?[60,40,60,40,160]:40);};
const sad=()=>{[392,330,262].forEach((f,i)=>beep(f,i*.14,.22,.05,"sawtooth"));vib(60);};

/* ---------- cartes ---------- */
function slotEl(i){const b=document.createElement("button");b.type="button";b.className="vp-slot";b.dataset.i=i;
 b.innerHTML=`<div class="vp-card back"><div class="vp-in"><div class="vp-f"></div><div class="vp-b" aria-hidden="true"></div></div></div><span class="vp-tag">GARDÉE</span>`;
 b.addEventListener("click",()=>toggle(i));return b;}
let jokerOK=null;
function face(slot,c){const e=slot.querySelector(".vp-card"),f=e.querySelector(".vp-f");f.style.backgroundImage="";
 if(c===52){f.className="vp-f jk"+(jokerOK?" img":"");if(jokerOK)f.style.backgroundImage=`url(${IMG.joker})`;f.innerHTML=`<span class="c">JOKER</span><span class="m">🐒</span><span class="c c2">JOKER</span>`;}
 else{const r=c%13,s=Math.floor(c/13),k=RK[r],u=SU[s],art=ART[r];
  f.className="vp-f"+(s===1||s===2?" red":"")+(art?" art":"");if(art)f.style.backgroundImage=`url(${IMG[art]})`;
  f.innerHTML=`<span class="c">${k}<i>${u}</i></span><span class="m">${art?"":u}</span><span class="c c2">${k}<i>${u}</i></span>`;}
 slot.setAttribute("aria-label",cname(c));}
const slots=()=>[...root.querySelectorAll(".vp-slot")];
async function reveal(i,c){const s=slots()[i],e=s.querySelector(".vp-card");face(s,c);await wait(30);e.classList.remove("back");flick();}
function hide(i){slots()[i].querySelector(".vp-card").classList.add("back");}

/* ---------- le singe parle ---------- */
let sayT=0;
function say(t,ms){const e=$(".vp-say");e.textContent=t;e.classList.add("on");clearTimeout(sayT);sayT=setTimeout(()=>e.classList.remove("on"),ms||2600);}
const pick=a=>a[Math.floor(Math.random()*a.length)];

/* ---------- affichage ---------- */
const hhmm=ms=>{const m=Math.max(0,Math.round(ms/60000));return `${Math.floor(m/60)} h ${String(m%60).padStart(2,"0")}`;};
function clampBet(){if(!S)return;bet=Math.max(+S.min||1,Math.min(+S.maxBet||20,bet));}
function payRows(){if(!S)return;const p=S.pays||[0,1,1,2,3,5,7,20,50,100,200,250],b=phase==="bet"?bet:(S.hand?+S.hand.bet:bet);
 const order=[11,10,9,8,7,6,5,4,3,2,1];   // du plus gros au plus petit, en 2 colonnes
 const bo=S.boosters||{};
 $(".vp-pay").innerHTML=order.map(k=>`<div class="vp-pr${bo[k]?" bo":""}" data-k="${k}"><span>${SHORT[k]}</span><b>${bo[k]?"🎁 "+esc(bo[k]):(p[k]*b).toLocaleString("fr-FR")}</b></div>`).join("");}
function mark(k,cls){root.querySelectorAll(".vp-pr").forEach(r=>{r.classList.remove("now","won");if(k>0&&+r.dataset.k===k)r.classList.add(cls);});}
function render(){if(!root)return;
 const st=S&&S.state;$("#vpBan").textContent=st?st.bananas:"…";$("#vpBoo").textContent=st?st.stock:"…";
 if(!S)return;clampBet();const ban=st?+st.bananas:0;
 $("#vpBetBox").hidden=phase==="hold";$("#vpPlay").hidden=phase!=="hold";
 $("#vpAmt").textContent=`${bet} 🍌`;
 $("#vpMinus").disabled=busy||bet<=+S.min;$("#vpPlus").disabled=busy||bet>=+S.maxBet;
 root.querySelectorAll(".vp-q").forEach(q=>{const v=+q.dataset.v;q.disabled=busy||v>+S.maxBet;q.classList.toggle("on",v===bet);});
 const d=$("#vpDeal");d.disabled=busy||+S.left<=0||ban<bet;
 d.textContent=+S.left<=0?"Plus de mains aujourd'hui":ban<bet?"Pas assez de bananes":`Distribuer · ${bet} 🍌`;
 $("#vpSub").textContent=`Mains : ${S.left}/${S.max}`+(+S.left<=0?` · Nouvelles mains dans ${hhmm(+S.nextDay-(Date.now()+skew))}`:"");
 const n=held.filter(Boolean).length,dr=$("#vpDraw");dr.disabled=busy;
 dr.textContent=n===5?"Garder les 5 cartes":n===0?"Tout échanger":`Échanger ${5-n} carte${5-n>1?"s":""}`;
 slots().forEach((s,i)=>{s.disabled=busy||phase!=="hold";s.classList.toggle("held",phase==="hold"&&held[i]);s.setAttribute("aria-pressed",String(phase==="hold"&&held[i]));});
 $("#vpHelp").textContent=phase==="hold"?"Touche les cartes à garder, puis échange.":"";
 $("#vpHist").innerHTML=(S.hist||[]).map(h=>`<li>${esc(h)}</li>`).join("");
 if(ADMIN){const o=$("#vpOpen");o.textContent=S.open?"Cacher aux joueurs":"Ouvrir à tous les joueurs";o.classList.toggle("on",!S.open);
  $("#vpState").textContent=S.open?"Le poker est ouvert aux joueurs (s'il est dans les jeux de la semaine).":"Le poker est visible par toi seulement.";}}
function msg(t,w){const m=$(".vp-msg");m.textContent=t;m.classList.toggle("win",!!w);}
let tt=0;function toast(t){const e=$(".vp-toast");e.textContent=t;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500);}
function showHand(h){C=h.c.slice();held=[false,false,false,false,false];phase="hold";
 C.forEach((c,i)=>{face(slots()[i],c);slots()[i].querySelector(".vp-card").classList.remove("back");});
 const k=cat(C);payRows();mark(k,"now");msg(k?`Tu as : ${NAMES[k]}`:"Choisis tes cartes",k>0);}
const err=e=>{busy=false;toast(errText(e));msg("Oups : "+errText(e));render();
 rpc("mf_vp_status").then(r=>{take(r);if(r.hand)showHand(r.hand);else if(phase==="hold"){phase="bet";payRows();}render();},()=>{});};
const takeForce=()=>{if(!ADMIN)return null;const el=$("#vpF"),v=el.value;el.value="";return v||null;};

/* ---------- une main ---------- */
async function deal(){if(busy||!S||phase==="hold")return;ac();busy=true;
 try{localStorage.setItem("mf_vp_bet",String(bet));}catch(e){}
 slots().forEach((s,i)=>hide(i));mark(0);msg("");render();
 let r;try{r=await rpc("mf_vp_deal",{p_bet:bet,p_force:takeForce()});}catch(e){return err(e);}
 take(r.info);const h=r.info.hand;C=h.c.slice();held=[false,false,false,false,false];phase="hold";payRows();
 await wait(250);for(let i=0;i<5;i++){await reveal(i,C[i]);await wait(140);}
 const k=cat(C);mark(k,"now");msg(k?`Tu as : ${NAMES[k]}`:"Choisis tes cartes",k>0);
 if(C.includes(52))say(pick(["Oh, le Joker ! C'est mon cousin 🐒","Le Joker est avec toi…","Hé hé, mon portrait !"]));
 else if(k>=3)say(pick(["Hmm… pas mal.","Je n'aime pas ce sourire."]));
 busy=false;render();}
function toggle(i){if(busy||phase!=="hold")return;ac();held[i]=!held[i];tick();render();}
async function draw(){if(busy||phase!=="hold")return;ac();busy=true;render();
 const keep=held.map((h,i)=>h?i:-1).filter(i=>i>=0);
 let r;try{r=await rpc("mf_vp_draw",{p_hold:keep});}catch(e){return err(e);}
 for(let i=0;i<5;i++)if(!held[i])hide(i);
 await wait(380);
 for(let i=0;i<5;i++)if(!held[i]){await reveal(i,r.c[i]);await wait(160);}
 C=r.c.slice();phase="done";take(r.info);busy=false;outcome(r);render();}
function outcome(r){const k=+r.cat,n=+r.net,b=+r.bet;
 mark(k,"won");
 if(r.booster){msg(`${NAMES[k]} ! Booster ${r.booster} 🎁`,true);win(true);big(k,r);return;}
 if(k===0){sad();msg(`Rien… −${b} 🍌`);say(pick(["Merci pour les bananes 🍌","Hé hé, encore une ?","Le singe gagne toujours."]));return;}
 if(n===0){msg(`${NAMES[k]} : mise rendue`,true);say("Tu récupères ta mise. Pfff.");win(false);return;}
 msg(`${NAMES[k]} ! +${n} 🍌`,true);win(k>=7);
 if(k>=7)big(k,r);else say(pick(["Grrr… bien joué.","Chance du débutant !","Pas mal, pas mal…"]));}
function big(k,r){const o=$(".vp-mk");$("#vpMkT").textContent=NAMES[k].toUpperCase()+" !";
 $("#vpMkS").textContent=(r.booster?`Booster ${r.booster} gagné 🎁 (et ta mise rendue) : il t'attend avec tes boosters`:`Ta mise ×${r.mult} : +${r.net} 🍌`)+(r.c.includes(52)&&k<9?" · merci le Joker 🐒":"");
 o.hidden=false;setTimeout(()=>win(true),700);const end=()=>{o.hidden=true;o.onclick=null;clearTimeout(t);};const t=setTimeout(end,4200);setTimeout(()=>{o.onclick=end;},800);
 say("Mes bananes !! 😱",3500);}

/* ---------- admin ---------- */
async function adm(x,m){try{const r=await rpc("mf_vp_admin",{p_action:x});take(r);if(x==="reset"){phase="bet";slots().forEach((s,i)=>hide(i));mark(0);msg("");payRows();}render();if(m)toast(m);}catch(e){err(e);}}

/* ---------- construction ---------- */
function build(){
 const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
 root=document.createElement("div");root.id="mfVP";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Poker Monkey");
 root.innerHTML=`<div class="vp-top"><button type="button" class="vp-btn l" id="vpTog" aria-controls="vpPanel" aria-expanded="false" aria-label="Règles">?</button>
  <h2 style="margin:0"><img class="vp-logo" src="${IMG.logo}" alt="Poker Monkey"><span class="vp-logoT" hidden>Poker Monkey</span></h2>
  <div class="vp-chips"><span class="vp-chip">🍌 <b id="vpBan">…</b></span><span class="vp-chip">Boosters <b id="vpBoo">…</b></span></div>
  <button type="button" class="vp-btn r" id="vpClose" aria-label="Fermer">✕</button></div>
 <div class="vp-scene"><div class="vp-tbl" aria-hidden="true"></div>
  <div class="vp-pay" aria-label="Table des gains"></div>
  <div class="vp-dealer"><img class="vp-monk" src="${IMG.croupier}" alt="Le singe croupier"><span class="vp-monkE" hidden role="img" aria-label="Le singe croupier">🐒</span><div class="vp-say" aria-live="polite"></div></div>
  <div class="vp-mid">
   <div class="vp-msg" aria-live="polite"></div>
   <div class="vp-hand" role="group" aria-label="Tes cartes"></div>
   <div class="vp-help" id="vpHelp"></div>
  </div>
  <div class="vp-act">
   <div id="vpBetBox">
    <div class="vp-mise"><button type="button" class="vp-pm" id="vpMinus" aria-label="Miser moins">−</button><span class="vp-amt" id="vpAmt" aria-live="polite"></span><button type="button" class="vp-pm" id="vpPlus" aria-label="Miser plus">+</button></div>
    <div class="vp-quick"><button type="button" class="vp-q" data-v="1">1</button><button type="button" class="vp-q" data-v="5">5</button><button type="button" class="vp-q" data-v="10">10</button><button type="button" class="vp-q" data-v="20">20</button></div>
    <button type="button" class="vp-big" id="vpDeal"></button>
   </div>
   <div id="vpPlay" hidden><button type="button" class="vp-big p" id="vpDraw"></button></div>
   <div class="vp-sub" id="vpSub"></div>
  </div>
 </div>
 <aside class="vp-panel" id="vpPanel" aria-label="Règles et réglages">
  <div class="vp-ph"><h3>Règles</h3><button type="button" class="vp-btn" style="position:static" id="vpPanelX" aria-label="Fermer les règles">✕</button></div>
  <ul class="r">
   <li>Tu reçois 5 cartes. Touche celles que tu veux <b>garder</b>, puis <b>échange</b> les autres : une seule fois.</li>
   <li>Ta main finale est payée selon la table : il faut au moins une <b>paire de Rois ou d'As</b>.</li>
   <li>🐒 Le <b>Joker singe</b> remplace n'importe quelle carte pour faire la meilleure main.</li>
   <li>Les chiffres de la table sont ce que tu récupères pour ta mise (mise comprise). Paire de Rois et double paire : ta mise revient.</li>
   <li>🎁 Les plus grosses mains donnent un <b>booster de rareté</b> (1 carte de cette rareté) et te rendent ta mise : quinte flush → Légendaire, royale avec le Joker → Mythique, cinq identiques → Secret, royale sans Joker → Originel. Il t'attend avec tes boosters.</li>
   <li>Cinq identiques : quatre cartes pareilles + le Joker.</li>
   <li>10 mains par jour, mise de 1 à 20 🍌.</li>
  </ul>
  <h3>Dernières mains</h3><ul class="vp-hist" id="vpHist"></ul>
  <div class="vp-adm" id="vpAdm" hidden>
   <h3>Réglages admin</h3>
   <p id="vpState"></p>
   <div class="vp-btns"><button type="button" id="vpOpen"></button></div>
   <label for="vpF">Prochaine donne</label>
   <select id="vpF"><option value="">Au hasard</option><option value="royal">Quinte flush royale servie</option><option value="sf">Quinte flush servie</option><option value="five">Cinq identiques servis (avec Joker)</option><option value="quads">Carré de Rois servi</option><option value="joker">Le Joker dans ma main</option></select>
   <div class="vp-btns"><button type="button" id="vpReset">Rendre mes mains du jour</button><button type="button" id="vpAdd">+50 🍌</button></div>
  </div>
 </aside>
 <div class="vp-mk" hidden aria-live="assertive"><div class="vp-mkE" aria-hidden="true">🐒</div><div class="vp-mkT" id="vpMkT"></div><div class="vp-mkS" id="vpMkS"></div></div>
 <div class="vp-toast" role="status"></div>`;
 document.body.appendChild(root);
 $("#vpAdm").hidden=!ADMIN;
 const hand=$(".vp-hand");for(let i=0;i<5;i++)hand.appendChild(slotEl(i));
 const lg=$(".vp-logo"),noLogo=()=>{lg.hidden=true;$(".vp-logoT").hidden=false;};lg.onerror=noLogo;if(lg.complete&&!lg.naturalWidth)noLogo();
 const mk=$(".vp-monk"),noMonk=()=>{mk.hidden=true;$(".vp-monkE").hidden=false;};mk.onerror=noMonk;if(mk.complete&&!mk.naturalWidth)noMonk();
 const j=new Image();j.onload=()=>{jokerOK=true;root.querySelectorAll(".vp-f.jk").forEach(f=>{f.classList.add("img");f.style.backgroundImage=`url(${IMG.joker})`;});};j.onerror=()=>{jokerOK=false;};j.src=IMG.joker;
 $("#vpClose").addEventListener("click",close);
 $("#vpMinus").addEventListener("click",()=>{bet=Math.max(+S.min||1,bet-1);payRows();render();});
 $("#vpPlus").addEventListener("click",()=>{bet=Math.min(+S.maxBet||20,bet+1);payRows();render();});
 root.querySelectorAll(".vp-q").forEach(q=>q.addEventListener("click",()=>{bet=+q.dataset.v;clampBet();payRows();render();}));
 $("#vpDeal").addEventListener("click",deal);
 $("#vpDraw").addEventListener("click",draw);
 $("#vpTog").addEventListener("click",()=>panel(!$("#vpPanel").classList.contains("open")));
 $("#vpPanelX").addEventListener("click",()=>{panel(false);$("#vpTog").focus({preventScroll:true});});
 $("#vpOpen").addEventListener("click",()=>adm(S&&S.open?"close":"open",S&&S.open?"Le poker est de nouveau caché.":"Poker Monkey est ouvert (selon la rotation du Casino)."));
 $("#vpReset").addEventListener("click",()=>adm("reset","Tes mains du jour sont rendues."));
 $("#vpAdd").addEventListener("click",()=>adm("bananas","+50 🍌 sur ton compte."));
 root.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!$(".vp-mk").hidden){$(".vp-mk").click();return;}if($("#vpPanel").classList.contains("open"))panel(false);else close();});
 setInterval(()=>{if(!root.hidden&&!busy)render();},30000);
}
function panel(o){$("#vpPanel").classList.toggle("open",o);$("#vpTog").setAttribute("aria-expanded",String(o));}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
 if(!root)build();
 if(!root.hidden)return;
 root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 $("#vpClose").focus({preventScroll:true});render();
 try{const r=await rpc("mf_vp_status");if(r.now)skew=+r.now-Date.now();take(r);
  if(r.hand)showHand(r.hand);else{if(phase==="hold")phase="bet";payRows();if(phase==="bet")say(pick(["Approche, approche… 🃏","Une petite main ?","Le Joker t'attend peut-être…"]));}
  render();}catch(e){msg(errText(e));}
}
function close(){
 if(busy){toast("Le singe distribue encore…");return;}
 panel(false);root.hidden=true;document.body.style.overflow=prevOverflow;if(opener&&opener.focus)opener.focus();
}

/* ---------- démarrage : le jeu s'inscrit au Casino ---------- */
async function boot(){
 if(!window.claude||!window.claude.use)return;
 try{USER=await window.claude.use("user");}catch(e){}
 if(!USER||typeof window.MF_RPC!=="function")return;
 try{ADMIN=!!(await USER.isOwner());}catch(e){}
 let ok=ADMIN;if(!ok){try{ok=!!(await rpc("mf_vp_open"));}catch(e){}}
 if(!ok||!window.MF_CASINO)return;
 Object.values(IMG).forEach(u=>{const i=new Image();i.src=u;});
 window.MF_CASINO.add({id:"vp",name:"Poker Monkey",order:8,root:"mfVP",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="6" height="10" rx="1.2"/><rect x="9" y="5" width="6" height="10" rx="1.2"/><rect x="16" y="7" width="6" height="10" rx="1.2"/><path d="M12 8.5l1 1.8-1 1.8-1-1.8z"/></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){const r=await rpc("mf_vp_status");if(r.now)skew=+r.now-Date.now();take(r);}const I=S;if(!I)return null;
   if(I.hand)return {line:"Une main t'attend : choisis tes cartes !",hot:true};
   if(+I.left>0)return {line:`Encore ${I.left} main${+I.left>1?"s":""} aujourd'hui · mise jusqu'à ${I.maxBet} 🍌`,hot:false};
   return {line:"Plus de mains aujourd'hui",pre:"Nouvelles mains dans ",in:+I.nextDay-(Date.now()+skew),hot:false};}});
}
window.MF_VP={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

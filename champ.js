/* Monkey Family — Le Champ de Cocos (jeu du Casino façon « Mines » : 25 noix de coco, des serpents cachés dessous)
   Le joueur choisit 3, 4 ou 5 serpents et sa mise, puis ouvre les cocos une par une : chaque coco sans serpent fait monter
   le multiplicateur, on encaisse quand on veut. Serpent = mise perdue. Tour par tour, sans chrono : une partie attend le joueur.
   Les serpents sont placés par le serveur (mf_mine_*, supabase-champ.sql) et ne sont envoyés à la page qu'à la fin.
   Visible par l'admin seulement tant que le jeu n'est pas ouvert à tous (réglages admin → « Ouvrir à tous »). */
(function(){
"use strict";

// images de Kévin (facultatives) : sans elles, fond du Crash Cocotier, noix de coco dessinées, serpent en emoji
const IMG={logo:"packs/champ-titre.webp",fond:"packs/champ-fond.webp",coco:"packs/champ-coco.webp",ouverte:"packs/champ-ouverte.webp",serpent:"packs/champ-serpent.webp",
 fondB:"packs/coco-fond.webp"};
const NAME="Le Champ de Cocos";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR={no_bananas:"Pas assez de bananes.",mine_limit:"Plus de parties aujourd'hui : reviens demain !",mine_closed:"Le Champ de Cocos n'est pas encore ouvert.",
 mine_in_game:"Une partie est déjà en cours.",mine_no_game:"Pas de partie en cours.",mine_bet:"Mise impossible.",mine_snakes:"Nombre de serpents impossible.",
 mine_cell:"Coco inconnue.",mine_opened:"Cette coco est déjà ouverte.",mine_none:"Ouvre au moins une coco avant d'encaisser.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait=ms=>new Promise(r=>setTimeout(r,reduce?Math.min(ms,80):ms));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const fx=x=>"×"+(+x).toFixed(2).replace(/\.00$/,"").replace(/(\.\d)0$/,"$1").replace(".",",");
const pct=x=>Math.round(x*100)+" %";

const NUT=`<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="ccG" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#a8703f"/><stop offset=".55" stop-color="#6e4120"/><stop offset="1" stop-color="#3e2210"/></radialGradient></defs>
<circle cx="50" cy="52" r="42" fill="url(#ccG)"/>
<g stroke="#c89a63" stroke-width="2.2" stroke-linecap="round" opacity=".5" fill="none"><path d="M24 64q2-14 8-24"/><path d="M40 84q-2-14 2-26"/><path d="M70 40q8 8 8 22"/><path d="M60 82q6-10 6-20"/><path d="M30 38q6-8 14-12"/></g>
<g fill="#2a160a"><ellipse cx="42" cy="30" rx="4.5" ry="3.6"/><ellipse cx="58" cy="30" rx="4.5" ry="3.6"/><ellipse cx="50" cy="40" rx="4.5" ry="3.6"/></g></svg>`;
const OPEN=`<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="56" r="38" fill="#4a2a12"/><circle cx="50" cy="56" r="33" fill="#fbf4e2"/><circle cx="50" cy="56" r="25" fill="#f2e6c6"/>
<path d="M14 46l10-8 8 7 9-9 9 8 9-8 9 9 8-7 10 8" fill="none" stroke="#4a2a12" stroke-width="5" stroke-linejoin="round"/></svg>`;

/* ---------- style ---------- */
const CSS=`
#mfCC{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;color:#f1edf9;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:#10231a;background-image:linear-gradient(rgba(8,24,16,.55),rgba(8,20,14,.85)),url(${IMG.fond}),url(${IMG.fondB});background-size:cover;background-position:center}
#mfCC[hidden]{display:none}
#mfCC *{box-sizing:border-box;min-width:0}
#mfCC [hidden]{display:none!important}
#mfCC,#mfCC *{-webkit-tap-highlight-color:transparent}
#mfCC button:focus-visible{outline:3px solid #8fd3ff;outline-offset:2px}
.cc-top{flex:none;position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;padding:max(8px,env(safe-area-inset-top)) 58px 4px}
.cc-logo{display:block;height:clamp(52px,9svh,110px);width:auto;max-width:100%;filter:drop-shadow(0 8px 12px rgba(0,0,0,.5))}
.cc-logoT{margin:0;font:400 clamp(24px,6.6vw,36px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 #6b4a00,0 0 16px rgba(0,0,0,.5);text-align:center}
.cc-btn{position:absolute;top:max(8px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(16,28,22,.8);color:#ffd23f;font:700 19px Quicksand,sans-serif;cursor:pointer;display:grid;place-items:center}
.cc-btn.l{left:10px}.cc-btn.r{right:10px}
.cc-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px}
.cc-chip{background:rgba(18,34,26,.9);border:1px solid #2f5a42;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13.5px;white-space:nowrap}
.cc-chip b{color:#ffd23f}
.cc-main{flex:1;min-height:0;width:min(100%,560px);display:flex;flex-direction:column;align-items:center;padding:4px 12px max(14px,env(safe-area-inset-bottom))}
.cc-meter{flex:none;width:100%;display:flex;align-items:stretch;gap:8px;margin:2px 0 8px}
.cc-m{flex:1;border-radius:14px;padding:5px 8px;text-align:center;background:rgba(18,34,26,.88);border:1px solid #2f5a42}
.cc-m small{display:block;font-size:11.5px;font-weight:700;color:#a9c9b4;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cc-m b{display:block;font:400 clamp(18px,5vw,24px)/1.15 "Titan One",sans-serif;color:#fff}
.cc-m.now b{color:#ffd23f}
.cc-m.now.pulse{animation:ccPulse .45s ease-out}
@keyframes ccPulse{40%{transform:scale(1.08);box-shadow:0 0 18px rgba(255,210,63,.7)}}
.cc-wrap{flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center;container-type:size}
.cc-grid{--S:min(100cqw,100cqh);width:var(--S);height:var(--S);display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(5,1fr);gap:calc(var(--S)*.022);padding:calc(var(--S)*.03);
 border-radius:22px;background:radial-gradient(ellipse at 50% 35%,#3f8a4c,#25653a 60%,#174a29);border:6px solid #6b3f1d;box-shadow:inset 0 0 0 2px #a0682f,inset 0 10px 30px rgba(0,0,0,.4),0 10px 24px rgba(0,0,0,.45)}
.cc-c{position:relative;padding:0;border:0;border-radius:50%;background:none;cursor:default;display:grid;place-items:center;transition:transform .12s}
.cc-c svg,.cc-c img{display:block;width:92%;height:92%;object-fit:contain;filter:drop-shadow(0 4px 4px rgba(0,0,0,.4));pointer-events:none}
.cc-c .e{font-size:calc(var(--S)*.12);line-height:1;filter:drop-shadow(0 3px 4px rgba(0,0,0,.5));pointer-events:none}
.cc-grid.play .cc-c.hid{cursor:pointer}
.cc-grid.play .cc-c.hid:hover{transform:scale(1.06)}
.cc-grid.play .cc-c.hid:active{transform:scale(.94)}
.cc-c.wait{animation:ccShake .35s infinite}
@keyframes ccShake{25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}
.cc-c.safe{animation:ccPop .4s cubic-bezier(.2,1.6,.4,1)}
@keyframes ccPop{from{transform:scale(.4)}}
.cc-c.boom{background:radial-gradient(circle,#e3183d 0,#e3183d55 55%,transparent 70%);animation:ccBoom .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes ccBoom{from{transform:scale(.3) rotate(-30deg)}}
.cc-c.ghost{opacity:.55}
.cc-c.ghost.snk{opacity:.9}
.cc-grid.dead{animation:ccRed .25s 4 alternate}
@keyframes ccRed{to{box-shadow:inset 0 0 0 2px #a0682f,inset 0 0 90px rgba(227,24,61,.9),0 10px 24px rgba(0,0,0,.45)}}
.cc-grid.won{box-shadow:inset 0 0 0 2px #a0682f,inset 0 0 70px rgba(255,210,63,.5),0 0 30px rgba(255,210,63,.45)}
.cc-act{flex:none;width:100%;text-align:center;margin-top:10px}
.cc-snk{display:flex;gap:6px;justify-content:center;margin-bottom:8px}
.cc-s{flex:1;max-width:120px;min-height:48px;border-radius:14px;border:2px solid rgba(255,255,255,.25);background:rgba(16,28,22,.85);color:#f1edf9;font:700 14px/1.1 Quicksand,sans-serif;cursor:pointer;padding:4px 6px}
.cc-s b{display:block;font:400 13px "Titan One",sans-serif;color:#ffd23f;margin-top:2px}
.cc-s.on{border-color:#ffd23f;background:#3a3010;box-shadow:0 0 0 2px #ffd23f inset}
.cc-s:disabled{opacity:.4;cursor:default}
.cc-mise{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.cc-pm{width:44px;height:44px;border-radius:50%;border:2px solid #ffd23f;background:rgba(0,0,0,.35);color:#ffd23f;font:700 24px Quicksand,sans-serif;cursor:pointer}
.cc-pm:disabled{opacity:.35;cursor:default}
.cc-amt{min-width:80px;font:400 24px "Titan One",sans-serif;color:#fff;text-shadow:0 2px 0 #0a3f22}
.cc-q{min-width:42px;min-height:38px;border-radius:999px;border:2px dashed rgba(255,255,255,.7);background:#1f5fd1;color:#fff;font:700 14px Quicksand,sans-serif;cursor:pointer;box-shadow:0 3px 0 #123b85}
.cc-q.on{outline:3px solid #fff;outline-offset:1px}
.cc-big{min-height:52px;min-width:min(100%,260px);padding:10px 22px;border-radius:16px;border:0;background:#ffd23f;color:#2a1145;font:400 19px "Titan One",sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8901a;transition:transform .08s,box-shadow .08s}
.cc-big:active{transform:translateY(2px);box-shadow:0 2px 0 #b8901a}
.cc-big.cash{background:#3ccf6e;color:#06290f;box-shadow:0 4px 0 #1f8a43}
.cc-big:disabled{background:#3c4a44;color:#93a89c;box-shadow:none;cursor:default}
.cc-sub{color:#fff;text-shadow:0 1px 3px #000;font-size:13px;margin-top:6px;font-weight:700}
.cc-res{position:absolute;z-index:8;left:50%;top:50%;transform:translate(-50%,-50%);width:min(92%,420px);background:rgba(20,36,28,.97);box-shadow:0 10px 30px rgba(0,0,0,.55);border:1px solid #2f5a42;border-radius:18px;padding:12px 16px;text-align:center;cursor:pointer;-webkit-user-select:none;user-select:none;animation:ccRes .35s cubic-bezier(.2,1.5,.4,1) both}
.cc-res .t{font:400 24px/1.15 "Titan One",sans-serif;color:#ffd23f}
.cc-res .t.lose{color:#ff8a8a}
.cc-res .s{color:#d4e6da;font-size:14.5px;margin-top:4px}
.cc-res .h{color:#a9c9b4;font-size:12.5px;margin-top:6px}
@keyframes ccRes{from{transform:translate(-50%,-50%) scale(.6);opacity:0}}
.cc-panel{position:absolute;top:0;left:0;bottom:0;z-index:30;width:min(400px,100%);overflow-y:auto;overscroll-behavior:contain;background:#14241b;border-right:1px solid #2f5a42;
 padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s;visibility:hidden}
.cc-panel.open{transform:none;visibility:visible}
.cc-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.cc-panel h3{font:400 19px "Titan One",sans-serif;color:#ffd23f;margin:14px 0 6px}
.cc-ph h3{margin:0}
.cc-panel p,.cc-panel li{color:#c6dccd;font-size:14px}
.cc-panel p{margin:4px 0}
.cc-panel ul.r{margin:4px 0;padding-left:18px}
.cc-tab{width:100%;border-collapse:collapse;font-size:13px;margin-top:4px}
.cc-tab th,.cc-tab td{padding:3px 4px;text-align:center;border-bottom:1px solid #24402f}
.cc-tab th{color:#ffd23f}
.cc-hist{list-style:none;margin:0;padding:0;font-size:14px}
.cc-hist li{padding:5px 0;border-bottom:1px solid #24402f}
.cc-hist:empty::after{content:"Aucune partie pour l'instant.";color:#9cb8a6}
.cc-adm label{display:block;margin:10px 0 4px;font-weight:700;font-size:14px}
.cc-adm select{width:100%;min-height:44px;font:16px Quicksand,sans-serif;border-radius:10px;border:1px solid #3a6a4f;background:#0f1c15;color:#f1edf9;padding:0 10px}
.cc-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.cc-btns button{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid #3a6a4f;background:#1f3a2b;color:#f1edf9;font:700 14px Quicksand,sans-serif;cursor:pointer}
.cc-btns button.on{background:#ffd23f;color:#2a1145;border-color:#ffd23f}
.cc-toast{position:absolute;left:50%;top:26%;z-index:40;transform:translate(-50%,12px);background:#1f3a2b;border:1px solid #ffd23f;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;max-width:92%;transition:transform .3s,opacity .3s;pointer-events:none;opacity:0}
.cc-toast.on{transform:translate(-50%,0);opacity:1}
@media(max-width:380px){.cc-top{padding-left:54px;padding-right:54px}.cc-logoT{font-size:21px}.cc-m{padding:4px 3px}.cc-m small{font-size:9.5px;letter-spacing:0}.cc-meter{gap:5px}.cc-s{font-size:13px}}
@media(max-height:620px){.cc-chips{display:none}.cc-m small{font-size:9.5px}.cc-m b{font-size:17px}.cc-s b{display:none}.cc-s{min-height:36px}.cc-pm{width:38px;height:38px;font-size:20px}.cc-big{min-height:44px;font-size:17px}.cc-sub{margin-top:3px}}
@media(max-height:700px){.cc-q{display:none}.cc-s{min-height:42px}.cc-mise{margin-bottom:6px}.cc-logo{height:48px}.cc-logoT{font-size:24px}.cc-top{gap:3px}.cc-meter{margin-bottom:5px}}
@media(max-height:480px){.cc-top{flex-direction:row;justify-content:center;gap:10px;padding-top:max(4px,env(safe-area-inset-top))}.cc-btn{top:max(4px,env(safe-area-inset-top))}.cc-logo{height:36px}.cc-logoT{font-size:20px}
 .cc-main{flex-direction:row;flex-wrap:wrap;width:100%;gap:0 12px;align-content:stretch}.cc-meter{order:1;width:100%;margin:0 0 4px}.cc-wrap{order:2;flex:1 1 50%;height:calc(100% - 60px)}.cc-act{order:3;flex:1 1 40%;align-self:center;margin:0}.cc-m b{font-size:17px}}
@media(prefers-reduced-motion:reduce){.cc-c.wait,.cc-c.safe,.cc-c.boom,.cc-grid.dead,.cc-res,.cc-m.now.pulse{animation:none}}
`;

/* ---------- état ---------- */
let root=null,USER=null,ADMIN=false,S=null,busy=false,bet=5,snakes=3,skew=0,last=null;   // last = fin de la dernière partie (grille dévoilée)
const $=s=>root.querySelector(s);
function take(info){if(!info)return;S=info;try{if(window.MF_APPLY&&info.state)window.MF_APPLY(info.state);}catch(e){}}
try{const b=+localStorage.getItem("mf_mine_bet");if(b>0)bet=b;const v=+localStorage.getItem("mf_mine_snakes");if(v>0)snakes=v;}catch(e){}
// mêmes calculs que le serveur (pour l'affichage avant de jouer ; en partie, on prend les valeurs du serveur)
const rtp=()=>S&&S.rtp!=null?+S.rtp:.95,cap=()=>S&&S.cap!=null?+S.cap:25;
function mult(n,k){if(k<=0)return 1;let m=1;for(let i=0;i<k;i++)m=m*(25-i)/(25-n-i);return Math.min(cap(),Math.floor(rtp()*m*100+1e-9)/100);}
const chance=(n,k)=>(25-n-k)/(25-k);   // chance que la prochaine coco soit sûre

/* ---------- sons ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==="suspended")AC.resume().catch(()=>{});return AC;}
function beep(f,t0,dur,vol,type){const a=AC;if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type||"square";o.frequency.value=f;g.gain.setValueAtTime(vol,a.currentTime+t0);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t0+dur);o.connect(g).connect(a.destination);o.start(a.currentTime+t0);o.stop(a.currentTime+t0+dur+.02);}catch(e){}}
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};
const knock=()=>{beep(170,0,.06,.07,"triangle");vib(5);};
const crack=k=>{const f=420+k*45;beep(f,0,.09,.06,"triangle");beep(f*1.5,.06,.12,.05,"triangle");vib(12);};
const hiss=()=>{if(!AC)return;try{const a=AC,len=a.sampleRate*.7,b=a.createBuffer(1,len,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
 const s=a.createBufferSource(),fl=a.createBiquadFilter(),g=a.createGain();s.buffer=b;fl.type="highpass";fl.frequency.value=3000;g.gain.value=.12;s.connect(fl).connect(g).connect(a.destination);s.start();}catch(e){}
 [330,262,196].forEach((f,i)=>beep(f,.15+i*.14,.22,.05,"sawtooth"));vib([80,40,120]);};
const cashS=big=>{[523,659,784,1047].concat(big?[1319,1568,2093]:[]).forEach((f,i)=>beep(f,i*.08,.16,.06,"triangle"));vib(big?[60,40,60,40,160]:40);};

/* ---------- grille ---------- */
const cells=()=>[...root.querySelectorAll(".cc-c")];
let imgCoco=false,imgOpen=false,imgSnake=false;
const faceHid=()=>imgCoco?`<img src="${IMG.coco}" alt="">`:NUT;
const faceSafe=()=>imgOpen?`<img src="${IMG.ouverte}" alt="">`:OPEN;
const faceSnake=()=>imgSnake?`<img src="${IMG.serpent}" alt="">`:`<span class="e">🐍</span>`;
const lab=i=>`ligne ${Math.floor(i/5)+1}, colonne ${i%5+1}`;
function setCell(i,kind,extra){const e=cells()[i];e.className="cc-c "+kind+(extra?" "+extra:"");
 e.innerHTML=kind==="hid"?faceHid():kind==="snk"?faceSnake():faceSafe();
 e.setAttribute("aria-label",`Coco ${lab(i)}`+(kind==="hid"?"":kind==="snk"?" : serpent":" : ouverte, pas de serpent"));}
// dessine la grille : partie en cours (S.game), ou la dernière partie dévoilée (last), ou une grille neuve
function drawGrid(){const g=S&&S.game,grid=$(".cc-grid");grid.classList.toggle("play",!!g&&!busy);
 if(g){const op=new Set((g.open||[]).map(Number));cells().forEach((e,i)=>{if(op.has(i)){if(!e.classList.contains("safe"))setCell(i,"safe");}else setCell(i,"hid");e.disabled=busy;});return;}
 if(last){const sn=new Set((last.snakes||[]).map(Number)),op=new Set((last.open||[]).map(Number));
  cells().forEach((e,i)=>{e.disabled=true;if(last.boom!=null&&i===+last.boom)setCell(i,"snk","boom");else if(sn.has(i))setCell(i,"snk","ghost");else if(op.has(i))setCell(i,"safe");else setCell(i,"safe","ghost");});return;}
 cells().forEach((e,i)=>{setCell(i,"hid");e.disabled=true;});}

/* ---------- affichage ---------- */
const hhmm=ms=>{const m=Math.max(0,Math.round(ms/60000));return `${Math.floor(m/60)} h ${String(m%60).padStart(2,"0")}`;};
function clampBet(){if(!S)return;bet=Math.max(+S.min||1,Math.min(+S.maxBet||10,bet));const ok=(S.snakes||[3,4,5]).map(Number);if(!ok.includes(snakes))snakes=ok[0];}
function render(){if(!root)return;
 const st=S&&S.state;$("#ccBan").textContent=st?st.bananas:"…";$("#ccBoo").textContent=st?st.stock:"…";
 if(!S){drawGrid();return;}clampBet();
 const g=S.game,ban=st?+st.bananas:0;
 $("#ccBetBox").hidden=!!g;$("#ccCash").hidden=!g;
 // compteurs du haut
 const n=g?+g.n:snakes,k=g?(g.open||[]).length:0,now=g?+g.mult:1,nx=g?+g.next:mult(n,1),left=25-n-k;
 $("#ccNow").textContent=g?fx(now):"×1";
 $("#ccNext").textContent=left>0?fx(nx):"—";
 $("#ccOdds").textContent=left>0?pct(chance(n,k)):"—";
 $("#ccSnk").textContent=`${n} 🐍`;
 // avant de jouer
 $("#ccAmt").textContent=`${bet} 🍌`;
 $("#ccMinus").disabled=busy||bet<=+S.min;$("#ccPlus").disabled=busy||bet>=+S.maxBet;
 root.querySelectorAll(".cc-q").forEach(q=>{const v=+q.dataset.v;q.hidden=v>+S.maxBet||v<+S.min;q.classList.toggle("on",v===bet);});
 root.querySelectorAll(".cc-s").forEach(e=>{const v=+e.dataset.n;e.hidden=!(S.snakes||[]).map(Number).includes(v);e.disabled=busy;e.classList.toggle("on",v===snakes);e.setAttribute("aria-pressed",String(v===snakes));
  e.querySelector("b").textContent=`${fx(mult(v,1))} → ${fx(mult(v,5))}`;});
 const d=$("#ccGo");d.disabled=busy||+S.left<=0||ban<bet;
 d.textContent=+S.left<=0?"Plus de parties aujourd'hui":ban<bet?"Pas assez de bananes":`Jouer · ${bet} 🍌`;
 // en partie
 if(g){const c=$("#ccCash"),pay=+g.pay;c.disabled=busy||k<1;c.textContent=k<1?"Ouvre une coco…":`Encaisser · ${pay} 🍌`;}
 $("#ccSub").textContent=g?`Mise : ${g.bet} 🍌 · ${k} coco${k>1?"s":""} ouverte${k>1?"s":""}`+(left>0?` · prochaine coco : ${Math.floor(+g.bet*nx)} 🍌`:"")
  :`Parties : ${S.left}/${S.max}`+(+S.left<=0?` · Nouvelles parties dans ${hhmm(+S.nextDay-(Date.now()+skew))}`:` · plafond ${fx(cap())}`);
 $("#ccLim").textContent=`${S.max} parties par jour, mise de ${S.min} à ${S.maxBet} 🍌. Plafond ${fx(cap())} (gain max ${Math.floor(+S.maxBet*cap())} 🍌) : la partie s'encaisse toute seule quand il est atteint.`;
 $("#ccHist").innerHTML=(S.hist||[]).map(h=>`<li>${esc(h)}</li>`).join("");
 $("#ccTab").innerHTML=`<tr><th>Cocos</th>${(S.snakes||[3,4,5]).map(v=>`<th>${v} 🐍</th>`).join("")}</tr>`+[1,2,3,4,5,6,8,10,12].map(kk=>`<tr><td>${kk}</td>${(S.snakes||[3,4,5]).map(v=>kk<=25-v?`<td>${fx(mult(v,kk))}</td>`:"<td>—</td>").join("")}</tr>`).join("");
 if(ADMIN){const o=$("#ccOpen");o.textContent=S.open?"Cacher aux joueurs":"Ouvrir à tous les joueurs";o.classList.toggle("on",!S.open);
  $("#ccState").textContent=S.open?"Le Champ de Cocos est ouvert à tous les joueurs.":"Le Champ de Cocos est visible par toi seulement.";}
 drawGrid();}
function show(t,s,cls,h){const r=$("#ccRes");r.querySelector(".t").textContent=t;r.querySelector(".t").className="t"+(cls?" "+cls:"");r.querySelector(".s").textContent=s||"";r.querySelector(".h").textContent=h||"Touche pour fermer";r.hidden=false;}
let tt=0;function toast(t){const e=$(".cc-toast");e.textContent=t;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500);}
function pulse(){const m=$(".cc-m.now");m.classList.remove("pulse");void m.offsetWidth;m.classList.add("pulse");}
const err=e=>{busy=false;cells().forEach(c=>c.classList.remove("wait"));show("Oups",errText(e),"lose");
 rpc("mf_mine_status").then(r=>{take(r);render();},()=>render());};
const takeForce=()=>{if(!ADMIN)return null;const el=$("#ccF"),v=el.value;el.value="";return v||null;};

/* ---------- une partie ---------- */
async function go(){if(busy||!S||S.game)return;ac();busy=true;$("#ccRes").hidden=true;last=null;
 const gr=$(".cc-grid");gr.classList.remove("dead","won");render();
 try{localStorage.setItem("mf_mine_bet",String(bet));localStorage.setItem("mf_mine_snakes",String(snakes));}catch(e){}
 let r;try{r=await rpc("mf_mine_start",{p_bet:bet,p_snakes:snakes,p_force:takeForce()});}catch(e){return err(e);}
 take(r);knock();busy=false;render();toast(pick(["À toi : choisis une coco ! 🥥",`${snakes} serpents se cachent… 🐍`,"Prends ton temps, rien ne presse."]));}

async function open1(i){if(busy||!S||!S.game)return;const e=cells()[i];if(!e.classList.contains("hid"))return;ac();
 busy=true;e.classList.add("wait");render();e.classList.add("wait");
 const t0=Date.now();let r;try{r=await rpc("mf_mine_pick",{p_cell:i});}catch(x){return err(x);}
 await wait(Math.max(0,320-(Date.now()-t0)));   // petit suspense, même avec un réseau rapide
 e.classList.remove("wait");
 if(r.safe){const k=(r.open||(r.info&&r.info.game&&r.info.game.open)||[]).length;crack(k);setCell(i,"safe","safe");
  if(r.out){busy=false;return finish(r);}
  take(r.info);busy=false;render();pulse();return;}
 busy=false;finish(r);}

async function cash(){if(busy||!S||!S.game||!(S.game.open||[]).length)return;ac();busy=true;render();
 let r;try{r=await rpc("mf_mine_cash");}catch(e){return err(e);}
 busy=false;finish(r);}

function finish(r){take(r.info);last={snakes:r.snakes,open:r.open,boom:r.boom};const gr=$(".cc-grid");
 const k=+r.k,m=fx(r.mult),net=+r.net,b=+r.bet;
 if(r.out==="boom"){hiss();render();gr.classList.remove("dead");void gr.offsetWidth;gr.classList.add("dead");
  show("Sssss… un serpent ! 🐍",`Mise perdue (−${b} 🍌). `+(k?`Tu avais ouvert ${k} coco${k>1?"s":""} : la suivante valait ${m}.`:"Pas de chance, dès la première coco…"),"lose",pick(["Encore une ? 😏","Les serpents sont dévoilés sur la grille.","La jungle est cruelle."]));}
 else{cashS(net>=20);render();gr.classList.add("won");
  show(r.auto?(k>=25-+r.n?"Champ vidé ! 🏆":`Plafond ${m} ! 🏆`):`Encaissé à ${m} !`,`${k} coco${k>1?"s":""} sans serpent : ${b} 🍌 ${m} = ${r.pay} 🍌 (${net>=0?"+":""}${net} 🍌).`,"",
   r.auto?"La partie s'est encaissée toute seule.":"Les serpents que tu as évités sont dévoilés.");}
}

/* ---------- admin ---------- */
async function adm(x,msg){try{const r=await rpc("mf_mine_admin",{p_action:x});take(r);if(x==="reset"){last=null;$("#ccRes").hidden=true;}render();if(msg)toast(msg);}catch(e){err(e);}}

/* ---------- construction ---------- */
function build(){
 const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
 root=document.createElement("div");root.id="mfCC";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label",NAME);
 root.innerHTML=`<div class="cc-top"><button type="button" class="cc-btn l" id="ccTog" aria-controls="ccPanel" aria-expanded="false" aria-label="Règles">?</button>
  <h2 style="margin:0"><img class="cc-logo" src="${IMG.logo}" alt="${NAME}"><span class="cc-logoT" hidden>${NAME}</span></h2>
  <div class="cc-chips"><span class="cc-chip">🍌 <b id="ccBan">…</b></span><span class="cc-chip">Boosters <b id="ccBoo">…</b></span></div>
  <button type="button" class="cc-btn r" id="ccClose" aria-label="Fermer">✕</button></div>
 <div class="cc-main">
  <div class="cc-meter" aria-live="polite">
   <div class="cc-m now"><small>Gain</small><b id="ccNow">×1</b></div>
   <div class="cc-m"><small>Prochaine</small><b id="ccNext">—</b></div>
   <div class="cc-m"><small>Sans serpent</small><b id="ccOdds">—</b></div>
   <div class="cc-m"><small>Serpents</small><b id="ccSnk">3 🐍</b></div>
  </div>
  <div class="cc-wrap"><div class="cc-grid" role="grid" aria-label="Champ de 25 noix de coco">${Array.from({length:25},(_,i)=>`<button type="button" class="cc-c hid" data-i="${i}" disabled></button>`).join("")}</div></div>
  <div class="cc-act">
   <div id="ccBetBox">
    <div class="cc-snk" role="group" aria-label="Nombre de serpents">${[3,4,5].map(v=>`<button type="button" class="cc-s" data-n="${v}">${v} serpents<b></b></button>`).join("")}</div>
    <div class="cc-mise"><button type="button" class="cc-pm" id="ccMinus" aria-label="Miser moins">−</button><span class="cc-amt" id="ccAmt" aria-live="polite"></span><button type="button" class="cc-pm" id="ccPlus" aria-label="Miser plus">+</button>
     <button type="button" class="cc-q" data-v="1">1</button><button type="button" class="cc-q" data-v="5">5</button><button type="button" class="cc-q" data-v="10">10</button></div>
    <button type="button" class="cc-big" id="ccGo"></button>
   </div>
   <button type="button" class="cc-big cash" id="ccCash" hidden></button>
   <div class="cc-sub" id="ccSub"></div>
  </div>
 </div>
 <div class="cc-res" id="ccRes" hidden role="status"><div class="t"></div><div class="s"></div><div class="h"></div></div>
 <aside class="cc-panel" id="ccPanel" aria-label="Règles et réglages">
  <div class="cc-ph"><h3>Règles</h3><button type="button" class="cc-btn" style="position:static" id="ccPanelX" aria-label="Fermer les règles">✕</button></div>
  <ul class="r">
   <li>25 noix de coco, et quelques serpents cachés dessous. Choisis 3, 4 ou 5 serpents : plus il y en a, plus le gain monte vite.</li>
   <li>Ouvre les cocos une par une. Chaque coco sans serpent fait monter ton multiplicateur.</li>
   <li>Encaisse quand tu veux : ta mise × le multiplicateur (arrondi en dessous). Un serpent, et la mise est perdue.</li>
   <li>Pas de chrono : réfléchis à chaque coco. Une partie commencée t'attend, même si tu fermes l'appli.</li>
   <li id="ccLim"></li>
  </ul>
  <h3>Multiplicateurs</h3><table class="cc-tab" id="ccTab"></table>
  <h3>Dernières parties</h3><ul class="cc-hist" id="ccHist"></ul>
  <div class="cc-adm" id="ccAdm" hidden>
   <h3>Réglages admin</h3>
   <p id="ccState"></p>
   <div class="cc-btns"><button type="button" id="ccOpen"></button></div>
   <label for="ccF">Prochaine partie</label>
   <select id="ccF"><option value="">Au hasard</option><option value="lucky">Aucun serpent sous mes cocos</option><option value="boom">Serpent à la première coco</option></select>
   <div class="cc-btns"><button type="button" id="ccReset">Rendre mes parties du jour</button><button type="button" id="ccAdd">+50 🍌</button></div>
  </div>
 </aside>
 <div class="cc-toast" role="status"></div>`;
 document.body.appendChild(root);
 $("#ccAdm").hidden=!ADMIN;
 const lg=$(".cc-logo"),noLogo=()=>{lg.hidden=true;$(".cc-logoT").hidden=false;};lg.onerror=noLogo;if(lg.complete&&!lg.naturalWidth)noLogo();
 const ld=(src,f)=>{const i=new Image();i.onload=()=>{f();if(root&&!busy)render();};i.src=src;};
 ld(IMG.coco,()=>{imgCoco=true;cells().forEach((e,i)=>{if(e.classList.contains("hid"))e.innerHTML=faceHid();});});
 ld(IMG.ouverte,()=>{imgOpen=true;});ld(IMG.serpent,()=>{imgSnake=true;});
 $("#ccClose").addEventListener("click",close);
 $("#ccMinus").addEventListener("click",()=>{bet=Math.max(+S.min||1,bet-1);render();});
 $("#ccPlus").addEventListener("click",()=>{bet=Math.min(+S.maxBet||10,bet+1);render();});
 root.querySelectorAll(".cc-q").forEach(q=>q.addEventListener("click",()=>{bet=+q.dataset.v;clampBet();render();}));
 root.querySelectorAll(".cc-s").forEach(e=>e.addEventListener("click",()=>{if(busy||(S&&S.game))return;snakes=+e.dataset.n;render();}));
 $("#ccGo").addEventListener("click",go);
 $("#ccCash").addEventListener("click",cash);
 cells().forEach((c,i)=>c.addEventListener("click",()=>open1(i)));
 $("#ccRes").addEventListener("click",()=>{$("#ccRes").hidden=true;});
 $("#ccTog").addEventListener("click",()=>panel(!$("#ccPanel").classList.contains("open")));
 $("#ccPanelX").addEventListener("click",()=>{panel(false);$("#ccTog").focus({preventScroll:true});});
 $("#ccOpen").addEventListener("click",()=>adm(S&&S.open?"close":"open",S&&S.open?"Le Champ de Cocos est de nouveau caché.":`${NAME} est ouvert à tous les joueurs !`));
 $("#ccReset").addEventListener("click",()=>adm("reset","Tes parties du jour sont rendues."));
 $("#ccAdd").addEventListener("click",()=>adm("bananas","+50 🍌 sur ton compte."));
 root.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if($("#ccPanel").classList.contains("open"))panel(false);else close();});
 setInterval(()=>{if(!root.hidden&&!busy)render();},30000);
}
function panel(o){$("#ccPanel").classList.toggle("open",o);$("#ccTog").setAttribute("aria-expanded",String(o));}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
 if(!root)build();
 root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 $("#ccClose").focus({preventScroll:true});$("#ccRes").hidden=true;
 render();
 try{const r=await rpc("mf_mine_status");if(r.now)skew=+r.now-Date.now();take(r);
  if(r.game){last=null;toast("Ta partie t'attend : encore une coco ? 🥥");}
  render();}catch(e){show("Oups",errText(e),"lose");}
}
function close(){
 if(busy){toast("La coco s'ouvre…");return;}
 panel(false);root.hidden=true;document.body.style.overflow=prevOverflow;if(opener&&opener.focus)opener.focus();
}

/* ---------- démarrage : le jeu s'inscrit au Casino ---------- */
async function boot(){
 if(!window.claude||!window.claude.use)return;
 try{USER=await window.claude.use("user");}catch(e){}
 if(!USER||typeof window.MF_RPC!=="function")return;
 try{ADMIN=!!(await USER.isOwner());}catch(e){}
 let ok=ADMIN;if(!ok){try{ok=!!(await rpc("mf_mine_open"));}catch(e){}}
 if(!ok||!window.MF_CASINO)return;
 window.MF_CASINO.add({id:"mine",name:NAME,order:11,root:"mfCC",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="2.6"/><circle cx="12" cy="6" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="12" r="2.6"/><circle cx="6" cy="18" r="2.6"/><circle cx="12" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M9.5 13.5c1-1.6 2-1.6 2.5 0s1.5 1.6 2.5 0"/></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){const r=await rpc("mf_mine_status");if(r.now)skew=+r.now-Date.now();take(r);}const I=S;if(!I)return null;
   if(I.game){const k=(I.game.open||[]).length;return {line:k?`Partie en cours : ${k} coco${k>1?"s":""}, ${fx(I.game.mult)}… encore une ?`:"Partie en cours : ouvre ta première coco !",hot:true};}
   if(+I.left>0)return {line:`Encore ${I.left} partie${+I.left>1?"s":""} aujourd'hui · jusqu'à ${fx(I.cap||25)}`,hot:false};
   return {line:"Plus de parties aujourd'hui",pre:"Nouvelles parties dans ",in:+I.nextDay-(Date.now()+skew),hot:false};}});
}
window.MF_CHAMP={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

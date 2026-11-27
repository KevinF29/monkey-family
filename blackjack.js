/* Monkey Family — MonkeyJack 21 (blackjack du Casino, avec un singe croupier)
   10 mains par jour, mise de 1 à 20 🍌, actions Tirer / Rester / Doubler.
   Monkey Blackjack (As + Roi singe d'entrée) : la mise ×5. Le singe triche parfois quand il devrait sauter.
   Les cartes sont tirées par le serveur (mf_bj_*, supabase-blackjack.sql) : la carte cachée du croupier n'arrive qu'à la fin de la main.
   Visible par l'admin seulement tant que le jeu n'est pas ouvert à tous (réglages admin → « Ouvrir à tous »). */
(function(){
"use strict";

const IMG={logo:"packs/bj-titre.webp",croupier:"packs/bj-croupier.webp",triche:"packs/bj-croupier-triche.webp",table:"packs/bj-table.webp",fond:"packs/bj-fond.webp",dos:"packs/bj-dos.webp",roi:"packs/bj-roi.webp",dame:"packs/bj-dame.webp",valet:"packs/bj-valet.webp",as:"packs/bj-as.webp"};
const ART={0:"as",10:"valet",11:"dame",12:"roi"};
const RK=["A","2","3","4","5","6","7","8","9","10","V","D","R"],SU=["♠","♥","♦","♣"];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR={no_bananas:"Pas assez de bananes.",bj_limit:"Plus de mains aujourd'hui : reviens demain !",bj_closed:"Le blackjack n'est pas encore ouvert.",
 bj_in_hand:"Une main est déjà en cours.",bj_no_hand:"Pas de main en cours.",bj_bet:"Mise impossible.",bj_no_double:"On ne peut doubler que sur les deux premières cartes.",
 not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait=ms=>new Promise(r=>setTimeout(r,reduce?Math.min(ms,120):ms));
const val=c=>{const r=c%13;return r===0?11:r>=9?10:r+1;};
function total(h){let t=0,a=0;(h||[]).forEach(c=>{t+=val(c);if(c%13===0)a++;});while(t>21&&a){t-=10;a--;}return t;}
const cname=c=>{const r=c%13;return (r===12?"Roi singe":r===11?"Dame":r===10?"Valet":r===0?"As":RK[r])+" "+SU[Math.floor(c/13)];};

/* ---------- style ---------- */
const CSS=`
#mfBJ{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;color:#f1edf9;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:#15111f linear-gradient(rgba(16,10,28,.5),rgba(16,10,28,.78)) center/cover;background-image:linear-gradient(rgba(16,10,28,.5),rgba(16,10,28,.78)),url(${IMG.fond})}
#mfBJ[hidden]{display:none}
#mfBJ *{box-sizing:border-box;min-width:0}
#mfBJ [hidden]{display:none!important}
#mfBJ,#mfBJ *{-webkit-tap-highlight-color:transparent}
#mfBJ button:focus-visible,#mfBJ select:focus-visible,#mfBJ input:focus-visible{outline:3px solid #8fd3ff;outline-offset:2px}
.bj-top{flex:none;position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;padding:max(8px,env(safe-area-inset-top)) 58px 6px}
.bj-logo{display:block;height:clamp(56px,10svh,120px);width:auto;max-width:100%;filter:drop-shadow(0 8px 12px rgba(0,0,0,.5))}
.bj-logoT{margin:0;font:400 clamp(26px,7vw,38px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 #8a5a00,0 0 16px rgba(0,0,0,.5)}
.bj-btn{position:absolute;top:max(8px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(20,18,32,.75);color:#ffd23f;font:700 19px Quicksand,sans-serif;cursor:pointer;display:grid;place-items:center}
.bj-btn.l{left:10px}.bj-btn.r{right:10px}
.bj-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px}
.bj-chip{background:#211a33;border:1px solid #3a2f57;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13.5px;white-space:nowrap}
.bj-chip b{color:#ffd23f}
.bj-scene{flex:1;min-height:0;width:min(100%,640px);position:relative;display:flex;flex-direction:column;align-items:center;padding:6px 26px max(30px,env(safe-area-inset-bottom))}
.bj-scene>*{position:relative;z-index:1}
.bj-scene>.bj-tbl{position:absolute;inset:0;z-index:0;pointer-events:none;background:#0f5a30;border-style:solid;border-color:transparent;border-width:70px 50px 86px;border-image:url(${IMG.table}) 290 210 360 210 fill stretch}
@media(min-width:500px){.bj-scene>.bj-tbl{border-width:93px 67px 115px}}
.bj-dealer{flex:none;position:relative;display:flex;align-items:flex-end;justify-content:center;--mh:clamp(64px,14svh,170px);height:var(--mh);width:100%}
.bj-monk{height:100%;width:auto;max-width:60%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,.45));transform-origin:50% 100%}
.bj-monkE{font-size:clamp(52px,11svh,130px);line-height:1;filter:drop-shadow(0 8px 12px rgba(0,0,0,.45));transform-origin:50% 100%}
.bj-monk.wob,.bj-monkE.wob{animation:bjWob .4s 3 alternate ease-in-out}
@keyframes bjWob{from{transform:rotate(-6deg)}to{transform:rotate(6deg) scale(1.04)}}
.bj-say{position:absolute;left:calc(50% + var(--mh)*.5);right:auto;top:-4px;max-width:min(190px,calc(50% - var(--mh)*.5 - 4px));background:#fff;color:#2a1145;border-radius:14px 14px 14px 4px;padding:6px 10px;font-weight:700;font-size:13.5px;line-height:1.25;box-shadow:0 4px 10px rgba(0,0,0,.35);opacity:0;transform:scale(.8);transition:opacity .2s,transform .2s;pointer-events:none}
.bj-say.on{opacity:1;transform:none}
.bj-rows{flex:1;min-height:0;width:100%;display:flex;flex-direction:column;justify-content:space-evenly;align-items:center;gap:4px}
.bj-side{display:flex;flex-direction:column;align-items:center;gap:4px;width:100%}
.bj-lab{font-weight:700;font-size:13.5px;color:#e6f5ea;text-shadow:0 1px 2px #000;display:flex;gap:8px;align-items:center}
.bj-tot{display:inline-block;min-width:34px;text-align:center;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:1px 9px;font-weight:700;color:#fff}
.bj-tot.bust{background:#a3263b;border-color:#ff8fa3}.bj-tot.bj{background:#ffd23f;color:#2a1145;border-color:#fff2b3}
.bj-hand{display:flex;justify-content:center;min-height:calc(var(--cw)*4/3);--cw:clamp(44px,min(20vw,9.5svh),90px)}
.bj-card{position:relative;width:var(--cw);height:calc(var(--cw)*4/3);flex:none;perspective:600px;animation:bjIn .32s cubic-bezier(.2,1.2,.4,1) both}
.bj-hand .bj-card+.bj-card{margin-left:calc(var(--cw)*-.2)}
.bj-hand.mid .bj-card+.bj-card{margin-left:calc(var(--cw)*-.42)}
.bj-hand.many .bj-card+.bj-card{margin-left:calc(var(--cw)*-.55)}
@keyframes bjIn{from{transform:translate(0,-80px) rotate(-12deg);opacity:0}to{opacity:1}}
.bj-card.cheat{animation:bjSleeve .9s cubic-bezier(.2,1.1,.4,1) both}
@keyframes bjSleeve{0%{transform:translate(90px,-120px) rotate(40deg) scale(.4);opacity:0}60%{transform:translate(-6px,4px) rotate(-6deg) scale(1.08);opacity:1}100%{transform:none}}
.bj-in{position:absolute;inset:0;transition:transform .45s;transform-style:preserve-3d}
.bj-card.back .bj-in{transform:rotateY(180deg)}
.bj-f,.bj-b{position:absolute;inset:0;border-radius:calc(var(--cw)*.1);backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:0 3px 8px rgba(0,0,0,.4)}
.bj-f{background:#fffdf5;border:1px solid #d9d2bd;color:#1d1a24;display:flex;align-items:center;justify-content:center}
.bj-f.red{color:#c8102e}
.bj-f .c{position:absolute;left:6%;top:3%;font:800 calc(var(--cw)*.24)/1 Quicksand,sans-serif;text-align:center}
.bj-f .c i{display:block;font-style:normal;font-size:.85em}
.bj-f .c2{left:auto;top:auto;right:6%;bottom:3%;transform:rotate(180deg)}
.bj-f .m{font-size:calc(var(--cw)*.46);line-height:1}
.bj-f.king{background:linear-gradient(160deg,#fff7d6,#ffe38a);border-color:#d9a514}
.bj-f.king .m{font-size:calc(var(--cw)*.5)}
.bj-f.king .m small{position:absolute;left:50%;top:22%;transform:translateX(-50%);font-size:calc(var(--cw)*.22)}
.bj-f.art{background:#fdf1d6 center/100% 100% no-repeat;border:0}
.bj-f.art .c{left:7%;top:4%;background:rgba(255,250,235,.93);border-radius:5px;padding:2px 2px 1px;box-shadow:0 0 0 1px rgba(201,151,26,.5)}
.bj-f.art .c2{left:auto;top:auto;right:7%;bottom:4%}
.bj-b{transform:rotateY(180deg);background:#a3101e url(${IMG.dos}) center/100% 100% no-repeat}
.bj-stamp{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-18deg);z-index:2;background:#e3183d;color:#fff;font:400 calc(var(--cw)*.16) "Titan One",sans-serif;padding:2px 6px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.bj-bet{font-weight:700;font-size:13.5px;color:#fff;text-shadow:0 1px 2px #000;min-height:1.4em}
.bj-bet b{color:#ffd23f}
.bj-act{flex:none;width:100%;text-align:center}
.bj-mise{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.bj-pm{width:46px;height:46px;border-radius:50%;border:2px solid #ffd23f;background:rgba(0,0,0,.35);color:#ffd23f;font:700 24px Quicksand,sans-serif;cursor:pointer}
.bj-pm:disabled{opacity:.35;cursor:default}
.bj-amt{min-width:84px;font:400 26px "Titan One",sans-serif;color:#fff;text-shadow:0 2px 0 #0a3f22}
.bj-quick{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:8px}
.bj-q{min-width:46px;min-height:40px;border-radius:999px;border:2px dashed rgba(255,255,255,.7);background:#c8102e;color:#fff;font:700 15px Quicksand,sans-serif;cursor:pointer;box-shadow:0 3px 0 #7a0a1c}
.bj-q:nth-child(2){background:#1f5fd1;box-shadow:0 3px 0 #123b85}.bj-q:nth-child(3){background:#2d2544;box-shadow:0 3px 0 #000}.bj-q:nth-child(4){background:#d9a514;color:#2a1145;box-shadow:0 3px 0 #8a6500}
.bj-q.on{outline:3px solid #fff;outline-offset:1px}
.bj-q:disabled{opacity:.35;cursor:default}
.bj-row3{display:flex;gap:8px;justify-content:center}
.bj-big{min-height:52px;padding:10px 22px;border-radius:16px;border:0;background:#ffd23f;color:#2a1145;font:400 19px "Titan One",sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8901a;transition:transform .08s,box-shadow .08s}
.bj-big:active{transform:translateY(2px);box-shadow:0 2px 0 #b8901a}
.bj-big:disabled{background:#4a4060;color:#9d93b8;box-shadow:none;cursor:default}
.bj-big.g{background:#fff;box-shadow:0 4px 0 #a9a3b8}.bj-big.p{background:#ff7aa8;box-shadow:0 4px 0 #a8305c}
.bj-row3 .bj-big{flex:1;max-width:160px;padding:10px 8px;font-size:17px;line-height:1.1}
.bj-row3 .bj-big small{display:block;font:700 12px Quicksand,sans-serif}
.bj-sub{color:#fff;text-shadow:0 1px 3px #000;font-size:13px;margin-top:6px;font-weight:700}
.bj-scene>.bj-res{position:absolute;z-index:5;left:6%;right:6%;top:40%;transform:translateY(-50%);z-index:5;background:rgba(33,26,51,.96);box-shadow:0 10px 30px rgba(0,0,0,.5);border:1px solid #3a2f57;border-radius:18px;padding:12px 16px;text-align:center;cursor:pointer;-webkit-user-select:none;user-select:none;animation:bjPop .35s cubic-bezier(.2,1.5,.4,1) both}
.bj-res[hidden]{display:none}
.bj-res .t{font:400 24px/1.15 "Titan One",sans-serif;color:#ffd23f}
.bj-res .t.lose{color:#b3a8cc}.bj-res .t.cheat{color:#ff7aa8}
.bj-res .s{color:#d9d1ec;font-size:14.5px;margin-top:4px}
@keyframes bjPop{from{transform:translateY(-50%) scale(.6);opacity:0}}
.bj-mk{position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:radial-gradient(circle at 50% 45%,rgba(255,210,63,.6),rgba(21,17,31,.94) 70%);cursor:pointer;animation:bjFade .25s}
.bj-mk[hidden]{display:none}
.bj-mkT{font:400 clamp(34px,11vw,56px)/1 "Titan One",sans-serif;text-align:center;color:#fff;transform:rotate(-4deg);text-shadow:0 4px 0 #b8901a,0 0 24px rgba(0,0,0,.6);animation:bjBoom .6s cubic-bezier(.2,1.6,.4,1) both}
.bj-mkT b{display:block;color:#ffd23f;font-weight:400}
.bj-mkS{font-weight:700;font-size:17px;text-shadow:0 1px 3px #000;text-align:center;padding:0 16px}
.bj-mkE{display:flex;animation:bjWob .35s infinite alternate ease-in-out}
.bj-mkE img{width:clamp(90px,26vw,150px);height:auto;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,.5)}
.bj-mkE img:first-child{transform:rotate(-10deg) translateX(14%)}.bj-mkE img:last-child{transform:rotate(8deg) translateX(-14%)}
@keyframes bjBoom{from{transform:scale(.3) rotate(-20deg);opacity:0}}
@keyframes bjFade{from{opacity:0}}
.bj-flash{animation:bjRed .25s 4 alternate}@keyframes bjRed{to{box-shadow:inset 0 0 120px rgba(227,24,61,.85)}}
.bj-panel{position:absolute;top:0;left:0;bottom:0;z-index:30;width:min(400px,100%);overflow-y:auto;overscroll-behavior:contain;background:#1a1429;border-right:1px solid #3a2f57;
 padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s;visibility:hidden}
.bj-panel.open{transform:none;visibility:visible}
.bj-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.bj-panel h3{font:400 19px "Titan One",sans-serif;color:#ffd23f;margin:14px 0 6px}
.bj-ph h3{margin:0}
.bj-panel p,.bj-panel li{color:#c9c0de;font-size:14px}
.bj-panel p{margin:4px 0}
.bj-panel ul.r{margin:4px 0;padding-left:18px}
.bj-hist{list-style:none;margin:0;padding:0;font-size:14px}
.bj-hist li{padding:5px 0;border-bottom:1px solid #2e2546}
.bj-hist:empty::after{content:"Aucune main pour l'instant.";color:#a79fc0}
.bj-adm[hidden]{display:none}
.bj-adm label{display:block;margin:10px 0 4px;font-weight:700;font-size:14px}
.bj-adm select{width:100%;min-height:44px;font:16px Quicksand,sans-serif;border-radius:10px;border:1px solid #4a3a78;background:#15111f;color:#f1edf9;padding:0 10px}
.bj-chk{display:flex!important;gap:8px;align-items:center}
.bj-chk input{width:22px;height:22px}
.bj-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.bj-btns button{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid #4a3a78;background:#2c2148;color:#f1edf9;font:700 14px Quicksand,sans-serif;cursor:pointer}
.bj-btns button.on{background:#ffd23f;color:#2a1145;border-color:#ffd23f}
.bj-toast{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));z-index:40;transform:translate(-50%,12px);background:#2c2148;border:1px solid #ffd23f;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;max-width:92%;transition:transform .3s,opacity .3s;pointer-events:none;opacity:0}
.bj-toast.on{transform:translate(-50%,0);opacity:1}
@media(min-width:660px){.bj-scene{margin-top:4px}}
@media(max-height:700px){.bj-quick{display:none}.bj-logo{height:54px}.bj-logoT{font-size:26px}.bj-top{gap:3px}}
@media(prefers-reduced-motion:reduce){.bj-card,.bj-card.cheat,.bj-mkT,.bj-mkE,.bj-res,.bj-monk.wob,.bj-monkE.wob,.bj-flash{animation:none}.bj-in,.bj-say,.bj-toast,.bj-panel{transition:none}}
`;

/* ---------- état ---------- */
let root=null,USER=null,ADMIN=false,S=null,busy=false,bet=5,skew=0;
const $=s=>root.querySelector(s);
function take(info){if(!info)return;S=info;try{if(window.MF_APPLY&&info.state)window.MF_APPLY(info.state);}catch(e){}}
try{const b=+localStorage.getItem("mf_bj_bet");if(b>0)bet=b;}catch(e){}

/* ---------- sons ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==="suspended")AC.resume().catch(()=>{});return AC;}
function beep(f,t0,dur,vol,type){const a=AC;if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type||"square";o.frequency.value=f;g.gain.setValueAtTime(vol,a.currentTime+t0);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t0+dur);o.connect(g).connect(a.destination);o.start(a.currentTime+t0);o.stop(a.currentTime+t0+dur+.02);}catch(e){}}
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};
const flick=()=>{beep(2400,0,.03,.03,"triangle");beep(1300,.02,.04,.03,"triangle");vib(5);};
const win=big=>{[523,659,784,1047].concat(big?[1319,1568,2093]:[]).forEach((f,i)=>beep(f,i*.09,.18,.06,"triangle"));vib(big?[60,40,60,40,160]:40);};
const sad=()=>{[392,330,262].forEach((f,i)=>beep(f,i*.14,.22,.05,"sawtooth"));vib(80);};

/* ---------- cartes ---------- */
function cardEl(c,back){
 const e=document.createElement("div");e.className="bj-card"+(back?" back":"");
 e.innerHTML=`<div class="bj-in"><div class="bj-f"></div><div class="bj-b" aria-hidden="true"></div></div>`;
 if(c!=null)face(e,c);else e.setAttribute("aria-label","carte cachée");return e;}
function face(e,c){const r=c%13,s=Math.floor(c/13),f=e.querySelector(".bj-f"),k=RK[r],u=SU[s];
 const art=ART[r];f.className="bj-f"+(s===1||s===2?" red":"")+(art?" art":"");f.style.backgroundImage=art?`url(${IMG[art]})`:"";
 const mid=art?"":u;
 f.innerHTML=`<span class="c">${k}<i>${u}</i></span><span class="m">${mid}</span><span class="c c2">${k}<i>${u}</i></span>`;
 e.setAttribute("aria-label",cname(c));}
function hand(id){return $(id);}
function addCard(id,c,back,cls){const h=hand(id),e=cardEl(c,back);if(cls)e.classList.add(cls);h.appendChild(e);h.classList.toggle("mid",h.children.length>3);h.classList.toggle("many",h.children.length>4);flick();return e;}
function setTot(id,cards,hidden){const e=$(id),t=total(cards);e.textContent=cards.length?(hidden?total([cards[0]]):t):"";
 e.className="bj-tot"+(t>21?" bust":cards.length===2&&t===21&&!hidden?" bj":"");e.hidden=!cards.length;}
let P=[],D=[];   // cartes affichées
function clearTable(){P=[];D=[];$("#bjP").innerHTML="";$("#bjD").innerHTML="";setTot("#bjPT",[]);setTot("#bjDT",[]);}
function drawHand(h){clearTable();if(!h)return;P=h.p.slice();D=h.d.slice();
 P.forEach(c=>$("#bjP").appendChild(cardEl(c)));$("#bjD").appendChild(cardEl(D[0]));$("#bjD").appendChild(cardEl(null,true));
 setTot("#bjPT",P);setTot("#bjDT",D,true);}

/* ---------- le singe parle ---------- */
let sayT=0;
function say(t,ms){const e=$(".bj-say");e.textContent=t;e.classList.add("on");clearTimeout(sayT);sayT=setTimeout(()=>e.classList.remove("on"),ms||2600);}
function wob(){const m=$(".bj-monk:not([hidden])")||$(".bj-monkE");m.classList.remove("wob");void m.offsetWidth;m.classList.add("wob");}
const pick=a=>a[Math.floor(Math.random()*a.length)];

/* ---------- affichage ---------- */
const hhmm=ms=>{const m=Math.max(0,Math.round(ms/60000));return `${Math.floor(m/60)} h ${String(m%60).padStart(2,"0")}`;};
function clampBet(){if(!S)return;bet=Math.max(+S.min||1,Math.min(+S.maxBet||20,bet));}
function render(){if(!root)return;
 const st=S&&S.state;$("#bjBan").textContent=st?st.bananas:"…";$("#bjBoo").textContent=st?st.stock:"…";
 if(!S)return;clampBet();
 const inHand=!!S.hand,ban=st?+st.bananas:0;
 $("#bjBetBox").hidden=inHand;$("#bjPlay").hidden=!inHand;
 $("#bjAmt").textContent=`${bet} 🍌`;
 $("#bjMinus").disabled=busy||bet<=+S.min;$("#bjPlus").disabled=busy||bet>=+S.maxBet;
 root.querySelectorAll(".bj-q").forEach(q=>{const v=+q.dataset.v;q.disabled=busy||v>+S.maxBet;q.classList.toggle("on",v===bet);});
 const d=$("#bjDeal");d.disabled=busy||+S.left<=0||ban<bet;
 d.textContent=+S.left<=0?"Plus de mains aujourd'hui":ban<bet?"Pas assez de bananes":`Distribuer · ${bet} 🍌`;
 $("#bjSub").textContent=`Mains : ${S.left}/${S.max}`+(+S.left<=0?` · Nouvelles mains dans ${hhmm(+S.nextDay-(Date.now()+skew))}`:"");
 if(inHand){const b=+S.hand.bet;$("#bjBetT").innerHTML=`Mise : <b>${b} 🍌</b>`;
  $("#bjHit").disabled=$("#bjStand").disabled=busy;
  const dbl=$("#bjDbl");dbl.hidden=S.hand.p.length!==2;dbl.disabled=busy||ban<b;dbl.innerHTML=`Doubler<small>+${b} 🍌</small>`;}
 else $("#bjBetT").innerHTML=P.length?$("#bjBetT").innerHTML:"";
 $("#bjHist").innerHTML=(S.hist||[]).map(h=>`<li>${esc(h)}</li>`).join("");
 if(ADMIN){const o=$("#bjOpen");o.textContent=S.open?"Cacher aux joueurs":"Ouvrir à tous les joueurs";o.classList.toggle("on",!S.open);
  $("#bjState").textContent=S.open?"Le blackjack est ouvert à tous les joueurs.":"Le blackjack est visible par toi seulement.";}}
function show(t,s,cls){const r=$("#bjRes");r.querySelector(".t").textContent=t;r.querySelector(".t").className="t"+(cls?" "+cls:"");r.querySelector(".s").textContent=s||"";r.hidden=false;}
let tt=0;function toast(t){const e=$(".bj-toast");e.textContent=t;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500);}
const err=e=>{busy=false;show("Oups",errText(e),"lose");render();rpc("mf_bj_status").then(r=>{take(r);if(!r.hand&&!P.length)clearTable();else if(r.hand)drawHand(r.hand);render();},()=>{});};
const takeForce=()=>{if(!ADMIN)return null;const el=$("#bjF"),v=el.value;el.value="";return v||null;};
const takeCheat=()=>{if(!ADMIN)return false;const el=$("#bjFC"),v=el.checked;el.checked=false;return v;};

/* ---------- une main ---------- */
async function deal(){if(busy||!S||S.hand)return;ac();busy=true;$("#bjRes").hidden=true;clearTable();render();
 try{localStorage.setItem("mf_bj_bet",String(bet));}catch(e){}
 let r;try{r=await rpc("mf_bj_deal",{p_bet:bet,p_force:takeForce(),p_cheat:takeCheat()});}catch(e){return err(e);}
 const p=r.done?r.p:r.info.hand.p,d0=r.done?r.d[0]:r.info.hand.d[0];
 $("#bjBetT").innerHTML=`Mise : <b>${bet} 🍌</b>`;
 P=[p[0]];addCard("#bjP",p[0]);setTot("#bjPT",P);await wait(330);
 D=[d0];addCard("#bjD",d0);setTot("#bjDT",D);await wait(330);
 P.push(p[1]);addCard("#bjP",p[1]);setTot("#bjPT",P);await wait(330);
 addCard("#bjD",null,true);await wait(300);
 if(r.done)return finish(r);
 take(r.info);busy=false;
 if(total(P)>=19)say(pick(["Hmm… joli jeu.","Tu bluffes ?","Je sens que tu vas t'arrêter là."]));
 else if(val(d0)>=10)say(pick(["J'ai un bon pressentiment 🐒","Hé hé hé…","Tu veux tirer ? Vas-y, tire."]));
 render();}
async function act(a){if(busy||!S||!S.hand)return;ac();busy=true;render();
 let r;try{r=await rpc("mf_bj_act",{p_act:a});}catch(e){return err(e);}
 if(a!=="stand"){const p=r.done?r.p:r.info.hand.p,c=p[p.length-1];P.push(c);addCard("#bjP",c);setTot("#bjPT",P);
  if(a==="double")$("#bjBetT").innerHTML=`Mise doublée : <b>${2*S.hand.bet} 🍌</b>`;await wait(450);}
 if(r.done)return finish(r);
 take(r.info);busy=false;render();}
async function finish(r){
 // la carte cachée se retourne, puis le singe tire ses cartes
 const back=$("#bjD .bj-card.back");D=[r.d[0],r.d[1]];if(back){face(back,r.d[1]);await wait(60);back.classList.remove("back");flick();}
 setTot("#bjDT",D);await wait(550);
 for(let i=2;i<r.d.length;i++){
  if(r.cheat&&i===r.ci){await cheatShow();D.push(r.d[i]);const e=addCard("#bjD",r.d[i],false,"cheat");const s=document.createElement("span");s.className="bj-stamp";s.textContent="DE LA MANCHE";e.appendChild(s);}
  else{D.push(r.d[i]);addCard("#bjD",r.d[i]);}
  setTot("#bjDT",D);await wait(r.cheat&&i===r.ci?1100:600);}
 take(r.info);busy=false;outcome(r);render();}
function cheatShow(){return new Promise(done=>{const sc=$(".bj-scene");sc.classList.remove("bj-flash");void sc.offsetWidth;sc.classList.add("bj-flash");setTimeout(()=>sc.classList.remove("bj-flash"),1100);
 const m=$(".bj-monk");if(m&&!m.hidden&&m.dataset.t){m.src=IMG.triche;}
 wob();say("Oh ! Regarde ce que j'ai trouvé dans ma manche 🙈",3400);beep(180,0,.5,.06,"sawtooth");vib([60,40,60]);setTimeout(done,reduce?200:1100);});}
function outcome(r){const n=+r.net,b=+r.bet,pt=+r.pt,dt=+r.dt;
 const m=$(".bj-monk");if(m&&m.dataset.t)setTimeout(()=>{m.src=IMG.croupier;},2500);
 switch(r.out){
  case"monkey":monkeyShow(n,b);return;
  case"bj":win(true);show(`Blackjack ! +${n} 🍌`,`Payé 3 pour 2 sur ta mise de ${b} 🍌.`);say("Grrr… bien joué.");wob();return;
  case"win":win(n>=20);show(`Gagné ! +${n} 🍌`,dt>21?`Le singe a sauté avec ${dt} !`:`${pt} contre ${dt}.`);say(pick(["Pfff. Chance du débutant.","Je te laisse gagner, c'est tout.","La prochaine est pour moi 🍌"]));return;
  case"push":show("Égalité",`${pt} partout : tu récupères ta mise (${b} 🍌).`,"lose");say("Égalité… on remet ça ?");return;
  case"dealer_bj":sad();show("Blackjack du singe…",`Il cachait un ${cname(r.d[1])}. −${b} 🍌`,"lose");wob();say("BLACKJACK ! Hou hou hou ! 🐒");return;
  case"bust":sad();show("Sauté !",`${pt}, c'est trop. −${b} 🍌`,"lose");wob();say(pick(["Hou hou ! Trop gourmand !","Merci pour les bananes 🍌","Fallait t'arrêter, hé hé."]));return;
  default:sad();
   if(r.cheat){show("Arnaqué !",`Le singe a sorti un ${cname(r.d[r.ci])} de sa manche : ${dt} contre ${pt}. −${b} 🍌`,"cheat");say("Quoi ? Moi, tricher ? Jamais 😇",3200);}
   else{show("Perdu…",`${dt} contre ${pt}. −${b} 🍌`,"lose");say(pick(["Merci pour les bananes 🍌","Hé hé, la maison gagne toujours.","Encore une ?"]));}
   wob();}}
function monkeyShow(n,b){const o=$(".bj-mk");$("#bjMkS").textContent=`As + Roi singe : ta mise de ${b} 🍌 ×${S&&S.mpay||5} ! +${n} 🍌`;o.hidden=false;win(true);setTimeout(()=>win(true),700);
 const end=()=>{if(o.hidden)return;o.hidden=true;o.onclick=null;clearTimeout(t);show(`MONKEY BLACKJACK ! +${n} 🍌`,"As + Roi singe d'entrée.");};const t=setTimeout(end,4200);setTimeout(()=>{o.onclick=end;},800);say("Mon propre roi… contre moi ?! 😱",3500);}

/* ---------- admin ---------- */
async function adm(x,msg){try{const r=await rpc("mf_bj_admin",{p_action:x});take(r);if(x==="reset"){clearTable();$("#bjRes").hidden=true;}render();if(msg)toast(msg);}catch(e){err(e);}}

/* ---------- construction ---------- */
function build(){
 const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
 root=document.createElement("div");root.id="mfBJ";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","MonkeyJack 21");
 root.innerHTML=`<div class="bj-top"><button type="button" class="bj-btn l" id="bjTog" aria-controls="bjPanel" aria-expanded="false" aria-label="Règles">?</button>
  <h2 style="margin:0"><img class="bj-logo" src="${IMG.logo}" alt="MonkeyJack 21" width="1400" height="467"><span class="bj-logoT" hidden>MonkeyJack 21</span></h2>
  <div class="bj-chips"><span class="bj-chip">🍌 <b id="bjBan">…</b></span><span class="bj-chip">Boosters <b id="bjBoo">…</b></span></div>
  <button type="button" class="bj-btn r" id="bjClose" aria-label="Fermer">✕</button></div>
 <div class="bj-scene"><div class="bj-tbl" aria-hidden="true"></div>
  <div class="bj-dealer"><img class="bj-monk" src="${IMG.croupier}" alt="Le singe croupier"><span class="bj-monkE" hidden role="img" aria-label="Le singe croupier">🐒</span><div class="bj-say" aria-live="polite"></div></div>
  <div class="bj-rows">
   <div class="bj-side"><div class="bj-lab">Le singe <span class="bj-tot" id="bjDT" hidden></span></div><div class="bj-hand" id="bjD"></div></div>
   <div class="bj-side"><div class="bj-hand" id="bjP"></div><div class="bj-lab">Toi <span class="bj-tot" id="bjPT" hidden></span></div><div class="bj-bet" id="bjBetT"></div></div>
  </div>
  <div class="bj-act">
   <div id="bjBetBox">
    <div class="bj-mise"><button type="button" class="bj-pm" id="bjMinus" aria-label="Miser moins">−</button><span class="bj-amt" id="bjAmt" aria-live="polite"></span><button type="button" class="bj-pm" id="bjPlus" aria-label="Miser plus">+</button></div>
    <div class="bj-quick"><button type="button" class="bj-q" data-v="1">1</button><button type="button" class="bj-q" data-v="5">5</button><button type="button" class="bj-q" data-v="10">10</button><button type="button" class="bj-q" data-v="20">20</button></div>
    <button type="button" class="bj-big" id="bjDeal"></button>
   </div>
   <div id="bjPlay" hidden><div class="bj-row3"><button type="button" class="bj-big g" id="bjHit">Tirer</button><button type="button" class="bj-big" id="bjStand">Rester</button><button type="button" class="bj-big p" id="bjDbl">Doubler</button></div></div>
   <div class="bj-sub" id="bjSub"></div>
  </div>
  <div class="bj-res" id="bjRes" hidden role="status"><div class="t"></div><div class="s"></div></div>
 </div>
 <aside class="bj-panel" id="bjPanel" aria-label="Règles et réglages">
  <div class="bj-ph"><h3>Règles</h3><button type="button" class="bj-btn" style="position:static" id="bjPanelX" aria-label="Fermer les règles">✕</button></div>
  <ul class="r">
   <li>Approche-toi de 21 sans dépasser, et bats le singe.</li>
   <li>Les figures valent 10, l'As 1 ou 11.</li>
   <li><b>Tirer</b> : une carte de plus. <b>Rester</b> : le singe joue. <b>Doubler</b> (sur tes deux premières cartes) : ta mise double et tu reçois une seule carte.</li>
   <li>Le singe tire jusqu'à 17 et s'arrête à 17.</li>
   <li>Gagné : ta mise ×2. Égalité : ta mise revient. Blackjack (21 d'entrée) : payé 3 pour 2.</li>
   <li>👑🐒 <b>Monkey Blackjack</b> : un As et un Roi singe d'entrée, ta mise ×5 !</li>
   <li>10 mains par jour, mise de 1 à 20 🍌.</li>
   <li>Méfie-toi du croupier : il paraît qu'il cache des cartes dans sa manche…</li>
  </ul>
  <h3>Dernières mains</h3><ul class="bj-hist" id="bjHist"></ul>
  <div class="bj-adm" id="bjAdm" hidden>
   <h3>Réglages admin</h3>
   <p id="bjState"></p>
   <div class="bj-btns"><button type="button" id="bjOpen"></button></div>
   <label for="bjF">Prochaine donne</label>
   <select id="bjF"><option value="">Au hasard</option><option value="monkey">Monkey Blackjack pour moi</option><option value="bj">Blackjack pour moi</option><option value="dealer">Blackjack du singe</option><option value="bust">Le singe va sauter (20 contre 16)</option></select>
   <label class="bj-chk"><input type="checkbox" id="bjFC"> Le singe triche à la prochaine main s'il saute</label>
   <div class="bj-btns"><button type="button" id="bjReset">Rendre mes mains du jour</button><button type="button" id="bjAdd">+50 🍌</button></div>
  </div>
 </aside>
 <div class="bj-mk" hidden aria-live="assertive"><div class="bj-mkE" aria-hidden="true"><img src="${IMG.as}" alt=""><img src="${IMG.roi}" alt=""></div><div class="bj-mkT">MONKEY<b>BLACKJACK !</b></div><div class="bj-mkS" id="bjMkS"></div></div>
 <div class="bj-toast" role="status"></div>`;
 document.body.appendChild(root);
 $("#bjAdm").hidden=!ADMIN;
 // images de Kévin : si elles ne sont pas encore là, titre en texte et singe en emoji
 const lg=$(".bj-logo"),noLogo=()=>{lg.hidden=true;$(".bj-logoT").hidden=false;};lg.onerror=noLogo;if(lg.complete&&!lg.naturalWidth)noLogo();
 const mk=$(".bj-monk");mk.onload=()=>{mk.dataset.t="1";};mk.onerror=()=>{if(mk.dataset.t){mk.src=IMG.croupier;return;}mk.hidden=true;$(".bj-monkE").hidden=false;};if(mk.complete&&!mk.naturalWidth)mk.onerror();
 $("#bjClose").addEventListener("click",close);
 $("#bjMinus").addEventListener("click",()=>{bet=Math.max(+S.min||1,bet-1);render();});
 $("#bjPlus").addEventListener("click",()=>{bet=Math.min(+S.maxBet||20,bet+1);render();});
 root.querySelectorAll(".bj-q").forEach(q=>q.addEventListener("click",()=>{bet=+q.dataset.v;clampBet();render();}));
 $("#bjDeal").addEventListener("click",deal);
 $("#bjHit").addEventListener("click",()=>act("hit"));
 $("#bjStand").addEventListener("click",()=>act("stand"));
 $("#bjDbl").addEventListener("click",()=>act("double"));
 $("#bjRes").addEventListener("click",()=>{$("#bjRes").hidden=true;});
 $("#bjTog").addEventListener("click",()=>panel(!$("#bjPanel").classList.contains("open")));
 $("#bjPanelX").addEventListener("click",()=>{panel(false);$("#bjTog").focus({preventScroll:true});});
 $("#bjOpen").addEventListener("click",()=>adm(S&&S.open?"close":"open",S&&S.open?"Le blackjack est de nouveau caché.":"MonkeyJack 21 est ouvert à tous les joueurs !"));
 $("#bjReset").addEventListener("click",()=>adm("reset","Tes mains du jour sont rendues."));
 $("#bjAdd").addEventListener("click",()=>adm("bananas","+50 🍌 sur ton compte."));
 root.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!$(".bj-mk").hidden){$(".bj-mk").click();return;}if($("#bjPanel").classList.contains("open"))panel(false);else close();});
 setInterval(()=>{if(!root.hidden&&!busy)render();},30000);
}
function panel(o){$("#bjPanel").classList.toggle("open",o);$("#bjTog").setAttribute("aria-expanded",String(o));}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
 if(!root)build();
 root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 $("#bjClose").focus({preventScroll:true});render();
 try{const r=await rpc("mf_bj_status");if(r.now)skew=+r.now-Date.now();take(r);if(r.hand)drawHand(r.hand);
  if(!busy&&!r.hand&&!P.length)say(pick(["Approche, approche… 🃏","Tu viens perdre tes bananes ?","Faites vos jeux !"]));render();}catch(e){show("Oups",errText(e),"lose");}
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
 let ok=ADMIN;if(!ok){try{ok=!!(await rpc("mf_bj_open"));}catch(e){}}
 if(!ok||!window.MF_CASINO)return;
 Object.values(IMG).forEach(u=>{const i=new Image();i.src=u;});
 window.MF_CASINO.add({id:"bj",name:"MonkeyJack 21",order:6,root:"mfBJ",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="11" height="15" rx="2" transform="rotate(-10 8.5 12.5)"/><rect x="10" y="4" width="11" height="15" rx="2" transform="rotate(8 15.5 11.5)"/><path d="M14.5 9.5l1.6 3.8 1.6-3.8M15 12h2.4"/></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){const r=await rpc("mf_bj_status");if(r.now)skew=+r.now-Date.now();take(r);}const I=S;if(!I)return null;
   if(I.hand)return {line:"Une main est en cours : le singe t'attend !",hot:true};
   if(+I.left>0)return {line:`Encore ${I.left} main${+I.left>1?"s":""} aujourd'hui · mise jusqu'à ${I.maxBet} 🍌`,hot:false};
   return {line:"Plus de mains aujourd'hui",pre:"Nouvelles mains dans ",in:+I.nextDay-(Date.now()+skew),hot:false};}});
}
window.MF_BJ={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

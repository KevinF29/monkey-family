/* Monkey Family — The Monkey Tower (ex-« La Tour du Temple », jeu du Casino : on monte un temple étage par étage)
   À chaque étage, 3 portes dont une piégée : la bonne porte fait monter, la mauvaise ouvre une trappe sous le singe.
   Après chaque étage passé, on peut redescendre avec son butin (mise × gain de l'étage). 8 étages, ×24 au sommet.
   La porte piégée est tirée par le serveur au moment du choix (mf_tour_*, supabase-tour.sql).
   Visible par l'admin seulement tant que le jeu n'est pas ouvert à tous (réglages admin → « Ouvrir à tous »). */
(function(){
"use strict";

// images de Kévin (facultatives) : sans elles, le temple et les portes sont dessinés, et le singe est un emoji
const IMG={logo:"packs/tour-titre.webp",fond:"packs/tour-fond.webp",mur:"packs/tour-mur.webp",porte:"packs/tour-porte.webp",or:"packs/tour-porte-or.webp",piege:"packs/tour-porte-piege.webp",
 trappe:"packs/tour-trappe.webp",escalier:"packs/tour-escalier.webp",singe:"packs/tour-singe.webp",chute:"packs/tour-chute.webp",idole:"packs/tour-idole.webp"};
const NAME="The Monkey Tower";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR={no_bananas:"Pas assez de bananes.",tour_limit:"Plus de montées aujourd'hui : reviens demain !",tour_closed:"The Monkey Tower n'est pas encore ouverte.",
 tour_in_game:"Une montée est déjà en cours.",tour_no_game:"Pas de montée en cours.",tour_bet:"Mise impossible.",tour_door:"Porte inconnue.",tour_ground:"Passe au moins un étage avant de redescendre.",
 not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait=ms=>new Promise(r=>setTimeout(r,reduce?Math.min(ms,120):ms));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const SIDE=["de gauche","du milieu","de droite"];
const DX=[20,50,80];   // centre des portes (% de la rangée de portes)
const SX=i=>(3+.94*DX[i]).toFixed(1)+"%";   // le même centre, en % de la scène (la rangée de portes commence à 3 %)
const fx=x=>"×"+String(+x).replace(".",",");
const ord=n=>n===1?"1er":n+"e";

/* ---------- style ---------- */
const CSS=`
#mfTOUR{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;color:#f4eedc;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:#10200f;background-image:linear-gradient(rgba(8,18,8,.1),rgba(8,14,6,.45)),url(${IMG.fond}),radial-gradient(ellipse at 50% 0%,#3d6b2a,#17301a 55%,#0b170b);background-size:cover;background-position:center}
#mfTOUR[hidden]{display:none}
#mfTOUR *{box-sizing:border-box;min-width:0}
#mfTOUR [hidden]{display:none!important}
#mfTOUR,#mfTOUR *{-webkit-tap-highlight-color:transparent}
#mfTOUR button:focus-visible,#mfTOUR select:focus-visible{outline:3px solid #8fd3ff;outline-offset:2px}
.tt-top{flex:none;position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;padding:max(8px,env(safe-area-inset-top)) 58px 6px}
.tt-logo{display:block;height:clamp(52px,9svh,110px);width:auto;max-width:100%;filter:drop-shadow(0 8px 12px rgba(0,0,0,.5))}
.tt-logoT{margin:0;font:400 clamp(24px,6.5vw,36px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 #7a4f00,0 0 16px rgba(0,0,0,.5);text-align:center}
.tt-btn{position:absolute;top:max(8px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(16,24,14,.78);color:#ffd23f;font:700 19px Quicksand,sans-serif;cursor:pointer;display:grid;place-items:center}
.tt-btn.l{left:10px}.tt-btn.r{right:10px}
.tt-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px}
.tt-chip{background:#1d2a17;border:1px solid #3d5530;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13.5px;white-space:nowrap}
.tt-chip b{color:#ffd23f}
.tt-lad{flex:none;display:flex;gap:4px;justify-content:center;width:min(100%,640px);padding:2px 10px 6px}
.tt-st{flex:1;max-width:66px;border-radius:9px;padding:2px 0;text-align:center;font:700 12px/1.15 Quicksand,sans-serif;background:rgba(16,22,12,.75);border:1px solid #3d5530;color:#b9c4a8}
.tt-st b{display:block;font:400 14px "Titan One",sans-serif;color:#e8dcb0}
.tt-st.ok{background:#4d3a0d;border-color:#d9a514;color:#ffe9a8}.tt-st.ok b{color:#ffd23f}
.tt-st.nx{border-color:#ffd23f;box-shadow:0 0 0 2px #ffd23f inset;animation:ttNx 1.2s infinite alternate}
.tt-st.top b{color:#ffd23f}
@keyframes ttNx{to{background:#33421f}}
.tt-stage{flex:1;min-height:0;max-height:calc(min(100vw,640px)*1.5);width:min(100%,640px);position:relative;overflow:hidden;margin:auto;container-type:size}
.tt-floor{position:absolute;inset:0;container-type:size}
/* le mur du temple */
.tt-wall{position:absolute;left:3%;right:3%;top:4%;bottom:30%;border-radius:14px 14px 0 0;
 background:repeating-linear-gradient(0deg,transparent 0 calc(12.5% - 2px),rgba(0,0,0,.28) calc(12.5% - 2px) 12.5%),
  repeating-linear-gradient(90deg,transparent 0 calc(16.66% - 2px),rgba(0,0,0,.18) calc(16.66% - 2px) 16.66%),
  linear-gradient(180deg,#9b8a62,#7b6b48 60%,#5e5135);box-shadow:inset 0 0 0 3px #4a3f28,inset 0 14px 30px rgba(0,0,0,.35),0 10px 24px rgba(0,0,0,.5)}
.tt-wall::before{content:"";position:absolute;left:-2%;right:-2%;top:-5%;height:9%;border-radius:8px;background:linear-gradient(#b9a777,#7b6b48);box-shadow:0 4px 8px rgba(0,0,0,.4)}
.tt-vine{position:absolute;top:0;width:10%;height:55%;background:radial-gradient(circle at 50% 10%,#3f8a2e 30%,transparent 31%) 0 0/100% 18% repeat-y;opacity:.85;pointer-events:none}
.tt-vine.a{left:0}.tt-vine.b{right:0;height:40%}
.tt-lvl{position:absolute;left:0;right:0;top:4%;text-align:center;font:400 clamp(15px,4.6cqw,22px) "Titan One",sans-serif;color:#fff3c4;text-shadow:0 2px 0 #4a3f28,0 0 10px rgba(0,0,0,.6)}
.tt-lvl small{display:block;font:700 clamp(12px,3.4cqw,15px) Quicksand,sans-serif;color:#fff;text-shadow:0 1px 3px #000}
/* les portes */
.tt-door{position:absolute;bottom:0;width:22%;height:62%;margin-left:-11%;padding:0;border:0;background:none;cursor:default;perspective:400px}
.tt-door .fr{position:absolute;inset:0;border-radius:50% 50% 0 0/28% 28% 0 0;background:linear-gradient(#6a5a3a,#3e3422);box-shadow:inset 0 0 0 4px #c8b07a,0 0 0 4px #4a3f28}
.tt-door .in{position:absolute;inset:8% 9% 0;border-radius:50% 50% 0 0/26% 26% 0 0;background:#0b0805;overflow:hidden}
.tt-door .in::after{content:"";position:absolute;inset:0;opacity:0;transition:opacity .4s}
.tt-door.gold .in::after{opacity:1;background:radial-gradient(ellipse at 50% 70%,#fff6c2,#ffcf3f 35%,#a86a00 75%,#3a2200)}
.tt-door.dark .in::after{opacity:1;background:radial-gradient(ellipse at 50% 80%,#3a0c0c,#0b0505 70%)}
.tt-door .sk{position:absolute;left:0;right:0;bottom:18%;text-align:center;font-size:calc(22cqw*.36);opacity:0;transform:scale(.4);transition:opacity .3s .2s,transform .4s .2s cubic-bezier(.2,1.6,.4,1)}
.tt-door.dark .sk{opacity:1;transform:none}
.tt-door .pl{position:absolute;top:8%;bottom:0;width:41%;background:repeating-linear-gradient(90deg,#7a4a20 0 18%,#5c3514 18% 22%),#6a3f19;box-shadow:inset 0 0 0 2px #3a2008,inset 0 -10px 16px rgba(0,0,0,.35);transition:transform .55s cubic-bezier(.4,.1,.3,1)}
.tt-door .pl.a{left:9%;border-radius:100% 0 0 0/26% 0 0 0;transform-origin:0 50%}
.tt-door .pl.b{right:9%;border-radius:0 100% 0 0/0 26% 0 0;transform-origin:100% 50%}
.tt-door .pl::after{content:"";position:absolute;top:52%;width:9%;aspect-ratio:1;border-radius:50%;background:#d9a514;box-shadow:0 0 0 2px #7a5200}
.tt-door .pl.a::after{right:12%}.tt-door .pl.b::after{left:12%}
.tt-door.open .pl.a{transform:rotateY(-78deg)}.tt-door.open .pl.b{transform:rotateY(78deg)}
.tt-door .gl{position:absolute;left:50%;top:-2%;transform:translateX(-50%);font-size:calc(22cqw*.22);filter:drop-shadow(0 2px 2px rgba(0,0,0,.6));opacity:.85}
.tt-doors.pick .tt-door{cursor:pointer}
.tt-doors.pick .tt-door .fr{animation:ttHint 1.3s infinite ease-in-out}
.tt-doors.pick .tt-door:nth-child(2) .fr{animation-delay:.22s}.tt-doors.pick .tt-door:nth-child(3) .fr{animation-delay:.44s}
@keyframes ttHint{50%{box-shadow:inset 0 0 0 4px #ffe58a,0 0 0 4px #4a3f28,0 0 22px rgba(255,210,63,.85)}}
.tt-door.sel .fr{box-shadow:inset 0 0 0 4px #ffd23f,0 0 0 4px #ffd23f,0 0 24px #ffd23f}
.tt-doors{position:absolute;left:3%;right:3%;top:22%;bottom:30%;container-type:inline-size}
/* le palier, les trappes et l'escalier */
.tt-land{position:absolute;left:0;right:0;bottom:22%;height:8%;background:linear-gradient(#a8966a,#6e603f);box-shadow:0 6px 10px rgba(0,0,0,.45)}
.tt-trap{position:absolute;top:10%;width:20%;height:70%;margin-left:-10%;border-radius:50%;background:#050302;transform:scaleX(0);transition:transform .25s ease-out;box-shadow:inset 0 6px 10px #000}
.tt-trap.on{transform:none}
.tt-steps{position:absolute;left:12%;right:12%;bottom:0;height:22%;background:repeating-linear-gradient(180deg,#8c7b54 0 calc(20% - 4px),#4e4430 calc(20% - 4px) 20%);clip-path:polygon(14% 0,86% 0,100% 100%,0 100%)}
/* le singe */
.tt-monk{--mw:clamp(44px,min(19cqw,30cqh),130px);position:absolute;left:50%;bottom:24%;width:var(--mw);margin-left:calc(var(--mw)*-.5);z-index:5;pointer-events:none;
 transition:left .55s ease-in-out,bottom .55s ease-in-out,transform .4s,opacity .4s;transform-origin:50% 100%}
.tt-monk img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 8px rgba(0,0,0,.55))}
.tt-monk .e{display:block;text-align:center;font-size:calc(var(--mw)*.8);line-height:1;filter:drop-shadow(0 6px 8px rgba(0,0,0,.55))}
.tt-monk.walk{animation:ttWalk .28s infinite alternate ease-in-out}
@keyframes ttWalk{from{rotate:-5deg;translate:0 0}to{rotate:5deg;translate:0 -6%}}
.tt-monk.in{transform:scale(.55);opacity:0}
.tt-monk.fall{transition:bottom .7s cubic-bezier(.5,0,1,.6),transform .7s,opacity .7s .3s;bottom:-40%!important;transform:rotate(200deg) scale(.6);opacity:0}
.tt-say{position:absolute;right:4%;top:20%;z-index:6;max-width:46%;background:#fff;color:#1f2a12;border-radius:14px 14px 4px 14px;padding:6px 10px;font-weight:700;font-size:13.5px;line-height:1.25;box-shadow:0 4px 10px rgba(0,0,0,.35);opacity:0;transform:scale(.8);transition:opacity .2s,transform .2s;pointer-events:none}
.tt-say.on{opacity:1;transform:none}
.tt-ask{position:absolute;left:0;right:0;bottom:14%;z-index:4;text-align:center;font-weight:700;font-size:14.5px;color:#fff;text-shadow:0 1px 3px #000,0 0 8px #000;pointer-events:none;min-height:1.4em}
.tt-stage>.tt-res{position:absolute;z-index:8;left:5%;right:5%;top:30%;background:rgba(24,30,18,.96);box-shadow:0 10px 30px rgba(0,0,0,.5);border:1px solid #4d6a3a;border-radius:18px;padding:12px 16px;text-align:center;cursor:pointer;-webkit-user-select:none;user-select:none;animation:ttPop .35s cubic-bezier(.2,1.5,.4,1) both}
.tt-res .t{font:400 24px/1.15 "Titan One",sans-serif;color:#ffd23f}
.tt-res .t.lose{color:#c9b8a8}
.tt-res .s{color:#e0dccb;font-size:14.5px;margin-top:4px}
.tt-res img{display:block;margin:0 auto 6px;max-height:110px;max-width:60%}
@keyframes ttPop{from{transform:scale(.6);opacity:0}}
.tt-flash{animation:ttRed .25s 4 alternate}@keyframes ttRed{to{box-shadow:inset 0 0 120px rgba(227,24,61,.85)}}
.tt-goldF{animation:ttGold .5s 3 alternate}@keyframes ttGold{to{box-shadow:inset 0 0 140px rgba(255,210,63,.8)}}
/* actions */
.tt-act{flex:none;width:min(100%,640px);text-align:center;padding:6px 14px max(14px,env(safe-area-inset-bottom))}
.tt-mise{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.tt-pm{width:46px;height:46px;border-radius:50%;border:2px solid #ffd23f;background:rgba(0,0,0,.35);color:#ffd23f;font:700 24px Quicksand,sans-serif;cursor:pointer}
.tt-pm:disabled{opacity:.35;cursor:default}
.tt-amt{min-width:84px;font:400 26px "Titan One",sans-serif;color:#fff;text-shadow:0 2px 0 #23361a}
.tt-q{min-width:46px;min-height:40px;border-radius:999px;border:2px solid rgba(255,255,255,.5);background:#2c3d20;color:#fff;font:700 15px Quicksand,sans-serif;cursor:pointer}
.tt-q.on{background:#ffd23f;color:#2a1a00;border-color:#ffd23f}
.tt-q:disabled{opacity:.35;cursor:default}
.tt-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.tt-big{min-height:52px;padding:10px 22px;border-radius:16px;border:0;background:#ffd23f;color:#2a1a00;font:400 19px "Titan One",sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8901a;transition:transform .08s,box-shadow .08s}
.tt-big:active{transform:translateY(2px);box-shadow:0 2px 0 #b8901a}
.tt-big:disabled{background:#4a4f3c;color:#a3a690;box-shadow:none;cursor:default}
.tt-big.cash{background:#3fbf6a;color:#062010;box-shadow:0 4px 0 #1f7a3e}
.tt-big.cash:active{box-shadow:0 2px 0 #1f7a3e}
.tt-sub{color:#fff;text-shadow:0 1px 3px #000;font-size:13px;margin-top:6px;font-weight:700}
/* règles et réglages */
.tt-panel{position:absolute;top:0;left:0;bottom:0;z-index:30;width:min(400px,100%);overflow-y:auto;overscroll-behavior:contain;background:#16200f;border-right:1px solid #3d5530;
 padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s;visibility:hidden}
.tt-panel.open{transform:none;visibility:visible}
.tt-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.tt-panel h3{font:400 19px "Titan One",sans-serif;color:#ffd23f;margin:14px 0 6px}
.tt-ph h3{margin:0}
.tt-panel p,.tt-panel li{color:#cfd6c0;font-size:14px}
.tt-panel p{margin:4px 0}
.tt-panel ul.r{margin:4px 0;padding-left:18px}
.tt-tab{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:4px}
.tt-tab td,.tt-tab th{padding:3px 4px;border-bottom:1px solid #2c3d20;text-align:center}
.tt-tab th{color:#ffd23f;font-weight:700}
.tt-hist{list-style:none;margin:0;padding:0;font-size:14px}
.tt-hist li{padding:5px 0;border-bottom:1px solid #2c3d20}
.tt-hist:empty::after{content:"Aucune montée pour l'instant.";color:#9fa98f}
.tt-adm label{display:block;margin:10px 0 4px;font-weight:700;font-size:14px}
.tt-adm select{width:100%;min-height:44px;font:16px Quicksand,sans-serif;border-radius:10px;border:1px solid #4d6a3a;background:#0f170b;color:#f4eedc;padding:0 10px}
.tt-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.tt-btns button{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid #4d6a3a;background:#26361b;color:#f4eedc;font:700 14px Quicksand,sans-serif;cursor:pointer}
.tt-btns button.on{background:#ffd23f;color:#2a1a00;border-color:#ffd23f}
/* images de Kévin (classes posées quand elles ont chargé) */
#mfTOUR.wimg .tt-wall{background:url(${IMG.mur}) center top/cover;box-shadow:0 10px 24px rgba(0,0,0,.5);border-radius:6px 6px 0 0}
#mfTOUR.wimg .tt-land{background:linear-gradient(rgba(255,230,170,.08),rgba(0,0,0,.4)),url(${IMG.mur}) 50% 100%/100% auto}
#mfTOUR.wimg .tt-steps{background:repeating-linear-gradient(180deg,transparent 0 calc(20% - 4px),rgba(0,0,0,.55) calc(20% - 4px) 20%),linear-gradient(rgba(0,0,0,.05),rgba(0,0,0,.35)),url(${IMG.mur}) 50% 100%/160% auto}
#mfTOUR.wimg .tt-wall::before,#mfTOUR.wimg .tt-vine{display:none}
#mfTOUR.wimg .tt-lvl{top:24%}
.tt-door .im{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%;display:none;transition:opacity .35s;pointer-events:none;-webkit-user-drag:none}
#mfTOUR.dimg .tt-door{width:auto;height:min(90%,43cqw);aspect-ratio:2/3;margin-left:0;transform:translateX(-50%);filter:drop-shadow(0 6px 8px rgba(0,0,0,.5))}
#mfTOUR.dimg .tt-door .fr,#mfTOUR.dimg .tt-door .in,#mfTOUR.dimg .tt-door .pl,#mfTOUR.dimg .tt-door .gl{display:none}
#mfTOUR.dimg .tt-door .im{display:block}
#mfTOUR.dimg .tt-door .im.g,#mfTOUR.dimg .tt-door .im.d{opacity:0}
#mfTOUR.dimg .tt-door.gold .im.g,#mfTOUR.dimg .tt-door.dark .im.d{opacity:1}
#mfTOUR.dimg .tt-door.gold .im.c,#mfTOUR.dimg .tt-door.dark .im.c{opacity:0}
#mfTOUR.dimg .tt-doors.pick .tt-door{animation:ttHintI 1.3s infinite ease-in-out}
#mfTOUR.dimg .tt-doors.pick .tt-door:nth-child(2){animation-delay:.22s}#mfTOUR.dimg .tt-doors.pick .tt-door:nth-child(3){animation-delay:.44s}
@keyframes ttHintI{50%{filter:drop-shadow(0 0 14px rgba(255,210,63,.95))}}
#mfTOUR.dimg .tt-door.sel{filter:drop-shadow(0 0 16px #ffd23f)}
#mfTOUR.simg .tt-steps{left:7%;right:7%;top:calc(78% - 4px);bottom:auto;height:auto;aspect-ratio:1200/473;clip-path:none;background:url(${IMG.escalier}) center top/100% 100% no-repeat;filter:drop-shadow(0 8px 10px rgba(0,0,0,.5))}
#mfTOUR.timg .tt-trap{background:url(${IMG.trappe}) center/contain no-repeat;border-radius:0;box-shadow:none;width:30%;margin-left:-15%;height:auto;aspect-ratio:3/1;top:-30%;transform:scale(.15);opacity:0;transition:transform .25s ease-out,opacity .15s}
#mfTOUR.timg .tt-trap.on{transform:none;opacity:1}
@media(max-height:480px){#mfTOUR .tt-lvl,#mfTOUR.wimg .tt-lvl{top:1%;font-size:15px}#mfTOUR .tt-lvl small{display:inline;margin-left:6px}#mfTOUR.dimg .tt-door{height:min(80%,43cqw)}.tt-doors{top:24%}}
@media(prefers-reduced-motion:reduce){#mfTOUR.dimg .tt-doors.pick .tt-door{animation:none}}
.tt-toast{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));z-index:40;transform:translate(-50%,12px);background:#26361b;border:1px solid #ffd23f;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;max-width:92%;transition:transform .3s,opacity .3s;pointer-events:none;opacity:0}
.tt-toast.on{transform:translate(-50%,0);opacity:1}
@media(max-height:700px){.tt-logo{height:48px}.tt-logoT{font-size:24px}.tt-top{gap:3px}.tt-mise{margin-bottom:4px}.tt-big{min-height:46px;padding:8px 18px;font-size:17px}}
@media(max-height:480px){.tt-top{flex-direction:row;justify-content:center;gap:10px;padding-top:max(4px,env(safe-area-inset-top))}.tt-btn{top:max(4px,env(safe-area-inset-top))}
 .tt-logo{height:36px}.tt-logoT{font-size:20px}.tt-lad{padding-bottom:3px}.tt-st b{display:inline;font-size:12px;margin-left:2px}
 .tt-act{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;padding-top:3px}.tt-mise{margin:0}.tt-pm{width:38px;height:38px}.tt-amt{font-size:20px;min-width:60px}.tt-q{min-height:34px}
 .tt-big{min-height:40px;padding:6px 14px;font-size:15px}.tt-sub{margin:0}.tt-say{display:none}}
@media(prefers-reduced-motion:reduce){.tt-monk.walk,.tt-res,.tt-flash,.tt-goldF,.tt-doors.pick .tt-door .fr,.tt-st.nx{animation:none!important}}`;

/* ---------- état ---------- */
let root=null,USER=null,ADMIN=false,S=null,busy=false,bet=5,skew=0,shownFl=0;
const $=s=>root.querySelector(s);
function take(info){if(!info)return;S=info;try{if(window.MF_APPLY&&info.state)window.MF_APPLY(info.state);}catch(e){}}
try{const b=+localStorage.getItem("mf_tour_bet");if(b>0)bet=b;}catch(e){}
const M=()=>(S&&Array.isArray(S.mults)&&S.mults.length?S.mults:[1.4,2,3,4.5,7,10,15,24]).map(Number);
const TOP=()=>M().length;
const payOf=(b,fl)=>fl<1?0:Math.floor(b*M()[fl-1]+1e-9);
const G=()=>S&&S.game?{bet:+S.game.bet,fl:+S.game.fl}:null;

/* ---------- sons ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==="suspended")AC.resume().catch(()=>{});return AC;}
function beep(f,t0,dur,vol,type){const a=AC;if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type||"square";o.frequency.value=f;g.gain.setValueAtTime(vol,a.currentTime+t0);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t0+dur);o.connect(g).connect(a.destination);o.start(a.currentTime+t0);o.stop(a.currentTime+t0+dur+.02);}catch(e){}}
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};
const step=()=>{beep(140,0,.05,.05,"triangle");vib(5);};
const creak=()=>{beep(220,0,.25,.03,"sawtooth");beep(180,.1,.3,.025,"sawtooth");};
const upS=fl=>{[523,659,784].forEach((f,i)=>beep(f*(1+fl*.06),i*.08,.16,.05,"triangle"));vib(30);};
const winS=()=>{[523,659,784,1047,1319,1568,2093].forEach((f,i)=>beep(f,i*.09,.2,.06,"triangle"));vib([60,40,60,40,160]);};
const cashS=()=>{[784,988,1175].forEach((f,i)=>beep(f,i*.07,.14,.05,"triangle"));vib(40);};
const fallS=()=>{const a=AC;if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type="sawtooth";o.frequency.setValueAtTime(600,a.currentTime);o.frequency.exponentialRampToValueAtTime(70,a.currentTime+.8);g.gain.setValueAtTime(.06,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+.9);o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+.95);}catch(e){}vib([80,40,160]);};

/* ---------- le temple ---------- */
const doors=()=>[...root.querySelectorAll(".tt-door")];
function drawFloor(n){   // n = étage affiché (1..TOP)
 const m=M()[n-1];shownFl=n;
 $(".tt-lvl").innerHTML=n>TOP()?"":`${n===TOP()?"Dernier étage":`${ord(n)} étage`}<small>${fx(m)}${G()?` · ${payOf(G().bet,n)} 🍌`:""}</small>`;
 doors().forEach(d=>{d.className="tt-door";d.disabled=true;});
 root.querySelectorAll(".tt-trap").forEach(t=>t.classList.remove("on"));}
function ladder(){if(!S)return;const g=G(),fl=g?g.fl:0,ms=M();
 $(".tt-lad").innerHTML=ms.map((m,i)=>{const k=i+1;return `<span class="tt-st${k<=fl?" ok":""}${g&&k===fl+1?" nx":""}${k===ms.length?" top":""}" aria-label="Étage ${k} : ${fx(m)}">${k===ms.length?"🗿":k}<b>${fx(m)}</b></span>`;}).join("");}
function monkAt(where,cls){const e=$(".tt-monk");e.classList.remove("in","fall","walk");void e.offsetWidth;
 if(where==="land"){e.style.left="50%";e.style.bottom="24%";}
 else if(where==="base"){e.style.left="50%";e.style.bottom="-30%";}
 else{e.style.left=SX(where);e.style.bottom="30%";}
 if(cls)e.classList.add(cls);}
function monkImg(fall){const i=$(".tt-monk img");if(!i||i.hidden)return;i.src=fall&&chuteOk?IMG.chute:IMG.singe;}
let chuteOk=false,idoleOk=false;

/* ---------- le singe parle ---------- */
let sayT=0;
function say(t,ms){const e=$(".tt-say");e.textContent=t;e.classList.add("on");clearTimeout(sayT);sayT=setTimeout(()=>e.classList.remove("on"),ms||2600);}

/* ---------- affichage ---------- */
const hhmm=ms=>{const m=Math.max(0,Math.round(ms/60000));return `${Math.floor(m/60)} h ${String(m%60).padStart(2,"0")}`;};
function clampBet(){if(!S)return;bet=Math.max(+S.min||1,Math.min(+S.maxBet||10,bet));}
function ask(t){$(".tt-ask").textContent=t||"";}
function render(){if(!root)return;
 const st=S&&S.state;$("#ttBan").textContent=st?st.bananas:"…";$("#ttBoo").textContent=st?st.stock:"…";
 if(!S)return;clampBet();ladder();
 const ban=st?+st.bananas:0,g=G();
 $("#ttBetBox").hidden=!!g;$("#ttPlay").hidden=!g;
 $("#ttAmt").textContent=`${bet} 🍌`;
 $("#ttMinus").disabled=busy||bet<=+S.min;$("#ttPlus").disabled=busy||bet>=+S.maxBet;
 root.querySelectorAll(".tt-q").forEach(q=>{const v=+q.dataset.v;q.disabled=busy||v>+S.maxBet||v<+S.min;q.classList.toggle("on",v===bet);});
 const d=$("#ttGo");d.disabled=busy||+S.left<=0||ban<bet;
 d.textContent=+S.left<=0?"Plus de montées aujourd'hui":ban<bet?"Pas assez de bananes":`Monter · ${bet} 🍌`;
 if(g){const c=$("#ttCash");c.disabled=busy||g.fl<1;c.textContent=g.fl<1?"Choisis une porte":`Redescendre avec ${payOf(g.bet,g.fl)} 🍌`;
  $("#ttSub").textContent=`Mise : ${g.bet} 🍌 · étage suivant ${fx(M()[g.fl])} = ${payOf(g.bet,g.fl+1)} 🍌`;}
 else $("#ttSub").textContent=`Montées : ${S.left}/${S.max}`+(+S.left<=0?` · Nouvelles montées dans ${hhmm(+S.nextDay-(Date.now()+skew))}`:` · sommet = ${payOf(bet,TOP())} 🍌`);
 $("#ttLim").textContent=`${S.max} montées par jour, mise de ${S.min} à ${S.maxBet} 🍌.`;
 $("#ttTab").innerHTML=`<tr><th>Étage</th>${M().map((m,i)=>`<th>${i+1}</th>`).join("")}</tr><tr><td>Gain</td>${M().map(m=>`<td>${fx(m)}</td>`).join("")}</tr><tr><td>Chances</td>${M().map((m,i)=>`<td>${Math.round(100*Math.pow(2/3,i+1))} %</td>`).join("")}</tr>`;
 $("#ttHist").innerHTML=(S.hist||[]).map(h=>`<li>${esc(h)}</li>`).join("");
 if(ADMIN){const o=$("#ttOpen");o.textContent=S.open?"Cacher aux joueurs":"Ouvrir à tous les joueurs";o.classList.toggle("on",!S.open);
  $("#ttState").textContent=S.open?"The Monkey Tower est ouverte à tous les joueurs.":"The Monkey Tower est visible par toi seulement.";}}
function show(t,s,cls,img){const r=$("#ttRes");r.innerHTML=`${img?`<img src="${img}" alt="">`:""}<div class="t${cls?" "+cls:""}"></div><div class="s"></div>`;r.querySelector(".t").textContent=t;r.querySelector(".s").textContent=s||"";r.hidden=false;}
let tt=0;function toast(t){const e=$(".tt-toast");e.textContent=t;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500);}
function setPick(on){$(".tt-doors").classList.toggle("pick",on);doors().forEach((d,i)=>{d.disabled=!on;d.setAttribute("aria-label",`Porte ${SIDE[i]}`);});
 if(on)ask("Une des trois portes est piégée… laquelle ouvres-tu ?");else ask("");}
function idle(){busy=false;drawFloor(1);monkAt("land");setPick(false);render();}
const err=e=>{busy=false;show("Oups",errText(e),"lose");rpc("mf_tour_status").then(r=>{take(r);resume();},()=>{render();});};
const takeForce=()=>{if(!ADMIN)return null;const el=$("#ttF"),v=el.value;el.value="";return v||null;};
function resume(){const g=G();if(g){drawFloor(g.fl+1);monkAt("land");setPick(true);}else{drawFloor(1);monkAt("land");setPick(false);}render();}
const sc=()=>$(".tt-stage");
function flash(c){const s=sc();s.classList.remove(c);void s.offsetWidth;s.classList.add(c);setTimeout(()=>s.classList.remove(c),1400);}

/* ---------- une montée ---------- */
async function go(){if(busy||!S||S.game)return;ac();busy=true;$("#ttRes").hidden=true;render();
 try{localStorage.setItem("mf_tour_bet",String(bet));}catch(e){}
 let r;try{r=await rpc("mf_tour_start",{p_bet:bet,p_force:takeForce()});}catch(e){return err(e);}
 take(r);drawFloor(1);render();
 // le singe arrive par l'escalier
 monkAt("base");monkImg(false);await wait(60);monkAt("land","walk");for(let i=0;i<4;i++){step();await wait(140);}
 $(".tt-monk").classList.remove("walk");
 busy=false;setPick(true);render();
 say(pick(["Allez, on grimpe ! 🐒","Trois portes… une seule mauvaise.","J'ai un bon pressentiment !"]));}

async function choose(i){const g=G();if(busy||!g)return;ac();busy=true;setPick(false);render();
 doors()[i].classList.add("sel");
 // le singe s'avance vers la porte
 monkAt(i,"walk");step();await wait(280);step();
 let r;try{r=await rpc("mf_tour_pick",{p_door:i});}catch(e){monkAt("land");return err(e);}
 await wait(300);$(".tt-monk").classList.remove("walk");
 const trap=+r.trap,dd=doors();
 creak();dd[i].classList.add("open",r.out==="fall"?"dark":"gold");
 if(r.out==="fall"){
  await wait(350);root.querySelectorAll(".tt-trap")[i].classList.add("on");monkImg(true);await wait(120);
  $(".tt-monk").classList.add("fall");fallS();flash("tt-flash");
  await wait(600);dd.forEach((d,k)=>{if(k!==i)d.classList.add("open","gold");});
  take(r.info);busy=false;render();
  const lost=+r.lost||0;
  show("Trappe !",`La porte ${SIDE[i]} était piégée : chute au ${ord(+r.fl+1)} étage.`+(lost?` Tu avais ${lost} 🍌 en poche… −${r.bet} 🍌`:` −${r.bet} 🍌`),"lose");
  say(pick(["Aïe aïe aïe… 🕳️","Qui a mis ce trou là ?!","Je reviendrai… 🐒"]),3000);
  setTimeout(()=>{if(!busy&&!G()){monkImg(false);idle();}},3600);
  return;}
 // bonne porte : le singe entre, on montre où était le piège, puis l'étage suivant descend
 upS(+r.fl);await wait(420);$(".tt-monk").classList.add("in");
 await wait(450);dd[trap].classList.add("open","dark");root.querySelectorAll(".tt-trap")[trap].classList.add("on");
 take(r.info);render();
 if(r.out==="top"){await wait(700);winS();flash("tt-goldF");busy=false;render();
  show(`SOMMET ! +${r.net} 🍌`,`Le singe a atteint l'idole du temple : ta mise de ${r.bet} 🍌 ${fx(M()[TOP()-1])} = ${r.pay} 🍌 !`,"",idoleOk?IMG.idole:"");
  say("L'IDOLE EST À NOUS ! 🗿🍌",3600);setTimeout(()=>{if(!busy&&!G())idle();},4200);return;}
 await wait(900);
 const f=$(".tt-floor");
 if(f.animate&&!reduce){await f.animate([{transform:"none",opacity:1},{transform:"translateY(60%)",opacity:0}],{duration:380,easing:"ease-in"}).finished;}
 drawFloor(+r.fl+1);monkAt("land");$(".tt-monk").classList.add("in");
 if(f.animate&&!reduce){await f.animate([{transform:"translateY(-60%)",opacity:0},{transform:"none",opacity:1}],{duration:420,easing:"ease-out"}).finished;}
 $(".tt-monk").classList.remove("in");await wait(250);
 busy=false;setPick(true);render();
 const fl=+r.fl;
 say(fl>=6?pick(["Ça devient haut… 😰","Redescendre ? Jamais ! …ou peut-être ?","Je vois l'idole d'ici !"]):fl>=3?pick(["On continue ? 🐒","Le butin grossit…","Encore une porte ?"]):pick(["Facile ! 🐒","Étage suivant !","Hé hé, trop fort."]));}

async function cash(){const g=G();if(busy||!g||g.fl<1)return;ac();busy=true;render();
 let r;try{r=await rpc("mf_tour_cash");}catch(e){return err(e);}
 take(r.info);cashS();
 monkAt("base","walk");await wait(560);busy=false;render();
 show(`+${r.net} 🍌`,`Redescendu du ${ord(+r.fl)} étage avec ${r.pay} 🍌 (ta mise de ${r.bet} 🍌 ${fx(M()[+r.fl-1])}).`);
 setTimeout(()=>{if(!busy&&!G())idle();},2600);}

/* ---------- admin ---------- */
async function adm(x,msg){try{const r=await rpc("mf_tour_admin",{p_action:x});take(r);if(x==="reset"){$("#ttRes").hidden=true;idle();}render();if(msg)toast(msg);}catch(e){err(e);}}

/* ---------- construction ---------- */
function build(){
 const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
 root=document.createElement("div");root.id="mfTOUR";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label",NAME);
 const door=i=>`<button type="button" class="tt-door" style="left:${DX[i]}%" disabled aria-label="Porte ${SIDE[i]}"><span class="fr"></span><span class="in"><span class="sk" aria-hidden="true">💀</span></span><span class="pl a"></span><span class="pl b"></span><span class="gl" aria-hidden="true">🐒</span><img class="im c" alt=""><img class="im g" alt=""><img class="im d" alt=""></button>`;
 root.innerHTML=`<div class="tt-top"><button type="button" class="tt-btn l" id="ttTog" aria-controls="ttPanel" aria-expanded="false" aria-label="Règles">?</button>
  <h2 style="margin:0"><img class="tt-logo" src="${IMG.logo}" alt="${NAME}"><span class="tt-logoT" hidden>${NAME}</span></h2>
  <div class="tt-chips"><span class="tt-chip">🍌 <b id="ttBan">…</b></span><span class="tt-chip">Boosters <b id="ttBoo">…</b></span></div>
  <button type="button" class="tt-btn r" id="ttClose" aria-label="Fermer">✕</button></div>
 <div class="tt-lad" aria-label="Étages du temple"></div>
 <div class="tt-stage">
  <div class="tt-floor">
   <div class="tt-wall"><span class="tt-vine a"></span><span class="tt-vine b"></span><div class="tt-lvl" aria-live="polite"></div></div>
   <div class="tt-doors">${door(0)}${door(1)}${door(2)}</div>
   <div class="tt-land">${DX.map((x,i)=>`<span class="tt-trap" style="left:${SX(i)}"></span>`).join("")}</div>
   <div class="tt-steps"></div>
  </div>
  <div class="tt-monk"><img alt="Le singe explorateur"><span class="e" hidden role="img" aria-label="Le singe explorateur">🐒</span></div>
  <div class="tt-say" aria-live="polite"></div>
  <div class="tt-ask" aria-live="polite"></div>
  <div class="tt-res" id="ttRes" hidden role="status"></div>
 </div>
 <div class="tt-act">
  <div id="ttBetBox">
   <div class="tt-mise"><button type="button" class="tt-pm" id="ttMinus" aria-label="Miser moins">−</button><span class="tt-amt" id="ttAmt" aria-live="polite"></span><button type="button" class="tt-pm" id="ttPlus" aria-label="Miser plus">+</button>
    <span class="tt-row"><button type="button" class="tt-q" data-v="1">1</button><button type="button" class="tt-q" data-v="5">5</button><button type="button" class="tt-q" data-v="10">10</button></span></div>
   <button type="button" class="tt-big" id="ttGo"></button>
  </div>
  <div id="ttPlay" hidden><button type="button" class="tt-big cash" id="ttCash"></button></div>
  <div class="tt-sub" id="ttSub"></div>
 </div>
 <aside class="tt-panel" id="ttPanel" aria-label="Règles et réglages">
  <div class="tt-ph"><h3>Règles</h3><button type="button" class="tt-btn" style="position:static" id="ttPanelX" aria-label="Fermer les règles">✕</button></div>
  <ul class="r">
   <li>Mise, puis monte le temple étage par étage. À chaque étage, <b>3 portes dont une piégée</b>.</li>
   <li>Bonne porte : tu montes et ton butin grossit. Mauvaise porte : une trappe s'ouvre sous le singe, tu perds ta mise.</li>
   <li>Après chaque étage passé, tu peux <b>redescendre avec ton butin</b> : ta mise × le gain de l'étage (arrondi en dessous).</li>
   <li>Au sommet (8e étage), le singe prend l'idole : ×24 !</li>
   <li id="ttLim">5 montées par jour, mise de 1 à 10 🍌.</li>
  </ul>
  <table class="tt-tab" id="ttTab"></table>
  <h3>Dernières montées</h3><ul class="tt-hist" id="ttHist"></ul>
  <div class="tt-adm" id="ttAdm" hidden>
   <h3>Réglages admin</h3>
   <p id="ttState"></p>
   <div class="tt-btns"><button type="button" id="ttOpen"></button></div>
   <label for="ttF">Prochaine montée</label>
   <select id="ttF"><option value="">Au hasard</option><option value="fall">Trappe dès la première porte</option><option value="top">Aucune trappe jusqu'au sommet</option></select>
   <div class="tt-btns"><button type="button" id="ttReset">Rendre mes montées du jour</button><button type="button" id="ttAdd">+50 🍌</button></div>
  </div>
 </aside>
 <div class="tt-toast" role="status"></div>`;
 document.body.appendChild(root);
 $("#ttAdm").hidden=!ADMIN;
 // images de Kévin : logo, singe, singe qui tombe, idole. Sans elles : titre en texte, singe emoji
 const lg=$(".tt-logo"),noLogo=()=>{lg.hidden=true;$(".tt-logoT").hidden=false;};lg.onerror=noLogo;if(lg.complete&&!lg.naturalWidth)noLogo();
 const mk=$(".tt-monk img");mk.onerror=()=>{if(mk.getAttribute("src")===IMG.chute){mk.src=IMG.singe;return;}mk.hidden=true;$(".tt-monk .e").hidden=false;};mk.src=IMG.singe;
 const ch=new Image();ch.onload=()=>{chuteOk=true;};ch.src=IMG.chute;
 const ld=(src,f)=>{const i=new Image();i.onload=()=>f(i);i.src=src;};
 ld(IMG.mur,()=>root.classList.add("wimg"));
 ld(IMG.trappe,()=>root.classList.add("timg"));
 ld(IMG.escalier,()=>root.classList.add("simg"));
 // les portes : on attend les trois images pour passer aux portes dessinées par Kévin
 let nd=0;const dOk=()=>{if(++nd<3)return;root.querySelectorAll(".tt-door").forEach(d=>{d.querySelector(".im.c").src=IMG.porte;d.querySelector(".im.g").src=IMG.or;d.querySelector(".im.d").src=IMG.piege;});root.classList.add("dimg");};
 [IMG.porte,IMG.or,IMG.piege].forEach(u=>ld(u,dOk));
 const id=new Image();id.onload=()=>{idoleOk=true;};id.src=IMG.idole;
 $("#ttClose").addEventListener("click",close);
 $("#ttMinus").addEventListener("click",()=>{bet=Math.max(+S.min||1,bet-1);render();});
 $("#ttPlus").addEventListener("click",()=>{bet=Math.min(+S.maxBet||10,bet+1);render();});
 root.querySelectorAll(".tt-q").forEach(q=>q.addEventListener("click",()=>{bet=+q.dataset.v;clampBet();render();}));
 $("#ttGo").addEventListener("click",go);
 $("#ttCash").addEventListener("click",cash);
 doors().forEach((d,i)=>d.addEventListener("click",()=>choose(i)));
 $("#ttRes").addEventListener("click",()=>{$("#ttRes").hidden=true;});
 $("#ttTog").addEventListener("click",()=>panel(!$("#ttPanel").classList.contains("open")));
 $("#ttPanelX").addEventListener("click",()=>{panel(false);$("#ttTog").focus({preventScroll:true});});
 $("#ttOpen").addEventListener("click",()=>adm(S&&S.open?"close":"open",S&&S.open?"The Monkey Tower est de nouveau cachée.":`${NAME} est ouverte à tous les joueurs !`));
 $("#ttReset").addEventListener("click",()=>adm("reset","Tes montées du jour sont rendues."));
 $("#ttAdd").addEventListener("click",()=>adm("bananas","+50 🍌 sur ton compte."));
 root.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if($("#ttPanel").classList.contains("open"))panel(false);else close();});
 setInterval(()=>{if(!root.hidden&&!busy)render();},30000);
}
function panel(o){$("#ttPanel").classList.toggle("open",o);$("#ttTog").setAttribute("aria-expanded",String(o));}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
 if(!root)build();
 root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 $("#ttClose").focus({preventScroll:true});
 if(!busy){if(S)resume();else{drawFloor(1);monkAt("land");}}
 try{const r=await rpc("mf_tour_status");if(r.now)skew=+r.now-Date.now();take(r);
  if(!busy){resume();
   if(G())say(G().fl>0?`On est au ${ord(G().fl)} étage avec ${payOf(G().bet,G().fl)} 🍌… on continue ? 🐒`:"Ta montée t'attend : choisis une porte !",3200);
   else say(pick(["Le temple t'attend… 🗿","Huit étages, une idole. Prêt ?","Attention aux trappes ! 🕳️"]));}
  render();}catch(e){show("Oups",errText(e),"lose");}
}
function close(){
 if(busy){toast("Le singe est en pleine ascension…");return;}
 panel(false);root.hidden=true;document.body.style.overflow=prevOverflow;if(opener&&opener.focus)opener.focus();
}

/* ---------- démarrage : le jeu s'inscrit au Casino ---------- */
async function boot(){
 if(!window.claude||!window.claude.use)return;
 try{USER=await window.claude.use("user");}catch(e){}
 if(!USER||typeof window.MF_RPC!=="function")return;
 try{ADMIN=!!(await USER.isOwner());}catch(e){}
 let ok=ADMIN;if(!ok){try{ok=!!(await rpc("mf_tour_open"));}catch(e){}}
 if(!ok||!window.MF_CASINO)return;
 window.MF_CASINO.add({id:"tour",name:NAME,order:12,root:"mfTOUR",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 21h20"/><path d="M4 21v-5h16v5"/><path d="M6 16v-5h12v5"/><path d="M8 11V6h8v5"/><path d="M11 6V3h2v3"/><path d="M10.5 21v-2.5a1.5 1.5 0 0 1 3 0V21"/></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){const r=await rpc("mf_tour_status");if(r.now)skew=+r.now-Date.now();take(r);}const I=S;if(!I)return null;const g=G();
   if(g)return {line:g.fl>0?`Montée en cours : ${ord(g.fl)} étage, ${payOf(g.bet,g.fl)} 🍌 en poche`:"Une montée est en cours : choisis une porte !",hot:true};
   if(+I.left>0)return {line:`Encore ${I.left} montée${+I.left>1?"s":""} aujourd'hui · jusqu'à ×${String(M()[TOP()-1]).replace(".",",")} au sommet`,hot:false};
   return {line:"Plus de montées aujourd'hui",pre:"Nouvelles montées dans ",in:+I.nextDay-(Date.now()+skew),hot:false};}});
}
window.MF_TOUR={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

/* Monkey Family — Le Singe Mystère (animation commune aux jeux du Casino, sauf Monkey Run)
   C'est le serveur qui décide de sa venue (1 % par partie, ou à coup sûr quand on a beaucoup perdu sur un jeu,
   une fois par jeu et par jour) et de ce qu'il fait. Les jeux reçoivent un texte « mys » et appellent :
     await MF_MYSTERY.show(texte[, {ms}]) → il surgit de sa fumée, annonce ce qu'il fait, claque des doigts, puis repart
     MF_MYSTERY.adminButton(jeu)    → bouton admin « Singe Mystère à ma prochaine partie »
*/
(function(){
"use strict";
const IMG={arrive:"packs/mystere-arrive.webp",claque:"packs/mystere-claque.webp",part:"packs/mystere-part.webp"};
Object.values(IMG).forEach(src=>{const i=new Image();i.src=src;});
const RM=()=>window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait=ms=>new Promise(r=>setTimeout(r,RM()?Math.min(ms,120):ms));
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const CSS=`
#mfMys{position:fixed;inset:0;z-index:9700;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));
 background:radial-gradient(circle at 50% 42%,rgba(126,58,196,.55),rgba(18,6,32,.88) 62%);opacity:0;transition:opacity .35s;font:16px/1.45 Quicksand,system-ui,sans-serif;color:#f6eefe;-webkit-tap-highlight-color:transparent}
#mfMys.on{opacity:1}
#mfMys *{box-sizing:border-box}
.my-stage{position:relative;width:min(70vw,44vh,320px);aspect-ratio:1;flex:none}
.my-stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;transform:scale(.4) translateY(30px);filter:drop-shadow(0 14px 22px rgba(0,0,0,.55));transition:opacity .45s,transform .55s cubic-bezier(.2,1.5,.4,1)}
.my-stage img.on{opacity:1;transform:none}
.my-stage img.out{opacity:0;transform:translate(40%,-10%) scale(.55) rotate(8deg);transition:opacity .7s,transform .9s ease-in}
.my-smoke{position:absolute;left:50%;top:55%;width:10px;height:10px;border-radius:50%;pointer-events:none}
.my-smoke i{position:absolute;left:0;top:0;width:90px;height:90px;margin:-45px;border-radius:50%;background:radial-gradient(circle,rgba(190,110,255,.75),rgba(120,40,200,0) 70%);opacity:0}
#mfMys.puff .my-smoke i{animation:myPuff 1.1s ease-out forwards}
@keyframes myPuff{0%{opacity:.9;transform:translate(0,0) scale(.3)}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(2.4)}}
.my-spark{position:absolute;left:62%;top:30%;pointer-events:none}
.my-spark b{position:absolute;width:14px;height:14px;margin:-7px;background:#ffd84a;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);opacity:0;filter:drop-shadow(0 0 6px #ffcf33)}
#mfMys.snap .my-spark b{animation:mySpark .9s ease-out forwards}
@keyframes mySpark{0%{opacity:1;transform:translate(0,0) scale(.4) rotate(0)}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(1.3) rotate(160deg)}}
.my-name{font:800 13px/1 Quicksand,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d9b8ff;text-shadow:0 0 10px rgba(180,100,255,.8);opacity:0;transition:opacity .4s}
.my-bub{position:relative;max-width:min(92vw,420px);background:#fbf6ff;color:#2b1442;border-radius:18px;padding:14px 18px;font-weight:700;font-size:16px;line-height:1.45;text-align:center;
 box-shadow:0 10px 30px rgba(0,0,0,.45),0 0 0 3px #b98cf0;opacity:0;transform:translateY(10px) scale(.95);transition:opacity .35s,transform .35s;min-height:3em}
.my-bub::before{content:"";position:absolute;left:50%;top:-11px;margin-left:-11px;border:11px solid transparent;border-top:0;border-bottom-color:#b98cf0}
.my-bub::after{content:"";position:absolute;left:50%;top:-7px;margin-left:-8px;border:8px solid transparent;border-top:0;border-bottom-color:#fbf6ff}
#mfMys.talk .my-bub,#mfMys.talk .my-name{opacity:1;transform:none}
.my-ok{font:800 16px Quicksand,sans-serif;color:#2b1442;background:linear-gradient(#ffe27a,#f5b82e);border:0;border-radius:99px;padding:11px 28px;box-shadow:0 5px 0 #b77c12,0 8px 18px rgba(0,0,0,.4);cursor:pointer;opacity:0;pointer-events:none;transition:opacity .3s}
#mfMys.ready .my-ok{opacity:1;pointer-events:auto}
.my-ok:active{transform:translateY(3px);box-shadow:0 2px 0 #b77c12}
.my-ok:focus-visible{outline:3px solid #fff;outline-offset:3px}
@media (max-height:520px){.my-stage{width:min(40vh,220px)}.my-bub{font-size:14px;padding:10px 14px}}
.my-adm{font:700 13px Quicksand,sans-serif;color:#2b1442;background:#d9b8ff;border:0;border-radius:99px;padding:7px 12px;cursor:pointer}
.my-adm:disabled{opacity:.6}
`;
let styled=false;
function style(){if(styled)return;styled=true;const s=document.createElement("style");s.textContent=CSS;document.head.appendChild(s);}

function sound(kind){
  try{
    const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
    const ctx=sound.ctx||(sound.ctx=new A());if(ctx.state==="suspended")ctx.resume();
    const t=ctx.currentTime,g=ctx.createGain();g.connect(ctx.destination);
    if(kind==="snap"){
      const n=ctx.createBufferSource(),b=ctx.createBuffer(1,ctx.sampleRate*.08,ctx.sampleRate),d=b.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,4);
      n.buffer=b;g.gain.value=.5;n.connect(g);n.start(t);
      [880,1320,1760].forEach((f,i)=>{const o=ctx.createOscillator(),h=ctx.createGain();o.type="triangle";o.frequency.value=f;h.gain.setValueAtTime(0,t+.05+i*.07);h.gain.linearRampToValueAtTime(.12,t+.07+i*.07);h.gain.exponentialRampToValueAtTime(.001,t+.5+i*.07);o.connect(h);h.connect(ctx.destination);o.start(t+.05+i*.07);o.stop(t+.6+i*.07);});
    }else{
      const o=ctx.createOscillator();o.type="sine";o.frequency.setValueAtTime(kind==="in"?220:520,t);o.frequency.exponentialRampToValueAtTime(kind==="in"?520:180,t+.6);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.12,t+.1);g.gain.exponentialRampToValueAtTime(.001,t+.7);o.connect(g);o.start(t);o.stop(t+.75);
    }
  }catch(e){}
}

let queue=Promise.resolve();
function show(text,opts){
  if(!text)return Promise.resolve();
  const run=()=>play(String(text),opts||{});
  queue=queue.then(run,run);
  return queue;
}

async function play(text,opts){
  const deadline=opts.ms?Date.now()+opts.ms:0;   // fermeture automatique (ex. Crash Cocotier : avant le départ)
  style();
  const prevFocus=document.activeElement;
  const el=document.createElement("div");
  el.id="mfMys";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-label","Le Singe Mystère");
  const puffs=Array.from({length:9},(_,i)=>{const a=i/9*Math.PI*2;return `<i style="--x:${Math.round(Math.cos(a)*120)}px;--y:${Math.round(Math.sin(a)*90-20)}px;animation-delay:${i*25}ms"></i>`;}).join("");
  const sparks=Array.from({length:10},(_,i)=>{const a=i/10*Math.PI*2;return `<b style="--x:${Math.round(Math.cos(a)*110)}px;--y:${Math.round(Math.sin(a)*110)}px;animation-delay:${i*20}ms"></b>`;}).join("");
  el.innerHTML=`<div class="my-stage" aria-hidden="true"><div class="my-smoke">${puffs}</div>
      <img class="a" src="${IMG.arrive}" alt=""><img class="c" src="${IMG.claque}" alt=""><img class="p" src="${IMG.part}" alt="">
      <div class="my-spark">${sparks}</div></div>
    <div class="my-name">🔮 Le Singe Mystère</div>
    <p class="my-bub" aria-live="polite"></p>
    <button type="button" class="my-ok">Merci, Singe Mystère !</button>`;
  document.body.appendChild(el);
  const $=s=>el.querySelector(s),bub=$(".my-bub"),ok=$(".my-ok");
  let closed=false,done;
  const finished=new Promise(r=>done=r);
  const close=()=>{if(closed||!el.classList.contains("ready"))return;closed=true;done();};
  ok.addEventListener("click",close);
  el.addEventListener("click",e=>{if(e.target===el)close();});
  const key=e=>{if(e.key==="Escape"||e.key==="Enter"){e.preventDefault();e.stopPropagation();close();}};
  document.addEventListener("keydown",key,true);

  requestAnimationFrame(()=>el.classList.add("on"));
  await wait(150);
  el.classList.add("puff");sound("in");
  $(".a").classList.add("on");
  await wait(550);
  el.classList.add("talk");
  // texte qui s'écrit
  if(RM()){bub.textContent=text;}
  else{for(let i=1;i<=text.length;i+=2){bub.textContent=text.slice(0,i);await wait(16);}bub.textContent=text;}
  await wait(450);
  $(".a").classList.remove("on");$(".c").classList.add("on");
  el.classList.add("snap");sound("snap");
  try{if(navigator.vibrate)navigator.vibrate([30,40,60]);}catch(e){}
  await wait(500);
  el.classList.add("ready");ok.focus({preventScroll:true});
  const auto=setTimeout(close,deadline?Math.max(0,deadline-Date.now()):12000);
  await finished;clearTimeout(auto);
  document.removeEventListener("keydown",key,true);
  el.classList.remove("ready","talk");
  $(".c").classList.remove("on");$(".p").classList.add("on");
  sound("out");
  await wait(500);
  $(".p").classList.add("out");
  el.classList.remove("on");
  await wait(650);
  el.remove();
  try{if(prevFocus&&prevFocus.focus)prevFocus.focus({preventScroll:true});}catch(e){}
}

// bouton admin à glisser dans les réglages d'un jeu
function adminButton(game){
  style();
  const b=document.createElement("button");
  b.type="button";b.className="my-adm";b.textContent="🔮 Singe Mystère à ma prochaine partie";
  b.addEventListener("click",async()=>{
    b.disabled=true;
    try{await window.MF_RPC("mf_mys_admin",{p_action:"force",p_game:game});b.textContent="🔮 Il viendra à ta prochaine partie";}
    catch(e){b.textContent="🔮 Impossible pour l'instant";}
    setTimeout(()=>{b.disabled=false;b.textContent="🔮 Singe Mystère à ma prochaine partie";},3000);
  });
  return b;
}

window.MF_MYSTERY={show,adminButton,img:IMG};
})();

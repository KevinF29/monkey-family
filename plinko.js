/* Monkey Family — Plinko Banana (plinko du Casino)
   La bille tête de singe tombe entre 10 rangées de clous et atterrit dans une des 11 cases.
   Prix fixe (3 🍌), 10 billes par jour. Bord gauche = 5 boosters, bord droit = booster Originel.
   Le chemin est tiré par le serveur (mf_pk_*, supabase-plinko.sql) ; la page ne fait que l'animer.
   Visible par l'admin seulement tant que le jeu n'est pas ouvert (réglages admin → « Ouvrir à tous »). */
(function(){
"use strict";

const IMG={logo:"packs/plinko-titre.webp",fond:"packs/plinko-fond.webp",bille:"packs/plinko-bille.webp",plateau:"packs/plinko-plateau.webp"};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR={no_bananas:"Pas assez de bananes.",pk_limit:"Plus de billes aujourd'hui : reviens demain !",pk_closed:"Le Plinko n'est pas ouvert en ce moment.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const MAXFLY=5;   // billes en l'air en même temps
const DEF_PRIZES=[{t:"boost",v:5},{t:"ban",v:20},{t:"ban",v:6},{t:"ban",v:3},{t:"ban",v:2},{t:"ban",v:1},{t:"ban",v:2},{t:"ban",v:3},{t:"ban",v:6},{t:"ban",v:20},{t:"rpack",v:"Originel"}];
const lab=p=>p.t==="ban"?`${p.v} 🍌`:p.t==="boost"?`${p.v} boosters`:`Booster ${p.v}`;
const short=p=>p.t==="ban"?String(p.v):p.t==="boost"?`🎁×${p.v}`:"🌈";

/* ---------- style ---------- */
const CSS=`
#mfPK{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;touch-action:manipulation;color:#f6f0d8;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:#10240f;background-image:radial-gradient(ellipse at 50% 30%,#2f5a1c,#14300f 60%,#0a1a08)}
#mfPK.fond{background-image:linear-gradient(rgba(10,20,8,.35),rgba(10,20,8,.7)),url(${IMG.fond});background-size:cover;background-position:center}
#mfPK[hidden]{display:none}
#mfPK *{box-sizing:border-box;min-width:0}
#mfPK [hidden]{display:none!important}
#mfPK,#mfPK *{-webkit-tap-highlight-color:transparent}
#mfPK button:focus-visible,#mfPK select:focus-visible{outline:3px solid #8fd3ff;outline-offset:2px}
.pk-top{flex:none;position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;padding:max(8px,env(safe-area-inset-top)) 58px 4px}
.pk-logo{display:block;height:clamp(52px,11svh,120px);width:auto;max-width:100%;filter:drop-shadow(0 8px 12px rgba(0,0,0,.5))}
.pk-logoT{margin:0;font:400 clamp(26px,7vw,38px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 #6b3f1d,0 0 16px rgba(0,0,0,.5)}
.pk-btn{position:absolute;top:max(8px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(20,30,14,.8);color:#ffd23f;font:700 19px Quicksand,sans-serif;cursor:pointer;display:grid;place-items:center}
.pk-btn.l{left:10px}.pk-btn.r{right:10px}
.pk-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px}
.pk-chip{background:#2a1a0c;border:1px solid #6b4520;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13.5px;white-space:nowrap}
.pk-chip b{color:#ffd23f}
.pk-scene{flex:1;min-height:0;width:min(100%,640px);display:flex;flex-direction:column;align-items:center;gap:8px;padding:4px 10px max(14px,env(safe-area-inset-bottom))}
.pk-msg{flex:none;min-height:1.4em;font:400 clamp(16px,4.4vw,21px)/1.2 "Titan One",sans-serif;color:#fff;text-shadow:0 2px 0 #3b2410,0 0 10px rgba(0,0,0,.5);text-align:center}
.pk-msg.win{color:#ffd23f}
.pk-boardW{flex:1;min-height:0;width:100%;display:flex;align-items:center;justify-content:center}
.pk-board{position:relative;padding:10px 10px 12px;border-radius:22px;background:linear-gradient(180deg,#6b3f1d,#4a2a10);border:4px solid #d9a514;box-shadow:inset 0 0 0 2px #8a5a00,inset 0 12px 30px rgba(0,0,0,.45),0 12px 28px rgba(0,0,0,.5)}
.pk-board canvas{display:block}
.pk-board.img{background:none;box-shadow:none;border-radius:0;padding:0;border-style:solid;border-color:transparent;border-width:calc(var(--sp)*1.15) calc(var(--sp)*1.1);border-image:url(${IMG.plateau}) 230 220 230 220 fill stretch;filter:drop-shadow(0 12px 20px rgba(0,0,0,.5))}
.pk-bins{display:grid;gap:3px;margin-top:2px}
.pk-bin{height:calc(var(--sp)*.95);min-height:24px;border-radius:7px;display:grid;place-items:center;font:400 calc(var(--sp)*.36)/1 "Titan One",sans-serif;color:#2a1a0c;
 background:linear-gradient(180deg,#ffe27a,#e0a817);box-shadow:0 3px 0 #8a5a00;transition:transform .12s;white-space:nowrap;overflow:hidden}
.pk-bin[data-k="1"]{background:linear-gradient(180deg,#9be36b,#2f8a18);box-shadow:0 3px 0 #1f5a10;color:#fff;text-shadow:0 1px 2px #0a3a00}
.pk-bin[data-k="2"]{background:linear-gradient(180deg,#d4f06b,#8cbf1c);box-shadow:0 3px 0 #4a6a00;color:#1f3a00}
.pk-bin[data-k="4"]{background:linear-gradient(180deg,#ffb06b,#e0661c);box-shadow:0 3px 0 #8a3a00}
.pk-bin[data-k="5"]{background:linear-gradient(180deg,#ff7a6b,#d8301c);box-shadow:0 3px 0 #7a1000;color:#fff}
.pk-bin.boost{background:linear-gradient(180deg,#8fd3ff,#2f6fd8);box-shadow:0 3px 0 #123b85;color:#fff;font-size:calc(var(--sp)*.3)}
.pk-bin.rpack{background:linear-gradient(135deg,#ff5b5b,#ffd23f,#5bff8a,#5bc8ff,#c45bff);background-size:300% 300%;animation:pkRain 4s linear infinite;box-shadow:0 3px 0 #5a2a8a;color:#fff;text-shadow:0 1px 2px #000;font-size:calc(var(--sp)*.42)}
@keyframes pkRain{to{background-position:300% 0}}
.pk-bin.hit{transform:translateY(5px) scale(1.06);filter:brightness(1.35)}
.pk-act{flex:none;width:100%;text-align:center}
.pk-big{min-height:56px;padding:10px 26px;border-radius:16px;border:0;background:#ffd23f;color:#3b2410;font:400 20px "Titan One",sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8901a;transition:transform .08s,box-shadow .08s}
.pk-big:active{transform:translateY(2px);box-shadow:0 2px 0 #b8901a}
.pk-big:disabled{background:#4a4030;color:#a09880;box-shadow:none;cursor:default}
.pk-sub{color:#fff;text-shadow:0 1px 3px #000;font-size:13px;margin-top:6px;font-weight:700}
.pk-mk{position:absolute;inset:0;z-index:50;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:radial-gradient(circle at 50% 45%,rgba(255,210,63,.55),rgba(10,20,8,.94) 70%);cursor:pointer;animation:pkFade .25s}
.pk-mk.og{background:radial-gradient(circle at 50% 45%,rgba(196,91,255,.6),rgba(10,10,20,.95) 70%)}
.pk-mkE{font-size:clamp(70px,20vw,120px);animation:pkWob .35s infinite alternate ease-in-out}
.pk-mkT{font:400 clamp(24px,7.4vw,52px)/1.05 "Titan One",sans-serif;text-align:center;color:#ffd23f;transform:rotate(-4deg);text-shadow:0 4px 0 #6b3f1d,0 0 24px rgba(0,0,0,.6);animation:pkBoom .6s cubic-bezier(.2,1.6,.4,1) both;padding:0 12px}
.pk-mk.og .pk-mkT{background:linear-gradient(90deg,#ff5b5b,#ffd23f,#5bff8a,#5bc8ff,#c45bff);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 4px 0 #2a1145)}
.pk-mkS{font-weight:700;font-size:17px;text-shadow:0 1px 3px #000;text-align:center;padding:0 16px}
.pk-rain{position:absolute;inset:0;pointer-events:none}
.pk-drop{position:absolute;top:-60px;font-size:var(--s);animation:pkFall var(--d) cubic-bezier(.35,.1,.7,1) var(--w) both}
@keyframes pkFall{to{transform:translate(var(--x),calc(100svh + 120px)) rotate(var(--r))}}
@keyframes pkBoom{from{transform:scale(.3) rotate(-20deg);opacity:0}}
@keyframes pkWob{from{transform:rotate(-8deg)}to{transform:rotate(8deg) scale(1.05)}}
@keyframes pkFade{from{opacity:0}}
.pk-panel{position:absolute;top:0;left:0;bottom:0;z-index:30;width:min(400px,100%);overflow-y:auto;overscroll-behavior:contain;background:#1c2414;border-right:1px solid #4a5a2a;
 padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s;visibility:hidden}
.pk-panel.open{transform:none;visibility:visible}
.pk-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.pk-panel h3{font:400 19px "Titan One",sans-serif;color:#ffd23f;margin:14px 0 6px}
.pk-ph h3{margin:0}
.pk-panel p,.pk-panel li{color:#d6dcc4;font-size:14px}
.pk-panel p{margin:4px 0}
.pk-panel ul.r{margin:4px 0;padding-left:18px}
.pk-odds{width:100%;border-collapse:collapse;font-size:14px}
.pk-odds td{padding:3px 4px;border-bottom:1px solid #33402a;color:#d6dcc4}
.pk-odds td:last-child{text-align:right;font-weight:700;color:#ffd23f}
.pk-hist{list-style:none;margin:0;padding:0;font-size:14px}
.pk-hist li{padding:5px 0;border-bottom:1px solid #33402a}
.pk-hist:empty::after{content:"Aucune bille pour l'instant.";color:#a0a890}
.pk-adm label{display:block;margin:10px 0 4px;font-weight:700;font-size:14px}
.pk-adm select{width:100%;min-height:44px;font:16px Quicksand,sans-serif;border-radius:10px;border:1px solid #5a6a3a;background:#11180c;color:#f6f0d8;padding:0 10px}
.pk-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.pk-btns button{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid #5a6a3a;background:#2c3a1c;color:#f6f0d8;font:700 14px Quicksand,sans-serif;cursor:pointer}
.pk-btns button.on{background:#ffd23f;color:#3b2410;border-color:#ffd23f}
.pk-toast{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));z-index:40;transform:translate(-50%,12px);background:#2c3a1c;border:1px solid #ffd23f;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;max-width:92%;transition:transform .3s,opacity .3s;pointer-events:none;opacity:0}
.pk-toast.on{transform:translate(-50%,0);opacity:1}
@media(max-height:640px){.pk-logo{height:46px}.pk-logoT{font-size:24px}.pk-top{gap:3px}.pk-big{min-height:48px}}
@media(prefers-reduced-motion:reduce){.pk-rain{display:none}.pk-mkT,.pk-mkE,.pk-bin.rpack{animation:none}.pk-toast,.pk-panel,.pk-bin{transition:none}}
`;

/* ---------- état ---------- */
let root=null,USER=null,ADMIN=false,S=null,calling=false,skew=0;
const $=s=>root.querySelector(s);
const prizes=()=>(S&&Array.isArray(S.prizes)&&S.prizes.length)?S.prizes:DEF_PRIZES;
const ROWS=()=>(S&&+S.rows)||10;
let balls=[],lastState=null;   // billes en l'air ; dernier état serveur, appliqué à l'appli quand toutes les billes sont tombées
function take(info){if(!info)return;S=info;if(info.state)lastState=info.state;if(!balls.length)applyState();}
function applyState(){if(!lastState)return;try{if(window.MF_APPLY)window.MF_APPLY(lastState);}catch(e){}}

/* ---------- sons ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==="suspended")AC.resume().catch(()=>{});return AC;}
function beep(f,t0,dur,vol,type){const a=AC;if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type||"square";o.frequency.value=f;g.gain.setValueAtTime(vol,a.currentTime+t0);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t0+dur);o.connect(g).connect(a.destination);o.start(a.currentTime+t0);o.stop(a.currentTime+t0+dur+.02);}catch(e){}}
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};
const ping=r=>{beep(700+r*90+Math.random()*60,0,.05,.025,"triangle");};
const land=v=>{if(v>3){[523,659,784,1047].forEach((f,i)=>beep(f,i*.08,.16,.05,"triangle"));vib(40);}else if(v===3){beep(660,0,.12,.05,"triangle");vib(15);}else{beep(330,0,.15,.04,"sawtooth");vib(10);}};
const fanfare=()=>{[523,659,784,1047,1319,1568,2093].forEach((f,i)=>beep(f,i*.09,.2,.06,"triangle"));vib([80,40,80,40,200]);};

/* ---------- plateau ---------- */
let cv=null,cx=null,W=0,H=0,SP=0,DPR=1,pegHit={},raf=0,billeImg=null;
const TOP=()=>SP*1.25,VG=()=>SP*.88;
const rowY=r=>TOP()+r*VG();
const pegX=(r,j)=>W/2+(j-(r+2)/2)*SP;          // rangée r : r+3 clous
const onPeg=(r,k)=>({x:W/2+(k-r/2)*SP,y:rowY(r)-SP*.11-SP*.34});   // bille posée sur le clou de la rangée r après k rebonds à droite
const binX=s=>W/2+(s-ROWS()/2)*SP;
function layout(){if(!cv)return;const wrap=$(".pk-boardW"),R=ROWS();
 const im=$(".pk-board").classList.contains("img"),aw=Math.max(200,wrap.clientWidth-(im?0:28)),ah=Math.max(200,wrap.clientHeight-(im?0:28));
 // hauteur totale ≈ canvas (TOP + (R-1)·VG + 0,7·SP) + cases (≈1,05·SP)
 SP=Math.floor(Math.min(aw/(R+3+(im?2.2:0)),ah/(1.25+(R-1)*.88+.7+1.15+(im?2.3:0))));SP=Math.max(14,Math.min(SP,58));
 W=SP*(R+3);H=Math.round(TOP()+(R-1)*VG()+SP*.7);DPR=Math.min(2,window.devicePixelRatio||1);
 cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+"px";cv.style.height=H+"px";
 $(".pk-board").style.setProperty("--sp",SP+"px");const bins=$(".pk-bins");bins.style.width=W+"px";bins.style.padding=`0 ${SP-1.5}px`;
 bins.style.gridTemplateColumns=`repeat(${R+1},1fr)`;draw();}
function bins(){const P=prizes(),n=P.length,b=$(".pk-bins");
 b.innerHTML=P.map((p,i)=>`<div class="pk-bin ${p.t==="ban"?"":p.t}" data-i="${i}" data-k="${Math.min(i,n-1-i)}" title="${esc(lab(p))}" aria-label="Case ${i+1} : ${esc(lab(p))}">${esc(short(p))}</div>`).join("");}
function monkey(x,y,r,rot){const c=cx;c.save();c.translate(x,y);c.rotate(rot||0);
 if(billeImg){c.shadowColor="rgba(0,0,0,.45)";c.shadowBlur=r*.4;c.shadowOffsetY=r*.15;c.drawImage(billeImg,-r*1.32,-r*1.32,r*2.64,r*2.64);c.restore();return;}
 c.shadowColor="rgba(0,0,0,.45)";c.shadowBlur=r*.5;c.shadowOffsetY=r*.2;
 c.fillStyle="#7a4a22";[[-1,1],[1,1]].forEach(([s])=>{c.beginPath();c.arc(s*r*.92,-r*.12,r*.38,0,7);c.fill();});
 c.beginPath();c.arc(0,0,r,0,7);c.fill();c.shadowColor="transparent";
 c.fillStyle="#f2c79a";[-1,1].forEach(s=>{c.beginPath();c.arc(s*r*.92,-r*.12,r*.2,0,7);c.fill();});
 c.beginPath();c.ellipse(-r*.3,-r*.12,r*.34,r*.42,0,0,7);c.ellipse(r*.3,-r*.12,r*.34,r*.42,0,0,7);c.fill();
 c.beginPath();c.ellipse(0,r*.38,r*.56,r*.4,0,0,7);c.fill();
 c.fillStyle="#1d120a";[-1,1].forEach(s=>{c.beginPath();c.arc(s*r*.28,-r*.14,r*.11,0,7);c.fill();});
 c.fillStyle="#fff";[-1,1].forEach(s=>{c.beginPath();c.arc(s*r*.28+r*.04,-r*.18,r*.04,0,7);c.fill();});
 c.fillStyle="#5a3214";c.beginPath();c.ellipse(-r*.09,r*.24,r*.05,r*.04,0,0,7);c.ellipse(r*.09,r*.24,r*.05,r*.04,0,0,7);c.fill();
 c.strokeStyle="#5a3214";c.lineWidth=Math.max(1,r*.08);c.lineCap="round";c.beginPath();c.arc(0,r*.36,r*.26,.2*Math.PI,.8*Math.PI);c.stroke();
 c.restore();}
function draw(){if(!cx)return;const R=ROWS(),now=performance.now();cx.setTransform(DPR,0,0,DPR,0,0);cx.clearRect(0,0,W,H);
 const pr=Math.max(3,SP*.11);
 for(let r=0;r<R;r++)for(let j=0;j<r+3;j++){const x=pegX(r,j),y=rowY(r),h=pegHit[r+":"+j],glow=h?Math.max(0,1-(now-h)/350):0;
  if(glow>0){cx.fillStyle=`rgba(255,240,150,${.55*glow})`;cx.beginPath();cx.arc(x,y,pr*(2.2+glow*1.5),0,7);cx.fill();}
  const g=cx.createRadialGradient(x-pr*.35,y-pr*.35,pr*.1,x,y,pr);g.addColorStop(0,"#fff6c2");g.addColorStop(.5,"#ffd23f");g.addColorStop(1,"#a86f00");
  cx.fillStyle=g;cx.beginPath();cx.arc(x,y,pr*(1+glow*.25),0,7);cx.fill();}
 balls.forEach(b=>monkey(b.x,b.y,SP*.36,b.rot));}

/* trajectoire d'une bille : liste de sauts {de, vers, durée, arc} */
function plan(path){const R=path.length,hops=[];let k=0,prev={x:W/2+(Math.random()-.5)*SP*.15,y:-SP*.4};
 for(let r=0;r<R;r++){const p=onPeg(r,k);hops.push({a:prev,b:p,d:r?175:260,arc:r?SP*.32:0,r,k});prev=p;k+=path[r];}
 hops.push({a:prev,b:{x:binX(k),y:H+SP*.35},d:230,arc:SP*.2,r:R,k});
 return {hops,slot:k};}
function drop(res){const {hops,slot}=plan(res.path);const b={hops,i:0,t0:performance.now(),x:hops[0].a.x,y:hops[0].a.y,rot:0,spin:0,slot,res};balls.push(b);loop();}
function step(now){let any=false;
 for(const b of balls.slice()){let h=b.hops[b.i];if(!h)continue;let t=(now-b.t0)/(reduce?h.d*.4:h.d);
  while(t>=1){ // fin du saut : la bille touche son clou, puis repart à gauche ou à droite
   if(h.r<ROWS()){pegHit[h.r+":"+(h.k+1)]=now;ping(h.r);}
   if(b.i<b.hops.length-1){const nx=b.hops[b.i+1];b.spin=(nx.b.x>nx.a.x?1:-1)*.012;}
   b.t0+=reduce?h.d*.4:h.d;b.i++;h=b.hops[b.i];if(!h){finish(b);break;}t=(now-b.t0)/(reduce?h.d*.4:h.d);}
  if(!h)continue;any=true;
  const e=b.i===0?t*t:t,ex=b.i===0?t:(1-Math.cos(Math.PI*t))/2;
  b.x=h.a.x+(h.b.x-h.a.x)*ex;b.y=h.a.y+(h.b.y-h.a.y)*e-h.arc*4*t*(1-t);b.rot+=b.spin*16;}
 return any;}
function loop(){if(raf)return;const f=now=>{raf=0;const any=step(now);draw();
  const glowing=Object.values(pegHit).some(h=>now-h<400);if(any||glowing)raf=requestAnimationFrame(f);};raf=requestAnimationFrame(f);}
function finish(b){balls=balls.filter(x=>x!==b);const p=b.res.prize||{},slot=b.slot,el=root.querySelector(`.pk-bin[data-i="${slot}"]`);
 if(el){el.classList.add("hit");setTimeout(()=>el.classList.remove("hit"),260);}
 pend.ban-=p.t==="ban"?+p.v:0;pend.boost-=p.t==="boost"?+p.v:0;
 const pr=+b.res.price||3;
 if(p.t==="ban"){land(+p.v);msg(+p.v>pr?`+${p.v} 🍌 ! (+${p.v-pr})`:+p.v===pr?`${p.v} 🍌 : bille remboursée`:`${p.v} 🍌…`,+p.v>pr);}
 else{fanfare();big(p);msg(p.t==="rpack"?`BOOSTER ${String(p.v).toUpperCase()} !`:`${p.v} BOOSTERS !`,true);}
 if(!balls.length)applyState();render();}
let pend={ban:0,boost:0};

/* ---------- affichage ---------- */
const hhmm=ms=>{const m=Math.max(0,Math.round(ms/60000));return `${Math.floor(m/60)} h ${String(m%60).padStart(2,"0")}`;};
function render(){if(!root)return;const st=S&&S.state;
 $("#pkBan").textContent=st?(+st.bananas-pend.ban):"…";$("#pkBoo").textContent=st?(+st.stock-pend.boost):"…";
 if(!S)return;const price=+S.price||3,ban=st?+st.bananas-pend.ban:0,d=$("#pkGo");
 d.disabled=calling||+S.left<=0||ban<price||balls.length>=MAXFLY;
 d.textContent=+S.left<=0?"Plus de billes aujourd'hui":ban<price?"Pas assez de bananes":`Lâcher une bille · ${price} 🍌`;
 $("#pkSub").textContent=`Billes : ${S.left}/${S.max}`+(+S.left<=0?` · Nouvelles billes dans ${hhmm(+S.nextDay-(Date.now()+skew))}`:"");
 $("#pkHist").innerHTML=(S.hist||[]).map(h=>`<li>${esc(h)}</li>`).join("");
 odds();
 if(ADMIN){const o=$("#pkOpen");o.textContent=S.open?"Cacher aux joueurs":"Ouvrir à tous les joueurs";o.classList.toggle("on",!S.open);
  $("#pkState").textContent=S.open?"Le Plinko est ouvert aux joueurs (s'il est dans les jeux de la semaine).":"Le Plinko est visible par toi seulement.";
  const f=$("#pkF");if(document.activeElement!==f)f.value=S.force==null?"":String(S.force);}}
function binom(n,k){let c=1;for(let i=1;i<=k;i++)c=c*(n-k+i)/i;return c;}
function odds(){const P=prizes(),R=P.length-1,rows={};let ev=0,evB=0;
 P.forEach((p,i)=>{const q=binom(R,i)/2**R,key=lab(p);rows[key]=(rows[key]||0)+q;if(p.t==="ban")ev+=q*p.v;});
 const pc=q=>q<.001?`1 sur ${Math.round(1/q).toLocaleString("fr-FR")}`:(q*100).toLocaleString("fr-FR",{maximumFractionDigits:1})+" %";
 const order=Object.keys(rows).sort((a,b)=>rows[a]-rows[b]);
 $("#pkOdds").innerHTML=order.map(k=>`<tr><td>${esc(k)}</td><td>${pc(rows[k])}</td></tr>`).join("");
 $("#pkEv").textContent=`En moyenne, une bille rapporte ${ev.toLocaleString("fr-FR",{maximumFractionDigits:2})} 🍌 pour ${+S.price||3} 🍌 (sans compter les boosters des bords).`;}
function msg(t,w){const m=$(".pk-msg");m.textContent=t;m.classList.toggle("win",!!w);}
let tt=0;function toast(t){const e=$(".pk-toast");e.textContent=t;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500);}
function big(p){const o=$(".pk-mk"),og=p.t==="rpack";o.classList.toggle("og",og);
 $("#pkMkE").textContent=og?"🌈":"🎁";
 $("#pkMkT").textContent=og?`BOOSTER ${String(p.v).toUpperCase()} !`:`${p.v} BOOSTERS !`;
 $("#pkMkS").textContent=og?"Le bord droit ! 1 carte Originel t'attend avec tes boosters 🐒":`Le bord gauche ! +${p.v} boosters à ouvrir 🐒`;
 const R=$(".pk-rain");R.innerHTML="";if(!reduce)for(let i=0;i<30;i++){const d=document.createElement("span");d.className="pk-drop";d.textContent=og?["🌈","✨","💎","🐒"][i%4]:["🍌","🎁","✨","🐒"][i%4];
  d.style.left=(Math.random()*100)+"%";d.style.setProperty("--s",(22+Math.random()*24)+"px");d.style.setProperty("--d",(1.6+Math.random()*1.6)+"s");
  d.style.setProperty("--w",(Math.random()*2)+"s");d.style.setProperty("--x",((Math.random()-.5)*120)+"px");d.style.setProperty("--r",((Math.random()-.5)*720)+"deg");R.appendChild(d);}
 o.hidden=false;const end=()=>{o.hidden=true;o.onclick=null;clearTimeout(t);R.innerHTML="";};const t=setTimeout(end,5500);setTimeout(()=>{o.onclick=end;},800);}

/* ---------- une bille ---------- */
async function go(){if(calling||!S||balls.length>=MAXFLY)return;ac();calling=true;render();
 let r;try{r=await rpc("mf_pk_drop");}catch(e){calling=false;toast(errText(e));msg(errText(e));render();
  rpc("mf_pk_status").then(x=>{take(x);render();},()=>{});return;}
 const p=r.prize||{};pend.ban+=p.t==="ban"?+p.v:0;pend.boost+=p.t==="boost"?+p.v:0;
 calling=false;drop(r);take(r.info);msg("");render();}

/* ---------- admin ---------- */
async function adm(x,m){try{const r=await rpc("mf_pk_admin",{p_action:x});take(r);render();if(m)toast(m);}catch(e){toast(errText(e));}}

/* ---------- construction ---------- */
function build(){
 const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
 root=document.createElement("div");root.id="mfPK";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Plinko Banana");
 root.innerHTML=`<div class="pk-top"><button type="button" class="pk-btn l" id="pkTog" aria-controls="pkPanel" aria-expanded="false" aria-label="Règles">?</button>
  <h2 style="margin:0"><img class="pk-logo" src="${IMG.logo}" alt="Plinko Banana"><span class="pk-logoT" hidden>Plinko Banana</span></h2>
  <div class="pk-chips"><span class="pk-chip">🍌 <b id="pkBan">…</b></span><span class="pk-chip">Boosters <b id="pkBoo">…</b></span></div>
  <button type="button" class="pk-btn r" id="pkClose" aria-label="Fermer">✕</button></div>
 <div class="pk-scene">
  <div class="pk-msg" aria-live="polite"></div>
  <div class="pk-boardW"><div class="pk-board"><canvas aria-label="Plateau du Plinko : la bille tête de singe rebondit sur les clous"></canvas><div class="pk-bins" role="list" aria-label="Cases"></div></div></div>
  <div class="pk-act"><button type="button" class="pk-big" id="pkGo"></button><div class="pk-sub" id="pkSub"></div></div>
 </div>
 <aside class="pk-panel" id="pkPanel" aria-label="Règles et réglages">
  <div class="pk-ph"><h3>Règles</h3><button type="button" class="pk-btn" style="position:static" id="pkPanelX" aria-label="Fermer les règles">✕</button></div>
  <ul class="r">
   <li>Chaque bille coûte <b>3 🍌</b>. La tête de singe tombe entre les clous et rebondit au hasard à gauche ou à droite.</li>
   <li>Tu gagnes ce qui est écrit sous la case où elle atterrit. Au milieu, on perd un peu ; plus on va vers les bords, plus c'est gros.</li>
   <li>🎁 <b>Bord gauche</b> : 5 boosters. 🌈 <b>Bord droit</b> : un booster <b>Originel</b> (1 carte Originel). Ils t'attendent avec tes boosters.</li>
   <li>10 billes par jour. Tu peux en lâcher plusieurs à la suite.</li>
  </ul>
  <h3>Chances</h3><table class="pk-odds"><tbody id="pkOdds"></tbody></table><p id="pkEv"></p>
  <h3>Dernières billes</h3><ul class="pk-hist" id="pkHist"></ul>
  <div class="pk-adm" id="pkAdm" hidden>
   <h3>Réglages admin</h3>
   <p id="pkState"></p>
   <div class="pk-btns"><button type="button" id="pkOpen"></button></div>
   <label for="pkF">Prochaine bille</label>
   <select id="pkF"><option value="">Au hasard</option><option value="0">Bord gauche (5 boosters)</option><option value="10">Bord droit (booster Originel)</option><option value="1">20 🍌 (à gauche)</option><option value="5">Milieu (1 🍌)</option></select>
   <div class="pk-btns"><button type="button" id="pkReset">Rendre mes billes du jour</button><button type="button" id="pkAdd">+50 🍌</button></div>
  </div>
 </aside>
 <div class="pk-mk" hidden aria-live="assertive"><div class="pk-rain" aria-hidden="true"></div><div class="pk-mkE" id="pkMkE" aria-hidden="true"></div><div class="pk-mkT" id="pkMkT"></div><div class="pk-mkS" id="pkMkS"></div></div>
 <div class="pk-toast" role="status"></div>`;
 document.body.appendChild(root);
 $("#pkAdm").hidden=!ADMIN;
 cv=$("canvas");cx=cv.getContext("2d");bins();
 const lg=$(".pk-logo"),noLogo=()=>{lg.hidden=true;$(".pk-logoT").hidden=false;};lg.onerror=noLogo;if(lg.complete&&!lg.naturalWidth)noLogo();
 const f=new Image();f.onload=()=>root.classList.add("fond");f.src=IMG.fond;
 const pl=new Image();pl.onload=()=>{$(".pk-board").classList.add("img");layout();};pl.src=IMG.plateau;
 const bi=new Image();bi.onload=()=>{billeImg=bi;draw();};bi.src=IMG.bille;
 try{new ResizeObserver(()=>layout()).observe($(".pk-boardW"));}catch(e){addEventListener("resize",layout);}
 $("#pkClose").addEventListener("click",close);
 $("#pkGo").addEventListener("click",go);
 $("#pkTog").addEventListener("click",()=>panel(!$("#pkPanel").classList.contains("open")));
 $("#pkPanelX").addEventListener("click",()=>{panel(false);$("#pkTog").focus({preventScroll:true});});
 $("#pkOpen").addEventListener("click",()=>adm(S&&S.open?"close":"open",S&&S.open?"Le Plinko est de nouveau caché.":"Plinko Banana est ouvert (selon la rotation du Casino)."));
 $("#pkF").addEventListener("change",e=>adm("force:"+e.target.value,e.target.value===""?"Prochaine bille au hasard.":"Prochaine bille imposée."));
 $("#pkReset").addEventListener("click",()=>adm("reset","Tes billes du jour sont rendues."));
 $("#pkAdd").addEventListener("click",()=>adm("bananas","+50 🍌 sur ton compte."));
 root.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!$(".pk-mk").hidden){$(".pk-mk").click();return;}if($("#pkPanel").classList.contains("open"))panel(false);else close();});
 setInterval(()=>{if(!root.hidden&&!balls.length)render();},30000);
}
function panel(o){$("#pkPanel").classList.toggle("open",o);$("#pkTog").setAttribute("aria-expanded",String(o));}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
 if(!root)build();
 if(!root.hidden)return;
 root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 $("#pkClose").focus({preventScroll:true});layout();render();
 try{const r=await rpc("mf_pk_status");if(r.now)skew=+r.now-Date.now();take(r);bins();layout();render();}catch(e){msg(errText(e));}
}
function close(){
 if(balls.length||calling){toast("La bille tombe encore…");return;}
 panel(false);root.hidden=true;document.body.style.overflow=prevOverflow;if(opener&&opener.focus)opener.focus();
}

/* ---------- démarrage : le jeu s'inscrit au Casino ---------- */
async function boot(){
 if(!window.claude||!window.claude.use)return;
 try{USER=await window.claude.use("user");}catch(e){}
 if(!USER||typeof window.MF_RPC!=="function")return;
 try{ADMIN=!!(await USER.isOwner());}catch(e){}
 let ok=ADMIN;if(!ok){try{ok=!!(await rpc("mf_pk_open"));}catch(e){}}
 if(!ok||!window.MF_CASINO)return;
 Object.values(IMG).forEach(u=>{const i=new Image();i.src=u;});
 window.MF_CASINO.add({id:"pk",name:"Plinko Banana",order:9,root:"mfPK",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="4" r="2"/><circle cx="8" cy="10" r=".6" fill="currentColor"/><circle cx="16" cy="10" r=".6" fill="currentColor"/><circle cx="5" cy="15" r=".6" fill="currentColor"/><circle cx="12" cy="15" r=".6" fill="currentColor"/><circle cx="19" cy="15" r=".6" fill="currentColor"/><path d="M3 20h18M7 20v-2M12 20v-2M17 20v-2"/></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){const r=await rpc("mf_pk_status");if(r.now)skew=+r.now-Date.now();take(r);}const I=S;if(!I)return null;
   if(+I.left>0)return {line:`Encore ${I.left} bille${+I.left>1?"s":""} aujourd'hui · ${I.price} 🍌 la bille`,hot:false};
   return {line:"Plus de billes aujourd'hui",pre:"Nouvelles billes dans ",in:+I.nextDay-(Date.now()+skew),hot:false};}});
}
window.MF_PK={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

/* Monkey Family — Flying Monkey (le singe pilote entre les troncs, façon Flappy Bird)
   Une manche va de 18 h à 18 h. 5 vols par manche : le 1er gratuit, puis 1 🍌. On garde le meilleur vol.
   À 18 h, le serveur classe la manche et donne les récompenses (1er 1 booster + 20 🍌, 2e 15, 3e 10, 4e 5, 5e 3, 6e 1).
   Le jeu tourne sur le téléphone ; chaque vol a un jeton du serveur (mf_fly_*, supabase-flying.sql) qui refuse les scores impossibles.
   Visible par l'admin seulement tant que le jeu n'est pas ouvert (réglages admin → « Ouvrir à tous »). */
(function(){
"use strict";

const P="packs/fly-";
const IMG={sky:P+"sky.webp",hills:P+"hills.webp",trees:P+"trees.webp",vines:P+"vines.webp",ground:P+"ground.webp",trunk:P+"trunk.webp",
 cap:P+"cap.webp",banana:P+"banana.webp",plane:P+"plane-anim.webp",crash:P+"crash.webp",logo:P+"logo.webp"};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ERR={no_bananas:"Pas assez de bananes.",fly_limit:"Plus de vols dans cette manche : reviens après 18 h !",fly_closed:"Flying Monkey n'est pas ouvert en ce moment.",
 fly_token:"Ce vol n'est plus valable.",not_member:"Ton accès est en pause."};
const errText=e=>{const m=String(e&&e.message||e);const k=Object.keys(ERR).find(x=>m.includes(x));return k?ERR[k]:"Connexion impossible : réessaie dans un instant.";};
const rpc=(n,a)=>window.MF_RPC(n,a||{});
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const MED=["🥇","🥈","🥉"];
const rew=x=>{const b=+(x&&x.boost)||0,n=+(x&&x.ban)||0;return [b?`${b} booster${b>1?"s":""}`:"",n?`${n} 🍌`:""].filter(Boolean).join(" + ");};
const dur=ms=>{ms=Math.max(0,ms);const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);return h?`${h} h ${String(m).padStart(2,"0")}`:`${Math.max(1,m)} min`;};

/* ---------- style ---------- */
const CSS=`
#mfFLY{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;align-items:center;overflow:hidden;overscroll-behavior:none;touch-action:manipulation;color:#f6f0d8;font:16px/1.45 Quicksand,system-ui,sans-serif;
 background:#0f3b2a;background-image:radial-gradient(ellipse at 50% 0,#2f7a4d,#0f3b2a 55%,#08231a)}
#mfFLY[hidden]{display:none}
#mfFLY *{box-sizing:border-box;min-width:0}
#mfFLY [hidden]{display:none!important}
#mfFLY,#mfFLY *{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
#mfFLY button:focus-visible{outline:3px solid #8fd3ff;outline-offset:2px}
.fl-top{flex:none;position:relative;width:100%;display:flex;flex-direction:column;align-items:center;gap:4px;padding:max(8px,env(safe-area-inset-top)) 58px 4px}
.fl-logo{display:block;height:clamp(48px,9svh,96px);width:auto;max-width:100%;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
.fl-logoT{margin:0;font:400 clamp(26px,7vw,36px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 #6b3f1d}
.fl-btn{position:absolute;top:max(8px,env(safe-area-inset-top));width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(10,30,18,.8);color:#ffd23f;font:700 19px Quicksand,sans-serif;cursor:pointer;display:grid;place-items:center}
.fl-btn.l{left:10px}.fl-btn.r{right:10px}
.fl-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 8px}
.fl-chip{background:#2a1a0c;border:1px solid #6b4520;border-radius:999px;padding:3px 10px;font-weight:700;font-size:13.5px;white-space:nowrap}
.fl-chip b{color:#ffd23f}
.fl-main{flex:1;min-height:0;width:100%;display:flex;align-items:flex-start;justify-content:center;padding:4px 8px max(10px,env(safe-area-inset-bottom))}
.fl-cab{position:relative;flex:none;border-radius:18px;padding:8px;background:linear-gradient(180deg,#8a5a2e,#5a3618);box-shadow:0 14px 30px rgba(0,0,0,.55),inset 0 2px 0 rgba(255,255,255,.2)}
.fl-scr{position:relative;width:100%;height:100%;border-radius:11px;overflow:hidden;box-shadow:inset 0 0 0 2px rgba(0,0,0,.5);touch-action:none;cursor:pointer}
.fl-scr canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.fl-ov{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 12px;background:rgba(6,32,20,.62);overflow-y:auto;overscroll-behavior:contain;cursor:default;text-align:center}
.fl-ov h3{margin:2px 0 0;font:400 clamp(22px,4.2svh,30px)/1.1 "Titan One",sans-serif;color:#ffd23f;text-shadow:0 3px 0 rgba(0,0,0,.5)}
.fl-ov p{margin:0}
.fl-big{min-height:54px;padding:8px 24px;border-radius:16px;border:0;background:#ffd23f;color:#3b2410;font:400 19px "Titan One",sans-serif;cursor:pointer;box-shadow:0 4px 0 #b8901a}
.fl-big:active{transform:translateY(2px);box-shadow:0 2px 0 #b8901a}
.fl-big:disabled{background:#4a4030;color:#a09880;box-shadow:none;cursor:default}
.fl-sub{font-size:13.5px;font-weight:700;color:#e3efd9;text-shadow:0 1px 3px #000}
.fl-score{font:400 clamp(44px,9svh,64px)/1 "Titan One",sans-serif;color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.45)}
.fl-res{font:700 15px Quicksand,sans-serif;color:#ffe7a8}
.fl-res.win{color:#8fe3a8}
.fl-board{width:100%;max-width:340px;margin-top:2px;text-align:left}
.fl-board h4{margin:6px 0 4px;font:400 15px "Titan One",sans-serif;color:#ffd23f;display:flex;justify-content:space-between;gap:8px}
.fl-board h4 small{font:700 12px Quicksand,sans-serif;color:#cfe0c8;white-space:nowrap}
.fl-board ol{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.fl-board li{display:grid;grid-template-columns:2em minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:rgba(0,0,0,.35);font-size:14px}
.fl-board li.me{background:rgba(255,210,63,.18);box-shadow:inset 0 0 0 2px #ffd23f}
.fl-board .rk{font:400 15px "Titan One",sans-serif;text-align:center}
.fl-board .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.fl-board .sc{font:400 16px "Titan One",sans-serif;color:#fff;white-space:nowrap;text-align:right}
.fl-board .rw{font-size:12px;font-weight:700;color:#ffe7a8;white-space:nowrap;text-align:right}
.fl-board .empty{color:#cfe0c8;font-size:14px;padding:6px 2px}
.fl-panel{position:absolute;top:0;left:0;bottom:0;z-index:30;width:min(400px,100%);overflow-y:auto;overscroll-behavior:contain;background:#14301f;border-right:1px solid #2f5a3a;
 padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));box-shadow:20px 0 40px rgba(0,0,0,.5);transform:translateX(-105%);transition:transform .25s;visibility:hidden}
.fl-panel.open{transform:none;visibility:visible}
.fl-ph{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.fl-panel h3{font:400 19px "Titan One",sans-serif;color:#ffd23f;margin:14px 0 6px}
.fl-ph h3{margin:0}
.fl-panel p,.fl-panel li{color:#d6e4cc;font-size:14px}
.fl-panel ul.r{margin:4px 0;padding-left:18px}
.fl-rw{width:100%;border-collapse:collapse;font-size:14px}
.fl-rw td{padding:3px 4px;border-bottom:1px solid #2a4a32;color:#d6e4cc}
.fl-rw td:last-child{text-align:right;font-weight:700;color:#ffd23f}
.fl-hist{list-style:none;margin:0;padding:0;font-size:14px}
.fl-hist li{padding:5px 0;border-bottom:1px solid #2a4a32}
.fl-hist:empty::after{content:"Aucun vol pour l'instant.";color:#9fb59a}
.fl-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.fl-btns button{min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid #3f6a4a;background:#1f4a30;color:#f6f0d8;font:700 14px Quicksand,sans-serif;cursor:pointer}
.fl-btns button.on{background:#ffd23f;color:#3b2410;border-color:#ffd23f}
.fl-toast{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));z-index:40;transform:translate(-50%,12px);background:#1f4a30;border:1px solid #ffd23f;border-radius:14px;padding:9px 14px;font-weight:700;font-size:14px;max-width:92%;transition:transform .3s,opacity .3s;pointer-events:none;opacity:0}
.fl-toast.on{transform:translate(-50%,0);opacity:1}
@media(max-height:640px){.fl-logo{height:40px}.fl-big{min-height:46px}}
@media(prefers-reduced-motion:reduce){.fl-toast,.fl-panel{transition:none}.fl-big:active{transform:none}}
`;

/* ---------- état serveur ---------- */
let root=null,USER=null,ADMIN=false,S=null,skew=0,busy=false;
const $=s=>root.querySelector(s);
const nowS=()=>Date.now()+skew;
function take(info){if(!info)return;S=info;if(info.now)skew=+info.now-Date.now();try{if(info.state&&window.MF_APPLY)window.MF_APPLY(info.state);}catch(e){}}

/* ---------- sons ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==="suspended")AC.resume().catch(()=>{});return AC;}
function beep(f,t0,d,vol,type){const a=AC;if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type||"square";o.frequency.value=f;g.gain.setValueAtTime(vol,a.currentTime+t0);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t0+d);o.connect(g).connect(a.destination);o.start(a.currentTime+t0);o.stop(a.currentTime+t0+d+.02);}catch(e){}}
const vib=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};

/* ---------- le jeu (coordonnées logiques 420 × 640) ---------- */
const W=420,H=640,GROUND=64,PX=110;
const IM={};let cv=null,cx=null,dpr=1,raf=0,last=0;
const ok=n=>IM[n]&&IM[n].complete&&IM[n].naturalWidth>0;
let mode="menu",y=H/2,vy=0,t=0,score=0,pipes=[],bananas=[],spawnT=0,scroll=0,shake=0,parts=[],deadAt=0,token=null;
const speed=()=>Math.min(170+score*4,270),gap=()=>Math.max(190-score*1.5,148);
function reset(){y=H/2-40;vy=0;score=0;pipes=[];bananas=[];spawnT=.6;parts=[];}
function flap(){if(mode!=="play")return;vy=-430;beep(520,0,.06,.025,"triangle");for(let i=0;i<5;i++)parts.push({x:PX-30,y:y+6,vx:-80-Math.random()*60,vy:(Math.random()-.5)*60,l:.5});}
function spawn(){const g=gap(),top=90+Math.random()*(H-GROUND-g-180);
 pipes.push({x:W+40,top,g,w:70,passed:false});
 if(Math.random()<.45)bananas.push({x:W+72,y:top+g/2+(Math.random()-.5)*g*.4});}
function update(dt){t+=dt;
 if(mode!=="play"){if(mode==="dead"){if(y<H-GROUND-14){vy+=1800*dt;y+=vy*dt;}shake=Math.max(0,shake-dt);}else{y=H/2-40+Math.sin(t*3)*12;scroll+=dt*120;}return;}
 const s=speed();scroll+=s*dt;vy=Math.min(vy+1450*dt,620);y+=vy*dt;
 spawnT-=dt;if(spawnT<=0){spawn();spawnT=Math.max(1.25,1.6-score*.01);}
 for(const p of pipes){p.x-=s*dt;
  if(!p.passed&&p.x+p.w<PX-16){p.passed=true;score++;beep(880,0,.07,.03,"square");}
  if(PX+30>p.x+6&&PX-30<p.x+p.w-6&&(y-16<p.top||y+14>p.top+p.g)){die();return;}}
 pipes=pipes.filter(p=>p.x>-90);
 for(const b of bananas){b.x-=s*dt;if(!b.got&&Math.hypot(b.x-PX,b.y-y)<26){b.got=true;score++;[988,1319].forEach((f,i)=>beep(f,i*.06,.08,.03,"triangle"));
  for(let i=0;i<10;i++)parts.push({x:b.x,y:b.y,vx:(Math.random()-.5)*200,vy:(Math.random()-.5)*200,l:.6,c:"#ffd23f"});}}
 bananas=bananas.filter(b=>b.x>-40&&!b.got);
 for(const p of parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.l-=dt;}parts=parts.filter(p=>p.l>0);
 if(y>H-GROUND-14||y<-30)die();}
function tile(n,off,yy,w,h){const im=IM[n],x0=-(((off%(2*w))+2*w)%(2*w));
 for(let x=x0,k=0;x<W;x+=w,k++){if(k%2){cx.save();cx.translate(x+w,yy);cx.scale(-1,1);cx.drawImage(im,0,0,w,h);cx.restore();}else cx.drawImage(im,x,yy,w,h);}}
function bg(){if(ok("sky"))cx.drawImage(IM.sky,0,0,W,H);else{const g=cx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#8fe3d0");g.addColorStop(1,"#a6d98c");cx.fillStyle=g;cx.fillRect(0,0,W,H);}
 if(ok("hills"))tile("hills",scroll*.15,H-GROUND-200,650,115);
 if(ok("trees"))tile("trees",scroll*.35,H-GROUND-125,650,137);
 if(ok("vines"))tile("vines",scroll*.6,-6,650,140);}
function ground(){cx.fillStyle="#7a3f1c";cx.fillRect(0,H-20,W,20);if(ok("ground"))tile("ground",scroll,H-107,650,107);else{cx.fillStyle="#2e8a4a";cx.fillRect(0,H-GROUND,W,GROUND);}}
function trunk(x,y0,h,w,top){
 if(ok("trunk")){const im=IM.trunk,sh=Math.min(im.naturalHeight,h*im.naturalWidth/w);
  if(top){cx.save();cx.translate(x,y0+h);cx.scale(1,-1);cx.drawImage(im,0,0,im.naturalWidth,sh,0,0,w,h);cx.restore();}else cx.drawImage(im,0,0,im.naturalWidth,sh,x,y0,w,h);}
 else{cx.fillStyle="#8a5a2e";cx.fillRect(x,y0,w,h);}
 if(ok("cap")){const cw=124,ch=89.5,c0=x+w/2-63;
  if(top)cx.drawImage(IM.cap,c0,y0+h-84,cw,ch);else{cx.save();cx.translate(c0,y0-5+ch);cx.scale(1,-1);cx.drawImage(IM.cap,0,0,cw,ch);cx.restore();}}}
function plane(){cx.save();cx.translate(PX,y);
 cx.rotate(mode==="dead"?.25:mode==="play"?Math.max(-.45,Math.min(1.1,vy/600)):Math.sin(t*3)*.08);
 if(mode==="dead"&&ok("crash"))cx.drawImage(IM.crash,-48,-54,96,85);
 else if(ok("plane")){const im=IM.plane,fw=im.naturalWidth/3,f=Math.floor(t*14)%3;cx.drawImage(im,f*fw,0,fw,im.naturalHeight,-46,-52,92,84);}
 else{cx.fillStyle="#f4c430";cx.beginPath();cx.ellipse(0,2,34,12,0,0,7);cx.fill();}
 cx.restore();}
function draw(){cx.setTransform(1,0,0,1,0,0);const k=cv.width/W;cx.setTransform(k,0,0,k,0,0);
 cx.save();if(shake>0&&!reduce)cx.translate((Math.random()-.5)*shake*30,(Math.random()-.5)*shake*30);
 bg();for(const p of pipes){trunk(p.x,-10,p.top+10,p.w,true);const by=p.top+p.g;trunk(p.x,by,H-GROUND-by,p.w,false);}
 for(const b of bananas){if(ok("banana"))cx.drawImage(IM.banana,b.x-21,b.y-20+Math.sin(t*5+b.x*.05)*3,42,41);else{cx.fillStyle="#ffd23f";cx.beginPath();cx.arc(b.x,b.y,12,0,7);cx.fill();}}
 ground();
 for(const p of parts){cx.globalAlpha=Math.max(0,p.l*1.8);cx.fillStyle=p.c||"rgba(255,255,255,.8)";cx.beginPath();cx.arc(p.x,p.y,p.c?3:4,0,7);cx.fill();}cx.globalAlpha=1;
 plane();
 if(mode==="play"||(mode==="dead"&&view===null)){cx.font='52px "Titan One",sans-serif';cx.textAlign="center";cx.lineWidth=6;cx.strokeStyle="#1d3b23";cx.strokeText(score,W/2,82);cx.fillStyle="#fff";cx.fillText(score,W/2,82);}
 cx.restore();}
function fit(){const m=$(".fl-main"),c=$(".fl-cab");if(!m||!c)return;const cs=getComputedStyle(m);
 const aw=m.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-16,ah=m.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)-16;
 let h=Math.max(120,ah),w=h*W/H;if(w>aw){w=Math.max(80,aw);h=w*H/W;}c.style.width=Math.floor(w+16)+"px";c.style.height=Math.floor(h+16)+"px";}
function size(){if(!cv)return;fit();const r=cv.getBoundingClientRect();if(!r.width)return;dpr=Math.min(2,window.devicePixelRatio||1);
 const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}draw();}
function loop(n){raf=0;if(!root||root.hidden)return;const dt=Math.min((n-last)/1000,1/30);last=n;update(dt);draw();raf=requestAnimationFrame(loop);}
function run(){if(!raf){last=performance.now();raf=requestAnimationFrame(loop);}}

/* ---------- un vol ---------- */
async function takeoff(){
 if(busy||mode==="play"||!S)return;ac();busy=true;render();
 try{const r=await rpc("mf_fly_start");token=r.token;take(r.info);
  reset();mode="play";busy=false;show(null);render();flap();
  if(+r.cost>0)toast(`Vol payé : ${r.cost} 🍌`);
 }catch(e){busy=false;toast(errText(e));render();rpc("mf_fly_status").then(x=>{take(x);render();},()=>{});}
}
function die(){if(mode!=="play")return;mode="dead";deadAt=t;shake=.35;vib([40,30,80]);beep(180,0,.35,.05,"sawtooth");send(score);}
async function send(sc){
 const tk=token;token=null;busy=true;let r=null,err=null;
 for(let i=0;i<3&&!r;i++){try{r=await rpc("mf_fly_end",{p_token:tk,p_score:sc});}catch(e){err=e;if(String(e&&e.message||e).includes("fly_token"))break;await new Promise(z=>setTimeout(z,800*(i+1)));}}
 busy=false;
 const res=!r?{t:"Score non envoyé : "+errText(err),w:false}
  :r.why==="fly_bad"?{t:"Ce vol n'a pas été compté.",w:false}
  :r.why==="fly_late"?{t:"La manche était déjà terminée : ce vol ne compte pas.",w:false}
  :r.newBest?{t:`Meilleur vol de la manche !${r.rank?` Tu es ${r.rank===1?"1er":r.rank+"e"}.`:" (hors classement)"}`,w:true}
  :{t:`Ton meilleur vol reste ${S&&S.myBest!=null?S.myBest:"—"} points${r.rank?` · ${r.rank===1?"1er":r.rank+"e"}`:""}.`,w:false};
 if(r){take(r.info);render();}
 if(r&&r.newBest)[523,659,784,1047].forEach((f,i)=>beep(f,i*.08,.16,.05,"triangle"));
 setTimeout(()=>{if(mode==="dead")show("end",{score:sc,res});},Math.max(0,450-(t-deadAt)*1000));
}

/* ---------- écrans par-dessus le jeu ---------- */
function boardHTML(list,title,note){const me=S&&S.me;
 const rows=(list||[]).slice(0,10).map(x=>`<li class="${x.uid===me?"me":""}"><span class="rk">${MED[x.rank-1]||esc(x.rank)}</span><span class="nm">${esc(x.name||"?")}${x.uid===me?" (toi)":""}</span><span class="sc">${esc(x.best)}</span><span class="rw">${esc(rew(x))}</span></li>`).join("");
 return `<div class="fl-board"><h4>${esc(title)}<small>${esc(note||"")}</small></h4>${rows?`<ol>${rows}</ol>`:`<div class="empty">Personne n'a encore volé dans cette manche. À toi d'ouvrir le bal !</div>`}</div>`;}
function goLabel(){if(!S)return["…",true];if(+S.left<=0)return["Plus de vols",true];const bn=S.state?+S.state.bananas:0;
 if(+S.freeLeft>0)return["Décoller · vol gratuit",false];if(bn<+S.price)return["Pas assez de bananes",true];return[`Décoller · ${S.price} 🍌`,false];}
function menuHTML(top){const [lab,dis]=goLabel(),end=S?+S.endsAt-nowS():0;
 const sub=!S?"":(+S.left<=0?`Nouveaux vols à 18 h (dans ${dur(end)})`:`Vols : ${S.left}/${S.max} · classement à 18 h (dans ${dur(end)})`);
 return `${top||""}<button type="button" class="fl-big" id="flGo"${dis||busy?" disabled":""}>${esc(busy?"…":lab)}</button><div class="fl-sub">${esc(sub)}</div>
  ${S&&S.myBest!=null?`<div class="fl-res">Ton meilleur vol de la manche : <b>${esc(S.myBest)}</b></div>`:""}
  ${boardHTML(S&&S.board,"Classement de la manche",S?"jusqu'à 18 h":"")}`;}
let view="menu",vdata=null;
function show(v,d){view=v;vdata=d||null;const o=$(".fl-ov");if(!v){o.hidden=true;return;}o.hidden=false;
 if(v==="menu")o.innerHTML=`<h3>Prêt au décollage ?</h3>${menuHTML()}`;
 else if(v==="end")o.innerHTML=`<h3>Crash dans la jungle !</h3><div class="fl-score">${esc(d.score)}</div><div class="fl-res${d.res.w?" win":""}">${esc(d.res.t)}</div>${menuHTML()}`;
 else if(v==="last"){const L=S.last,m=L.me||{},rk=+m.rank||0,got=rew(m);
  o.innerHTML=`<h3>Résultat de la manche</h3><div class="fl-score">${rk?(MED[rk-1]||rk+"e"):"—"}</div>
   <div class="fl-res${got?" win":""}">${rk?`Tu as fini ${rk===1?"1er":rk+"e"} avec ${esc(m.best)} point${+m.best>1?"s":""}`:""}${got?` : +${esc(got)} !`:"."}</div>
   <button type="button" class="fl-big" id="flOk">Continuer</button>${boardHTML(L.board,"Classement final",fmtRound(L.round))}`;
  const b=o.querySelector("#flOk");b.addEventListener("click",()=>{rpc("mf_fly_seen",{p_round:L.round}).then(x=>{take(x);},()=>{});S.last.seen=true;show("menu");});b.focus({preventScroll:true});return;}
 const g=o.querySelector("#flGo");if(g)g.addEventListener("click",takeoff);}
const fmtRound=d=>{try{const [Y,M,D]=String(d).split("-").map(Number);const p=new Date(Y,M-1,D-1);return `du ${p.getDate()}/${p.getMonth()+1} 18 h au ${D}/${M} 18 h`;}catch(e){return "";}};
function render(){if(!root)return;const st=S&&S.state;
 $("#flBan").textContent=st?st.bananas:"…";$("#flLeft").textContent=S?`${S.left}/${S.max}`:"…";
 if(view==="menu"||view==="end")show(view,vdata);
 if(S){$("#flHist").innerHTML=(S.hist||[]).map(h=>`<li>${esc(h)}</li>`).join("");
  $("#flRw").innerHTML=(S.rewards||[]).map((x,i)=>`<tr><td>${MED[i]||(i+1)+"e"}</td><td>${esc(rew(x))}</td></tr>`).join("")+`<tr><td>${(S.rewards||[]).length+1}e et après</td><td>rien</td></tr>`;
  $("#flBestAll").textContent=S.bestAll||0;}
 if(ADMIN&&S){const o=$("#flOpen");o.textContent=S.open?"Cacher aux joueurs":"Ouvrir à tous les joueurs";o.classList.toggle("on",!S.open);
  $("#flState").textContent=S.open?"Flying Monkey est ouvert aux joueurs (pendant ses semaines dans la rotation du Casino).":"Flying Monkey est visible par toi seulement.";}}
let tt=0;function toast(m){const e=$(".fl-toast");e.textContent=m;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500);}
function panel(o){$("#flPanel").classList.toggle("open",o);$("#flTog").setAttribute("aria-expanded",String(o));}
async function adm(a,m){try{take(await rpc("mf_fly_admin",{p_action:a}));render();if(m)toast(m);}catch(e){toast(errText(e));}}

/* ---------- construction ---------- */
function build(){
 const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
 root=document.createElement("div");root.id="mfFLY";root.hidden=true;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-label","Flying Monkey");
 root.innerHTML=`<div class="fl-top"><button type="button" class="fl-btn l" id="flTog" aria-controls="flPanel" aria-expanded="false" aria-label="Règles">?</button>
  <h2 style="margin:0"><img class="fl-logo" src="${IMG.logo}" alt="Flying Monkey"><span class="fl-logoT" hidden>Flying Monkey</span></h2>
  <div class="fl-chips"><span class="fl-chip">🍌 <b id="flBan">…</b></span><span class="fl-chip">Vols <b id="flLeft">…</b></span></div>
  <button type="button" class="fl-btn r" id="flClose" aria-label="Fermer">✕</button></div>
 <div class="fl-main"><div class="fl-cab"><div class="fl-scr" id="flScr" aria-label="Zone de jeu : touche l'écran pour faire monter l'avion">
  <canvas></canvas><div class="fl-ov" aria-live="polite"></div></div></div></div>
 <aside class="fl-panel" id="flPanel" aria-label="Règles et réglages">
  <div class="fl-ph"><h3>Règles</h3><button type="button" class="fl-btn" style="position:static" id="flPanelX" aria-label="Fermer les règles">✕</button></div>
  <ul class="r">
   <li>Touche l'écran (ou Espace) pour faire monter l'avion. Passe entre les troncs sans les toucher, ni le sol.</li>
   <li><b>1 point</b> par tronc passé, <b>1 point bonus</b> par banane attrapée. Ça accélère au fil des troncs.</li>
   <li>Une <b>manche</b> va de 18 h à 18 h. <b>5 vols</b> par manche : le 1er est <b>gratuit</b>, les suivants coûtent <b>1 🍌</b>.</li>
   <li>Seul ton <b>meilleur vol</b> de la manche compte. Égalité : le premier à avoir fait ce score passe devant.</li>
   <li>Chaque soir à <b>18 h</b>, le classement est figé et les récompenses arrivent toutes seules sur ton compte.</li>
  </ul>
  <h3>Récompenses de 18 h</h3><table class="fl-rw"><tbody id="flRw"></tbody></table>
  <p>Ton record de tous les temps : <b id="flBestAll">0</b></p>
  <h3>Derniers vols</h3><ul class="fl-hist" id="flHist"></ul>
  <div id="flAdm" hidden><h3>Réglages admin</h3><p id="flState"></p>
   <div class="fl-btns"><button type="button" id="flOpen"></button></div>
   <div class="fl-btns"><button type="button" id="flReset">Rendre mes vols de la manche</button><button type="button" id="flAdd">+50 🍌</button></div></div>
 </aside>
 <div class="fl-toast" role="status"></div>`;
 document.body.appendChild(root);
 $("#flAdm").hidden=!ADMIN;
 cv=$("canvas");cx=cv.getContext("2d");
 const lg=$(".fl-logo"),noLogo=()=>{lg.hidden=true;$(".fl-logoT").hidden=false;};lg.onerror=noLogo;if(lg.complete&&!lg.naturalWidth)noLogo();
 Object.entries(IMG).forEach(([k,u])=>{if(k==="logo")return;const i=new Image();i.src=u;IM[k]=i;});
 try{new ResizeObserver(size).observe($(".fl-main"));}catch(e){addEventListener("resize",size);}
 $("#flScr").addEventListener("pointerdown",e=>{if(mode!=="play")return;e.preventDefault();flap();});
 root.addEventListener("keydown",e=>{
  if(e.key==="Escape"){if($("#flPanel").classList.contains("open"))panel(false);else close();return;}
  if((e.code==="Space"||e.code==="ArrowUp")&&mode==="play"){e.preventDefault();flap();}});
 $("#flClose").addEventListener("click",close);
 $("#flTog").addEventListener("click",()=>panel(!$("#flPanel").classList.contains("open")));
 $("#flPanelX").addEventListener("click",()=>{panel(false);$("#flTog").focus({preventScroll:true});});
 $("#flOpen").addEventListener("click",()=>adm(S&&S.open?"close":"open",S&&S.open?"Flying Monkey est de nouveau caché.":"Flying Monkey est ouvert (selon la rotation du Casino)."));
 $("#flReset").addEventListener("click",()=>adm("reset","Tes vols de la manche sont rendus."));
 $("#flAdd").addEventListener("click",()=>adm("bananas","+50 🍌 sur ton compte."));
 setInterval(()=>{if(root&&!root.hidden&&mode!=="play"&&(view==="menu"||view==="end"))render();},30000);
}

/* ---------- ouvrir / fermer ---------- */
let opener=null,prevOverflow="";
async function open(){
 if(!root)build();if(!root.hidden)return;
 root.hidden=false;opener=document.activeElement;prevOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 mode="menu";reset();show("menu");render();size();run();$("#flClose").focus({preventScroll:true});
 try{take(await rpc("mf_fly_status"));render();if(S.last&&!S.last.seen)show("last");}catch(e){toast(errText(e));}
}
function close(){
 if(mode==="play"){toast("Termine ton vol d'abord !");return;}
 if(busy&&mode==="dead"){toast("Envoi du score…");return;}
 panel(false);root.hidden=true;mode="menu";document.body.style.overflow=prevOverflow;if(opener&&opener.focus)opener.focus();
}
// l'appli passe en arrière-plan pendant un vol : on le termine (le score part quand même)
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&mode==="play")die();});

/* ---------- démarrage : le jeu s'inscrit au Casino ---------- */
async function boot(){
 if(!window.claude||!window.claude.use)return;
 try{USER=await window.claude.use("user");}catch(e){}
 if(!USER||typeof window.MF_RPC!=="function")return;
 try{ADMIN=!!(await USER.isOwner());}catch(e){}
 let can=ADMIN;if(!can){try{can=!!(await rpc("mf_fly_open"));}catch(e){}}
 if(!can||!window.MF_CASINO)return;
 Object.values(IMG).forEach(u=>{const i=new Image();i.src=u;});
 window.MF_CASINO.add({id:"fly",name:"Flying Monkey",order:10,root:"mfFLY",open,
  icon:`<svg class="ic" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13l7-1 2-6 2 1-1 5 6-1 2 2-8 2-3 4-2-1 1-3-5 1z"/><path d="M3 4v4M21 18v3"/></svg>`,
  status:async()=>{if(!(root&&!root.hidden)){const r=await rpc("mf_fly_status");take(r);}const I=S;if(!I)return null;
   const end=+I.endsAt-nowS(),unseen=!!(I.last&&!I.last.seen),me=(I.board||[]).find(x=>x.uid===I.me);
   const pos=me?` · tu es ${me.rank===1?"1er":me.rank+"e"}`:"";
   if(unseen)return {line:"Résultat de la manche à voir !",hot:true};
   if(+I.freeLeft>0)return {line:"Vol gratuit disponible"+pos,pre:"Classement dans ",in:end,hot:true};
   if(+I.left>0)return {line:`Encore ${I.left} vol${+I.left>1?"s":""} · ${I.price} 🍌 le vol${pos}`,pre:"Classement dans ",in:end,hot:false};
   return {line:"Plus de vols dans cette manche"+pos,pre:"Classement dans ",in:end,hot:false};}});
}
window.MF_FLY={open};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

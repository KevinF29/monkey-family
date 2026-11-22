/* Monkey Family — Extension Pop-Culture (mode caché : visible seulement par l'admin)
   Cartes full art, 6 raretés propres à l'extension, booster et classeur séparés du jeu de base.
   Rien ici ne touche à la collection du jeu de base ni au serveur des boosters :
   les cartes de l'extension vivent dans la collection « popcards », la collection de test de l'admin dans data/users/<id>/pop. */
(function(){
"use strict";

/* ---------- catalogue de départ (onglet « Extension 1 » du Google Sheet) ----------
   ligne n → N° PC-00n | catégorie (J, F, B, A) | œuvre | personnage | nom de la carte | prénom | rareté */
const SEED_TXT=`J|Assassin's Creed|Ezio Auditore||Maxime|
A|Avatar|Bumi|Budri|Adrien|
A|Avatar|Toph|Beel'Toph|Brian|
A|Avatar|Zuko|ZukKyx|DarkKyx|
A|Avatar|Aang|Avatar Fredho|Fred|
A|Avatar|Ozai|Seigneur du feu Kubenaï|Kuben|
A|Avatar|Azula|AzulamesRr|Maxime|
A|Avatar|Sokka|Swokka|Sweevy|
A|Avatar|Iroh|Chelmaquiroh|Wes|
B|Batman|Batman||Maxime|
A|Bob l'éponge|Patrick||Adrien|
A|Bob l'éponge|Carlos||Fred|
A|Bob l'éponge|Mr. Crabbs||Kuben|
A|Bob l'éponge|Bob||Wes|
J|Borderland|Psycho||Adrien|
J|Borderland|Beau Jack|Beau Dark|DarkKyx|
J|Borderland|Etalon du cul||Sweevy|
F|Breaking Bad|Walter White|Walterdo White|Fred|
F|Breaking Bad|Jesse|Jamesse Pinkman|Maxime|
F|Breaking Bad|Walter et Jesse faisant de la Met||Groupe|
J|Brütal Legend|Eddie Riggs||DarkKyx|
B|Captain America|Captain America||Wes|
A|Code Lyoko|Todd||Brian|
A|Code Lyoko|Ulrich||DarkKyx|
A|Code Lyoko|Jeremy||Kuben|
A|Code Lyoko|Yumi||Wes|
J|Devil May Cry|Dante||Wes|
B|Dr. Strange|Dr. Strange||Brian|
B|Dragon Ball|Mr Satan|Mister Dridri|Adrien|
B|Dragon Ball|Vegeta|Vegegraal|Brian|
B|Dragon Ball|Beerus|Deeddus|DarkKyx|
B|Dragon Ball|Boo|Majin Bo|Fred|
B|Dragon Ball|Cell|Kubell|Kuben|
B|Dragon Ball|Freezer|JamesZerZer|Maxime|
B|Dragon Ball|Broly|Sweely|Sweevy|
B|Dragon Ball|Son Goku|Son Gomaque|Wes|
B|Dragon Ball|Combat Son Goku Vegeta||Groupe|
J|Duke Nukkem|Duke Nukkem||Sweevy|
A|Eyeshield 21|Shin||Brian|
A|Eyeshield 21|Sena||DarkKyx|
B|Eyeshield 21|Duel Sena Shin||Groupe|
F|Fast and Furious|Toretto||Fred|
F|Fast and Furious|Brian O'Connor||Maxime|
F|Fast and Furious|Scene iconique F&F7||Groupe|
J|FF7|Cloud||Brian|
B|Food Wars|Soma|Shokugeki no Chelmaque|Wes|
F|Friends|Scene de Friends||Groupe|Secret
B|Full Metal Alchemist|Louis Armstrong|Dridri Armstrong|Adrien|
B|Full Metal Alchemist|Scar|Beel'Scar|Brian|
B|Full Metal Alchemist|Roy Mustang|DarkKoy Mustang|DarkKyx|
B|Full Metal Alchemist|Alphonse|Fredho Elric|Fred|
B|Full Metal Alchemist|King Bradley|King Bradleni|Kuben|
B|Full Metal Alchemist|Ed|James Elric|Maxime|
B|Full Metal Alchemist|Envy|Sweenvy|Sweevy|
B|Full Metal Alchemist|Hugues|Chelmaes Hughes|Wes|
F|Game of Thrones|Ed Stark||Adrien|
F|Game of Thrones|Daenerys Targaryen||Brian|
F|Game of Thrones|Oberyn Martell||DarkKyx|
F|Game of Thrones|Varys||Fred|
F|Game of Thrones|Tyrion Lannister||Kuben|
F|Game of Thrones|Jamie Lannister||Maxime|
F|Game of Thrones|La Montagne||Sweevy|
F|Game of Thrones|Jon Snow||Wes|
J|Gears of War|Marcus Phenix||Adrien|
J|GTA|Trevor Collins||Kuben|
J|Hades|Zagreus||DarkKyx|
B|Haikyuu!!|Tsukishima|Dridrishima|Adrien|
F|Harry Potter|Sorcier Pousouffle||Adrien|
F|Harry Potter|Sorcier Gryffondor||Brian|
F|Harry Potter|Sorcier Serpentard||DarkKyx|
F|Harry Potter|Sorcier Pousouffle||Fred|
F|Harry Potter|Sorcier Pousouffle||Kuben|
F|Harry Potter|Sorcier Gryffondor||Maxime|
F|Harry Potter|Sorcier Serpentard||Sweevy|
F|Harry Potter|Sorcier Pousouffle||Wes|
B|Hawkeye|Hawkeye||Kuben|
J|Hitman|Agent 47||Fred|
B|Hulk|Hulk||Sweevy|
F|Indiana Jones|Indiana Jones||Kuben|
B|Iron Man|Iron Man||DarkKyx|
F|James Bond|James Bond||Maxime|
J|Kurby|Kurby||Kuben|
B|Kuroko no Basket|Momoi|Momodri|Adrien|
B|Kuroko no Basket|Aomine|Aomigraal|Brian|
B|Kuroko no Basket|Kise|DarKise|DarkKyx|
B|Kuroko no Basket|Kuroko|Fredhoko|Fred|
B|Kuroko no Basket|Murasakibara|Kubenibara|Kuben|
B|Kuroko no Basket|Kagami|KagajamesRr|Maxime|
B|Kuroko no Basket|Akashi|Sweevashi|Sweevy|
B|Kuroko no Basket|Midorima|Midorimaque|Wes|
F|Mad Max|Max||Maxime|
B|Mashle|Mashle|Sweemashle|Sweevy|
J|Megaman|Megaman||Adrien|
B|Naruto|Kakashi|Dridrishi Hatake|Adrien|
B|Naruto|Gai|Gaal Maito|Brian|
B|Naruto|Itachi|DarkKyx Uchiwa|DarkKyx|
B|Naruto|Naruto|Narudo Uzumaki|Fred|
B|Naruto|Sasuke|Sasubeni Uchiwa|Kuben|
B|Naruto|Kiba|Kibames Inuzuka|Maxime|
B|Naruto|Jiraiya|Jireevy|Sweevy|
B|Naruto|Orochimaru|Orochimaku|Wes|
B|Naruto|Combat Naruto Sasuke||Groupe|
B|One Piece|Kaido|Drido aux Cent Bêtes|Adrien|
B|One Piece|Fujitora|Fujitoraal|Brian|
B|One Piece|Luffy|Monkey D. DarkKy|DarkKyx|
B|One Piece|Mihawk|Dracule Mihok|Fred|
B|One Piece|Teach|Marshall D. Kubeach|Kuben|
B|One Piece|Ace|Portgas D. James|Maxime|
B|One Piece|Shanks|Sweevy le Roux|Sweevy|
B|One Piece|Zoro|Roronoa Chelmaque|Wes|
B|One Piece|Combat Luffy Barbe Noire||Groupe|
B|One Punch Man|Genos||Brian|
B|One Punch Man|Saitama||Fred|
J|Overwatch|Reinhardt||Adrien|
J|Overwatch|Tracer||Brian|
J|Overwatch|Chacal||DarkKyx|
J|Overwatch|Winston||Fred|
J|Overwatch|Cassidy||Kuben|
J|Overwatch|Soldat 76||Maxime|
J|Overwatch|Mei||Sweevy|
J|Overwatch|Ange||Wes|
A|Pokemon|Dresseur||Adrien|
A|Pokemon|Dresseur||Brian|
A|Pokemon|Dresseur||DarkKyx|
A|Pokemon|Dresseur||Fred|
A|Pokemon|Dresseur||Kuben|
A|Pokemon|Dresseur||Maxime|
A|Pokemon|Dresseur||Sweevy|
A|Pokemon|Dresseur||Wes|
F|Rambo|Rambo||Wes|
J|Red Dead Redemption|Arthur Morgan||Maxime|
F|Rocky Balboa|Rocky||Brian|
F|Seigneur des Anneaux|Gimli||Adrien|
F|Seigneur des Anneaux|Frodon||Brian|
F|Seigneur des Anneaux|Aragorn||DarkKyx|
F|Seigneur des Anneaux|Gollum||Fred|
F|Seigneur des Anneaux|Nazgul reunis|Les nazes gül|Groupe|Secret
F|Seigneur des Anneaux|Saroumane||Kuben|
F|Seigneur des Anneaux|Theoden||Maxime|
F|Seigneur des Anneaux|Legolas||Sweevy|
F|Seigneur des Anneaux|Gandalf||Wes|
B|Shaman King|Yoh|Asakura Beel'Yoh|Brian|
B|Shaman King|Hao|Asakura DarkHao|DarkKyx|
A|Simpsons|Style Simpsons||Adrien|
A|Simpsons|Style Simpsons||Brian|
A|Simpsons|Style Simpsons||DarkKyx|
A|Simpsons|Style Simpsons||Fred|
A|Simpsons|Style Simpsons||Kuben|
A|Simpsons|Style Simpsons||Maxime|
A|Simpsons|Style Simpsons||Sweevy|
A|Simpsons|Style Simpsons||Wes|
B|Solo Leveling|Sung Jin-Woo|Sung Darkin-woo|DarkKyx|
J|Sonic|Shadow||DarkKyx|
J|Sonic|Dr. Eggman||Fred|
J|Sonic|Sonic||Brian|
A|South Park|Style South Park||Adrien|
A|South Park|Style South Park||Brian|
A|South Park|Style South Park||DarkKyx|
A|South Park|Style South Park||Fred|
A|South Park|Style South Park||Kuben|
A|South Park|Style South Park||Maxime|
A|South Park|Style South Park||Sweevy|
A|South Park|Style South Park||Wes|
B|Spider Man|Spider Man||Maxime|
F|Star Wars|Yan Solo||Adrien|
F|Star Wars|Luke Skywalker||Brian|
F|Star Wars|Dark Sidious||DarkKyx|
F|Star Wars|Dark Maul||Fred|
F|Star Wars|Chewbacca||Kuben|
F|Star Wars|Anakin / ombre de Vador||Maxime|
F|Star Wars|Obi-Wan||Sweevy|
F|Star Wars|Yoda||Wes|
J|Super Mario|Waluigi||Adrien|
J|Super Mario|Luigi||DarkKyx|
J|Super Mario|Toad||Fred|
J|Super Mario|Boowser||Kuben|
J|Super Mario|Peach||Maxime|
J|Super Mario|Mario||Sweevy|
J|Super Mario|Wario||Wes|
B|Superman|Superman||Sweevy|
F|The Office|Scene style The Office||Groupe|Secret
J|The Witcher|Geralt de Riv||Sweevy|
B|Thor|Thor||Adrien|
A|Totally Spies|Alex||Brian|
A|Totally Spies|Jerry||Fred|
A|Totally Spies|Sam||Kuben|
A|Totally Spies|Clover||Wes|
A|Totally Spies|Pose des spies + Jerry||Groupe|
J|Uncharted|Nathan Drake||Sweevy|
B|Vision|Vision||Fred|
J|World of Warcraft|Leroy Jenkins||Adrien|
J|World of Warcraft|Malfurion||Brian|
J|World of Warcraft|Anduin||DarkKyx|
J|World of Warcraft|Garrosh||Fred|
J|World of Warcraft|Gul'dan||Kuben|
J|World of Warcraft|Roi-Liche||Maxime|
J|World of Warcraft|Uther||Sweevy|
J|World of Warcraft|Thrall||Wes|
A|Yu-Gi-Oh|Bakura||Adrien|
A|Yu-Gi-Oh|Joey||Brian|
A|Yu-Gi-Oh|Kaiba||DarkKyx|
A|Yu-Gi-Oh|Tristan||Fred|
A|Yu-Gi-Oh|Pegasus||Kuben|
A|Yu-Gi-Oh|Yugi||Maxime|
A|Yu-Gi-Oh|Le Pharaon||Sweevy|
A|Yu-Gi-Oh|Grand-père de Yugi||Wes|
A|Yu-Gi-Oh|Pharaon vs Kaiba||Groupe|
J|Zelda|Link||Adrien|`;

const EXT_NAME="Extension Pop-Culture";
const CATS=["Jeux vidéo","Film / Série","BD / Manga","Animé"];
const CAT_CODE={J:"Jeux vidéo",F:"Film / Série",B:"BD / Manga",A:"Animé"};
const CAT_ICO={"Jeux vidéo":"🎮","Film / Série":"🎬","BD / Manga":"📚","Animé":"📺"};
/* prénom (Google Sheet) → pseudo affiché sur la carte */
const POTES=[["DarkKyx","DarkKyx"],["Maxime","JamesRr"],["Fred","Fredho"],["Wes","Chelmaque"],["Sweevy","Sweevy"],["Brian","Beel'Graal"],["Adrien","Dridriix"],["Kuben","Kubeni"],["Groupe","Monkey Family"]];
const PSEUDO=Object.fromEntries(POTES);

/* ---------- raretés de l'extension ---------- */
const RAR=[
  {key:"rare",name:"Rare",sym:"star",a:"#1449c8",b:"#7fb4ff",tx:"#9cc8ff"},
  {key:"super-rare",name:"Super Rare",sym:"stars2",a:"#5a17c4",b:"#c799ff",tx:"#cfaaff"},
  {key:"ultra-rare",name:"Ultra Rare",sym:"pint",a:"#d45a06",b:"#ffc073",tx:"#ffb366",sheen:true},
  {key:"epique",name:"Épique",sym:"pad",a:"#b80f19",b:"#ff6f63",tx:"#ff8077",sheen:true},
  {key:"legendaire",name:"Légendaire",sym:"bigstar",a:"#b8820a",b:"#ffe27a",tx:"#ffd447",sheen:true,sparkle:true},
  {key:"secret",name:"Secret",sym:"monkey",a:"#ffffff",b:"#ffffff",tx:"#ffffff",sheen:true,sparkle:true,rainbow:true}
];
const RI=Object.fromEntries(RAR.map((r,i)=>[r.key,i]));
const RNAME=Object.fromEntries(RAR.map(r=>[r.name.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase(),r.key]));
/* taux provisoires (modifiables dans l'onglet « Taux ») : cartes 1 à 4, puis carte 5 */
const DEF_RATES={main:{"rare":72,"super-rare":20,"ultra-rare":8,"epique":0,"legendaire":0,"secret":0},
                 last:{"rare":0,"super-rare":45,"ultra-rare":30,"epique":15,"legendaire":8,"secret":2}};
const PACK_SIZE=5;

const W=1060,H=1484,ART={x:96,y:114,w:868,h:1236,r:64};
const $=(s,r)=>(r||document).querySelector(s),$$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};

/* ---------- cartes : catalogue de départ + modifications du Studio ---------- */
const SEED=SEED_TXT.split("\n").map((l,i)=>{const [c,sub,perso,nom,pr,rar]=l.split("|").map(s=>(s||"").trim());
  const rk=rar?RNAME[rar.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()]:"";
  return {id:"PC-"+String(i+1).padStart(3,"0"),cat:CAT_CODE[c],sub,perso,name:nom||perso,pote:pr,rarity:rk||"rare",todo:!rk};});
let EDITS={};          // id -> champs modifiés (collection popcards)
let CARDS=[];          // catalogue fusionné, trié
const IMGS=new Map();  // asset -> Image
function imgOf(asset){if(!asset)return null;let im=IMGS.get(asset);
  if(!im){im=new Image();im.decoding="async";IMGS.set(asset,im);im.onload=()=>{THUMBS.clear();onArt();};
    if(window.MF_MEDIA)MF_MEDIA.url(asset).then(u=>{im.src=u;},()=>{});}
  return im;}
function rebuild(){
  const byId=new Map();
  SEED.forEach(s=>byId.set(s.id,{...s}));
  Object.entries(EDITS).forEach(([id,e])=>{const base=byId.get(id)||{id,cat:CATS[0],sub:"",perso:"",name:"",pote:"",rarity:"rare",custom:true};
    const m={...base,...e};if(e.rarity)m.todo=false;byId.set(id,m);});
  CARDS=[...byId.values()].filter(c=>!c.del&&c.name).map(c=>({...c,cat:CATS.includes(c.cat)?c.cat:CATS[0],rarity:RI[c.rarity]!=null?c.rarity:"rare"}));
  CARDS.sort((a,b)=>CATS.indexOf(a.cat)-CATS.indexOf(b.cat)||a.id.localeCompare(b.id,"fr",{numeric:true}));
  CARDS.forEach(c=>{c.R=RAR[RI[c.rarity]];c.img=imgOf(c.asset);});
}
const cardById=id=>CARDS.find(c=>c.id===id);

/* ---------- dessin d'une carte (même rendu que l'atelier « Extension Full Art ») ---------- */
const FRAMES={};let SINGE=null,COVER=null;
function loadStatic(){
  RAR.forEach(R=>{const im=new Image();im.onload=()=>{THUMBS.clear();onArt();};im.src="packs/pop-cadre-"+R.key+".webp";FRAMES[R.key]=im;});
  SINGE=new Image();SINGE.onload=()=>{THUMBS.clear();onArt();};SINGE.src="packs/pop-singe.webp";
  COVER=new Image();COVER.src="packs/pop-cover.webp";
  if(document.fonts&&document.fonts.load)Promise.all([document.fonts.load("40px 'Dela Gothic One'"),document.fonts.load("700 30px 'Barlow Condensed'"),document.fonts.load("600 30px 'Barlow Condensed'")]).then(()=>{THUMBS.clear();onArt();}).catch(()=>{});
}
const ok=im=>im&&im.complete&&im.naturalWidth>0;
function rr(c,x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function rainbowGrad(c,x0,y0,x1,y1,ph,alpha){const g=c.createLinearGradient(x0,y0,x1,y1);for(let i=0;i<=8;i++)g.addColorStop(i/8,`hsla(${(i*45+ph)%360},95%,62%,${alpha})`);return g;}
function rarFill(c,R,x,y,w,h,ph){if(R.rainbow)return rainbowGrad(c,x,y,x+w,y+h,ph||0,1);const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,R.b);g.addColorStop(.5,R.a);g.addColorStop(1,R.b);return g;}
/* certaines polices n'ont pas É, è, ê… : la lettre est dessinée nue et l'accent à la main */
function clusters(t){const out=[];for(const ch of t.normalize("NFD")){if(/[̀-ͯ]/.test(ch)&&out.length)out[out.length-1].m.push(ch);else out.push({b:ch,m:[]});}return out;}
const measureSafe=(c,t)=>clusters(t).reduce((s,k)=>s+c.measureText(k.b).width,0);
function drawMark(c,m,cx,y,s,up){
  const top=up?y-.39*s:y-.2*s,bot=up?y+.36*s:y+.3*s;
  c.save();c.lineCap="round";c.lineJoin="round";
  const line=(pts,w)=>{c.beginPath();pts.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));if(c.__stroke){c.lineWidth=w+c.__stroke;c.strokeStyle=c.__strokeC;c.stroke();}c.lineWidth=w;c.strokeStyle=c.fillStyle;c.stroke();};
  if(m==="́")line([[cx-.05*s,top-.07*s],[cx+.09*s,top-.22*s]],.1*s);
  else if(m==="̀")line([[cx+.05*s,top-.07*s],[cx-.09*s,top-.22*s]],.1*s);
  else if(m==="̂")line([[cx-.13*s,top-.07*s],[cx,top-.2*s],[cx+.13*s,top-.07*s]],.09*s);
  else if(m==="̈")[-.1,.1].forEach(d=>{c.beginPath();c.arc(cx+d*s,top-.13*s,.055*s,0,Math.PI*2);c.fill();});
  else if(m==="̧")line([[cx,bot-.02*s],[cx+.03*s,bot+.07*s],[cx-.06*s,bot+.2*s]],.07*s);
  c.restore();
}
function textSafe(c,t,x,y,align){
  const s=parseFloat((c.font.match(/([\d.]+)px/)||[0,30])[1]),ks=clusters(t);
  const ws=ks.map(k=>c.measureText(k.b).width),total=ws.reduce((a,b)=>a+b,0);
  let sx=align==="center"?x-total/2:align==="right"?x-total:x;
  c.save();c.textAlign="left";
  if(c.__stroke){c.save();c.shadowColor="transparent";c.lineWidth=c.__stroke;c.strokeStyle=c.__strokeC;c.lineJoin="round";let px=sx;ks.forEach((k,i)=>{c.strokeText(k.b,px,y);px+=ws[i];});c.restore();}
  ks.forEach((k,i)=>{c.fillText(k.b,sx,y);const up=k.b!==k.b.toLowerCase();k.m.forEach(m=>drawMark(c,m,sx+ws[i]/2,y,s,up));sx+=ws[i];});
  c.restore();
}
function fit(c,t,max,start,min,family,weight){let size=start;const f=()=>c.font=`${weight||""} ${size}px ${family}`.trim();f();while(measureSafe(c,t)>max&&size>min){size-=2;f();}return size;}
function starPath(c,x,y,s,inner){c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?s*(inner||.45):s;c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}c.closePath();}
function finish(c,fill,stroke,w){c.fillStyle=fill;c.fill();c.lineWidth=w||3;c.lineJoin="round";c.strokeStyle=stroke||"rgba(255,255,255,.9)";c.stroke();}
function pint(c,stroke){
  const top=-26,bot=26,tw=19,bw=14;
  const glass=()=>{c.beginPath();c.moveTo(-tw,top);c.lineTo(tw,top);c.lineTo(bw,bot);c.lineTo(-bw,bot);c.closePath();};
  glass();const g=c.createLinearGradient(-tw,0,tw,0);g.addColorStop(0,"#c97a0c");g.addColorStop(.45,"#f8c03c");g.addColorStop(1,"#b56a08");c.fillStyle=g;c.fill();
  c.save();glass();c.clip();c.fillStyle="#fff8e7";c.fillRect(-tw-2,top-2,tw*2+4,13);c.restore();
  c.fillStyle="#fff8e7";[[-11,top+1,7],[0,top-2,8],[11,top+1,7]].forEach(([dx,yy,r])=>{c.beginPath();c.arc(dx,yy,r,0,Math.PI*2);c.fill();});
  c.fillStyle="rgba(255,255,255,.7)";[[-5,6,2.2],[4,14,1.8],[-2,19,1.5]].forEach(([dx,yy,r])=>{c.beginPath();c.arc(dx,yy,r,0,Math.PI*2);c.fill();});
  glass();c.lineWidth=3;c.lineJoin="round";c.strokeStyle=stroke;c.stroke();
}
function pad(c,stroke){
  rr(c,-31,-15,62,30,14);finish(c,"#f4f2fa",stroke);
  [-1,1].forEach(d=>{c.beginPath();c.ellipse(d*20,10,11,13,d*-.35,0,Math.PI*2);finish(c,"#f4f2fa",stroke);});
  rr(c,-31,-15,62,24,14);c.fillStyle="#f4f2fa";c.fill();
  c.fillStyle="#2a1630";c.fillRect(-23,-3,13,5);c.fillRect(-19,-7,5,13);
  [["#3aa0ff",13,-6],["#ff4b45",20,0],["#39c463",6,0],["#ffc23a",13,6]].forEach(([col,bx,by])=>{c.beginPath();c.arc(bx,by,3.4,0,Math.PI*2);c.fillStyle=col;c.fill();});
}
function symbol(c,R,x,y,size){
  c.save();c.translate(x,y);const k=size/64;c.scale(k,k);const st="rgba(20,10,30,.55)";
  if(R.sym==="star"){starPath(c,0,3,34);finish(c,"#ffffff",st,3);}
  else if(R.sym==="stars2"){starPath(c,-15,8,23);finish(c,"#ffffff",st,3);starPath(c,15,-6,23);finish(c,"#ffffff",st,3);}
  else if(R.sym==="pint"){c.scale(1.1,1.1);pint(c,"rgba(255,255,255,.95)");}
  else if(R.sym==="pad"){pad(c,st);}
  else if(R.sym==="bigstar"){c.shadowColor="#fff3b0";c.shadowBlur=18;starPath(c,0,4,44,.42);const g=c.createLinearGradient(0,-44,0,44);g.addColorStop(0,"#fffbe6");g.addColorStop(.5,"#ffd447");g.addColorStop(1,"#e09a00");finish(c,g,"#ffffff",3.5);}
  c.restore();
}
function badge(c,R,x,y,r,ph){
  c.save();c.shadowColor="rgba(0,0,0,.55)";c.shadowBlur=14;
  c.beginPath();c.arc(x,y,r,0,Math.PI*2);
  if(R.rainbow&&c.createConicGradient){const g=c.createConicGradient((ph||0)*Math.PI/180,x,y);for(let i=0;i<=6;i++)g.addColorStop(i/6,`hsl(${i*60} 95% 60%)`);c.fillStyle=g;}
  else c.fillStyle=rarFill(c,R,x-r,y-r,2*r,2*r,ph);
  c.fill();c.shadowBlur=0;c.lineWidth=4;c.strokeStyle="rgba(255,255,255,.95)";c.stroke();
  if(R.sym==="monkey"&&ok(SINGE)){c.beginPath();c.arc(x,y,r-9,0,Math.PI*2);c.clip();c.drawImage(SINGE,x-(r-7),y-(r-7),2*(r-7),2*(r-7));}
  else{c.beginPath();c.arc(x,y,r-10,0,Math.PI*2);const g=c.createRadialGradient(x,y-r*.3,4,x,y,r);g.addColorStop(0,R.a);g.addColorStop(1,"#0d0716");c.fillStyle=g;c.fill();
    c.lineWidth=2;c.strokeStyle="rgba(255,255,255,.35)";c.stroke();symbol(c,R.sym==="monkey"?{...R,sym:"bigstar"}:R,x,y,r*1.05);}
  c.restore();
}
function imgSize(im,zoom){const s=Math.max(ART.w/im.naturalWidth,ART.h/im.naturalHeight)*(zoom||1);return {dw:im.naturalWidth*s,dh:im.naturalHeight*s};}
function art(c,o){
  const A=ART,im=o.img;
  c.save();rr(c,A.x,A.y,A.w,A.h,A.r);c.fillStyle="#17121f";c.fill();c.clip();
  if(ok(im)){
    const {dw,dh}=imgSize(im,o.zoom);
    if(dw<A.w-.5||dh<A.h-.5){const cover=Math.max(A.w/im.naturalWidth,A.h/im.naturalHeight)*1.15,bw=im.naturalWidth*cover,bh=im.naturalHeight*cover;
      c.save();if(!o.cheap)c.filter="blur(30px) brightness(.6)";else c.globalAlpha=.45;c.drawImage(im,A.x+(A.w-bw)/2,A.y+(A.h-bh)/2,bw,bh);c.restore();}
    c.drawImage(im,A.x+(A.w-dw)/2+(o.fx||0)*A.w,A.y+(A.h-dh)/2+(o.fy||0)*A.h,dw,dh);
  }else{
    const g=c.createLinearGradient(0,A.y,0,A.y+A.h);g.addColorStop(0,"#2a1d3d");g.addColorStop(1,"#120c1b");c.fillStyle=g;c.fillRect(A.x,A.y,A.w,A.h);
    c.strokeStyle="rgba(255,255,255,.05)";c.lineWidth=2;for(let i=-A.h;i<A.w;i+=36){c.beginPath();c.moveTo(A.x+i,A.y+A.h);c.lineTo(A.x+i+A.h,A.y);c.stroke();}
    c.fillStyle="rgba(255,255,255,.5)";c.textAlign="center";c.textBaseline="middle";c.font="600 44px 'Barlow Condensed',sans-serif";
    c.fillText(o.asset?"Illustration en chargement…":"Illustration à venir",W/2,H/2-80);
    if(o.perso){c.font="500 32px Barlow,sans-serif";c.globalAlpha=.7;c.fillText(o.perso,W/2,H/2-30);c.globalAlpha=1;}
  }
  c.restore();
}
function textLayer(c,o,R,ph){
  const A=ART,title=(o.name||"").trim(),sub=(o.sub||"").trim(),pote=o.pote?(PSEUDO[o.pote]||o.pote):"";
  c.save();rr(c,A.x,A.y,A.w,A.h,A.r);c.clip();
  const g=c.createLinearGradient(0,A.y+A.h-480,0,A.y+A.h);g.addColorStop(0,"rgba(8,4,16,0)");g.addColorStop(.45,"rgba(8,4,16,.55)");g.addColorStop(1,"rgba(8,4,16,.92)");c.fillStyle=g;c.fillRect(A.x,A.y+A.h-480,A.w,480);
  c.restore();
  const L=152,BX=852,BR=66,titleY=sub?1150:1176,subY=1214,badgeY=sub?1180:1176,max=BX-BR-26-L;
  c.save();c.textBaseline="middle";
  if(pote){c.font="700 30px 'Barlow Condensed',sans-serif";const label=pote.toUpperCase(),tw=measureSafe(c,label)+40,py=sub?1072:1098;
    c.save();rr(c,L-4,py-22,tw,44,22);c.fillStyle="rgba(10,6,20,.6)";c.fill();c.lineWidth=3;c.strokeStyle=R.rainbow?rainbowGrad(c,L,0,L+tw,0,ph,1):R.tx;c.stroke();c.restore();
    c.fillStyle=R.rainbow?"#ffffff":R.tx;textSafe(c,label,L+16,py+1,"left");}
  c.__stroke=10;c.__strokeC="rgba(8,4,16,.85)";c.shadowColor=R.rainbow?`hsl(${ph%360} 90% 60%)`:R.a;c.shadowBlur=o.cheap?0:22;
  if(title){fit(c,title,max,70,24,"'Dela Gothic One','Arial Black',sans-serif");c.fillStyle="#ffffff";textSafe(c,title,L,titleY,"left");}
  c.shadowBlur=0;c.__stroke=7;
  if(sub){c.save();fit(c,sub,max-10,40,18,"'Barlow Condensed',sans-serif","600");c.fillStyle=R.rainbow?"#ffffff":R.tx;c.translate(L+4,subY);c.transform(1,0,-.18,1,0,0);textSafe(c,sub,0,0,"left");c.restore();}
  c.__stroke=0;badge(c,R,BX,badgeY,BR,ph);
  const fy=1298,num=(o.id||"").toUpperCase();c.__stroke=6;c.__strokeC="rgba(8,4,16,.8)";
  if(num){c.font="700 32px 'Barlow Condensed',sans-serif";c.fillStyle="rgba(255,255,255,.9)";textSafe(c,num,L,fy,"left");}
  c.font="700 32px 'Barlow Condensed',sans-serif";const rn=R.name.toUpperCase().split("").join(" ");
  c.fillStyle=R.rainbow?rainbowGrad(c,BX-200,0,BX+60,0,ph,1):R.tx;textSafe(c,rn,908,fy,"right");
  c.__stroke=0;c.restore();
}
let fcv=null;
function frame(c,R,ph){
  const im=FRAMES[R.key];if(!ok(im))return;
  if(!R.rainbow){c.drawImage(im,0,0,W,H);return;}
  if(!fcv){fcv=document.createElement("canvas");fcv.width=530;fcv.height=742;}
  const f=fcv.getContext("2d");f.clearRect(0,0,530,742);f.globalCompositeOperation="source-over";f.drawImage(im,0,0,530,742);
  f.globalCompositeOperation="source-atop";f.globalAlpha=.36;f.fillStyle=rainbowGrad(f,0,0,530,742,ph,1);f.fillRect(0,0,530,742);
  f.globalAlpha=1;f.globalCompositeOperation="source-over";
  c.drawImage(im,0,0,W,H);c.drawImage(fcv,0,0,W,H);
}
function rand(seed){let s=seed;return()=>((s=(s*16807)%2147483647)/2147483647);}
function effects(c,R,ph){
  if(R.sheen){c.save();c.globalCompositeOperation="source-atop";const p=((ph%360)/360)*(W+H*2)-H,g=c.createLinearGradient(p,0,p+380,H);
    g.addColorStop(0,"rgba(255,255,255,0)");g.addColorStop(.5,R.rainbow?"rgba(255,255,255,.2)":"rgba(255,255,255,.13)");g.addColorStop(1,"rgba(255,255,255,0)");c.fillStyle=g;c.fillRect(0,0,W,H);c.restore();}
  if(R.sparkle){const rnd=rand(R.rainbow?29:17);c.save();
    for(let i=0;i<22;i++){const x=60+rnd()*(W-120),y=60+rnd()*(H-120),sz=8+rnd()*16,tw=(Math.sin(ph*Math.PI/30+i*1.7)+1)/2;if(tw<.2)continue;
      c.globalAlpha=tw;c.shadowColor=R.rainbow?`hsl(${(ph*2+i*40)%360} 95% 65%)`:"#ffe27a";c.shadowBlur=16;c.fillStyle="#fff";
      c.beginPath();c.moveTo(x,y-sz);c.quadraticCurveTo(x,y,x+sz,y);c.quadraticCurveTo(x,y,x,y+sz);c.quadraticCurveTo(x,y,x-sz,y);c.quadraticCurveTo(x,y,x,y-sz);c.fill();}
    c.restore();}
}
/* draw(canvas, carte, {phase, fx:effets animés, cheap:vignette}) — le canvas peut faire n'importe quelle taille au format carte */
function draw(cv,card,o){
  o=o||{};const c=cv.getContext("2d"),k=cv.width/W,R=card.R||RAR[RI[card.rarity]||0],ph=o.phase||0;
  c.save();c.setTransform(k,0,0,k,0,0);c.clearRect(0,0,W,H);
  const d={...card,cheap:o.cheap};
  art(c,d);textLayer(c,d,R,ph);frame(c,R,ph);if(o.fx)effects(c,R,ph);
  c.restore();
}
/* vignettes : dessinées une fois sur un canvas partagé, gardées en images (peu de mémoire graphique, pas de zones noires sur téléphone) */
const THUMBS=new Map();let tcv=null,tq=[],tbusy=false;
const sigOf=c=>[c.id,c.name,c.sub,c.pote,c.rarity,c.asset,c.zoom,c.fx,c.fy,ok(c.img)].join("|");
const TPEND=new Map();
function thumbURL(card){const s=sigOf(card),hit=THUMBS.get(card.id);if(hit&&hit.sig===s)return Promise.resolve(hit.url);
  const pk=card.id+"#"+s;if(TPEND.has(pk)){const j=tq.findIndex(x=>x.pk===pk);if(j>=0)tq.push(tq.splice(j,1)[0]);return TPEND.get(pk);}
  const pr=new Promise(res=>{tq.push({card,s,pk,res});pump();});TPEND.set(pk,pr);return pr;}
/* les vignettes demandées en dernier passent d'abord (l'écran affiché avant le reste) */
function pump(){if(tbusy||!tq.length)return;tbusy=true;const {card,s,pk,res}=tq.pop();TPEND.delete(pk);
  if(!tcv){tcv=document.createElement("canvas");tcv.width=318;tcv.height=445;}
  try{draw(tcv,card,{cheap:true});}catch(e){}
  tcv.toBlob(b=>{const old=THUMBS.get(card.id);if(old&&old.url)setTimeout(()=>URL.revokeObjectURL(old.url),4000);
    const url=b?URL.createObjectURL(b):"";THUMBS.set(card.id,{sig:s,url});res(url);tbusy=false;setTimeout(pump,0);},"image/webp",.85);}

const IO="IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;IO.unobserve(e.target);const c=cardById(e.target.dataset.id);
  if(c)thumbURL(c).then(u=>{if(e.target.isConnected&&e.target.src!==u)e.target.src=u;});}),{rootMargin:"300px"}):null;
function lazy(im,c){im.dataset.id=c.id;if(IO)IO.observe(im);else thumbURL(c).then(u=>{im.src=u;});}

/* ---------- collection de test (admin) ---------- */
const LS_COL="mf-pop-col-v1",LS_RATES="mf-pop-rates-v1";
let COL=lsGet(LS_COL,{owned:{},opened:0,t:0});if(!COL||typeof COL.owned!=="object")COL={owned:{},opened:0,t:0};
let RATES=lsGet(LS_RATES,null)||JSON.parse(JSON.stringify(DEF_RATES));
let DB=null,UID=null,ASSETS=null;
let colT=0;
function saveCol(){COL.t=Date.now();lsSet(LS_COL,COL);clearTimeout(colT);colT=setTimeout(()=>{if(DB&&UID)DB.doc(`data/users/${UID}/pop`).set(COL).catch(()=>{});},800);}
function saveRates(){lsSet(LS_RATES,RATES);if(DB)DB.doc("popconfig/rates").set({...RATES,t:Date.now()}).catch(()=>{});}
const nOwned=id=>COL.owned[id]||0;

/* ---------- tirage ---------- */
function pickRarity(tab){const tot=RAR.reduce((s,R)=>s+Math.max(0,+tab[R.key]||0),0);if(tot<=0)return "rare";
  let x=Math.random()*tot;for(const R of RAR){x-=Math.max(0,+tab[R.key]||0);if(x<0)return R.key;}return RAR[0].key;}
function rollPack(){
  const out=[],taken=new Set();
  for(let i=0;i<PACK_SIZE;i++){
    let rk=pickRarity(i<PACK_SIZE-1?RATES.main:RATES.last),ri=RI[rk],pool=[];
    while(ri>=0){pool=CARDS.filter(c=>c.rarity===RAR[ri].key&&!taken.has(c.id));if(pool.length)break;ri--;}
    if(!pool.length){ri=RI[rk];while(ri<RAR.length&&!pool.length){pool=CARDS.filter(c=>c.rarity===RAR[ri].key&&!taken.has(c.id));ri++;}}
    if(!pool.length)pool=CARDS.filter(c=>!taken.has(c.id));if(!pool.length)break;
    const c=pool[Math.floor(Math.random()*pool.length)];taken.add(c.id);out.push(c);
  }
  return out.sort((a,b)=>RI[a.rarity]-RI[b.rarity]);
}

/* ---------- interface ---------- */
const CSS=`
#popHub{position:fixed;inset:0;z-index:9000;background:var(--bg);color:var(--fg);display:grid;grid-template-rows:auto minmax(0,1fr);overscroll-behavior:contain}
#popHub[hidden]{display:none}
.ph-top{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;padding:calc(env(safe-area-inset-top,0px) + 10px) max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));border-bottom:1px solid var(--line);background:var(--panel)}
.ph-top h2{font-family:var(--display);font-weight:400;font-size:clamp(18px,3.2vw,24px);margin:0;letter-spacing:.02em}
.ph-top .tag{font:600 12px/1 var(--label);letter-spacing:.1em;text-transform:uppercase;padding:5px 8px;border-radius:99px;background:#5a17c4;color:#fff}
.ph-tabs{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;order:3;flex:1 1 100%}
@media (min-width:760px){.ph-tabs{order:0;flex:0 1 auto;margin-left:auto}}
.ph-x{margin-left:auto}@media (min-width:760px){.ph-x{margin-left:0}}
.ph-tabs button{flex:0 0 auto;appearance:none;border:1px solid var(--line);background:var(--field);color:var(--fg);border-radius:99px;padding:8px 14px;font:600 14px var(--ui);cursor:pointer}
.ph-tabs button[aria-selected="true"]{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.ph-x{appearance:none;border:0;background:none;color:var(--fg);font-size:26px;line-height:1;cursor:pointer;padding:4px 8px}
.ph-body{overflow:auto;-webkit-overflow-scrolling:touch}
.ph-pane{max-width:1100px;margin:0 auto;padding:18px max(16px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 40px) max(16px,env(safe-area-inset-left,0px));display:grid;gap:18px}
.ph-pane[hidden]{display:none}
.ph-note{margin:0;color:var(--muted);font-size:14px}
.ph-btn{appearance:none;border:1px solid var(--line);background:var(--field);color:var(--fg);border-radius:8px;padding:10px 14px;font:600 15px var(--ui);cursor:pointer}
.ph-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.ph-btn:disabled{opacity:.5;cursor:not-allowed}
.ph-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
/* booster */
.pb-stage{position:relative;border-radius:18px;overflow:hidden;min-height:min(78svh,720px);background:radial-gradient(circle at 50% 42%,#3a1563 0%,#12081f 70%);color:#f3eaff;display:grid;place-items:center;isolation:isolate;user-select:none;-webkit-user-select:none}
.pb-rays{position:absolute;left:50%;top:46%;width:160vmax;height:160vmax;margin:-80vmax 0 0 -80vmax;background:repeating-conic-gradient(from 0deg,var(--rc,#c799ff) 0 6deg,transparent 6deg 18deg);opacity:0;-webkit-mask-image:radial-gradient(circle,#000 0%,transparent 42%);mask-image:radial-gradient(circle,#000 0%,transparent 42%);transition:opacity .5s;animation:pbspin 18s linear infinite;pointer-events:none;z-index:0}
.pb-stage.rainbow .pb-rays{background:repeating-conic-gradient(from 0deg,#ff3b3b 0 5deg,transparent 5deg 12deg,#ffb020 12deg 17deg,transparent 17deg 24deg,#39d353 24deg 29deg,transparent 29deg 36deg,#3aa0ff 36deg 41deg,transparent 41deg 48deg,#b85cff 48deg 53deg,transparent 53deg 60deg)}
.pb-stage.lit .pb-rays{opacity:.42}
@keyframes pbspin{to{rotate:360deg}}
.pb-scene{position:relative;z-index:1;width:min(70vw,calc((min(78svh,720px) - 150px)*.57),340px);aspect-ratio:720/1268;perspective:1200px}
.pb-pack{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .7s cubic-bezier(.3,1.4,.5,1);cursor:pointer;animation:pbfloat 3s ease-in-out infinite}
.pb-pack.flipped{transform:rotateY(180deg)}
.pb-pack img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;backface-visibility:hidden;-webkit-backface-visibility:hidden;filter:drop-shadow(0 18px 30px rgba(0,0,0,.6));pointer-events:none}
.pb-pack img.back{transform:rotateY(180deg)}
.pb-pack.shake{animation:pbshake .6s linear}
.pb-pack.gone{transition:transform .5s ease-in,opacity .5s ease-in;transform:translateY(60vh) rotate(8deg);opacity:0;pointer-events:none;animation:none}
@keyframes pbfloat{50%{translate:0 -8px}}
@keyframes pbshake{0%,100%{rotate:0deg}15%{rotate:-4deg}30%{rotate:4deg}45%{rotate:-3deg}60%{rotate:3deg}75%{rotate:-1.5deg}90%{rotate:1.5deg}}
.pb-card{position:absolute;left:50%;top:50%;width:min(66vw,calc((min(78svh,720px) - 170px)*.714),330px);aspect-ratio:1060/1484;translate:-50% -54%;perspective:1400px;z-index:2;cursor:pointer}
.pb-card[hidden]{display:none}
.pb-flip{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .75s cubic-bezier(.3,1.25,.5,1)}
.pb-card.up .pb-flip{transform:rotateY(180deg)}
.pb-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:4.5%/3.2%;overflow:hidden}
.pb-face.back{background:#1b0b33 center/cover no-repeat;box-shadow:0 0 0 4px #ffd447 inset,0 16px 30px rgba(0,0,0,.5)}
.pb-face.front{transform:rotateY(180deg);border-radius:0;overflow:visible}
.pb-face.front canvas{width:100%;height:100%;display:block;filter:drop-shadow(0 0 22px var(--rc,#fff))}
.pb-card.enter{animation:pbin .45s cubic-bezier(.2,1.3,.4,1)}
@keyframes pbin{from{transform:translateY(40%) scale(.6);opacity:0}}
.pb-new{position:absolute;top:-4%;right:-4%;z-index:3;background:#ff3b6b;color:#fff;font:700 15px/1 var(--label);letter-spacing:.08em;padding:7px 10px;border-radius:99px;box-shadow:0 4px 12px rgba(0,0,0,.4);opacity:0;transition:opacity .3s .5s}
.pb-card.up .pb-new{opacity:1}
.pb-text{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 74px);text-align:center;z-index:3;font:600 16px/1.3 var(--ui);margin:0;padding:0 16px;min-height:2.6em;text-shadow:0 2px 8px rgba(0,0,0,.6)}
.pb-text b{display:block;font:400 24px/1.15 var(--display);color:var(--rc,#fff);letter-spacing:.04em;text-shadow:0 0 18px var(--rc,#fff)}
.pb-stage.rainbow .pb-text b{background:linear-gradient(90deg,#ff5a5a,#ffc23a,#53e07a,#4aa8ff,#c06bff);-webkit-background-clip:text;background-clip:text;color:transparent}
.pb-act{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);display:flex;gap:10px;justify-content:center;flex-wrap:wrap;z-index:4;padding:0 12px}
.pb-act .ph-btn{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.28);color:#fff}
.pb-act .ph-btn.primary{background:#ffd447;border-color:#ffd447;color:#2a1600}
.pb-count{position:absolute;top:12px;left:0;right:0;text-align:center;z-index:3;font:600 13px/1 var(--label);letter-spacing:.12em;text-transform:uppercase;opacity:.75}
.pb-recap{position:relative;z-index:2;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;width:min(96%,900px);padding:40px 0 110px}
.pb-recap[hidden]{display:none}
@media (max-width:640px){.pb-recap{grid-template-columns:repeat(3,minmax(0,1fr))}}
.pb-recap button{appearance:none;border:0;background:none;padding:0;cursor:pointer;position:relative;animation:pbin .4s backwards}
.pb-recap img{width:100%;aspect-ratio:1060/1484;display:block;filter:drop-shadow(0 6px 14px rgba(0,0,0,.5))}
.pb-recap .pb-new{opacity:1;font-size:11px;padding:5px 7px}
/* classeur */
.pc-head{display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr);gap:18px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px}
.pc-head img{width:100%;border-radius:10px;display:block;box-shadow:0 10px 24px rgba(40,0,80,.35)}
@media (max-width:560px){.pc-head{grid-template-columns:110px minmax(0,1fr)}}
.pc-big{font:400 clamp(26px,5vw,40px)/1 var(--display);margin:0}
.pc-bars{display:grid;gap:6px;margin-top:10px}
.pc-bar{display:grid;grid-template-columns:minmax(0,120px) minmax(0,1fr) 54px;gap:8px;align-items:center;font-size:13px}
.pc-bar i{display:block;height:8px;border-radius:99px;background:var(--field);overflow:hidden}
.pc-bar i s{display:block;height:100%;background:var(--accent);text-decoration:none}
.pc-bar span:last-child{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
.pc-chips{display:flex;gap:6px;flex-wrap:wrap}
.pc-chips button{appearance:none;border:1px solid var(--line);background:var(--field);color:var(--fg);border-radius:99px;padding:7px 12px;font:600 14px var(--ui);cursor:pointer}
.pc-chips button[aria-pressed="true"]{background:var(--fg);color:var(--bg);border-color:var(--fg)}
.pc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
@media (max-width:420px){.pc-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}}
.pc-cell{appearance:none;border:0;padding:0;background:none;cursor:pointer;position:relative;color:inherit;text-align:center}
.pc-cell img,.pb-recap img,.ps-item img{background:linear-gradient(160deg,#3a2758,#160e24);border-radius:5%/3.6%}
.pc-cell img[src],.pb-recap img[src],.ps-item img[src]{background:none}
.pc-cell img{width:100%;aspect-ratio:1060/1484;display:block}
.pc-cell .lock{width:100%;aspect-ratio:1060/1484;border-radius:8%/6%;background:repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 6px,transparent 6px 14px),linear-gradient(160deg,#2a1d3d,#120c1b);border:2px dashed rgba(160,140,200,.35);display:grid;place-content:center;gap:4px;color:#bdb3d6;font:700 15px/1.1 var(--label);letter-spacing:.06em}
.pc-cell .lock b{font:400 30px/1 var(--display);opacity:.5}
.pc-cell .cnt{position:absolute;top:4px;right:4px;background:rgba(10,6,20,.8);color:#fff;font:700 12px/1 var(--label);padding:4px 6px;border-radius:99px}
.pc-sec{font:600 13px/1 var(--label);text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:10px 0 0;grid-column:1/-1}
/* zoom */
#popZoom{position:fixed;inset:0;z-index:9100;background:rgba(6,3,12,.92);display:grid;place-items:center;padding:16px}
#popZoom[hidden]{display:none}
#popZoom canvas{width:min(92vw,calc((100svh - 120px)*.714),560px);height:auto;aspect-ratio:1060/1484;touch-action:pan-y}
#popZoom .zb{position:absolute;top:50%;translate:0 -50%;appearance:none;border:0;background:rgba(255,255,255,.12);color:#fff;width:46px;height:46px;border-radius:50%;font-size:26px;cursor:pointer}
#popZoom .zb.l{left:10px}#popZoom .zb.r{right:10px}
#popZoom .zx{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);right:12px;appearance:none;border:0;background:none;color:#fff;font-size:30px;cursor:pointer}
#popZoom .zc{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);left:0;right:0;text-align:center;color:#d8cff0;font:600 14px var(--ui)}
/* studio */
.ps-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ps-bar input,.ps-bar select,.ps-form input,.ps-form select{background:var(--field);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:9px 11px;font:500 15px var(--ui);min-width:0}
.ps-bar input{flex:1 1 200px}
.ps-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}
.ps-item{appearance:none;border:1px solid var(--line);background:var(--panel);border-radius:10px;padding:6px;cursor:pointer;color:var(--fg);display:grid;gap:4px;text-align:left;font:500 12px/1.2 var(--ui)}
.ps-item img{width:100%;aspect-ratio:1060/1484;display:block}
.ps-item small{color:var(--muted)}
.ps-item .warn{color:#c25b00;font-weight:600}
.ps-ed{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
.ps-ed[hidden]{display:none}
@media (max-width:760px){.ps-ed{grid-template-columns:minmax(0,1fr)}}
.ps-ed canvas{width:100%;max-width:420px;aspect-ratio:1060/1484;display:block;margin:0 auto;touch-action:none;cursor:grab}
.ps-form{display:grid;gap:12px;min-width:0}
.ps-form label{display:grid;gap:5px;font:600 13px/1 var(--label);text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.ps-form .two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
.ps-form input[type=range]{padding:0;accent-color:var(--accent)}
.ps-imp{display:grid;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px}
.ps-imp[hidden]{display:none}
.ps-imp textarea{width:100%;background:var(--field);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:10px;font:13px/1.4 ui-monospace,monospace;resize:vertical}
.ps-msg{min-height:1.4em;margin:0;font-size:14px}
.ps-msg.err{color:#d23b3b}.ps-msg.ok{color:#1f9a52}
/* taux */
.pt-tab{border-collapse:collapse;width:100%;max-width:640px;background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.pt-tab th,.pt-tab td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left}
.pt-tab input{width:76px;background:var(--field);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;font:500 15px var(--ui)}
.pt-dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px;vertical-align:-1px}
`;

let hub=null,tab="booster",catF="",zoomList=[],zoomI=0,zoomRaf=0;
function build(){
  const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  hub=document.createElement("div");hub.id="popHub";hub.hidden=true;hub.setAttribute("role","dialog");hub.setAttribute("aria-modal","true");hub.setAttribute("aria-label",EXT_NAME);
  hub.innerHTML=`<div class="ph-top"><h2>${EXT_NAME}</h2><span class="tag">Caché · admin</span>
    <div class="ph-tabs" role="tablist">${[["booster","Booster"],["binder","Classeur"],["studio","Studio"],["rates","Taux"]].map(([k,l])=>`<button type="button" role="tab" data-tab="${k}">${l}</button>`).join("")}</div>
    <button class="ph-x" type="button" id="phClose" aria-label="Fermer">×</button></div>
  <div class="ph-body">
    <section class="ph-pane" data-pane="booster">
      <div class="pb-stage" id="pbStage">
        <div class="pb-rays"></div><div class="pb-count" id="pbCount"></div>
        <div class="pb-scene" id="pbScene"><div class="pb-pack" id="pbPack" role="button" tabindex="0" aria-label="Ouvrir le booster">
          <img src="packs/pop-front.webp" alt=""><img class="back" src="packs/pop-back.webp" alt=""></div></div>
        <div class="pb-card" id="pbCard" hidden><div class="pb-flip"><div class="pb-face back"></div><div class="pb-face front"><canvas width="636" height="890"></canvas></div></div><span class="pb-new">NOUVELLE</span></div>
        <div class="pb-recap" id="pbRecap" hidden></div>
        <p class="pb-text" id="pbText">Touche le booster pour l'ouvrir</p>
        <div class="pb-act" id="pbAct"></div>
      </div>
      <p class="ph-note">Booster de test : 5 cartes tirées avec les taux de l'onglet « Taux ». Les cartes vont dans ta collection Pop-Culture de test (ton classeur du jeu de base n'est pas touché). Personne d'autre ne voit l'extension.</p>
    </section>
    <section class="ph-pane" data-pane="binder" hidden></section>
    <section class="ph-pane" data-pane="studio" hidden></section>
    <section class="ph-pane" data-pane="rates" hidden></section>
  </div>`;
  document.body.appendChild(hub);
  const z=document.createElement("div");z.id="popZoom";z.hidden=true;z.innerHTML=`<canvas width="1060" height="1484"></canvas><button class="zb l" type="button" aria-label="Carte précédente">‹</button><button class="zb r" type="button" aria-label="Carte suivante">›</button><button class="zx" type="button" aria-label="Fermer">×</button><div class="zc"></div>`;
  document.body.appendChild(z);
  $$(".ph-tabs button",hub).forEach(b=>b.addEventListener("click",()=>show(b.dataset.tab)));
  $("#phClose",hub).addEventListener("click",close);
  z.querySelector(".zx").addEventListener("click",zoomClose);z.querySelector(".l").addEventListener("click",()=>zoomGo(-1));z.querySelector(".r").addEventListener("click",()=>zoomGo(1));
  z.addEventListener("click",e=>{if(e.target===z)zoomClose();});
  {let sx=null;z.addEventListener("pointerdown",e=>{sx=e.clientX;});z.addEventListener("pointerup",e=>{if(sx!=null&&Math.abs(e.clientX-sx)>50)zoomGo(e.clientX<sx?1:-1);sx=null;});}
  document.addEventListener("keydown",e=>{if(hub.hidden)return;
    if(!z.hidden){if(e.key==="Escape")zoomClose();else if(e.key==="ArrowLeft")zoomGo(-1);else if(e.key==="ArrowRight")zoomGo(1);return;}
    if(e.key==="Escape")close();});
  boosterInit();
}
function open(){if(!hub)build();hub.hidden=false;document.documentElement.style.overflow="hidden";show(tab);}
function close(){hub.hidden=true;document.documentElement.style.overflow="";zoomClose();}
function show(t){tab=t;$$(".ph-tabs button",hub).forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===t));
  $$(".ph-pane",hub).forEach(p=>p.hidden=p.dataset.pane!==t);
  if(t==="binder")renderBinder();else if(t==="studio")renderStudio();else if(t==="rates")renderRates();else boosterIdle();}
let artT=0;
function onArt(){clearTimeout(artT);artT=setTimeout(()=>{if(!hub||hub.hidden)return;if(tab==="binder")renderBinder(true);else if(tab==="studio"){renderList();edPaint();}},150);}

/* ----- booster ----- */
let pb=null;
function boosterInit(){
  const pack=$("#pbPack"),card=$("#pbCard");
  card.querySelector(".back").style.backgroundImage="url(packs/pop-cover.webp)";
  pack.addEventListener("click",e=>{if(pb&&pb.phase==="pack")tear();});
  pack.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();if(pb&&pb.phase==="pack")tear();}});
  card.addEventListener("click",()=>{if(!pb)return;if(pb.phase==="card"&&!pb.up)flipUp();else if(pb.phase==="card")nextCard();});
}
function setAct(btns){const a=$("#pbAct");a.innerHTML="";btns.forEach(([l,f,p])=>{const b=document.createElement("button");b.type="button";b.className="ph-btn"+(p?" primary":"");b.textContent=l;b.addEventListener("click",f);a.appendChild(b);});}
function setRc(R){const s=$("#pbStage");s.style.setProperty("--rc",R?(R.rainbow?"#ffffff":R.b):"#c799ff");s.classList.toggle("rainbow",!!(R&&R.rainbow));}
function boosterIdle(){
  if(pb&&pb.phase!=="pack"&&pb.phase!=="done")return;
  cancelAnimationFrame(pbRaf);
  pb={phase:"pack",cards:[],i:0,up:false};
  const pack=$("#pbPack");pack.className="pb-pack";$("#pbScene").hidden=false;$("#pbCard").hidden=true;$("#pbRecap").hidden=true;
  $("#pbStage").classList.remove("lit");setRc(null);
  $("#pbText").textContent=CARDS.length?"Touche le booster pour l'ouvrir":"Aucune carte dans l'extension pour le moment.";
  $("#pbCount").textContent=`${COL.opened||0} booster${(COL.opened||0)>1?"s":""} ouvert${(COL.opened||0)>1?"s":""} · ${Object.keys(COL.owned).filter(id=>cardById(id)).length}/${CARDS.length} cartes`;
  setAct([["Retourner le booster",()=>$("#pbPack").classList.toggle("flipped")],["Ouvrir",()=>{if(pb.phase==="pack")tear();},true]]);
}
function tear(){
  if(!CARDS.length)return;
  const cards=rollPack();pb.cards=cards.map(c=>({c,fresh:!nOwned(c.id)}));
  cards.forEach(c=>{COL.owned[c.id]=nOwned(c.id)+1;});COL.opened=(COL.opened||0)+1;saveCol();
  pb.phase="tearing";setAct([]);$("#pbText").textContent="";
  const pack=$("#pbPack");pack.classList.remove("flipped");pack.classList.add("shake");
  setTimeout(()=>{pack.classList.add("gone");setTimeout(()=>{$("#pbScene").hidden=true;pb.i=0;showCard();},reduce?0:420);},reduce?0:600);
}
let pbRaf=0;
function showCard(){
  const e=pb.cards[pb.i];if(!e){return recap();}
  pb.phase="card";pb.up=false;const card=$("#pbCard");card.hidden=false;card.classList.remove("up","enter");void card.offsetWidth;card.classList.add("enter");
  card.querySelector(".pb-new").style.display=e.fresh?"":"none";
  $("#pbStage").classList.remove("lit");setRc(null);
  $("#pbCount").textContent=`Carte ${pb.i+1} / ${pb.cards.length}`;
  $("#pbText").textContent="Touche la carte pour la retourner";
  const cv=card.querySelector("canvas");cancelAnimationFrame(pbRaf);draw(cv,e.c,{phase:0});
  setAct([["Tout révéler",revealAll]]);
}
function flipUp(){
  const e=pb.cards[pb.i];pb.up=true;const card=$("#pbCard");card.classList.add("up");
  const R=e.c.R;setTimeout(()=>{setRc(R);$("#pbStage").classList.add("lit");},reduce?0:280);
  const t=$("#pbText");t.innerHTML="";const b=document.createElement("b");b.textContent=R.name;t.append(b,document.createTextNode(e.c.name+(e.fresh?" · nouvelle !":` · ×${nOwned(e.c.id)}`)));
  const cv=card.querySelector("canvas");cancelAnimationFrame(pbRaf);
  if((R.sheen||R.rainbow)&&!reduce){const t0=performance.now();const loop=()=>{draw(cv,e.c,{phase:((performance.now()-t0)/40)%360,fx:true});pbRaf=requestAnimationFrame(loop);};loop();}
  else draw(cv,e.c,{fx:true});
  setAct([[pb.i<pb.cards.length-1?"Carte suivante":"Voir le récap",nextCard,true]]);
}
function nextCard(){cancelAnimationFrame(pbRaf);pb.i++;if(pb.i>=pb.cards.length)recap();else showCard();}
function revealAll(){cancelAnimationFrame(pbRaf);recap();}
function recap(){
  pb.phase="done";cancelAnimationFrame(pbRaf);$("#pbCard").hidden=true;$("#pbScene").hidden=true;
  const best=pb.cards.reduce((m,e)=>RI[e.c.rarity]>RI[m.c.rarity]?e:m,pb.cards[0]);setRc(best&&best.c.R);$("#pbStage").classList.add("lit");
  $("#pbCount").textContent="Récap du booster";$("#pbText").textContent="";
  const rc=$("#pbRecap");rc.hidden=false;rc.innerHTML="";
  pb.cards.forEach((e,i)=>{const b=document.createElement("button");b.type="button";b.style.animationDelay=(i*.08)+"s";b.setAttribute("aria-label",e.c.name+", "+e.c.R.name);
    const im=document.createElement("img");im.alt="";b.appendChild(im);if(e.fresh){const n=document.createElement("span");n.className="pb-new";n.textContent="NOUVELLE";b.appendChild(n);}
    thumbURL(e.c).then(u=>{im.src=u;});b.addEventListener("click",()=>zoomOpen(pb.cards.map(x=>x.c),i));rc.appendChild(b);});
  setAct([["Voir le classeur",()=>show("binder")],["Ouvrir un autre booster",()=>{pb.phase="done";boosterIdle();},true]]);
}

/* ----- classeur ----- */
let binderSig="";
function renderBinder(soft){
  const pane=$('[data-pane="binder"]',hub);
  const owned=CARDS.filter(c=>nOwned(c.id));
  const sig=CARDS.length+"|"+catF+"|"+JSON.stringify(COL.owned);
  if(soft&&sig===binderSig){$$("img[data-id]",pane).forEach(im=>{const c=cardById(im.dataset.id);if(c)lazy(im,c);});return;}
  binderSig=sig;
  const bars=[["Toutes",CARDS],...CATS.map(k=>[k,CARDS.filter(c=>c.cat===k)])].map(([k,l])=>{const n=l.filter(c=>nOwned(c.id)).length;
    return `<div class="pc-bar"><span>${k==="Toutes"?"<b>Total</b>":CAT_ICO[k]+" "+esc(k)}</span><i><s style="width:${l.length?n/l.length*100:0}%"></s></i><span>${n}/${l.length}</span></div>`;}).join("");
  const list=CARDS.filter(c=>!catF||c.cat===catF);
  let html=`<div class="pc-head"><img src="packs/pop-cover.webp" alt="Couverture du classeur ${EXT_NAME}"><div><p class="pc-big">${owned.length} / ${CARDS.length}</p><p class="ph-note">cartes de l'extension dans ta collection de test</p><div class="pc-bars">${bars}</div></div></div>
    <div class="pc-chips">${[["","Tout"],...CATS.map(k=>[k,CAT_ICO[k]+" "+k])].map(([k,l])=>`<button type="button" data-cat="${esc(k)}" aria-pressed="${catF===k}">${esc(l)}</button>`).join("")}</div>
    <div class="pc-grid">`;
  let last="";
  list.forEach(c=>{if(!catF&&c.cat!==last){last=c.cat;html+=`<p class="pc-sec">${CAT_ICO[c.cat]} ${esc(c.cat)}</p>`;}
    const n=nOwned(c.id);
    html+=n?`<button class="pc-cell" type="button" data-z="${c.id}" aria-label="${esc(c.name)}"><img data-id="${c.id}" alt="">${n>1?`<span class="cnt">×${n}</span>`:""}</button>`
           :`<div class="pc-cell" aria-label="Carte ${c.id} non obtenue"><div class="lock"><b>?</b>${c.id}</div></div>`;});
  html+=`</div><div class="ph-row"><button class="ph-btn" type="button" id="pcAll">Tout débloquer (test)</button><button class="ph-btn" type="button" id="pcReset">Vider ma collection Pop-Culture</button></div>
    <p class="ph-note">Le classeur de l'extension est séparé du classeur du jeu de base.</p>`;
  pane.innerHTML=html;
  $$(".pc-chips button",pane).forEach(b=>b.addEventListener("click",()=>{catF=b.dataset.cat;renderBinder();}));
  $$("img[data-id]",pane).forEach(im=>lazy(im,cardById(im.dataset.id)));
  $$("[data-z]",pane).forEach(b=>b.addEventListener("click",()=>{const l=list.filter(c=>nOwned(c.id));zoomOpen(l,l.findIndex(c=>c.id===b.dataset.z));}));
  $("#pcAll",pane).addEventListener("click",()=>{CARDS.forEach(c=>{if(!nOwned(c.id))COL.owned[c.id]=1;});saveCol();renderBinder();});
  const rs=$("#pcReset",pane);rs.addEventListener("click",()=>{if(rs.dataset.sure){COL={owned:{},opened:0,t:0};saveCol();renderBinder();return;}rs.dataset.sure=1;rs.textContent="Confirmer : tout vider ?";setTimeout(()=>{if(rs.isConnected){delete rs.dataset.sure;rs.textContent="Vider ma collection Pop-Culture";}},4000);});
}

/* ----- zoom ----- */
function zoomOpen(list,i){zoomList=list;zoomI=Math.max(0,i);$("#popZoom").hidden=false;zoomPaint();}
function zoomClose(){const z=$("#popZoom");if(z)z.hidden=true;cancelAnimationFrame(zoomRaf);}
function zoomGo(d){if(zoomList.length<2)return;zoomI=(zoomI+d+zoomList.length)%zoomList.length;zoomPaint();}
function zoomPaint(){
  const z=$("#popZoom"),cv=z.querySelector("canvas"),c=zoomList[zoomI];if(!c)return;cancelAnimationFrame(zoomRaf);
  const R=c.R;z.querySelector(".zc").textContent=`${c.name} · ${R.name} · ${zoomI+1}/${zoomList.length}`;
  z.querySelectorAll(".zb").forEach(b=>b.hidden=zoomList.length<2);
  if((R.sheen||R.rainbow)&&!reduce){const t0=performance.now();const loop=()=>{draw(cv,c,{phase:((performance.now()-t0)/40)%360,fx:true});zoomRaf=requestAnimationFrame(loop);};loop();}
  else draw(cv,c,{fx:true});
}

/* ----- studio ----- */
let sQ="",sCat="",sRar="",sImg="",sPote="",ed=null;
function renderStudio(){
  const pane=$('[data-pane="studio"]',hub);
  if(!pane.dataset.built){pane.dataset.built=1;
    pane.innerHTML=`<p class="ph-note">Ajoute l'illustration de chaque carte et règle son cadrage. Le nom, l'œuvre (sous-titre) et la rareté s'affichent en bas de la carte. Les cartes de départ viennent de l'onglet « Extension 1 » du Google Sheet.</p>
    <div class="ps-ed" id="psEd" hidden></div>
    <div class="ps-bar"><input type="search" id="psQ" placeholder="Chercher un nom, une œuvre, un pote…" aria-label="Chercher">
      <select id="psCat" aria-label="Catégorie"><option value="">Toutes les catégories</option>${CATS.map(k=>`<option>${esc(k)}</option>`).join("")}</select>
      <select id="psRar" aria-label="Rareté"><option value="">Toutes les raretés</option>${RAR.map(R=>`<option value="${R.key}">${R.name}</option>`).join("")}<option value="todo">Rareté à définir</option></select>
      <select id="psPote" aria-label="Pote incarné"><option value="">Tous les potes</option>${POTES.map(([pr,ps])=>`<option value="${esc(pr)}">${esc(ps)}${ps!==pr?` (${esc(pr)})`:""}</option>`).join("")}</select>
      <select id="psImg" aria-label="Illustration"><option value="">Avec ou sans image</option><option value="no">Sans image</option><option value="yes">Avec image</option></select>
      <button class="ph-btn primary" type="button" id="psNew">+ Nouvelle carte</button><button class="ph-btn" type="button" id="psImp">📋 Importer du Google Sheet</button></div>
    <div class="ps-imp" id="psImpBox" hidden>
      <p class="ph-note">Dans l'onglet « Extension 1 », sélectionne les colonnes A à H (de « N° » à « Statut »), copie (Ctrl+C) puis colle ici. Les noms, œuvres, catégories, prénoms et raretés remplis sont mis à jour ; les illustrations et cadrages déjà faits sont gardés. Une ligne sans N° reçoit le numéro suivant.</p>
      <textarea id="psImpTxt" rows="6" placeholder="Colle ici les lignes copiées du Google Sheet"></textarea>
      <div class="ph-row"><button class="ph-btn primary" type="button" id="psImpGo">Importer</button><button class="ph-btn" type="button" id="psImpX">Fermer</button></div>
      <p class="ps-msg" id="psImpMsg" role="status"></p>
    </div>
    <p class="ph-note" id="psCount"></p>
    <div class="ps-list" id="psList"></div>`;
    $("#psQ").addEventListener("input",e=>{sQ=e.target.value;renderList();});
    $("#psCat").addEventListener("change",e=>{sCat=e.target.value;renderList();});
    $("#psRar").addEventListener("change",e=>{sRar=e.target.value;renderList();});
    $("#psImg").addEventListener("change",e=>{sImg=e.target.value;renderList();});
    $("#psPote").addEventListener("change",e=>{sPote=e.target.value;renderList();});
    $("#psImp").addEventListener("click",()=>{const x=$("#psImpBox");x.hidden=!x.hidden;if(!x.hidden)$("#psImpTxt").focus();});
    $("#psImpX").addEventListener("click",()=>{$("#psImpBox").hidden=true;});
    $("#psImpGo").addEventListener("click",importSheet);
    $("#psNew").addEventListener("click",()=>{const n=Math.max(0,...CARDS.map(c=>+(c.id.match(/\d+$/)||[0])[0]),...SEED.map(c=>+(c.id.match(/\d+$/)||[0])[0]))+1;
      edit({id:"PC-"+String(n).padStart(3,"0"),cat:sCat||CATS[0],sub:"",perso:"",name:"",pote:sPote,rarity:"rare",custom:true,isNew:true});});
  }
  renderList();
}
const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
function renderList(){
  const box=$("#psList");if(!box)return;
  const q=norm(sQ);
  const list=CARDS.filter(c=>(!sCat||c.cat===sCat)&&(!sRar||(sRar==="todo"?c.todo:c.rarity===sRar&&!c.todo))&&(!sImg||(sImg==="yes")===!!c.asset)&&(!sPote||c.pote===sPote)
    &&(!q||norm([c.id,c.name,c.sub,c.perso,c.pote,PSEUDO[c.pote]].join(" ")).includes(q)));
  $("#psCount").textContent=`${list.length} carte${list.length>1?"s":""} · ${CARDS.filter(c=>c.asset).length}/${CARDS.length} avec illustration · ${CARDS.filter(c=>c.todo).length} rareté${CARDS.filter(c=>c.todo).length>1?"s":""} à définir`;
  const have=new Map($$(".ps-item",box).map(b=>[b.dataset.id,b]));
  box.innerHTML="";
  list.forEach(c=>{let b=have.get(c.id);
    if(!b){b=document.createElement("button");b.type="button";b.className="ps-item";b.dataset.id=c.id;b.innerHTML=`<img alt=""><span></span><small></small>`;
      b.addEventListener("click",()=>edit(cardById(b.dataset.id)));}
    b.querySelector("span").textContent=c.name;
    b.querySelector("small").innerHTML=`${esc(c.id)} · ${esc(c.R.name)}${c.todo?' <span class="warn">à définir</span>':""}${c.asset?"":' · <span class="warn">sans image</span>'}`;
    box.appendChild(b);lazy(b.querySelector("img"),c);});
}
function edit(c){
  if(!c)return;ed={...c,file:null,localImg:null,R:RAR[RI[c.rarity]]};
  const box=$("#psEd");box.hidden=false;
  box.innerHTML=`<canvas width="636" height="890" aria-label="Aperçu de la carte (glisse l'image pour la recadrer)"></canvas>
  <div class="ps-form">
    <label>Nom de la carte<input id="peName" maxlength="40" value="${esc(ed.name)}"></label>
    <label>Œuvre / sous-titre<input id="peSub" maxlength="50" value="${esc(ed.sub)}" placeholder="Ex. : Star Wars"></label>
    <div class="two"><label>Catégorie<select id="peCat">${CATS.map(k=>`<option ${k===ed.cat?"selected":""}>${esc(k)}</option>`).join("")}</select></label>
      <label>Rareté<select id="peRar">${RAR.map(R=>`<option value="${R.key}" ${R.key===ed.rarity?"selected":""}>${R.name}</option>`).join("")}</select></label></div>
    <div class="two"><label>Pote incarné<select id="pePote"><option value="">— Aucun —</option>${POTES.map(([p,ps])=>`<option value="${esc(p)}" ${p===ed.pote?"selected":""}>${esc(ps)}${p!==ps&&p!=="Groupe"?" ("+esc(p)+")":""}</option>`).join("")}</select></label>
      <label>Personnage<input id="pePerso" maxlength="60" value="${esc(ed.perso||"")}"></label></div>
    <label>Illustration<input type="file" id="peFile" accept="image/*"></label>
    <label>Zoom <input type="range" id="peZoom" min="40" max="400" value="${Math.round((ed.zoom||1)*100)}"></label>
    <div class="ph-row"><button class="ph-btn" type="button" id="peFill">Remplir</button><button class="ph-btn" type="button" id="peFit">Image entière</button></div>
    <p class="ph-note">Glisse l'image sur l'aperçu pour la recadrer, molette ou curseur pour zoomer. Tu peux aussi coller une image (Ctrl+V).</p>
    <div class="ph-row"><button class="ph-btn primary" type="button" id="peSave">Enregistrer</button><button class="ph-btn" type="button" id="peCancel">Fermer</button>${ed.isNew?"":`<button class="ph-btn" type="button" id="peDel">Supprimer la carte</button>`}</div>
    <p class="ps-msg" id="peMsg" role="status">${ed.todo?"Rareté pas encore choisie dans le Google Sheet : « Rare » par défaut.":""}</p>
  </div>`;
  const f=k=>$("#pe"+k);
  const sync=()=>{ed.name=f("Name").value;ed.sub=f("Sub").value;ed.cat=f("Cat").value;ed.rarity=f("Rar").value;ed.R=RAR[RI[ed.rarity]];ed.pote=f("Pote").value;ed.perso=f("Perso").value;edPaint();};
  ["Name","Sub","Perso"].forEach(k=>f(k).addEventListener("input",sync));["Cat","Rar","Pote"].forEach(k=>f(k).addEventListener("change",sync));
  f("File").addEventListener("change",e=>loadFile(e.target.files[0]));
  f("Zoom").addEventListener("input",e=>{ed.zoom=+e.target.value/100;clampPan();edPaint();});
  f("Fill").addEventListener("click",()=>{ed.zoom=1;ed.fx=ed.fy=0;f("Zoom").value=100;edPaint();});
  f("Fit").addEventListener("click",()=>{const im=edImg();if(!ok(im))return;const z=Math.min(ART.w/im.naturalWidth,ART.h/im.naturalHeight)/Math.max(ART.w/im.naturalWidth,ART.h/im.naturalHeight);ed.zoom=z;ed.fx=ed.fy=0;f("Zoom").value=Math.round(z*100);edPaint();});
  f("Save").addEventListener("click",saveEdit);f("Cancel").addEventListener("click",()=>{box.hidden=true;ed=null;});
  const del=f("Del");if(del)del.addEventListener("click",()=>{if(!del.dataset.sure){del.dataset.sure=1;del.textContent="Confirmer la suppression";return;}removeCard();});
  const cv=box.querySelector("canvas");let drag=null;
  cv.addEventListener("pointerdown",e=>{if(!ok(edImg()))return;cv.setPointerCapture(e.pointerId);const r=cv.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,fx:ed.fx||0,fy:ed.fy||0,k:W/r.width};});
  cv.addEventListener("pointermove",e=>{if(!drag)return;ed.fx=drag.fx+(e.clientX-drag.x)*drag.k/ART.w;ed.fy=drag.fy+(e.clientY-drag.y)*drag.k/ART.h;clampPan();edPaint();});
  const end=()=>{drag=null;};cv.addEventListener("pointerup",end);cv.addEventListener("pointercancel",end);
  cv.addEventListener("wheel",e=>{if(!ok(edImg()))return;e.preventDefault();ed.zoom=Math.min(4,Math.max(.4,(ed.zoom||1)-Math.sign(e.deltaY)*.06));f("Zoom").value=Math.round(ed.zoom*100);clampPan();edPaint();},{passive:false});
  edPaint();box.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});
}
document.addEventListener("paste",e=>{if(!ed||!hub||hub.hidden||tab!=="studio")return;const it=[...(e.clipboardData&&e.clipboardData.items||[])].find(x=>x.type.startsWith("image/"));if(it){e.preventDefault();loadFile(it.getAsFile());}});
const edImg=()=>ed&&(ed.localImg||ed.img);
function clampPan(){const im=edImg();if(!ok(im))return;const {dw,dh}=imgSize(im,ed.zoom||1);const mx=Math.max(0,(dw-ART.w)/2)/ART.w,my=Math.max(0,(dh-ART.h)/2)/ART.h;
  ed.fx=Math.min(mx,Math.max(-mx,ed.fx||0));ed.fy=Math.min(my,Math.max(-my,ed.fy||0));}
function edPaint(){if(!ed)return;const cv=$("#psEd canvas");if(!cv)return;draw(cv,{...ed,img:edImg()},{});}
function msg(t,k){const m=$("#peMsg");if(m){m.textContent=t;m.className="ps-msg"+(k?" "+k:"");}}
function loadFile(file){if(!file||!/^image\//.test(file.type)){msg("Ce fichier n'est pas une image.","err");return;}
  const im=new Image();im.onload=()=>{ed.localImg=im;ed.file=file;ed.zoom=1;ed.fx=ed.fy=0;$("#peZoom").value=100;msg("Image prête : règle le cadrage puis enregistre.");edPaint();};
  im.onerror=()=>msg("Impossible de lire cette image.","err");im.src=URL.createObjectURL(file);}
/* l'image est réduite avant l'envoi (1500 px de haut au plus) : moins de stockage, chargement plus rapide */
function shrink(im){return new Promise(res=>{const k=Math.min(1,1500/im.naturalHeight,1500/im.naturalWidth),w=Math.round(im.naturalWidth*k),h=Math.round(im.naturalHeight*k);
  const cv=document.createElement("canvas");cv.width=w;cv.height=h;cv.getContext("2d").drawImage(im,0,0,w,h);cv.toBlob(b=>res(b),"image/webp",.9);});}
async function saveEdit(){
  if(!ed)return;const name=(ed.name||"").trim();if(!name){msg("Donne un nom à la carte.","err");return;}
  const btn=$("#peSave");btn.disabled=true;msg("Enregistrement…");
  try{
    if(!DB)throw new Error("connexion");
    let asset=ed.asset||null;
    if(ed.localImg){if(!ASSETS)throw new Error("envoi d'images réservé à l'admin");const blob=await shrink(ed.localImg);const r=await ASSETS.upload(blob);asset=r.id;
      IMGS.set(asset,ed.localImg);}
    const data={name,sub:(ed.sub||"").trim(),cat:ed.cat,rarity:ed.rarity,pote:ed.pote||"",perso:(ed.perso||"").trim(),asset,zoom:+(ed.zoom||1).toFixed(3),fx:+(ed.fx||0).toFixed(4),fy:+(ed.fy||0).toFixed(4),t:Date.now()};
    await DB.doc("popcards/"+ed.id).set(data);
    EDITS[ed.id]=data;rebuild();THUMBS.delete(ed.id);
    ed={...cardById(ed.id),file:null,localImg:null};ed.isNew=false;msg("Carte enregistrée.","ok");renderList();edPaint();
  }catch(e){msg("Enregistrement impossible : "+String(e&&e.message||e),"err");}
  btn.disabled=false;
}
async function removeCard(){
  try{const isSeed=SEED.some(s=>s.id===ed.id);
    if(isSeed){await DB.doc("popcards/"+ed.id).set({del:true,t:Date.now()});EDITS[ed.id]={del:true};}
    else{await DB.doc("popcards/"+ed.id).delete();delete EDITS[ed.id];}
    rebuild();$("#psEd").hidden=true;ed=null;renderList();
  }catch(e){msg("Suppression impossible : "+String(e&&e.message||e),"err");}
}

/* import : lignes copiées depuis le Google Sheet (colonnes A à H, séparées par des tabulations) */
const catOf=t=>{const n=norm(t).replace(/s$/,"");return CATS.find(k=>norm(k).replace(/s$/,"")===n)||(/jeu/.test(n)?"Jeux vidéo":/film|serie/.test(n)?"Film / Série":/bd|manga/.test(n)?"BD / Manga":/anim/.test(n)?"Animé":"");};
async function importSheet(){
  const out=$("#psImpMsg"),say=(t,k)=>{out.textContent=t;out.className="ps-msg"+(k?" "+k:"");};
  const rows=$("#psImpTxt").value.split(/\r?\n/).map(l=>l.split("\t").map(x=>x.trim())).filter(r=>r.length>=4&&r.some(Boolean));
  if(!rows.length){say("Rien à importer : colle des lignes copiées du Google Sheet (colonnes A à H).","err");return;}
  if(!DB){say("Connexion impossible pour le moment.","err");return;}
  let next=Math.max(0,...CARDS.map(c=>+(c.id.match(/\d+$/)||[0])[0]),...SEED.map(c=>+(c.id.match(/\d+$/)||[0])[0]));
  const todo=[],noNum=[];let same=0,skip=0;
  rows.forEach(r=>{let [num,cat,sub,nom,rar,perso,pote]=r;if(/^n°?$/i.test(num)||norm(cat)==="categorie"){return;}
    const name=(nom||perso||"").trim();if(!name){skip++;return;}
    let id=/^PC-\d+$/i.test(num)?num.toUpperCase():"";if(!id){next++;id="PC-"+String(next).padStart(3,"0");noNum.push(id+" : "+name);}
    const rk=rar?RNAME[norm(rar)]:"";const cur=cardById(id)||SEED.find(x=>x.id===id)||{};
    const data={...(EDITS[id]||{}),name,sub:sub||"",cat:catOf(cat)||cur.cat||CATS[0],perso:perso||"",pote:pote||""};
    if(rk)data.rarity=rk;else if(EDITS[id]&&EDITS[id].rarity)data.rarity=EDITS[id].rarity;
    delete data.del;
    const cmp=k=>(cur[k]||"")===(data[k]||"");
    if(cur.id&&!cur.del&&["name","sub","cat","perso","pote"].every(cmp)&&(!rk||cur.rarity===rk)&&!(EDITS[id]&&EDITS[id].del)){same++;return;}
    todo.push([id,{...data,t:Date.now()}]);});
  const btn=$("#psImpGo");btn.disabled=true;let done=0,fail=0;
  for(const [id,data] of todo){try{await DB.doc("popcards/"+id).set(data);EDITS[id]=data;done++;}catch(e){fail++;}if((done+fail)%10===0)say(`Import… ${done+fail}/${todo.length}`);}
  btn.disabled=false;rebuild();THUMBS.clear();renderList();
  say(`${done} carte${done>1?"s":""} ajoutée${done>1?"s":""} ou mise${done>1?"s":""} à jour, ${same} déjà à jour${skip?`, ${skip} ligne${skip>1?"s":""} sans nom ignorée${skip>1?"s":""}`:""}${fail?`, ${fail} échec${fail>1?"s":""}`:""}.`+(noNum.length?` Lignes sans N° : pense à écrire ces numéros dans le Google Sheet → ${noNum.join(" ; ")}`:""),fail?"err":"ok");
}

/* ----- taux ----- */
function renderRates(){
  const pane=$('[data-pane="rates"]',hub);
  const tot=t=>RAR.reduce((s,R)=>s+Math.max(0,+t[R.key]||0),0);
  const cnt=k=>CARDS.filter(c=>c.rarity===k).length;
  pane.innerHTML=`<p class="ph-note">Taux provisoires pour tester. Chaque booster contient ${PACK_SIZE} cartes : les cartes 1 à 4 utilisent la première colonne, la carte 5 la seconde. Les nombres sont des poids : ils n'ont pas besoin de faire 100. Si une rareté n'a encore aucune carte, le tirage prend la rareté juste en dessous.</p>
  <table class="pt-tab"><thead><tr><th>Rareté</th><th>Cartes</th><th>Cartes 1 à 4</th><th>Carte 5</th></tr></thead><tbody>
  ${RAR.map(R=>`<tr><td><span class="pt-dot" style="background:${R.rainbow?"conic-gradient(red,orange,yellow,lime,cyan,blue,violet,red)":R.a}"></span>${R.name}</td><td>${cnt(R.key)}</td>
    <td><input type="number" min="0" step="0.5" data-g="main" data-k="${R.key}" value="${+RATES.main[R.key]||0}"> <small data-p="main-${R.key}"></small></td>
    <td><input type="number" min="0" step="0.5" data-g="last" data-k="${R.key}" value="${+RATES.last[R.key]||0}"> <small data-p="last-${R.key}"></small></td></tr>`).join("")}
  </tbody></table>
  <div class="ph-row"><button class="ph-btn" type="button" id="ptReset">Revenir aux taux de départ</button><button class="ph-btn" type="button" id="ptSim">Simuler 100 boosters</button></div>
  <p class="ph-note" id="ptOut"></p>`;
  const pct=()=>["main","last"].forEach(g=>{const t=tot(RATES[g]);RAR.forEach(R=>{const el=pane.querySelector(`[data-p="${g}-${R.key}"]`);el.textContent=t?Math.round((+RATES[g][R.key]||0)/t*1000)/10+" %":"";});});pct();
  $$("input[data-g]",pane).forEach(i=>i.addEventListener("input",()=>{RATES[i.dataset.g][i.dataset.k]=Math.max(0,+i.value||0);pct();saveRates();}));
  $("#ptReset",pane).addEventListener("click",()=>{RATES=JSON.parse(JSON.stringify(DEF_RATES));saveRates();renderRates();});
  $("#ptSim",pane).addEventListener("click",()=>{const by={};for(let i=0;i<100;i++)rollPack().forEach(c=>by[c.rarity]=(by[c.rarity]||0)+1);
    $("#ptOut",pane).textContent="Sur 100 boosters (sans rien ajouter à ta collection) : "+RAR.map(R=>`${R.name} ${by[R.key]||0}`).join(" · ");});
}

/* ---------- démarrage : admin seulement ---------- */
async function boot(){
  if(!window.claude||!window.claude.use)return;
  let user=null;try{user=await window.claude.use("user");}catch(e){}
  let admin=false;try{admin=user?await user.isOwner():false;}catch(e){}
  if(!admin)return;
  try{ASSETS=await window.claude.use("assets");}catch(e){}
  try{DB=await window.claude.use("db");}catch(e){}
  try{UID=user?await user.id():null;}catch(e){}
  rebuild();loadStatic();
  // bouton d'accès dans la barre admin
  const bar=document.querySelector(".adminbar");
  if(bar&&!document.getElementById("popBtn")){const b=document.createElement("button");b.className="btn";b.id="popBtn";b.type="button";b.textContent="🍿 Extension Pop-Culture";b.addEventListener("click",open);bar.appendChild(b);}
  if(!DB)return;
  DB.collection("popcards").onSnapshot(snap=>{const e={};snap.docs.forEach(d=>{const v=d.data();if(v&&typeof v==="object")e[d.id]=v;});EDITS=e;rebuild();THUMBS.clear();
    if(hub&&!hub.hidden){if(tab==="studio")renderList();else if(tab==="binder")renderBinder();}},()=>{});
  try{const s=await DB.doc("popconfig/rates").get();const v=s.exists&&s.data();if(v&&v.main&&v.last&&!lsGet(LS_RATES,null)){RATES={main:v.main,last:v.last};lsSet(LS_RATES,RATES);}}catch(e){}
  if(UID){try{const s=await DB.doc(`data/users/${UID}/pop`).get();const v=s.exists&&s.data();if(v&&v.owned&&(+v.t||0)>(+COL.t||0)){COL={owned:v.owned,opened:+v.opened||0,t:+v.t||0};lsSet(LS_COL,COL);}}catch(e){}}
}
window.MF_POP={open,draw:(cv,id,o)=>{const c=cardById(id);if(c)draw(cv,c,o);},cards:()=>CARDS,seed:SEED};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

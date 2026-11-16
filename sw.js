/* Monkey Family : fonctionnement hors ligne de l'appli (les images sont mises en cache par la page elle-même) */
const VERSION="mf-20261116143057";
const SHELL=["./","index.html","config.js","cloud.js","admin.js","lib/gsap.min.js","lib/three.min.js","lib/supabase.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("mf-")&&k!==VERSION&&k!=="mf-media-v1").map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin)return; // Supabase, polices : réseau normal
  // page et scripts : le réseau d'abord (mises à jour immédiates), le cache si hors ligne
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(VERSION).then(x=>x.put(e.request,c));}return r;})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match("index.html"))));
});
